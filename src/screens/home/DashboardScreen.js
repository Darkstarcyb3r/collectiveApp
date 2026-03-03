// DashboardScreen — Main home screen / app dashboard
// Combines Private Groups + Public Network sections into one scrollable view
// Replaces the old ProfileScreen home tab, Groups tab, and Everyone tab


import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
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
import { getUserGroups, deleteGroup, leaveGroup, getMemberProfiles } from '../../services/groupService';
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
import { firestore } from '../../config/firebase';
import * as Notifications from 'expo-notifications';

const MAX_GROUPS = 50;

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

const DashboardScreen = ({ navigation }) => {
  const { user, userProfile, refreshUserProfile } = useAuth();
  const { showTabBar, hideTabBar, resetTimer, notificationModalRequested, clearNotificationModalRequest } = useTabBar();

  // --- State ---
  const [groups, setGroups] = useState([]);
  const [groupCreators, setGroupCreators] = useState({}); // { creatorId: { name, profilePhoto } }
  const [groupLastVisited, setGroupLastVisited] = useState({}); // { groupId: timestamp }
  const [rooms, setRooms] = useState([]);
  const [roomParticipantProfiles, setRoomParticipantProfiles] = useState({}); // { roomId: [profiles] }
  const [confluencePosts, setConfluencePosts] = useState([]);
  const [events, setEvents] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadDMCount, setUnreadDMCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [notificationModalVisible, setNotificationModalVisible] = useState(false);
  const [allNetworkUsers, setAllNetworkUsers] = useState([]);
  const lastScrollY = useRef(0);
  const groupsScrollThumb = useRef(new Animated.Value(0)).current;
  const roomsScrollThumbAnim = useRef(new Animated.Value(0)).current;
  const [groupConfirmModal, setGroupConfirmModal] = useState({ visible: false, group: null });
  const onboardingComplete = userProfile?.onboardingComplete === true;
  const diamondScale = useRef(new Animated.Value(1)).current;
  const diamondOpacity = useRef(new Animated.Value(0.8)).current;
  const pulseAnimRef = useRef(null);
  // Excluded users (hidden/blocked)
  const hiddenUsers = userProfile?.hiddenUsers || [];
  const blockedUsers = userProfile?.blockedUsers || [];
  const blockedBy = userProfile?.blockedBy || [];
  const excludedUsers = [...new Set([...hiddenUsers, ...blockedUsers, ...blockedBy])];
  const myFollowingUsers = userProfile?.subscribedUsers || [];

  // --- Data Fetching ---

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
  }, [onboardingComplete]);

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

  // Badge count is set server-side via the push notification payload.
  // No client-side setBadgeCountAsync here — competing badge setters cause jumping.

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
    await Promise.all([fetchGroups(), refreshUserProfile()]);
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
      
      // Recalculate badge count
      const [notifSnapshot, convosSnapshot] = await Promise.all([
        firestore().collection("users").doc(user.uid)
          .collection("notifications").where("read", "==", false).count().get(),
        firestore().collection("conversations")
          .where("participants", "array-contains", user.uid)
          .where(`unread_${user.uid}`, "==", true).count().get(),
      ]);
      
      const totalUnread = notifSnapshot.data().count + convosSnapshot.data().count;
      await Notifications.setBadgeCountAsync(totalUnread);
    }
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
  };

  const handleGroupsScroll = (event) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const scrollableHeight = contentSize.height - layoutMeasurement.height;
    if (scrollableHeight > 0) {
      const scrollPercent = contentOffset.y / scrollableHeight;
      const trackHeight = 126; // matches groupsScrollView height
      const thumbHeight = 40;
      const maxThumbOffset = trackHeight - thumbHeight;
      groupsScrollThumb.setValue(scrollPercent * maxThumbOffset);
    }
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

  const handleCreateGroup = () => {
    if (groups.length >= MAX_GROUPS) {
      Alert.alert('Group Limit', `You've reached the maximum of ${MAX_GROUPS} groups.`);
      return;
    }
    navigation.navigate('CreateGroup');
  };

  const handleGroupPress = (groupId) => {
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
      fetchGroups();
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

  const formatUserCount = (count) => {
    return count.toString().padStart(6, '0');
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
  const sortedGroups = [...groups].sort((a, b) => {
    const aActive = isGroupActive(a) ? 1 : 0;
    const bActive = isGroupActive(b) ? 1 : 0;
    return bActive - aActive;
  });

  // --- Event Date Formatter ---
  const formatEventDate = (dateVal) => {
    if (!dateVal) return '';
    const d = dateVal instanceof Date ? dateVal : dateVal.toDate ? dateVal.toDate() : new Date(dateVal);
    const days = ['Sun', 'Mon', 'Tues', 'Weds', 'Thurs', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${days[d.getDay()]} ${months[d.getMonth()]} ${d.getDate()}`;
  };

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

       {/* ==================== HEADER ==================== */}
<View style={styles.headerSection}>
  {/* Avatar + Bell in glass container */}
  <View style={styles.avatarWrapper}>
    <BlurView intensity={10} tint="dark" style={styles.glassContainer}>
      <View style={styles.glassInner}>
        <TouchableOpacity onPress={() => navigation.navigate('ProfileTab')} style={{ flex: 1, width: '100%' }}>
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
    <TouchableOpacity
      style={[styles.bellOverlay, unreadCount === 0 && styles.bellOverlayInactive]}
      onPress={handleOpenNotifications}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      activeOpacity={0.7}
    >
      <Ionicons name="notifications" size={12} color={unreadCount > 0 ? '#000' : '#555'} />
    </TouchableOpacity>
  </View>

  {/* Logo */}
  <TouchableOpacity
    onPress={() => navigation.navigate('Onboarding')}
    activeOpacity={0.8}
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
</View>


        {/* ==================== =MY PRIVATE GROUPS ==================== */}
        <BlurView intensity={10} tint="dark" style={styles.privateGroupsGlass}>
          <View style={styles.privateGroupsSection}>
            {/* Section Header */}
            <View style={styles.sectionHeaderRow}>
              <View>
                <Text style={styles.privateGroupsTitle}>My Private Groups</Text>
                <Text style={styles.groupCounter}>{groups.length}/{MAX_GROUPS} groups</Text>
              </View>
              <TouchableOpacity
                style={[styles.addButton, groups.length >= MAX_GROUPS && styles.addButtonDisabled]}
                onPress={handleCreateGroup}
                disabled={groups.length >= MAX_GROUPS}
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
                  <Text style={styles.addButtonText}>Group</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>

          {/* Groups Scrollable Container */}
          <View style={styles.groupsContainer}>
              <View style={styles.groupsScrollRow}>
                <ScrollView
                  style={[styles.groupsScrollView, { height: 115 }]}
                  nestedScrollEnabled={true}
                  showsVerticalScrollIndicator={false}
                  onScroll={handleGroupsScroll}
                  scrollEventThrottle={16}
                  scrollEnabled={sortedGroups.length > 3}
                >
                  {sortedGroups.map((group) => {
                    const active = isGroupActive(group);
                    const creator = groupCreators[group.creatorId];
                    return (
                      <Swipeable
                        key={group.id}
                        renderRightActions={(progress, dragX) => renderGroupDeleteAction(progress, dragX, group)}
                        rightThreshold={40}
                        overshootRight={false}
                      >
                        <TouchableOpacity
                          style={[styles.groupRowOuter, !active && styles.groupRowInactive]}
                          onPress={() => handleGroupPress(group.id)}
                          activeOpacity={0.8}
                        >
                          <LinearGradient
                            colors={['#d8f434', '#b3f425', '#93f478']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.groupRow}
                          >
                            {/* Creator Avatar */}
                            <View style={styles.groupCreatorAvatar}>
                              {creator?.profilePhoto ? (
                                <Image source={{ uri: creator.profilePhoto }} style={styles.groupCreatorImage} />
                              ) : (
                                <View style={styles.groupCreatorPlaceholder}>
                                  <Ionicons name="person" size={12} color="#666" />
                                </View>
                              )}
                            </View>

                            {/* Group Name */}
                            <Text style={styles.groupName} numberOfLines={1}>{group.name || '------'}</Text>

                            {/* Arrow */}
                            <Ionicons name="chevron-forward" size={16} color="rgba(0,0,0,0.4)" style={{ marginLeft: 8 }} />
                          </LinearGradient>
                        </TouchableOpacity>
                      </Swipeable>
                    );
                  })}
                  {/* Ghost placeholder rows */}
                  {sortedGroups.length < MAX_GROUPS && (
                    sortedGroups.length < 3
                      ? Array.from({ length: 3 - sortedGroups.length }, (_, i) => (
                          <TouchableOpacity
                            key={`placeholder-${i}`}
                            style={styles.groupPlaceholder}
                            onPress={handleCreateGroup}
                          >
                            <Text style={styles.emptyText}>create a group</Text>
                          </TouchableOpacity>
                        ))
                      : (
                          <TouchableOpacity
                            key="placeholder-extra"
                            style={styles.groupPlaceholder}
                            onPress={handleCreateGroup}
                          >
                            <Text style={styles.emptyText}>create a group</Text>
                          </TouchableOpacity>
                        )
                  )}
                </ScrollView>

                {/* Always-visible scroll track */}
                <View style={styles.groupsScrollTrack}>
                  {sortedGroups.length > 3 && (
                    <Animated.View
                      style={[
                        styles.groupsScrollThumb,
                        { transform: [{ translateY: groupsScrollThumb }] },
                      ]}
                    />
                  )}
                </View>
              </View>
          </View>
          </View>
        </BlurView>

        {/* ==================== MY PUBLIC COLLECTIVE ==================== */}
        <View style={[styles.sectionContainer, !userProfile?.everyoneNetworkEnabled && { opacity: 0.35 }]}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>My Public Collective</Text>
            {userProfile?.everyoneNetworkEnabled && (
              <TouchableOpacity
                onPress={() => navigation.navigate('ActiveUsers')}
                activeOpacity={0.8}
              >
                <BlurView intensity={10} tint="dark" style={styles.usersButton}>
                  <View style={styles.usersButtonInner}>
                    <Text style={styles.usersButtonText}>{formatUserCount(networkUserCount)} users</Text>
                    <Ionicons name="arrow-forward" size={12} color="#ffffff" />
                  </View>
                </BlurView>
              </TouchableOpacity>
            )}
          </View>

          {!userProfile?.everyoneNetworkEnabled && (
            <View style={styles.gatedOverlay}>
              <Ionicons name="globe-outline" size={36} color="#888888" />
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
              <TouchableOpacity
                style={styles.addChatButtonOuter}
                onPress={() => navigation.navigate('CyberLoungeCreate')}
                activeOpacity={0.8}
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
                  <Text style={styles.addChatButtonText}>Chat</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>

            {/* Rooms Preview */}
            <View style={styles.roomsScrollContainer}>
              {rooms.length === 0 ? (
                <View style={styles.roomsEmptyContainer}>
                  <Text style={styles.roomsEmptyText}>No active chatrooms</Text>
                </View>
              ) : (
                <View style={styles.roomsScrollRow}>
                  <ScrollView
                    nestedScrollEnabled={true}
                    showsVerticalScrollIndicator={false}
                    style={[
                      styles.roomsScrollView,
                      rooms.slice(0, 10).length > 2 && { maxHeight: 170 },
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
                          <View style={styles.roomActivityDot} />
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
                </View>
              )}
            </View>
          </View>

          {/* ---- Confluence ---- */}
          <BlurView intensity={10} tint="dark" style={styles.confluenceGlass}>
            <TouchableOpacity
              style={styles.confluenceContainer}
              onPress={() => navigation.navigate('ConfluenceLanding')}
            >
              <Text style={styles.subSectionTitleLight}>Confluence {'>'}</Text>
              <View style={styles.confluenceImagesRow}>
                {confluencePosts.length > 0 ? (
                  <>
                    <View style={styles.confluenceImageFrame}>
                      <Image
                        source={{ uri: confluencePosts[0]?.imageUrl }}
                        style={styles.confluenceImage}
                      />
                    </View>
                    {confluencePosts.length > 1 && (
                      <View style={styles.confluenceImageFrame}>
                        <Image
                          source={{ uri: confluencePosts[1]?.imageUrl }}
                          style={styles.confluenceImage}
                        />
                      </View>
                    )}
                  </>
                ) : (
                  <Text style={styles.confluenceEmptyText}>No posts yet</Text>
                )}
              </View>
            </TouchableOpacity>
          </BlurView>

          {/* ---- Mutual Aid & Resources ---- */}
          <TouchableOpacity
            style={styles.mutualAidButtonOuter}
            onPress={() => navigation.navigate('MutualAidLanding')}
            activeOpacity={0.7}
          >
            <LinearGradient
              colors={['#d8f434', '#b3f425', '#93f478']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.mutualAidButton}
            >
              <Text style={styles.mutualAidButtonText}>Mutual Aid & Resources {'>'}</Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* ---- Events ---- */}
          <BlurView intensity={10} tint="dark" style={styles.eventsGlass}>
          <TouchableOpacity
            style={styles.eventsContainer}
            onPress={() => navigation.navigate('EventsLanding')}
            activeOpacity={0.8}
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
          </>
          )}
        </View>

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
        icon={groupConfirmModal.group?.creatorId === user?.uid ? 'trash-outline' : 'exit-outline'}
        iconColor={groupConfirmModal.group?.creatorId === user?.uid ? undefined : '#FFFFFF'}
        title={groupConfirmModal.group?.creatorId === user?.uid ? 'Delete Group' : 'Leave Group'}
        message={
          groupConfirmModal.group?.creatorId === user?.uid
            ? `Are you sure you want to delete "${groupConfirmModal.group?.name}"? This will remove the group for all members.`
            : `Are you sure you want to remove yourself from "${groupConfirmModal.group?.name}"?`
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
    backgroundColor: '#333',
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
    fontSize: 18,
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
    fontSize: 16,
    fontFamily: fonts.regular,
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
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    paddingVertical: 5,
    paddingHorizontal: 10,
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
    width: 20,
    height: 20,
    borderRadius: 10,
    overflow: 'hidden',
    marginRight: 8,
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
    fontSize: 11,
    fontFamily: fonts.medium,
    color: '#1a1a1a',
  },
  activityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginLeft: 8,
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
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.tertiary,
    borderStyle: 'dashed',
    paddingVertical: 9,
    paddingHorizontal: 10,
    marginBottom: 6,
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

  // ---- Users Button ----
  usersButton: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderTopColor: 'rgba(255, 255, 255, 0.5)',
    borderLeftColor: 'rgba(255, 255, 255, 0.4)',
    shadowColor: '#ffffff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 18,
    elevation: 6,
  },
  usersButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    paddingVertical: 7,
    paddingHorizontal: 16,
    gap: 6,
  },
  usersButtonText: {
    fontSize: 10,
    fontFamily: fonts.mono,
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
    minHeight: 100,
  },
  roomsScrollRow: {
    flexDirection: 'row',
    maxHeight: 170,
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
    minHeight: 100,
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
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 16,
  },
  mutualAidButton: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.8)',
    borderLeftColor: 'rgba(255, 255, 255, 0.6)',
    borderBottomColor: 'rgba(0, 0, 0, 0.08)',
    borderRightColor: 'rgba(0, 0, 0, 0.05)',
  },
  mutualAidButtonText: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: '#1a1a1a',
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
    aspectRatio: 1,
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

});

export default DashboardScreen;
