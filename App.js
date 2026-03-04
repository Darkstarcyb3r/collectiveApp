// Collective App
// Main entry point

import React, { useEffect, useRef, useState } from 'react';
import { AppState, View, StyleSheet, LogBox } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as Font from 'expo-font';
import * as Notifications from 'expo-notifications';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from './src/contexts/AuthContext';
import { RootNavigator } from './src/navigation';
import { colors } from './src/theme';
import { fonts } from './src/theme/typography';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';


// Configure foreground notification display
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true, // Let the push payload's badge field update the app icon badge
  }),
});

// Optional: Ignore specific warnings
LogBox.ignoreLogs([
  'Key "cancelled" in the image picker result is deprecated',
]);

// Keep splash screen visible while loading resources
SplashScreen.preventAutoHideAsync();

export default function App() {
  const [appIsReady, setAppIsReady] = useState(false);

  // Clear app icon badge whenever the app comes to the foreground.
  // Badge is set server-side in push payloads (reflects total unread).
  // When user opens the app, they can see everything — badge resets to 0.
  const appState = useRef(AppState.currentState);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        Notifications.setBadgeCountAsync(0).catch(() => {});
      }
      appState.current = nextAppState;
    });
    // Also clear on initial mount (app just opened)
    Notifications.setBadgeCountAsync(0).catch(() => {});
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    console.log('[Splash] prepare() starting...');

    // Emergency timeout — if ANYTHING hangs, force the splash to hide after 5 seconds
    const emergencyTimeout = setTimeout(async () => {
      console.warn('[Splash] EMERGENCY TIMEOUT — forcing splash hide after 5s');
      try { await SplashScreen.hideAsync(); } catch (_) {}
      setAppIsReady(true);
    }, 5000);

    async function prepare() {
      try {
        // Load custom fonts with a 3-second timeout to prevent hanging
        console.log('[Splash] Loading fonts...');
        await Promise.race([
          Font.loadAsync({
            'RobotoMono-Regular': require('./src/assets/fonts/roboto-mono/RobotoMono-Regular.ttf'),
            'RobotoMono-Bold': require('./src/assets/fonts/roboto-mono/RobotoMono-Bold.ttf'),
            'RobotoMono-Medium': require('./src/assets/fonts/roboto-mono/RobotoMono-Medium.ttf'),
            'RobotoMono-Italic': require('./src/assets/fonts/roboto-mono/RobotoMono-Italic.ttf'),
            'RobotoMono-SemiBold': require('./src/assets/fonts/roboto-mono/RobotoMono-Medium.ttf'),
            'PressStart2P-Regular': require('./src/assets/fonts/roboto-mono/RobotoMono-Regular.ttf'),
            'FiraCode-Regular': require('./src/assets/fonts/roboto-mono/RobotoMono-Regular.ttf'),
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Font load timeout')), 3000)),
        ]);

        console.log('[Splash] Fonts loaded successfully');
        fonts.regular = 'RobotoMono-Regular';
        fonts.bold = 'RobotoMono-Bold';
        fonts.medium = 'RobotoMono-Medium';
        fonts.italic = 'RobotoMono-Italic';
        fonts.semiBold = 'RobotoMono-SemiBold' || 'RobotoMono-Bold';
        fonts.pixel = 'PressStart2P-Regular';
        fonts.mono = 'FiraCode-Regular';

        // Request notification permissions — fire-and-forget (don't block startup)
        console.log('[Splash] Checking notification permissions (non-blocking)...');
        Notifications.getPermissionsAsync()
          .then(({ status }) => {
            console.log('[Splash] Notification permission status:', status);
            if (status !== 'granted') {
              Notifications.requestPermissionsAsync().catch(() => {});
            }
          })
          .catch(() => {});
      } catch (e) {
        console.warn('[Splash] Error during prepare:', e.message);
        // Fallback to system fonts if custom fonts fail or timeout
        fonts.regular = 'System';
        fonts.bold = 'System';
        fonts.medium = 'System';
        fonts.italic = 'System';
        fonts.semiBold = 'System';
        fonts.pixel = 'System';
        fonts.mono = 'System';
      } finally {
        clearTimeout(emergencyTimeout);
        setAppIsReady(true);
        console.log('[Splash] Hiding splash screen...');
        try {
          await SplashScreen.hideAsync();
          console.log('[Splash] Splash hidden successfully');
        } catch (_e) {
          console.warn('[Splash] hideAsync failed:', _e.message);
        }
      }
    }

    prepare();
  }, []);

  if (!appIsReady) {
    return null;
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaProvider>
        <AuthProvider>
          <View style={styles.container}>
            <StatusBar style="light" />
            <RootNavigator />
          </View>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
});