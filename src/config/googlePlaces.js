// Google Places API Configuration
// The API key is loaded from an environment variable for security.
// Set EXPO_PUBLIC_GOOGLE_PLACES_API_KEY in your .env file.
// Get your key from: https://console.cloud.google.com (enable "Places API")
// Restrict the key to the Places API and your app's bundle IDs.
export const GOOGLE_PLACES_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY || ''
