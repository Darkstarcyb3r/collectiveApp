// Firebase Configuration - Using @react-native-firebase (native SDK)
// Native SDK initializes automatically from GoogleService-Info.plist (iOS)
// and google-services.json (Android) — no JS config object needed.

import auth from '@react-native-firebase/auth'
import firestore from '@react-native-firebase/firestore'
import functions from '@react-native-firebase/functions'

//
// Static properties available on these module exports:
//   auth.EmailAuthProvider         — for re-authentication credentials
//   firestore.FieldValue           — serverTimestamp(), arrayUnion(), arrayRemove(), delete(), increment()
//   firestore.Timestamp            — fromDate(), now()
//
// Instance methods (call the function first):
//   auth().currentUser, auth().signInWithEmailAndPassword(), etc.
//   firestore().collection(), firestore().batch(), etc.
//   functions().httpsCallable()

export { auth, firestore, functions }
