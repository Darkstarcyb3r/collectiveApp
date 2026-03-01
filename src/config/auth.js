// Firebase Auth Configuration for React Native
// Lazy loading to avoid native module registration issues
import { app } from './firebase'

let auth = null
let authPromise = null
let getAuthFn = null

// Lazy load the getAuth function
const loadGetAuth = () => {
  if (!getAuthFn) {
    const firebaseAuth = require('firebase/auth')
    getAuthFn = firebaseAuth.getAuth
  }
  return getAuthFn
}

// Initialize auth with a delay to ensure native modules are ready
const initAuth = () => {
  return new Promise((resolve, reject) => {
    // Wait for native modules to be ready
    setTimeout(() => {
      try {
        const getAuth = loadGetAuth()
        auth = getAuth(app)
        resolve(auth)
      } catch (error) {
        console.error('Auth init error, retrying...', error.message)
        // Retry after longer delay
        setTimeout(() => {
          try {
            const getAuth = loadGetAuth()
            auth = getAuth(app)
            resolve(auth)
          } catch (retryError) {
            reject(retryError)
          }
        }, 1000)
      }
    }, 500)
  })
}

export const getAuthInstance = () => {
  return auth
}

export const getAuthAsync = async () => {
  if (auth) {
    return auth
  }
  if (!authPromise) {
    authPromise = initAuth()
  }
  return authPromise
}

export default getAuthInstance
