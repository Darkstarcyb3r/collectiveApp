// Authentication Context - Using Firebase Compat mode
import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { auth, db } from '../config/firebase';
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
  const appState = useRef(AppState.currentState);

  // Track online presence via AppState
  useEffect(() => {
    const setOnlineStatus = async (isOnline) => {
      const currentUser = auth.currentUser;
      if (currentUser) {
        try {
          await db.collection('users').doc(currentUser.uid).update({
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
    // Safety timeout — if auth takes longer than 10 seconds, stop loading
    const safetyTimeout = setTimeout(() => {
      setLoading(false);
    }, 10000);

    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        setIsEmailVerified(firebaseUser.emailVerified || false);
        try {
          // Set user as online when they authenticate
          await db.collection('users').doc(firebaseUser.uid).update({
            isOnline: true,
          }).catch(() => {}); // Ignore if doc doesn't exist yet (new signup)

          const userDoc = await db.collection('users').doc(firebaseUser.uid).get();
          if (userDoc.exists) {
            const profileData = userDoc.data();
            profileData.isOnline = true; // Reflect the update we just made
            setUserProfile(profileData);
            setIsProfileSetup(profileData.profileSetup || false);

            // Register for push notifications
            registerForPushNotifications(firebaseUser.uid)
              .then((token) => {
                // If user is admin, also save token to adminTokens collection
                if (token && profileData.isAdmin) {
                  registerAdminToken(firebaseUser.uid, token);
                }
              })
              .catch(() => {});
          } else {
            setIsProfileSetup(false);
          }
        } catch (error) {
          console.error('🔴 Error fetching profile:', error);
        }
      } else {
        setUser(null);
        setUserProfile(null);
        setIsProfileSetup(false);
        setIsEmailVerified(false);
      }
      clearTimeout(safetyTimeout);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const refreshUserProfile = async () => {
    // Use the current Firebase auth user directly to avoid stale state
    const currentUser = user || auth.currentUser;
    if (currentUser) {
      try {
        const userDoc = await db.collection('users').doc(currentUser.uid).get();
        if (userDoc.exists) {
          const profileData = userDoc.data();
          setUser(currentUser);
          setUserProfile(profileData);
          setIsProfileSetup(profileData.profileSetup || false);

          // Refresh email verification status from Firebase Auth
          try {
            await auth.currentUser?.reload();
            setIsEmailVerified(auth.currentUser?.emailVerified || false);
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
      refreshUserProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;