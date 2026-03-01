// Firebase Configuration - Using Compat mode for Expo Go compatibility
// App Check: Uses native @react-native-firebase for App Attest (iOS) / Play Integrity (Android)
import firebase from 'firebase/compat/app'
import 'firebase/compat/auth'
import 'firebase/compat/firestore'
import 'firebase/compat/storage'
import 'firebase/compat/functions'
import { initializeAuth, getReactNativePersistence } from 'firebase/auth'
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage'
import '@react-native-firebase/app'
import { getAppCheck } from '@react-native-firebase/app-check'

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
}

// Initialize Firebase (JS SDK — used for Firestore, Auth, Storage, Functions)
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig)

  // Initialize Auth with AsyncStorage persistence BEFORE calling firebase.auth()
  // Without this, auth defaults to in-memory storage on React Native and
  // users get logged out every time the app restarts
  initializeAuth(firebase.app(), {
    persistence: getReactNativePersistence(ReactNativeAsyncStorage),
  })
}

// Initialize App Check (native SDK — uses App Attest on iOS, Play Integrity on Android)
// This runs on the native Firebase instance initialized by @react-native-firebase/app
// via GoogleService-Info.plist (iOS) / google-services.json (Android)
try {
  getAppCheck()
  // App Check auto-initializes via the native config plugin
  // Tokens are automatically attached to Firebase requests
} catch (error) {
  console.log('App Check init skipped:', error.message)
}

const auth = firebase.auth()
const db = firebase.firestore()
const storage = firebase.storage()
const functions = firebase.functions()

export { firebase, auth, db, storage, functions }
