// Authentication Context - Using @react-native-firebase
import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { auth, firestore } from '../config/firebase';
import { registerForPushNotifications } from '../services/notificationService';
import { registerAdminToken } from '../services/userService';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isProfileSetup, setIsProfileSetup] = useState(false);
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [isAddFriendsComplete, setIsAddFriendsComplete] = useState(true); // default true for existing users
  const appState = useRef(AppState.currentState);

  // Track online presence via AppState
  useEffect(() => {
    const setOnlineStatus = async (isOnline) => {
      const currentUser = auth().currentUser;
      if (currentUser) {
        try {
          await firestore().collection('users').doc(currentUser.uid).update({
            isOnline: isOnline,
          });
        } catch (error) {
          console.log('🔴 Error setting online status:', error.message);
        }
      }
    };

    const handleAppStateChange = (nextAppState) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        // App came to foreground
        setOnlineStatus(true);
      } else if (nextAppState.match(/inactive|background/)) {
        // App went to background
        setOnlineStatus(false);
      }
      appState.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    console.log('[Auth] Starting auth state listener...');

    // Safety timeout — if auth takes longer than 5 seconds, stop loading
    const safetyTimeout = setTimeout(() => {
      console.warn('[Auth] SAFETY TIMEOUT — forcing loading=false after 5s');
      setLoading(false);
    }, 5000);

    const unsubscribe = auth().onAuthStateChanged(async (firebaseUser) => {
      console.log('[Auth] onAuthStateChanged fired, user:', firebaseUser ? firebaseUser.uid : 'null');
      if (firebaseUser) {
        setUser(firebaseUser);
        setIsEmailVerified(firebaseUser.emailVerified || false);
        try {
          // Set user as online — fire-and-forget (don't block loading)
          firestore().collection('users').doc(firebaseUser.uid).update({
            isOnline: true,
          }).catch(() => {}); // Ignore if doc doesn't exist yet (new signup)

          // Fetch user profile with a 4-second timeout
          console.log('[Auth] Fetching user profile...');
          const userDoc = await Promise.race([
            firestore().collection('users').doc(firebaseUser.uid).get(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Profile fetch timeout')), 4000)),
          ]);

          if (userDoc.exists && userDoc.data()) {
            const profileData = { ...userDoc.data(), isOnline: true };
            setUserProfile(profileData);
            setIsProfileSetup(profileData.profileSetup || false);
            setIsAddFriendsComplete(profileData.addFriendsComplete !== false);
            console.log('[Auth] Profile loaded, profileSetup:', profileData.profileSetup);

            // Register for push notifications — fire-and-forget
            registerForPushNotifications(firebaseUser.uid)
              .then((token) => {
                if (token && profileData.isAdmin) {
                  registerAdminToken(firebaseUser.uid, token);
                }
              })
              .catch(() => {});
          } else {
            console.log('[Auth] No profile document found — new user');
            setIsProfileSetup(false);
            setIsAddFriendsComplete(true);
          }
        } catch (error) {
          console.error('[Auth] Error fetching profile:', error.message);
        }
      } else {
        console.log('[Auth] No user — showing login');
        setUser(null);
        setUserProfile(null);
        setIsProfileSetup(false);
        setIsEmailVerified(false);
        setIsAddFriendsComplete(true);
      }
      clearTimeout(safetyTimeout);
      console.log('[Auth] Setting loading=false');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const refreshUserProfile = async () => {
    // Use the current Firebase auth user directly to avoid stale state
    const currentUser = user || auth().currentUser;
    if (currentUser) {
      try {
        const userDoc = await firestore().collection('users').doc(currentUser.uid).get();
        if (userDoc.exists) {
          const profileData = userDoc.data();
          setUser(currentUser);
          setUserProfile(profileData);
          setIsProfileSetup(profileData.profileSetup || false);
          setIsAddFriendsComplete(profileData.addFriendsComplete !== false);

          // Refresh email verification status from Firebase Auth
          try {
            await auth().currentUser?.reload();
            setIsEmailVerified(auth().currentUser?.emailVerified || false);
          } catch (_reloadErr) {
          }
        }
      } catch (error) {
        console.error('🔴 Error refreshing:', error);
      }
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      userProfile,
      loading,
      isProfileSetup,
      setIsProfileSetup,
      isEmailVerified,
      setIsEmailVerified,
      isAddFriendsComplete,
      setIsAddFriendsComplete,
      refreshUserProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
