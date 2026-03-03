// Authentication Service - Using @react-native-firebase
import { auth, firestore, functions } from '../config/firebase'

export const signUp = async (email, password, phoneNumber) => {
  try {
    const userCredential = await auth().createUserWithEmailAndPassword(email, password)
    const user = userCredential.user

    await firestore()
      .collection('users')
      .doc(user.uid)
      .set({
        uid: user.uid,
        email: email,
        phoneNumber: phoneNumber || '',
        name: '',
        quip: '',
        profilePhoto: null,
        profileSetup: false,
        isOnline: true,
        createdAt: firestore.FieldValue.serverTimestamp(),
        updatedAt: firestore.FieldValue.serverTimestamp(),
        subscribedUsers: [], // Firestore field name kept for backward compat (represents "following")
        hiddenUsers: [],
        blockedUsers: [],
        blockedBy: [],
        groups: [],
        addFriendsComplete: false,
      })

    // Send email verification link
    try {
      await user.sendEmailVerification()
    } catch (_emailError) {
      // Don't block account creation — user can resend from the verification screen
    }

    return { success: true, user }
  } catch (error) {
    console.log('🔴 signUp error:', error.code, error.message)
    return { success: false, error: error.message }
  }
}

export const signIn = async (email, password) => {
  try {
    const userCredential = await auth().signInWithEmailAndPassword(email, password)

    try {
      await firestore().collection('users').doc(userCredential.user.uid).update({
        isOnline: true,
        lastSeen: firestore.FieldValue.serverTimestamp(),
      })
    } catch (_updateError) {}

    return { success: true, user: userCredential.user }
  } catch (error) {
    console.log('🔴 signIn error:', error.code, error.message)
    return { success: false, error: error.message }
  }
}

export const logOut = async () => {
  try {
    const user = auth().currentUser

    if (user) {
      try {
        await firestore().collection('users').doc(user.uid).update({
          isOnline: false,
          lastSeen: firestore.FieldValue.serverTimestamp(),
        })
      } catch (_updateError) {}
    }

    await auth().signOut()
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export const sendResetEmail = async (email) => {
  try {
    await auth().sendPasswordResetEmail(email)
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export const confirmReset = async (code, newPassword) => {
  try {
    await auth().confirmPasswordReset(code, newPassword)
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export const changePassword = async (currentPassword, newPassword) => {
  try {
    const user = auth().currentUser
    const credential = auth.EmailAuthProvider.credential(user.email, currentPassword)
    await user.reauthenticateWithCredential(credential)
    await user.updatePassword(newPassword)
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export const deleteAccount = async (password) => {
  try {
    const user = auth().currentUser
    if (!user) {
      return { success: false, error: 'No user is currently signed in.' }
    }

    // Re-authenticate before deleting (Firebase requires recent login)
    const credential = auth.EmailAuthProvider.credential(user.email, password)
    await user.reauthenticateWithCredential(credential)

    // Force-refresh the ID token after re-authentication
    await user.getIdToken(true)

    // Call the deleteUserAccount Cloud Function (uses Admin SDK to bypass rules)
    // This handles: group cleanup, conversation cleanup, follower cleanup,
    // Firestore doc deletion, and Firebase Auth account deletion
    const result = await functions().httpsCallable('deleteUserAccount')()

    if (!result.data.success) {
      return { success: false, error: 'Failed to delete account. Please try again.' }
    }

    // Sign out locally after server-side deletion
    await auth().signOut()

    return { success: true }
  } catch (error) {
    console.log('🔴 deleteAccount error:', error.code, error.message, error)
    if (error.code === 'auth/wrong-password') {
      return { success: false, error: 'Incorrect password. Please try again.' }
    }
    return { success: false, error: error.message }
  }
}

export const getCurrentUser = () => {
  return auth().currentUser
}

export const resendVerificationEmail = async () => {
  try {
    const user = auth().currentUser
    if (!user) {
      return { success: false, error: 'No user is currently signed in.' }
    }
    await user.sendEmailVerification()
    return { success: true }
  } catch (error) {
    console.log('⚠️ Resend verification email failed:', error.code, error.message)
    if (error.code === 'auth/too-many-requests') {
      return {
        success: false,
        error: 'Too many requests. Please wait a moment before trying again.',
      }
    }
    return { success: false, error: error.message }
  }
}

export const checkEmailVerified = async () => {
  try {
    const user = auth().currentUser
    if (!user) {
      return { verified: false, error: 'No user is currently signed in.' }
    }
    await user.reload()
    return { verified: user.emailVerified }
  } catch (error) {
    return { verified: false, error: error.message }
  }
}

export default {
  signUp,
  signIn,
  logOut,
  sendResetEmail,
  confirmReset,
  changePassword,
  deleteAccount,
  getCurrentUser,
  resendVerificationEmail,
  checkEmailVerified,
}
