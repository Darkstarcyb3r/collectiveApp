// DashboardScreen — Main home screen / app dashboard
// Combines Private Groups + Public Network sections into one scrollable view
// Replaces the old ProfileScreen home tab, Groups tab, and Everyone tab


import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  AppState,
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  ScrollView,
  Image,
  RefreshControl,
  Alert,
  Animated,
  Easing,
  Vibration,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../../theme';
import { fonts } from '../../theme/typography';
import { useAuth } from '../../contexts/AuthContext';
import { useTabBar } from '../../contexts/TabBarContext';
import { getUserGroups, deleteGroup, leaveGroup, getMemberProfiles, getPublicGroups, joinGroup } from '../../services/groupService';
import { updateUserProfile } from '../../services/userService';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import {
  subscribeToActiveRooms,
  subscribeToConfluencePosts,
  subscribeToEvents,
  subscribeToNetworkUsers,
} from '../../services/everyoneService';
import { buildConnectedUserIds } from '../../utils/networkGraph';
import {
  subscribeToNotifications,
  markAllNotificationsRead,
} from '../../services/notificationHistoryService';
import { subscribeToConversations } from '../../services/messageService';
import { NotificationListModal } from '../../components/notifications';
import { ConfirmModal } from '../../components/common';
import { firestore, functions } from '../../config/firebase';
import * as Notifications from 'expo-notifications';
import * as Haptics from 'expo-haptics';
import { playClick, playSwoosh } from '../../services/soundService';

const MAX_GROUPS = 50;          // max groups any user can create/join
const MAX_PUBLIC_GROUPS = 100; // max public groups shown on dashboard

const EVENT_THUMBNAILS = [
  require('../../assets/event-thumbnails/Galaxy.png'),
  require('../../assets/event-thumbnails/Green.png'),
  require('../../assets/event-thumbnails/Lavendar.png'),
  require('../../assets/event-thumbnails/Orange.png'),
  require('../../assets/event-thumbnails/Red.png'),
];
const PLACEHOLDER_MAP = {
  thumb1: require('../../assets/event-thumbnails/Galaxy.png'),
  thumb2: require('../../assets/event-thumbnails/Green.png'),
  thumb3: require('../../assets/event-thumbnails/Lavendar.png'),
  thumb4: require('../../assets/event-thumbnails/Orange.png'),
  thumb5: require('../../assets/event-thumbnails/Red.png'),
};
const getEventThumbnail = (eventId) => {
  let hash = 0;
  for (let i = 0; i < eventId.length; i++) {
    hash = ((hash << 5) - hash) + eventId.charCodeAt(i);
    hash |= 0;
  }
  return EVENT_THUMBNAILS[Math.abs(hash) % EVENT_THUMBNAILS.length];
};
const getEventImageSource = (imageUrl, eventId) => {
  if (imageUrl && imageUrl.startsWith('placeholder:')) {
    const thumbId = imageUrl.replace('placeholder:', '');
    return PLACEHOLDER_MAP[thumbId] || getEventThumbnail(eventId);
  }
  if (imageUrl) return { uri: imageUrl };
  return getEventThumbnail(eventId);
};

// Skeleton shimmer bar for loading placeholders
const SkeletonBar = ({ width = '100%', height = 12, style, delay = 0 }) => {
  const shimmer = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(shimmer, { toValue: 1, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <Animated.View style={[{ width, height, borderRadius: 6, backgroundColor: '#2a2a2a', opacity: shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.7] }) }, style]} />
  );
};

// Skeleton row for group loading state
const SkeletonGroupRow = ({ delay = 0 }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 10, marginBottom: 6 }}>
    <SkeletonBar width={20} height={20} style={{ borderRadius: 10, marginRight: 8 }} delay={delay} />
    <SkeletonBar width="60%" height={10} delay={delay + 100} />
  </View>
);

// Skeleton for room loading state
const SkeletonRoomRow = ({ delay = 0 }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 8 }}>
    <SkeletonBar width={20} height={20} style={{ borderRadius: 10, marginRight: 10 }} delay={delay} />
    <SkeletonBar width="50%" height={10} delay={delay + 100} />
  </View>
);

// Reusable spring bounce wrapper — each instance has its own scale
const BounceWrap = ({ children, style }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const onPressIn = () => {
    Animated.spring(scale, { toValue: 0.95, friction: 8, useNativeDriver: true }).start();
  };
  const onPressOut = () => {
    Animated.spring(scale, { toValue: 1, friction: 5, tension: 200, useNativeDriver: true }).start();
  };
  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      {typeof children === 'function' ? children({ onPressIn, onPressOut }) : children}
    </Animated.View>
  );
};

const DashboardScreen = ({ navigation }) => {
  const { user, userProfile, refreshUserProfile } = useAuth();
  const { showTabBar, hideTabBar, resetTimer, notificationModalRequested, clearNotificationModalRequest } = useTabBar();

  // --- State ---
  const [groups, setGroups] = useState([]);
  const groupsCacheLoaded = useRef(false);
  const [groupCreators, setGroupCreators] = useState({}); // { creatorId: { name, profilePhoto } }
  const [groupLastVisited, setGroupLastVisited] = useState({}); // { groupId: timestamp }
  const [rooms, setRooms] = useState([]);
  const [roomParticipantProfiles, setRoomParticipantProfiles] = useState({}); // { roomId: [profiles] }
  const [confluencePosts, setConfluencePosts] = useState([]);
  const [events, setEvents] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [_unreadDMCount, setUnreadDMCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [notificationModalVisible, setNotificationModalVisible] = useState(false);
  const [allNetworkUsers, setAllNetworkUsers] = useState([]);
  const [groupsLoaded, setGroupsLoaded] = useState(false);
  const [publicGroups, setPublicGroups] = useState([]);
  const [publicGroupCreators, setPublicGroupCreators] = useState({});
  const [joiningGroupIds, setJoiningGroupIds] = useState(new Set());
  const [manualPrivateOrder, setManualPrivateOrder] = useState(null); // null = activity sort
  const [manualPublicOrder, setManualPublicOrder] = useState(null);
  const [isReorderingPrivate, setIsReorderingPrivate] = useState(false);
  const [isReorderingPublic, setIsReorderingPublic] = useState(false);
  const [roomsLoaded, setRoomsLoaded] = useState(false);
  const [privateGroupsExpanded, setPrivateGroupsExpanded] = useState(false);
  const privateGroupsHeight = useRef(new Animated.Value(0)).current;
  const privateChevronRotation = useRef(new Animated.Value(0)).current;
  // Reorder arrow pulse animation (shared across all rows)
  const reorderArrowOpacity = useRef(new Animated.Value(1)).current;
  const reorderArrowPulseRef = useRef(null);
  const groupsFade = useRef(new Animated.Value(0)).current;
  const roomsFade = useRef(new Animated.Value(0)).current;
  const lastScrollY = useRef(0);
  const roomsScrollThumbAnim = useRef(new Animated.Value(0)).current;
  const [groupConfirmModal, setGroupConfirmModal] = useState({ visible: false, group: null });
  const onboardingComplete = userProfile?.onboardingComplete === true;
  const diamondScale = useRef(new Animated.Value(1)).current;
  const diamondOpacity = useRef(new Animated.Value(0.8)).current;
  const pulseAnimRef = useRef(null);
  // Always-on pulsing diamonds for Active Users + Mutual Aid buttons
  const accentDiamondScale = useRef(new Animated.Value(1)).current;
  const accentDiamondOpacity = useRef(new Animated.Value(0.7)).current;
  const accentPulseRef = useRef(null);
  const mutualAidSpin = useRef(new Animated.Value(0)).current;
  const mutualAidSpinRef = useRef(null);
  // Animation: Bell shake + unread glow
  const bellShake = useRef(new Animated.Value(0)).current;
  const bellGlow = useRef(new Animated.Value(1)).current;
  // Animation: Activity dot breathing
  const activityDotScale = useRef(new Animated.Value(1)).current;
  const activityDotOpacity = useRef(new Animated.Value(1)).current;
  // Animation: Card entrance (fade + slide)
  const sectionFadePrivate = useRef(new Animated.Value(0)).current;
  const sectionSlidePrivate = useRef(new Animated.Value(30)).current;
  const sectionFadePublic = useRef(new Animated.Value(0)).current;
  const sectionSlidePublic = useRef(new Animated.Value(30)).current;
  // Animation: Pull-to-refresh glow
  const refreshGlow = useRef(new Animated.Value(0)).current;
  // Animation: Section title shimmer
  const shimmerPrivate = useRef(new Animated.Value(0)).current;
  const shimmerPublic = useRef(new Animated.Value(0)).current;
  const shimmerPublicGroups = useRef(new Animated.Value(0)).current;
  // Excluded users (hidden/blocked)
  const hiddenUsers = userProfile?.hiddenUsers || [];
  const blockedUsers = userProfile?.blockedUsers || [];
  const blockedBy = userProfile?.blockedBy || [];
  const excludedUsers = [...new Set([...hiddenUsers, ...blockedUsers, ...blockedBy])];
  const myFollowingUsers = userProfile?.subscribedUsers || [];

  // --- Data Fetching ---

  // Load cached groups instantly on first mount so rows appear without delay
  useEffect(() => {
    if (!user?.uid || groupsCacheLoaded.current) return;
    groupsCacheLoaded.current = true;
    AsyncStorage.getItem(`groups_cache_${user.uid}`).then((cached) => {
      if (cached && !groupsLoaded) {
        try {
          const parsed = JSON.parse(cached);
          if (parsed.length > 0) {
            setGroups(parsed);
            setGroupsLoaded(true);
            groupsFade.setValue(1); // show instantly, no fade needed for cache
          }
        } catch (_e) {}
      }
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  const fetchGroups = async () => {
    if (!user?.uid) {
      return;
    }
    try {
      const result = await getUserGroups(user.uid);
      console.log('[Dashboard] fetchGroups result:', { success: result.success, count: result.data?.length, error: result.error });

      if (result.success && result.data) {
        // Build excluded list fresh from current userProfile
        const hidden = userProfile?.hiddenUsers || [];
        const blocked = userProfile?.blockedUsers || [];
        const blockedByList = userProfile?.blockedBy || [];
        const excluded = [...new Set([...hidden, ...blocked, ...blockedByList])];

        const visibleGroups = result.data.filter(
          (g) => !excluded.includes(g.creatorId)
        );
        setGroups(visibleGroups);
        // Cache for instant load next time — store only what we need for display
        const cacheData = visibleGroups.map((g) => ({ id: g.id, name: g.name, creatorId: g.creatorId, lastActivityAt: g.lastActivityAt }));
        AsyncStorage.setItem(`groups_cache_${user.uid}`, JSON.stringify(cacheData)).catch(() => {});
        if (!groupsLoaded) {
          setGroupsLoaded(true);
          Animated.timing(groupsFade, { toValue: 1, duration: 300, useNativeDriver: true }).start();
        }

        // Fetch creator profiles for avatars
        const creatorIds = [...new Set(visibleGroups.map((g) => g.creatorId).filter(Boolean))];
        const idsToFetch = creatorIds.filter((id) => !groupCreators[id]);
        if (idsToFetch.length > 0) {
          const newCreators = {};
          await Promise.all(
            idsToFetch.map(async (id) => {
              try {
                const doc = await firestore().collection('users').doc(id).get();
                if (doc.exists) {
                  const data = doc.data();
                  newCreators[id] = { name: data.name || '', profilePhoto: data.profilePhoto || null };
                }
              } catch (_err) {
                // silently fail
              }
            })
          );
          setGroupCreators((prev) => ({ ...prev, ...newCreators }));
        }
      }
    } catch (err) {
      console.log('[Dashboard] fetchGroups error:', err.message);
    }
  };

  const fetchPublicGroups = async () => {
    try {
      const result = await getPublicGroups();
      if (result.success && result.data) {
        const hidden = userProfile?.hiddenUsers || [];
        const blocked = userProfile?.blockedUsers || [];
        const blockedByList = userProfile?.blockedBy || [];
        const excluded = [...new Set([...hidden, ...blocked, ...blockedByList])];

        const visiblePublicGroups = result.data.filter(
          (g) => !excluded.includes(g.creatorId)
        );
        setPublicGroups(visiblePublicGroups);

        // Fetch creator profiles for public group avatars
        const creatorIds = [...new Set(visiblePublicGroups.map((g) => g.creatorId).filter(Boolean))];
        const idsToFetch = creatorIds.filter((id) => !publicGroupCreators[id] && !groupCreators[id]);
        if (idsToFetch.length > 0) {
          const newCreators = {};
          await Promise.all(
            idsToFetch.map(async (id) => {
              try {
                const doc = await firestore().collection('users').doc(id).get();
                if (doc.exists) {
                  const data = doc.data();
                  newCreators[id] = { name: data.name || '', profilePhoto: data.profilePhoto || null };
                }
              } catch (_err) {}
            })
          );
          setPublicGroupCreators((prev) => ({ ...prev, ...newCreators }));
        }
      }
    } catch (err) {
      console.log('[Dashboard] fetchPublicGroups error:', err.message);
    }
  };

  const handleJoinGroup = async (groupId) => {
    if (joiningGroupIds.has(groupId)) return;
    setJoiningGroupIds((prev) => new Set([...prev, groupId]));
    try {
      await joinGroup(groupId, user.uid);
      // Optimistically add user to members so the Join button disappears immediately
      setPublicGroups((prev) =>
        prev.map((g) => g.id === groupId ? { ...g, members: [...(g.members || []), user.uid] } : g)
      );
    } catch (_e) {
      // silent — Firestore subscription will eventually correct state
    } finally {
      setJoiningGroupIds((prev) => { const next = new Set(prev); next.delete(groupId); return next; });
    }
  };

  // Connected user count derived from 2-degree network graph
  const connectedUserIds = buildConnectedUserIds(user?.uid, allNetworkUsers, excludedUsers, myFollowingUsers);
  // Subtract 1 to exclude self from the displayed count
  const networkUserCount = Math.max(0, connectedUserIds.size - 1);

  // Load group last-visited timestamps from AsyncStorage
  const loadGroupLastVisited = async () => {
    if (!user?.uid) return;
    try {
      const stored = await AsyncStorage.getItem(`groupLastVisited_${user.uid}`);
      if (stored) {
        setGroupLastVisited(JSON.parse(stored));
      }
    } catch (_err) {
      // silently fail
    }
  };

  // Save last-visited timestamp when navigating to a group
  const markGroupVisited = async (groupId) => {
    if (!user?.uid) return;
    const updated = { ...groupLastVisited, [groupId]: Date.now() };
    setGroupLastVisited(updated);
    try {
      await AsyncStorage.setItem(`groupLastVisited_${user.uid}`, JSON.stringify(updated));
    } catch (_err) {
      // silently fail
    }
  };



  // --- Effects ---

  // Fetch on focus (and whenever user auth changes)
  useFocusEffect(
    useCallback(() => {
      fetchGroups();
      fetchPublicGroups();
      loadGroupLastVisited();
      refreshUserProfile();
      resetTimer();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.uid, userProfile?.hiddenUsers?.length, userProfile?.blockedUsers?.length])
  );

  // Diamond pulse animation — runs until onboarding is completed
  useEffect(() => {
    if (!onboardingComplete) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(diamondScale, { toValue: 1.4, duration: 800, useNativeDriver: true }),
            Animated.timing(diamondOpacity, { toValue: 1, duration: 800, useNativeDriver: true }),
          ]),
          Animated.parallel([
            Animated.timing(diamondScale, { toValue: 1.0, duration: 800, useNativeDriver: true }),
            Animated.timing(diamondOpacity, { toValue: 0.6, duration: 800, useNativeDriver: true }),
          ]),
        ])
      );
      pulse.start();
      pulseAnimRef.current = pulse;
    } else {
      // Stop animation, reset to static
      if (pulseAnimRef.current) {
        pulseAnimRef.current.stop();
        pulseAnimRef.current = null;
      }
      diamondScale.setValue(1);
      diamondOpacity.setValue(0.7);
    }
    return () => {
      if (pulseAnimRef.current) {
        pulseAnimRef.current.stop();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onboardingComplete]);

  // Always-on accent diamond pulse (Active Users + Mutual Aid buttons)
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(accentDiamondScale, { toValue: 1.3, duration: 900, useNativeDriver: true }),
          Animated.timing(accentDiamondOpacity, { toValue: 1, duration: 900, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(accentDiamondScale, { toValue: 0.9, duration: 900, useNativeDriver: true }),
          Animated.timing(accentDiamondOpacity, { toValue: 0.5, duration: 900, useNativeDriver: true }),
        ]),
      ])
    );
    pulse.start();
    accentPulseRef.current = pulse;

    // Slow spin for Mutual Aid diamond (3s per rotation)
    const spin = Animated.loop(
      Animated.timing(mutualAidSpin, { toValue: 1, duration: 3000, useNativeDriver: true, easing: undefined })
    );
    spin.start();
    mutualAidSpinRef.current = spin;

    return () => { pulse.stop(); spin.stop(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Bell shake when unread count changes and is > 0
  useEffect(() => {
    if (unreadCount > 0) {
      bellShake.setValue(0);
      Animated.sequence([
        Animated.timing(bellShake, { toValue: 0.5, duration: 100, useNativeDriver: true }),
        Animated.timing(bellShake, { toValue: -0.4, duration: 100, useNativeDriver: true }),
        Animated.timing(bellShake, { toValue: 0.2, duration: 80, useNativeDriver: true }),
        Animated.timing(bellShake, { toValue: 0, duration: 80, useNativeDriver: true }),
      ]).start();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unreadCount]);

  // Bell glow pulse when unread
  useEffect(() => {
    if (unreadCount > 0) {
      const glow = Animated.loop(
        Animated.sequence([
          Animated.timing(bellGlow, { toValue: 0.5, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(bellGlow, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      );
      glow.start();
      return () => glow.stop();
    } else {
      bellGlow.setValue(1);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unreadCount > 0]);

  // Activity dot breathing on active groups
  useEffect(() => {
    const dotPulse = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(activityDotScale, { toValue: 1.4, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(activityDotOpacity, { toValue: 0.4, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(activityDotScale, { toValue: 1, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(activityDotOpacity, { toValue: 1, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
      ])
    );
    dotPulse.start();
    return () => dotPulse.stop();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reorder arrow pulse — runs while any section is in reorder mode
  useEffect(() => {
    if (isReorderingPrivate || isReorderingPublic) {
      reorderArrowOpacity.setValue(1);
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(reorderArrowOpacity, { toValue: 0.4, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(reorderArrowOpacity, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      );
      pulse.start();
      reorderArrowPulseRef.current = pulse;
    } else {
      if (reorderArrowPulseRef.current) {
        reorderArrowPulseRef.current.stop();
        reorderArrowPulseRef.current = null;
      }
      reorderArrowOpacity.setValue(1);
    }
    return () => { if (reorderArrowPulseRef.current) reorderArrowPulseRef.current.stop(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReorderingPrivate, isReorderingPublic]);

  // Card entrance animations — fade + slide up on mount
  useEffect(() => {
    Animated.stagger(150, [
      Animated.parallel([
        Animated.timing(sectionFadePrivate, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(sectionSlidePrivate, { toValue: 0, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(sectionFadePublic, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(sectionSlidePublic, { toValue: 0, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
    ]).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Section title shimmer — looping light sweep
  // Load saved group order from userProfile (only when not actively reordering)
  useEffect(() => {
    if (userProfile?.groupOrder) setManualPrivateOrder(userProfile.groupOrder);
    if (userProfile?.publicGroupOrder) setManualPublicOrder(userProfile.publicGroupOrder);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile?.groupOrder?.length, userProfile?.publicGroupOrder?.length]);

  useEffect(() => {
    const shimmerLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerPrivate, { toValue: 1, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(shimmerPrivate, { toValue: 0, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    const shimmerLoop2 = Animated.loop(
      Animated.sequence([
        Animated.delay(1000),
        Animated.timing(shimmerPublic, { toValue: 1, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(shimmerPublic, { toValue: 0, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    const shimmerLoop3 = Animated.loop(
      Animated.sequence([
        Animated.delay(500),
        Animated.timing(shimmerPublicGroups, { toValue: 1, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(shimmerPublicGroups, { toValue: 0, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    shimmerLoop.start();
    shimmerLoop2.start();
    shimmerLoop3.start();
    return () => { shimmerLoop.stop(); shimmerLoop2.stop(); shimmerLoop3.stop(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Real-time subscription to network users (for 2-degree filtering)
  useEffect(() => {
    if (!user?.uid) return;
    const unsubNetwork = subscribeToNetworkUsers((users) => {
      setAllNetworkUsers(users);
    });
    return () => unsubNetwork();
  }, [user?.uid]);

  // Real-time subscriptions — filter content by 2-degree connections
  useEffect(() => {
    if (!user?.uid) return;

    const connectedUserIds = buildConnectedUserIds(user.uid, allNetworkUsers, excludedUsers, myFollowingUsers);

    const unsubRooms = subscribeToActiveRooms((roomList) => {
      setRooms(roomList.filter((r) => !excludedUsers.includes(r.hostId) && connectedUserIds.has(r.hostId)));
      setRoomsLoaded(true);
      Animated.timing(roomsFade, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    });

    const unsubConfluence = subscribeToConfluencePosts((posts) => {
      setConfluencePosts(posts.filter((p) => !excludedUsers.includes(p.authorId) && connectedUserIds.has(p.authorId)));
    });

    const unsubEvents = subscribeToEvents((eventList) => {
      setEvents(eventList.filter((e) => !excludedUsers.includes(e.authorId) && connectedUserIds.has(e.authorId)));
    });

    return () => {
      unsubRooms();
      unsubConfluence();
      unsubEvents();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, allNetworkUsers]);

  // Notification & DM subscriptions — separate from content subscriptions
  // so they don't restart when allNetworkUsers changes (prevents badge jumping)
  useEffect(() => {
    if (!user?.uid) return;

    const unsubNotifications = subscribeToNotifications(user.uid, (notifs) => {
      setNotifications(notifs);
      setUnreadCount(notifs.filter((n) => !n.read).length);
    });

    const unsubConversations = subscribeToConversations(user.uid, (convos) => {
      setUnreadDMCount(convos.filter((c) => c[`unread_${user.uid}`] === true).length);
    });

    return () => {
      unsubNotifications();
      unsubConversations();
    };
  }, [user?.uid]);

  // Reset the server-side pendingBadge counter when the app comes to foreground.
  // This keeps the counter in sync with the device badge (which App.js clears to 0).
  const dashAppState = useRef(AppState.currentState);
  useEffect(() => {
    if (!user?.uid) return;
    const resetPendingBadge = () => {
      functions().httpsCallable('resetBadgeCount')().catch(() => {});
    };
    // Reset on mount (app just opened to this screen)
    resetPendingBadge();
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (dashAppState.current.match(/inactive|background/) && nextAppState === 'active') {
        resetPendingBadge();
      }
      dashAppState.current = nextAppState;
    });
    return () => subscription.remove();
  }, [user?.uid]);

  // Fetch participant profiles for chatroom avatar banners (max 4 per room)
  // Dependency uses JSON.stringify of participant arrays so it re-fetches
  // whenever heartbeat prunes stale participants from any room
  const roomParticipantsKey = JSON.stringify(
    rooms.slice(0, 10).map((r) => ({ id: r.id, p: r.participants || [] }))
  );
  useEffect(() => {
    if (rooms.length === 0) {
      setRoomParticipantProfiles({});
      return;
    }
    const fetchAllRoomProfiles = async () => {
      const profileMap = {};
      await Promise.all(
        rooms.slice(0, 10).map(async (room) => {
          const participants = room.participants || [];
          if (participants.length > 0) {
            const result = await getMemberProfiles(participants, 4);
            if (result.success) {
              profileMap[room.id] = result.data;
            }
          }
        })
      );
      setRoomParticipantProfiles(profileMap);
    };
    fetchAllRoomProfiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomParticipantsKey]);

  // Listen for Activity tab press (via context)
  useEffect(() => {
    if (notificationModalRequested) {
      setNotificationModalVisible(true);
      if (user?.uid && unreadCount > 0) {
        setTimeout(() => markAllNotificationsRead(user.uid), 5000);
      }
      // Clear app icon badge when opening via Activity tab
      Notifications.setBadgeCountAsync(0).catch(() => {});
      clearNotificationModalRequest();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notificationModalRequested]);

  // --- Handlers ---

  const onRefresh = async () => {
    setRefreshing(true);
    // Trigger glow animation
    refreshGlow.setValue(1);
    Animated.timing(refreshGlow, { toValue: 0, duration: 800, easing: Easing.out(Easing.ease), useNativeDriver: true }).start();
    await Promise.all([fetchGroups(), fetchPublicGroups(), refreshUserProfile()]);
    setRefreshing(false);
  };

  const handleOpenNotifications = () => {
    setNotificationModalVisible(true);
    if (user?.uid && unreadCount > 0) {
      setTimeout(() => markAllNotificationsRead(user.uid), 5000);
    }
    // Clear app icon badge immediately when user opens notifications
    Notifications.setBadgeCountAsync(0).catch(() => {});
  };

  const handleCloseNotifications = async () => {
    setNotificationModalVisible(false);

    if (user?.uid && unreadCount > 0) {
      await markAllNotificationsRead(user.uid);
    }
    // User just reviewed notifications — clear the badge.
    // Next push notification will set the correct count server-side.
    Notifications.setBadgeCountAsync(0).catch(() => {});
  };

  const handleScroll = (event) => {
    const currentScrollY = event.nativeEvent.contentOffset.y;
    const contentHeight = event.nativeEvent.contentSize.height;
    const layoutHeight = event.nativeEvent.layoutMeasurement.height;
    const scrollDirection = currentScrollY > lastScrollY.current ? 'down' : 'up';
    const scrollableHeight = contentHeight - layoutHeight;
    const scrollPercent = scrollableHeight > 0 ? currentScrollY / scrollableHeight : 0;

    if (scrollDirection === 'down' && scrollPercent > 0.5) {
      hideTabBar();
    } else if (scrollDirection === 'up') {
      showTabBar();
    }

    lastScrollY.current = currentScrollY;
  };

  const handleScrollBeginDrag = () => {
    showTabBar();
    // Exit reorder mode when user starts scrolling away
    if (isReorderingPrivate) exitReorderMode('private', sortedGroups);
    if (isReorderingPublic) exitReorderMode('public', sortedPublicGroups);
  };

  const handleRoomsScroll = (event) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const scrollableHeight = contentSize.height - layoutMeasurement.height;
    if (scrollableHeight > 0) {
      const scrollPercent = Math.min(1, Math.max(0, contentOffset.y / scrollableHeight));
      const trackHeight = 82; // 98 maxHeight minus 16 marginVertical
      const thumbHeight = 30;
      const maxThumbOffset = trackHeight - thumbHeight;
      roomsScrollThumbAnim.setValue(scrollPercent * maxThumbOffset);
    }
  };

  const togglePrivateGroups = () => {
    const toValue = privateGroupsExpanded ? 0 : 1;
    setPrivateGroupsExpanded(!privateGroupsExpanded);
    Animated.parallel([
      Animated.spring(privateGroupsHeight, { toValue, useNativeDriver: false, friction: 8, tension: 60 }),
      Animated.timing(privateChevronRotation, { toValue, duration: 200, useNativeDriver: true }),
    ]).start();
  };

  const handleCreateGroup = (isPublic = false) => {
    playClick();
    if (groups.length >= MAX_GROUPS) {
      Alert.alert('Group Limit', `You've reached the maximum of ${MAX_GROUPS} groups.`);
      return;
    }
    navigation.navigate('CreateGroup', { isPublic });
  };

  const handleGroupPress = (groupId) => {
    playSwoosh();
    markGroupVisited(groupId);
    navigation.navigate('GroupDetail', { groupId });
  };

  const handleRemoveGroup = (group) => {
    setGroupConfirmModal({ visible: true, group });
  };

  const handleConfirmRemoveGroup = async () => {
    const group = groupConfirmModal.group;
    if (!group) return;
    setGroupConfirmModal({ visible: false, group: null });

    const isCreator = group.creatorId === user?.uid;
    const result = isCreator
      ? await deleteGroup(group.id, group.creatorId)
      : await leaveGroup(group.id, user.uid);
    if (result.success) {
      // Clean up this group from saved order if present
      setManualPrivateOrder((prev) => prev ? prev.filter((id) => id !== group.id) : prev);
      setManualPublicOrder((prev) => prev ? prev.filter((id) => id !== group.id) : prev);
      fetchGroups();
      fetchPublicGroups();
    } else {
      Alert.alert('Error', result.error || 'Something went wrong.');
    }
  };

  const renderGroupDeleteAction = (progress, dragX, group) => {
    const trans = progress.interpolate({
      inputRange: [0, 1],
      outputRange: [80, 0],
    });

    return (
      <Animated.View style={[styles.groupDeleteAction, { transform: [{ translateX: trans }] }]}>
        <TouchableOpacity onPress={() => handleRemoveGroup(group)} style={styles.groupDeleteButton}>
          <Ionicons name="trash-outline" size={22} color="#000000" />
        </TouchableOpacity>
      </Animated.View>
    );
  };

  // --- Reorder ---

  const enterReorderMode = (section) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (section === 'private') setIsReorderingPrivate(true);
    else setIsReorderingPublic(true);
  };

  const exitReorderMode = (section, orderedGroups) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (section === 'private') {
      setIsReorderingPrivate(false);
      updateUserProfile(user.uid, { groupOrder: orderedGroups.map((g) => g.id) }).catch(() => {});
    } else {
      setIsReorderingPublic(false);
      updateUserProfile(user.uid, { publicGroupOrder: orderedGroups.map((g) => g.id) }).catch(() => {});
    }
  };

  const handleMoveGroup = (section, index, direction, currentList) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const arr = [...currentList];
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= arr.length) return;
    // For public groups: never allow swapping across the member / non-member boundary
    if (section === 'public') {
      const isMem = (g) => g.members?.includes(user?.uid);
      if (isMem(arr[index]) !== isMem(arr[newIndex])) return;
    }
    [arr[index], arr[newIndex]] = [arr[newIndex], arr[index]];
    if (section === 'private') setManualPrivateOrder(arr.map((g) => g.id));
    else setManualPublicOrder(arr.map((g) => g.id));
  };


  // --- Group Activity Helpers ---

  const isGroupActive = (group) => {
    if (!group.updatedAt) return false;
    const updatedMs = group.updatedAt?.toDate
      ? group.updatedAt.toDate().getTime()
      : group.updatedAt?.seconds
        ? group.updatedAt.seconds * 1000
        : 0;
    const lastVisited = groupLastVisited[group.id] || 0;
    return updatedMs > lastVisited;
  };

  // Sort: active groups first, then inactive
  // Private groups: exclude public ones (they appear in the public container)
  const privateGroups = groups.filter((g) => !g.isPublic);

  // Merge user's own public groups with remotely fetched public groups (de-duped)
  // This ensures the user's own public groups always appear even if the Firestore
  // composite index query hasn't been created yet or hasn't propagated.
  const ownPublicGroups = groups.filter((g) => g.isPublic);
  const displayedPublicGroups = [...ownPublicGroups];
  publicGroups.forEach((pg) => {
    if (!displayedPublicGroups.find((g) => g.id === pg.id)) {
      displayedPublicGroups.push(pg);
    }
  });

  const sortedGroups = manualPrivateOrder && manualPrivateOrder.length > 0
    ? [...privateGroups].sort((a, b) => {
        const ai = manualPrivateOrder.indexOf(a.id);
        const bi = manualPrivateOrder.indexOf(b.id);
        if (ai === -1 && bi === -1) return 0;
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
      })
    : [...privateGroups].sort((a, b) => {
        const aActive = isGroupActive(a) ? 1 : 0;
        const bActive = isGroupActive(b) ? 1 : 0;
        return bActive - aActive;
      });

  const _rawPublicGroups = manualPublicOrder && manualPublicOrder.length > 0
    ? [...displayedPublicGroups].sort((a, b) => {
        const ai = manualPublicOrder.indexOf(a.id);
        const bi = manualPublicOrder.indexOf(b.id);
        if (ai === -1 && bi === -1) return 0;
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
      })
    : [...displayedPublicGroups].sort((a, b) => {
        const aActive = isGroupActive(a) ? 1 : 0;
        const bActive = isGroupActive(b) ? 1 : 0;
        return bActive - aActive;
      });
  // Always keep groups the user is a member of above groups they haven't joined
  const _isMemberOf = (pg) => pg.members?.includes(user?.uid);
  const sortedPublicGroups = [
    ..._rawPublicGroups.filter(_isMemberOf),
    ..._rawPublicGroups.filter((pg) => !_isMemberOf(pg)),
  ];

  // --- Event Date Formatter ---
  const formatEventDate = (dateVal) => {
    if (!dateVal) return '';
    const d = dateVal instanceof Date ? dateVal : dateVal.toDate ? dateVal.toDate() : new Date(dateVal);
    const days = ['Sun', 'Mon', 'Tues', 'Weds', 'Thurs', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${days[d.getDay()]} ${months[d.getMonth()]} ${d.getDate()}`;
  };

  // Tap bounce helper — wraps a pressable with a quick scale bounce + haptic
  const makeBounce = useCallback(() => {
    const scale = new Animated.Value(1);
    const onPressIn = () => {
      Animated.spring(scale, { toValue: 0.95, friction: 8, useNativeDriver: true }).start();
    };
    const onPressOut = () => {
      Animated.spring(scale, { toValue: 1, friction: 5, tension: 200, useNativeDriver: true }).start();
    };
    return { scale, onPressIn, onPressOut };
  }, []);

  const bounceAvatar = useRef(makeBounce()).current;
  const bounceLogo = useRef(makeBounce()).current;
  const bounceConfluence = useRef(makeBounce()).current;
  const bounceEvents = useRef(makeBounce()).current;
  // Bounce + green glow factory for green-accented buttons
  const makeGlowBounce = useCallback(() => {
    const scale = new Animated.Value(1);
    const glowOpacity = new Animated.Value(0);
    const onPressIn = () => {
      playClick();
      Animated.parallel([
        Animated.timing(scale, { toValue: 0.97, duration: 200, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(glowOpacity, { toValue: 1, duration: 200, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      ]).start();
    };
    const onPressOut = () => {
      Animated.parallel([
        Animated.timing(scale, { toValue: 1, duration: 300, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(glowOpacity, { toValue: 0, duration: 400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]).start();
    };
    return { scale, glowOpacity, onPressIn, onPressOut };
  }, []);
  const bounceMutualAid = useRef(makeGlowBounce()).current;
  const bounceAddFriends = useRef(makeGlowBounce()).current;
  const bounceNetwork = useRef(makeGlowBounce()).current;
  const bounceAddGroup = useRef(makeBounce()).current;
  const bounceAddPublicGroup = useRef(makeBounce()).current;
  const bounceAddChat = useRef(makeBounce()).current;

  // --- Render ---

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        onScroll={handleScroll}
        onScrollBeginDrag={handleScrollBeginDrag}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* Pull-to-refresh glow bar */}
        <Animated.View style={{ height: 3, borderRadius: 2, marginHorizontal: 40, marginBottom: 4, backgroundColor: colors.primary, opacity: refreshGlow, transform: [{ scaleX: refreshGlow.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }] }} />

       {/* ==================== HEADER ==================== */}
<View style={styles.headerSection}>
  {/* Avatar + Bell in glass container */}
  <Animated.View style={[styles.avatarWrapper, { transform: [{ scale: bounceAvatar.scale }] }]}>
    <BlurView intensity={10} tint="dark" style={styles.glassContainer}>
      <View style={styles.glassInner}>
        <TouchableOpacity onPress={() => navigation.navigate('ProfileTab')} onPressIn={bounceAvatar.onPressIn} onPressOut={bounceAvatar.onPressOut} activeOpacity={0.9} style={{ flex: 1, width: '100%' }}>
          <View style={styles.avatarContainer}>
            {userProfile?.profilePhoto ? (
              <Image
                source={{ uri: userProfile.profilePhoto, cache: 'reload' }}
                style={styles.avatarImage}
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="person" size={32} color="#666" />
              </View>
            )}
          </View>
        </TouchableOpacity>
      </View>
    </BlurView>
    {/* Notification bell */}
    <Animated.View style={{ transform: [{ rotate: bellShake.interpolate({ inputRange: [-1, 0, 1], outputRange: ['-15deg', '0deg', '15deg'] }) }, { scale: unreadCount > 0 ? bellGlow.interpolate({ inputRange: [0.5, 1], outputRange: [1.08, 1] }) : 1 }], opacity: unreadCount > 0 ? bellGlow : 1 }}>
      <TouchableOpacity
        style={[styles.bellOverlay, unreadCount === 0 && styles.bellOverlayInactive]}
        onPress={() => { playClick(); handleOpenNotifications(); }}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        activeOpacity={0.7}
      >
        <Ionicons name="notifications" size={12} color={unreadCount > 0 ? '#000' : '#555'} />
      </TouchableOpacity>
    </Animated.View>
  </Animated.View>

  {/* Logo */}
  <Animated.View style={{ flex: 1, transform: [{ scale: bounceLogo.scale }] }}>
  <TouchableOpacity
    onPress={() => navigation.navigate('Onboarding')}
    onPressIn={bounceLogo.onPressIn}
    onPressOut={bounceLogo.onPressOut}
    activeOpacity={0.9}
    style={{ flex: 1 }}
  >
    <BlurView intensity={10} tint="dark" style={styles.glassContainer}>
      <View style={[styles.glassInner, { padding: 0 }]}>
        <Image
          source={require('../../assets/images/green-logo.png')}
          style={styles.logoImage}
          resizeMode="cover"
        />
      </View>
    </BlurView>
    {/* Pulsing diamond indicator */}
    {!onboardingComplete && (
      <Animated.View
        style={[
          styles.diamondIndicator,
          {
            transform: [{ scale: diamondScale }],
            opacity: diamondOpacity,
          },
        ]}
      >
        <View style={styles.starSpikeV} />
        <View style={styles.starSpikeH} />
        <View style={[styles.starSpikeV, { transform: [{ rotate: '45deg' }], opacity: 0.7, width: 3, height: 14 }]} />
        <View style={[styles.starSpikeV, { transform: [{ rotate: '-45deg' }], opacity: 0.7, width: 3, height: 14 }]} />
      </Animated.View>
    )}
  </TouchableOpacity>
  </Animated.View>
</View>


        {/* ==================== MY COLLECTIVE NETWORK ==================== */}
        <Animated.View style={{ opacity: sectionFadePublic, transform: [{ translateY: sectionSlidePublic }] }}>
        <View style={[styles.sectionContainer, !userProfile?.everyoneNetworkEnabled && { opacity: 0.35 }]}>
          <View style={styles.sectionHeaderRow}>
            <Animated.Text style={[styles.sectionTitle, { opacity: shimmerPublic.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0.6, 1] }) }]}>My Collective Network</Animated.Text>
            {userProfile?.everyoneNetworkEnabled && (
              <>
              <View style={{ flex: 1, alignItems: 'flex-start', justifyContent: 'center', paddingLeft: 8 }}>
                <Animated.View style={{ transform: [{ scale: accentDiamondScale }, { rotate: mutualAidSpin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }], opacity: accentDiamondOpacity, width: 14, height: 14, alignItems: 'center', justifyContent: 'center' }}>
                  <View style={{ position: 'absolute', width: 3, height: 12, borderRadius: 1.5, backgroundColor: colors.primary }} />
                  <View style={{ position: 'absolute', width: 12, height: 3, borderRadius: 1.5, backgroundColor: colors.primary }} />
                  <View style={{ position: 'absolute', width: 2, height: 9, borderRadius: 1, backgroundColor: colors.primary, transform: [{ rotate: '45deg' }], opacity: 0.7 }} />
                  <View style={{ position: 'absolute', width: 2, height: 9, borderRadius: 1, backgroundColor: colors.primary, transform: [{ rotate: '-45deg' }], opacity: 0.7 }} />
                </Animated.View>
              </View>
              </>
            )}
          </View>

          {/* ---- Add Friends & Explore Buttons ---- */}
          {userProfile?.everyoneNetworkEnabled && (
          <View style={[styles.actionButtonRow, { marginTop: 6 }]}>
            <Animated.View style={{ transform: [{ scale: bounceAddFriends.scale }], shadowColor: colors.primary, shadowOffset: { width: 0, height: 0 }, shadowOpacity: bounceAddFriends.glowOpacity, shadowRadius: 16, elevation: 8 }}>
              <TouchableOpacity
                onPress={() => { playClick(); navigation.navigate('FindFriends', { mode: 'profile' }); }}
                onPressIn={bounceAddFriends.onPressIn}
                onPressOut={bounceAddFriends.onPressOut}
                activeOpacity={0.8}
              >
                <BlurView intensity={10} tint="dark" style={styles.actionGlassButton}>
                  <View style={styles.actionGlassButtonInner}>
                    <Ionicons name="search-outline" size={14} color="#ffffff" />
                    <Text style={styles.actionGlassButtonText}>Add Friends</Text>
                  </View>
                </BlurView>
              </TouchableOpacity>
            </Animated.View>
            <Animated.View style={{ flex: 1, opacity: bounceNetwork.scale.interpolate({ inputRange: [0.97, 1], outputRange: [0.6, 1], extrapolate: 'clamp' }), shadowColor: colors.primary, shadowOffset: { width: 0, height: 0 }, shadowOpacity: bounceNetwork.glowOpacity, shadowRadius: 16, elevation: 8 }}>
              <TouchableOpacity
                onPress={() => { playClick(); navigation.navigate('ActiveUsers'); }}
                onPressIn={bounceNetwork.onPressIn}
                onPressOut={bounceNetwork.onPressOut}
                activeOpacity={1}
              >
                <BlurView intensity={10} tint="dark" style={styles.actionGlassButton}>
                  <View style={[styles.actionGlassButtonInner, { flexWrap: 'nowrap' }]}>
                    <Ionicons name="people-outline" size={14} color="#ffffff" />
                    <Text style={styles.actionGlassButtonText} numberOfLines={1}>See My Network</Text>
                  </View>
                </BlurView>
              </TouchableOpacity>
            </Animated.View>
          </View>
          )}

          {!userProfile?.everyoneNetworkEnabled && (
            <View style={styles.gatedOverlay}>
              <Ionicons name="globe-outline" size={36} color="#bbbbbb" />
              <Text style={styles.gatedOverlayTitle}>Everyone Network Disabled</Text>
              <Text style={styles.gatedOverlayMessage}>
                Turn on the Everyone Network toggle in your profile to access the public collective — a cyber public space with your network of IRL humans.
              </Text>
            </View>
          )}

          {userProfile?.everyoneNetworkEnabled && (
          <>
          {/* ---- Cyber Lounge ---- */}
          <View style={styles.cyberLoungeContainer}>
            <View style={styles.cyberLoungeHeader}>
              <Text style={styles.subSectionTitle}>Cyber Lounge {'>'}</Text>
              <Animated.View style={{ transform: [{ scale: bounceAddChat.scale }] }}>
              <TouchableOpacity
                style={styles.addChatButtonOuter}
                onPress={() => { playClick(); navigation.navigate('CyberLoungeCreate') }}
                onPressIn={bounceAddChat.onPressIn}
                onPressOut={bounceAddChat.onPressOut}
                activeOpacity={0.9}
              >
                <LinearGradient
                  colors={['#cafb6c', '#71f200', '#23ff0d']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.addChatButton}
                >
                  <LinearGradient
                    colors={['rgba(255, 255, 255, 0.35)', 'rgba(255, 255, 255, 0)']}
                    style={styles.addChatButtonHighlight}
                  />
                  <Ionicons name="add" size={12} color={colors.textDark} />
                  <Text style={styles.addChatButtonText}>Live Chatroom</Text>
                </LinearGradient>
              </TouchableOpacity>
              </Animated.View>
            </View>

            {/* Rooms Preview */}
            <View style={styles.roomsScrollContainer}>
              {!roomsLoaded ? (
                <View style={{ paddingVertical: 4 }}>
                  <SkeletonRoomRow delay={0} />
                  <SkeletonRoomRow delay={150} />
                </View>
              ) : rooms.length === 0 ? (
                <Animated.View style={[styles.roomsEmptyContainer, { opacity: roomsFade }]}>
                  <Text style={styles.roomsEmptyText}>No active chatrooms</Text>
                </Animated.View>
              ) : (
                <Animated.View style={[styles.roomsScrollRow, { opacity: roomsFade }]}>
                  <ScrollView
                    nestedScrollEnabled={true}
                    showsVerticalScrollIndicator={false}
                    style={[
                      styles.roomsScrollView,
                      rooms.slice(0, 10).length > 2 && { maxHeight: 120 },
                    ]}
                    scrollEnabled={rooms.slice(0, 10).length > 2}
                    onScroll={handleRoomsScroll}
                    scrollEventThrottle={16}
                  >
                    {rooms.slice(0, 10).map((room) => (
                      <TouchableOpacity
                        key={room.id}
                        style={styles.roomRow}
                        onPress={() => navigation.navigate('CyberLoungeDetail', { roomId: room.id })}
                      >
                        <View style={styles.roomAvatarBanner}>
                          {(roomParticipantProfiles[room.id] || []).slice(0, 4).map((p, idx) => (
                            <View key={p.id} style={{ marginLeft: idx > 0 ? -6 : 0, zIndex: 1 }}>
                              {p.profilePhoto ? (
                                <Image source={{ uri: p.profilePhoto, cache: 'reload' }} style={styles.roomAvatar} />
                              ) : (
                                <View style={[styles.roomAvatar, styles.roomAvatarPlaceholder]}>
                                  <Ionicons name="person" size={10} color="#666" />
                                </View>
                              )}
                            </View>
                          ))}
                          {(room.participantCount || room.participants?.length || 0) > 4 && (
                            <View style={[styles.roomAvatar, styles.roomAvatarPlaceholder, { marginLeft: -6 }]}>
                              <Text style={styles.roomParticipantCountText}>+{(room.participantCount || room.participants?.length || 0) - 4}</Text>
                            </View>
                          )}
                          <Animated.View style={[styles.roomActivityDot, { transform: [{ scale: activityDotScale }], opacity: activityDotOpacity }]} />
                        </View>
                        <Text style={styles.roomName} numberOfLines={1}>{room.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  {/* Always-visible scroll track */}
                  <View style={styles.roomsScrollTrack}>
                    {rooms.slice(0, 10).length > 2 && (
                      <Animated.View
                        style={[
                          styles.roomsScrollThumbStyle,
                          { transform: [{ translateY: roomsScrollThumbAnim }] },
                        ]}
                      />
                    )}
                  </View>
                </Animated.View>
              )}
            </View>
          </View>

          {/* ---- Confluence ---- */}
          {confluencePosts.length > 0 && (
          <Animated.View style={{ transform: [{ scale: bounceConfluence.scale }] }}>
          <BlurView intensity={10} tint="dark" style={styles.confluenceGlass}>
            <TouchableOpacity
              style={styles.confluenceContainer}
              onPress={() => navigation.navigate('ConfluenceLanding')}
              onPressIn={bounceConfluence.onPressIn}
              onPressOut={bounceConfluence.onPressOut}
              activeOpacity={0.9}
            >
              <Text style={styles.subSectionTitleLight}>Confluence {'>'}</Text>
              <View style={{ gap: 8 }}>
                <View style={styles.confluenceImagesRow}>
                  <View style={styles.confluenceImageFrame}>
                    <Image source={{ uri: confluencePosts[0]?.imageUrl }} style={styles.confluenceImage} />
                  </View>
                  {confluencePosts.length > 1 && (
                    <View style={styles.confluenceImageFrame}>
                      <Image source={{ uri: confluencePosts[1]?.imageUrl }} style={styles.confluenceImage} />
                    </View>
                  )}
                </View>
                {confluencePosts.length > 2 && (
                  <View style={styles.confluenceImagesRow}>
                    <View style={styles.confluenceImageFrame}>
                      <Image source={{ uri: confluencePosts[2]?.imageUrl }} style={styles.confluenceImage} />
                    </View>
                    {confluencePosts.length > 3 && (
                      <View style={styles.confluenceImageFrame}>
                        <Image source={{ uri: confluencePosts[3]?.imageUrl }} style={styles.confluenceImage} />
                      </View>
                    )}
                  </View>
                )}
              </View>
            </TouchableOpacity>
          </BlurView>
          </Animated.View>
          )}

          {/* ---- Mutual Aid & Resources ---- */}
          {networkUserCount > 0 && (
          <Animated.View style={{ marginTop: 12, transform: [{ scale: bounceMutualAid.scale }], shadowColor: '#ff93bd', shadowOffset: { width: 0, height: 0 }, shadowOpacity: bounceMutualAid.glowOpacity, shadowRadius: 28, elevation: 12 }}>
          <TouchableOpacity
            style={styles.mutualAidButtonOuter}
            onPress={() => navigation.navigate('MutualAidLanding')}
            onPressIn={bounceMutualAid.onPressIn}
            onPressOut={bounceMutualAid.onPressOut}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={['#ff93bd', '#8b5cf6', '#32259e']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.mutualAidButton}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Animated.View style={{ transform: [{ scale: accentDiamondScale }], opacity: accentDiamondOpacity, width: 22, height: 22, alignItems: 'center', justifyContent: 'center', marginRight: 4, shadowColor: '#cafb6c', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 10, elevation: 6 }}>
                  <Ionicons name="globe-outline" size={18} color="#cafb6c" />
                  <View style={{ position: 'absolute', top: -1, right: 0, width: 3, height: 3, borderRadius: 1.5, backgroundColor: '#ffffff' }} />
                  <View style={{ position: 'absolute', bottom: 0, left: -1, width: 2.5, height: 2.5, borderRadius: 1.25, backgroundColor: '#ffffff', opacity: 0.8 }} />
                </Animated.View>
                <Text style={styles.mutualAidButtonText}>Mutual Aid & Resources {'>'}</Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>
          </Animated.View>
          )}

          {/* ==================== PUBLIC COLLECTIVE GROUPS ==================== */}
          <View style={styles.publicGroupsSection}>
            <TouchableOpacity
              style={[styles.sectionHeaderRow, { alignItems: 'flex-start' }]}
              onPress={isReorderingPublic ? () => exitReorderMode('public', sortedPublicGroups) : undefined}
              activeOpacity={isReorderingPublic ? 0.7 : 1}
            >
              <View>
                <Animated.Text style={[styles.publicGroupsTitle, { opacity: shimmerPublicGroups.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0.6, 1] }) }]}>Public Groups</Animated.Text>
                {groups.length > 0 && <Text style={styles.publicGroupCounter}>{groups.length}/50 max groups authored</Text>}
                <Text style={styles.pinHintText}>{(isReorderingPrivate || isReorderingPublic) ? 'tap here to finish' : 'hold to reorder'}</Text>
              </View>
              {!isReorderingPublic && (
                <Animated.View style={{ transform: [{ scale: bounceAddPublicGroup.scale }] }}>
                <TouchableOpacity
                  style={[styles.addButton, groups.length >= MAX_GROUPS && styles.addButtonDisabled]}
                  onPress={() => handleCreateGroup(true)}
                  onPressIn={bounceAddPublicGroup.onPressIn}
                  onPressOut={bounceAddPublicGroup.onPressOut}
                  disabled={groups.length >= MAX_GROUPS}
                  activeOpacity={0.9}
                >
                  <LinearGradient
                    colors={['#cafb6c', '#71f200', '#23ff0d']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.addButtonGradient}
                  >
                    <LinearGradient
                      colors={['rgba(255, 255, 255, 0.35)', 'rgba(255, 255, 255, 0)']}
                      style={styles.addButtonHighlight}
                    />
                    <Ionicons name="add" size={12} color="#1a1a1a" />
                    <Text style={styles.addButtonText}>Public Group</Text>
                  </LinearGradient>
                </TouchableOpacity>
                </Animated.View>
              )}
            </TouchableOpacity>

            {/* Glass container wraps only the group buttons */}
            <BlurView intensity={10} tint="dark" style={styles.publicGroupsGlass}>
              <View style={styles.publicGroupsContainer}>
                <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false} style={{ maxHeight: 190 }}>
                  {sortedPublicGroups.slice(0, MAX_PUBLIC_GROUPS).map((pg, index) => {
                    const pgCreator = publicGroupCreators[pg.creatorId] || groupCreators[pg.creatorId];
                    const pgActive = isGroupActive(pg);
                    return (
                      <View key={pg.id}>
                        <Swipeable
                          renderRightActions={(progress, dragX) => renderGroupDeleteAction(progress, dragX, pg)}
                          rightThreshold={40}
                          overshootRight={false}
                          enabled={!isReorderingPublic}
                        >
                          <TouchableOpacity
                            style={[styles.pubGroupRowOuter, !pgActive && styles.groupRowInactive, isReorderingPublic && !pg.members?.includes(user?.uid) && { opacity: 0.4 }]}
                            onPress={() => { if (!isReorderingPublic) { playSwoosh(); markGroupVisited(pg.id); navigation.navigate('GroupDetail', { groupId: pg.id }); } }}
                            onLongPress={() => { if (!isReorderingPublic) enterReorderMode('public'); }}
                            delayLongPress={400}
                            activeOpacity={0.9}
                          >
                            <LinearGradient
                              colors={
                                isReorderingPublic && pg.members?.includes(user?.uid)
                                  ? [colors.primary, colors.primary]
                                  : pg.members?.includes(user?.uid)
                                    ? ['#cafb6c', '#71f200', '#23ff0d']
                                    : ['#f9a8d4', '#e879f9', '#a855f7']
                              }
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 1 }}
                              style={styles.pubGroupRow}
                            >
                              {!isReorderingPublic && !pg.members?.includes(user?.uid) && (
                                <TouchableOpacity
                                  onPress={() => handleJoinGroup(pg.id)}
                                  disabled={joiningGroupIds.has(pg.id)}
                                  style={styles.joinGroupBtn}
                                  hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                                >
                                  <Text style={styles.joinGroupBtnText}>
                                    {joiningGroupIds.has(pg.id) ? '…' : 'Join'}
                                  </Text>
                                </TouchableOpacity>
                              )}
                              <View style={styles.pubGroupCreatorAvatar}>
                                {pgCreator?.profilePhoto ? (
                                  <Image source={{ uri: pgCreator.profilePhoto }} style={styles.groupCreatorImage} />
                                ) : (
                                  <View style={styles.groupCreatorPlaceholder}>
                                    <Ionicons name="person" size={14} color="#666" />
                                  </View>
                                )}
                              </View>
                              <Text style={styles.pubGroupName} numberOfLines={1}>{pg.name || '------'}</Text>
                              {pgActive && !isReorderingPublic && (
                                <Animated.View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#1a1a1a', marginLeft: 6, transform: [{ scale: activityDotScale }], opacity: activityDotOpacity }} />
                              )}
                              {isReorderingPublic ? (
                                <View style={styles.reorderArrows}>
                                  {(() => {
                                    const pgIsMember = pg.members?.includes(user?.uid);
                                    const upDisabled = index === 0 || pgIsMember !== sortedPublicGroups[index - 1]?.members?.includes(user?.uid);
                                    const downDisabled = index === sortedPublicGroups.length - 1 || pgIsMember !== sortedPublicGroups[index + 1]?.members?.includes(user?.uid);
                                    return (<>
                                  <TouchableOpacity
                                    onPress={() => handleMoveGroup('public', index, -1, sortedPublicGroups)}
                                    style={[styles.reorderArrowBtn, upDisabled && { opacity: 0.2 }]}
                                    disabled={upDisabled}
                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                  >
                                    <Animated.View style={{ opacity: reorderArrowOpacity }}>
                                      <Ionicons name="chevron-up" size={16} color="rgba(0,0,0,0.85)" />
                                    </Animated.View>
                                  </TouchableOpacity>
                                  <TouchableOpacity
                                    onPress={() => handleMoveGroup('public', index, 1, sortedPublicGroups)}
                                    style={[styles.reorderArrowBtn, downDisabled && { opacity: 0.2 }]}
                                    disabled={downDisabled}
                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                  >
                                    <Animated.View style={{ opacity: reorderArrowOpacity }}>
                                      <Ionicons name="chevron-down" size={16} color="rgba(0,0,0,0.85)" />
                                    </Animated.View>
                                  </TouchableOpacity>
                                  </>); })()}
                                </View>
                              ) : (
                                <Ionicons name="chevron-forward" size={18} color="rgba(0,0,0,0.4)" style={{ marginLeft: 8 }} />
                              )}
                            </LinearGradient>
                          </TouchableOpacity>
                        </Swipeable>
                      </View>
                    );
                  })}
                  {groups.length < MAX_GROUPS && sortedPublicGroups.length < MAX_PUBLIC_GROUPS && !isReorderingPublic && (
                    <TouchableOpacity style={styles.pubGroupPlaceholder} onPress={() => handleCreateGroup(true)}>
                      <Text style={styles.emptyText}>make your group public</Text>
                    </TouchableOpacity>
                  )}
                </ScrollView>
              </View>
            </BlurView>
          </View>

          {/* ---- Events ---- */}
          {events.length > 0 && (
          <Animated.View style={{ transform: [{ scale: bounceEvents.scale }] }}>
          <BlurView intensity={10} tint="dark" style={styles.eventsGlass}>
          <TouchableOpacity
            style={styles.eventsContainer}
            onPress={() => navigation.navigate('EventsLanding')}
            onPressIn={bounceEvents.onPressIn}
            onPressOut={bounceEvents.onPressOut}
            activeOpacity={0.9}
          >
            <Text style={styles.subSectionTitleLight}>Events {'>'}</Text>
            {events.length > 0 ? (
              <>
                {events.slice(0, 3).map((evt, index) => (
                  <View
                    key={evt.id}
                    style={[
                      styles.eventPreviewRow,
                      index === 2 && { opacity: 0.35 },
                    ]}
                  >
                    <Image
                      source={getEventImageSource(evt.imageUrl, evt.id)}
                      style={styles.eventPreviewImage}
                    />
                    <View style={styles.eventPreviewInfo}>
                      <Text style={styles.eventPreviewTitle} numberOfLines={1}>{evt.title}</Text>
                      <Text style={styles.eventPreviewDate}>
                        {formatEventDate(evt.date)}
                        {evt.time ? ` · ${evt.time}` : ''}
                      </Text>
                    </View>
                  </View>
                ))}
                <Text style={styles.seeAllText}>See All</Text>
              </>
            ) : (
              <View style={[styles.eventPreviewRow, { marginBottom: 0 }]}>
                <View style={[styles.eventPreviewImage, styles.ghostImage]} />
                <View style={styles.eventPreviewInfo}>
                  <View style={styles.createEventBox}>
                    <Text style={styles.createEventText}>create your next event</Text>
                  </View>
                </View>
              </View>
            )}
          </TouchableOpacity>
          </BlurView>
          </Animated.View>
          )}
          </>
          )}
        </View>
        </Animated.View>

        {/* ==================== MY PRIVATE GROUPS ==================== */}
        <Animated.View style={{ opacity: sectionFadePrivate, transform: [{ translateY: sectionSlidePrivate }] }}>
        <BlurView intensity={10} tint="dark" style={styles.privateGroupsGlass}>
          <View style={styles.privateGroupsSection}>
            {/* Section Header — tap to toggle collapse, or tap to exit reorder mode */}
            <TouchableOpacity style={styles.sectionHeaderRow} onPress={isReorderingPrivate ? () => exitReorderMode('private', sortedGroups) : togglePrivateGroups} activeOpacity={0.7}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                {!isReorderingPrivate && (
                  <Animated.View style={{ transform: [{ rotate: privateChevronRotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '90deg'] }) }], marginRight: 8 }}>
                    <Ionicons name="chevron-forward" size={16} color="#bbbbbb" />
                  </Animated.View>
                )}
                <View>
                  <Animated.Text style={[styles.privateGroupsTitle, { opacity: shimmerPrivate.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0.6, 1] }) }]}>My Private Groups</Animated.Text>
                  {privateGroupsExpanded && groups.length > 0 && <Text style={styles.groupCounter}>{groups.length}/50 max groups authored</Text>}
                  {privateGroupsExpanded && <Text style={styles.pinHintText}>{isReorderingPrivate ? 'tap here to finish' : 'hold to reorder'}</Text>}
                </View>
              </View>
              {!isReorderingPrivate && privateGroupsExpanded ? (
                <Animated.View style={{ transform: [{ scale: bounceAddGroup.scale }] }}>
                <TouchableOpacity
                  style={[styles.addButton, { shadowColor: 'transparent', shadowOpacity: 0 }, groups.length >= MAX_GROUPS && styles.addButtonDisabled]}
                  onPress={() => handleCreateGroup(false)}
                  onPressIn={bounceAddGroup.onPressIn}
                  onPressOut={bounceAddGroup.onPressOut}
                  disabled={groups.length >= MAX_GROUPS}
                  activeOpacity={0.9}
                >
                  <View style={[styles.addButtonGradient, { backgroundColor: '#222222', borderColor: 'rgba(255,255,255,0.1)', borderTopColor: 'rgba(255,255,255,0.15)', borderLeftColor: 'rgba(255,255,255,0.12)' }]}>
                    <Ionicons name="add" size={12} color="#bbbbbb" />
                    <Text style={[styles.addButtonText, { color: '#bbbbbb' }]}>Private Group</Text>
                  </View>
                </TouchableOpacity>
                </Animated.View>
              ) : null}
            </TouchableOpacity>

          {/* Groups Scrollable Container — collapsible */}
          <Animated.View style={{ maxHeight: privateGroupsHeight.interpolate({ inputRange: [0, 1], outputRange: [0, 400] }), overflow: 'hidden', opacity: privateGroupsHeight }}>
          <View style={styles.groupsContainer}>
            {!groupsLoaded ? (
              <View style={{ paddingVertical: 4 }}>
                <SkeletonGroupRow delay={0} />
                <SkeletonGroupRow delay={150} />
                <SkeletonGroupRow delay={300} />
              </View>
            ) : (
              <Animated.View style={{ opacity: groupsFade }}>
                <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false} style={{ maxHeight: 190 }}>
                  {sortedGroups.map((group, index) => {
                    const active = isGroupActive(group);
                    const creator = groupCreators[group.creatorId];
                    return (
                      <View key={group.id}>
                        <Swipeable
                          renderRightActions={(progress, dragX) => renderGroupDeleteAction(progress, dragX, group)}
                          rightThreshold={40}
                          overshootRight={false}
                          enabled={!isReorderingPrivate}
                        >
                          <TouchableOpacity
                            style={[styles.groupRowOuter, !active && styles.groupRowInactive]}
                            onPress={() => { if (!isReorderingPrivate) handleGroupPress(group.id); }}
                            onLongPress={() => { if (!isReorderingPrivate) enterReorderMode('private'); }}
                            delayLongPress={400}
                            activeOpacity={0.9}
                          >
                            <View style={[styles.groupRow, { backgroundColor: isReorderingPrivate ? '#ffffff' : '#222222' }]}>
                              <View style={styles.groupCreatorAvatar}>
                                {creator?.profilePhoto ? (
                                  <Image source={{ uri: creator.profilePhoto }} style={styles.groupCreatorImage} />
                                ) : (
                                  <View style={styles.groupCreatorPlaceholder}>
                                    <Ionicons name="person" size={12} color="#999" />
                                  </View>
                                )}
                              </View>
                              <Text style={[styles.groupName, { color: isReorderingPrivate ? '#000000' : '#bbbbbb' }]} numberOfLines={1}>{group.name || '------'}</Text>
                              {active && !isReorderingPrivate && (
                                <Animated.View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#bbbbbb', marginLeft: 6, transform: [{ scale: activityDotScale }], opacity: activityDotOpacity }} />
                              )}
                              {isReorderingPrivate ? (
                                <View style={styles.reorderArrows}>
                                  <TouchableOpacity
                                    onPress={() => handleMoveGroup('private', index, -1, sortedGroups)}
                                    style={[styles.reorderArrowBtn, index === 0 && { opacity: 0.2 }]}
                                    disabled={index === 0}
                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                  >
                                    <Animated.View style={{ opacity: reorderArrowOpacity }}>
                                      <Ionicons name="chevron-up" size={16} color="rgba(0,0,0,0.85)" />
                                    </Animated.View>
                                  </TouchableOpacity>
                                  <TouchableOpacity
                                    onPress={() => handleMoveGroup('private', index, 1, sortedGroups)}
                                    style={[styles.reorderArrowBtn, index === sortedGroups.length - 1 && { opacity: 0.2 }]}
                                    disabled={index === sortedGroups.length - 1}
                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                  >
                                    <Animated.View style={{ opacity: reorderArrowOpacity }}>
                                      <Ionicons name="chevron-down" size={16} color="rgba(0,0,0,0.85)" />
                                    </Animated.View>
                                  </TouchableOpacity>
                                </View>
                              ) : (
                                <Ionicons name="chevron-forward" size={16} color="rgba(187,187,187,0.6)" style={{ marginLeft: 8 }} />
                              )}
                            </View>
                          </TouchableOpacity>
                        </Swipeable>
                      </View>
                    );
                  })}
                  {sortedGroups.length < MAX_GROUPS && !isReorderingPrivate && (
                    <TouchableOpacity style={styles.groupPlaceholder} onPress={() => handleCreateGroup(false)}>
                      <Text style={styles.emptyText}>create a group</Text>
                    </TouchableOpacity>
                  )}
                </ScrollView>
              </Animated.View>
            )}
          </View>
          </Animated.View>
          </View>
        </BlurView>
        </Animated.View>

      </ScrollView>

      {/* Notification Modal */}
      <NotificationListModal
        visible={notificationModalVisible}
        notifications={notifications}
        onClose={handleCloseNotifications}
        userId={user?.uid}
        onNavigate={({ route, params }) => navigation.navigate(route, params)}
      />

      {/* Group Delete/Leave Confirm Modal */}
      <ConfirmModal
        visible={groupConfirmModal.visible}
        title={groupConfirmModal.group?.creatorId === user?.uid ? 'Delete Group' : 'Leave Group'}
        message={
          groupConfirmModal.group?.creatorId === user?.uid
            ? `Are you sure you want to delete "${groupConfirmModal.group?.name}"? This will remove the group for all members.`
            : `Are you sure you want to leave "${groupConfirmModal.group?.name}"?`
        }
        confirmText={groupConfirmModal.group?.creatorId === user?.uid ? 'Delete' : 'Leave'}
        onConfirm={handleConfirmRemoveGroup}
        onCancel={() => setGroupConfirmModal({ visible: false, group: null })}
      />
    </SafeAreaView>
  );
};

// ==================== STYLES ====================

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#000000',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 120,
  },

  // ---- Header ----
  headerSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 20,
  },
  avatarWrapper: {
    flex: 1,
    position: 'relative',
  },
  glassContainer: {
    flex: 1,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderTopWidth: 1.5,
    borderLeftWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderTopColor: 'rgba(255, 255, 255, 0.35)',
    borderLeftColor: 'rgba(255, 255, 255, 0.25)',
    height: 200,
    shadowColor: 'rgba(255, 255, 255, 0.15)',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 4,
  },
  glassInner: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
  },
  avatarContainer: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  avatarPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#a3a3a3',
  },
  bellOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 30,
    height: 30,
    borderRadius: 20,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#000',
    zIndex: 10,
  },
  bellOverlayInactive: {
    backgroundColor: '#333',
    borderColor: '#555',
    opacity: 0.9,
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  diamondIndicator: {
    position: 'absolute',
    bottom: -5,
    right: 8,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 10,
    elevation: 6,
    zIndex: 10,
  },
  starSpikeV: {
    position: 'absolute',
    width: 4,
    height: 18,
    borderRadius: 2,
    backgroundColor: colors.primary,
  },
  starSpikeH: {
    position: 'absolute',
    width: 18,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.primary,
  },

  // ---- Section Container ----
  privateGroupsGlass: {
    marginBottom: 16,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderTopColor: 'rgba(255, 255, 255, 0.35)',
    borderLeftColor: 'rgba(255, 255, 255, 0.25)',
    shadowColor: 'rgba(255, 255, 255, 0.15)',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 12,
  },
  privateGroupsSection: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  privateGroupsTitle: {
    fontSize: 15,
    fontFamily: fonts.regular,
    color: '#ffffff',
  },
  sectionContainer: {
    backgroundColor: '#000000',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.primary,
    padding: 16,
    marginBottom: 16,
  },
  gatedOverlay: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  gatedOverlayTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: fonts.bold,
    marginTop: 12,
    marginBottom: 8,
  },
  gatedOverlayMessage: {
    color: '#AAAAAA',
    fontSize: 13,
    fontFamily: fonts.regular,
    textAlign: 'center',
    lineHeight: 18,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: fonts.bold,
    color: colors.primary,
  },
  // ---- Add Button ----
  addButton: {
    borderRadius: 14,
    shadowColor: '#23ff0d',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  addButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 14,
    borderRadius: 14,
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderTopColor: 'rgba(255, 255, 255, 0.5)',
    borderLeftColor: 'rgba(255, 255, 255, 0.4)',
    borderBottomColor: 'rgba(0, 0, 0, 0.08)',
    borderRightColor: 'rgba(0, 0, 0, 0.05)',
    overflow: 'hidden',
  },
  addButtonHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
  },
  addButtonText: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: '#1a1a1a',
    marginLeft: 2,
  },
  addButtonDisabled: {
    opacity: 0.4,
  },

  // ---- Group Counter ----
  groupCounter: {
    fontSize: 11,
    fontFamily: fonts.mono,
    color: '#8a8a8a',
    marginTop: 5,
  },

  // ---- Groups Container ----
  groupsContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 16,
    padding: 6,
    paddingBottom: 2,
    marginTop: 4,
  },
  groupsScrollRow: {
    flexDirection: 'row',
  },
  groupsScrollView: {
    flex: 1,
    // maxHeight applied inline only when > 3 groups (148px = 3 rows)
  },
  groupsScrollTrack: {
    width: 4,
    backgroundColor: '#555555',
    borderRadius: 2,
    marginLeft: 8,
    alignSelf: 'stretch',
  },
  groupsScrollThumb: {
    width: 4,
    height: 40,
    backgroundColor: '#aaaaaa',
    borderRadius: 2,
  },
  groupRowOuter: {
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.8)',
    borderLeftColor: 'rgba(255, 255, 255, 0.6)',
    borderBottomColor: 'rgba(0, 0, 0, 0.08)',
    borderRightColor: 'rgba(0, 0, 0, 0.05)',
  },
  groupRowInactive: {
    opacity: 0.4,
  },
  groupCreatorAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    overflow: 'hidden',
    marginRight: 10,
    backgroundColor: '#555',
  },
  groupCreatorImage: {
    width: '100%',
    height: '100%',
  },
  groupCreatorPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#a3a3a3',
  },
  groupName: {
    flex: 1,
    fontSize: 13,
    fontFamily: fonts.medium,
    color: '#1a1a1a',
  },
  groupDeleteAction: {
    backgroundColor: colors.tertiary,
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    borderRadius: 10,
    marginBottom: 8,
  },
  groupDeleteButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
  },
  groupPlaceholder: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.tertiary,
    borderStyle: 'dashed',
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginBottom: 8,
    minHeight: 36,
    opacity: 0.5,
  },
  emptyText: {
    fontSize: 12,
    fontFamily: fonts.italic,
    color: colors.offline,
  },

  // ---- Add Chat Button (matches addButton sizing) ----
  addChatButtonOuter: {
    borderRadius: 14,
    shadowColor: '#23ff0d',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  addChatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 14,
    borderRadius: 14,
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderTopColor: 'rgba(255, 255, 255, 0.5)',
    borderLeftColor: 'rgba(255, 255, 255, 0.4)',
    borderBottomColor: 'rgba(0, 0, 0, 0.08)',
    borderRightColor: 'rgba(0, 0, 0, 0.05)',
    overflow: 'hidden',
  },
  addChatButtonHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
  },
  addChatButtonText: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: colors.textDark,
  },

  // ---- Action Buttons Row ----
  actionButtonRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 16,
  },
  actionGlassButton: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderTopColor: 'rgba(255, 255, 255, 0.5)',
    borderLeftColor: 'rgba(255, 255, 255, 0.4)',
    borderBottomColor: 'rgba(255, 255, 255, 0.2)',
    borderRightColor: 'rgba(255, 255, 255, 0.15)',
  },
  actionGlassButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 6,
  },
  actionGlassButtonText: {
    fontSize: 11,
    fontFamily: fonts.medium,
    color: '#ffffff',
  },

  // ---- Cyber Lounge ----
  cyberLoungeContainer: {
    marginBottom: 16,
    marginTop: 10,
  },
  cyberLoungeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    marginTop: 0,
  },

  roomsScrollContainer: {
    borderWidth: 1,
    borderColor: '#383838',
    borderRadius: 12,
    overflow: 'hidden',
    minHeight: 44,
  },
  roomsScrollRow: {
    flexDirection: 'row',
    maxHeight: 120,
  },
  roomsScrollView: {
    flex: 1,
    padding: 8,
    // maxHeight applied inline only when > 2 rooms (85px = 2 rows)
  },
  roomsScrollTrack: {
    width: 4,
    backgroundColor: '#555555',
    borderRadius: 2,
    marginRight: 6,
    marginVertical: 8,
    alignSelf: 'stretch',
    overflow: 'hidden',
  },
  roomsScrollThumbStyle: {
    width: 4,
    height: 30,
    backgroundColor: '#aaaaaa',
    borderRadius: 2,
  },
  roomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(34, 255, 10, 0.15)',
  },
  roomAvatarBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 10,
  },
  roomAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#000',
  },
  roomAvatarPlaceholder: {
    backgroundColor: '#555',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roomParticipantCountText: {
    fontSize: 8,
    fontFamily: fonts.bold,
    color: '#fff',
  },
  roomActivityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
    marginLeft: 4,
  },
  roomName: {
    flex: 1,
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.textPrimary
  },
  roomsEmptyContainer: {
    flex: 1,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roomsEmptyText: {
    fontSize: 11,
    fontFamily: fonts.italic,
    color: colors.offline,
    textAlign: 'center',
  },

  // ---- Mutual Aid Button ----
  mutualAidButtonOuter: {
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 16,
  },
  mutualAidButton: {
    paddingVertical: 11,
    paddingHorizontal: 18,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.8)',
    borderLeftColor: 'rgba(255, 255, 255, 0.6)',
    borderBottomColor: 'rgba(0, 0, 0, 0.08)',
    borderRightColor: 'rgba(0, 0, 0, 0.05)',
  },
  mutualAidButtonText: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: '#ffffff',
  },

  // ---- Public Groups ----
  publicGroupsSection: {
    marginTop: 16,
    marginBottom: 16,
  },
  publicGroupsGlass: {
    marginTop: 10,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderTopColor: 'rgba(255, 255, 255, 0.35)',
    borderLeftColor: 'rgba(255, 255, 255, 0.25)',
    shadowColor: 'rgba(255, 255, 255, 0.15)',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 12,
  },
  publicGroupsTitle: {
    fontSize: 16,
    fontFamily: fonts.regular,
    color: colors.primary,
  },
  publicGroupCounter: {
    fontSize: 11,
    fontFamily: fonts.mono,
    color: '#8a8a8a',
    marginTop: 5,
  },
  pinHintText: {
    fontSize: 10,
    fontFamily: fonts.regular,
    color: '#666666',
    marginTop: 3,
  },
  publicGroupsContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    padding: 8,
    paddingBottom: 2,
  },
  pubGroupRowOuter: {
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  pubGroupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.8)',
    borderLeftColor: 'rgba(255, 255, 255, 0.6)',
    borderBottomColor: 'rgba(0, 0, 0, 0.08)',
    borderRightColor: 'rgba(0, 0, 0, 0.05)',
  },
  pubGroupCreatorAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    overflow: 'hidden',
    marginRight: 10,
    backgroundColor: '#555',
  },
  pubGroupName: {
    flex: 1,
    fontSize: 13,
    fontFamily: fonts.medium,
    color: '#1a1a1a',
  },
  pubGroupPlaceholder: {
    flexDirection: 'row',
    borderRadius: 14,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginBottom: 8,
    minHeight: 36,
    borderWidth: 1,
    borderColor: colors.tertiary,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.5,
  },

  // ---- Confluences ----
  confluenceGlass: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderTopColor: 'rgba(255, 255, 255, 0.35)',
    borderLeftColor: 'rgba(255, 255, 255, 0.25)',
    shadowColor: 'rgba(255, 255, 255, 0.15)',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 12,
    marginBottom: 16,
    marginTop: 2,
  },
  confluenceContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 20,
    padding: 12,
  },
  subSectionTitle: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: colors.textGreen,
  },
  subSectionTitleLight: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: colors.textGreen,
    marginBottom: 10,
  },
  confluenceImagesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  confluenceImageFrame: {
    flex: 1,
    aspectRatio: 5/6,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
  },
  confluenceImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  confluenceEmptyText: {
    fontSize: 11,
    fontFamily: fonts.italic,
    color: colors.offline,
    textAlign: 'center',
    paddingVertical: 20,
  },

  // ---- Events ----
  eventsGlass: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderTopColor: 'rgba(255, 255, 255, 0.35)',
    borderLeftColor: 'rgba(255, 255, 255, 0.25)',
    shadowColor: 'rgba(255, 255, 255, 0.15)',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 12,
  },
  eventsContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 20,
    padding: 12,
  },
  eventPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  eventPreviewImage: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: '#1a1a1a',
    overflow: 'hidden',
  },
  eventPreviewInfo: {
    flex: 1,
    marginLeft: 12,
  },
  eventPreviewTitle: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: '#ffffff',
  },
  eventPreviewDate: {
    fontSize: 11,
    fontFamily: fonts.mono,
    color: '#ffffff',
    marginTop: 2,
  },
  ghostImage: {
    backgroundColor: '#2a2a2a',
    borderWidth: 1,
    borderColor: '#333',
    borderStyle: 'dashed',
  },
  createEventBox: {
    borderWidth: 1,
    borderColor: colors.tertiary,
    borderStyle: 'dashed',
    borderRadius: 8,
    paddingVertical: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  createEventText: {
    fontSize: 12,
    fontFamily: fonts.italic,
    color: colors.offline,
  },
  seeAllText: {
    fontSize: 11,
    fontFamily: fonts.regular,
    color: colors.textGreen,
    textDecorationLine: 'underline',
    alignSelf: 'flex-end',
    marginTop: 2,
  },

  // ---- Reorder Mode ----
  reorderArrows: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  reorderArrowBtn: {
    paddingHorizontal: 4,
  },
  joinGroupBtn: {
    backgroundColor: 'rgba(0,0,0,0.18)',
    borderRadius: 8,
    paddingVertical: 2,
    paddingHorizontal: 7,
    marginRight: 8,
  },
  joinGroupBtnText: {
    fontSize: 11,
    fontFamily: fonts.medium,
    color: '#1a1a1a',
    fontWeight: '600',
  },
  reorderRowGlow: {
    shadowColor: '#22ff0a',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 10,
    elevation: 8,
    borderRadius: 14,
  },

});

export default DashboardScreen;
