// Collective App
// Main entry point

import React, { useEffect, useState } from 'react';
import { View, StyleSheet, LogBox } from 'react-native';
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
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false, // Badge is managed server-side via push payload — no client override
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

  useEffect(() => {
    async function prepare() {
      try {
        // Load custom fonts - IMPORTANT: Use RobotoMono since that's what you have
        await Font.loadAsync({
          // RobotoMono fonts (from your assets folder)
          'RobotoMono-Regular': require('./src/assets/fonts/roboto-mono/RobotoMono-Regular.ttf'),
          'RobotoMono-Bold': require('./src/assets/fonts/roboto-mono/RobotoMono-Bold.ttf'),
          'RobotoMono-Medium': require('./src/assets/fonts/roboto-mono/RobotoMono-Medium.ttf'),
          'RobotoMono-Italic': require('./src/assets/fonts/roboto-mono/RobotoMono-Italic.ttf'),
          'RobotoMono-SemiBold': require('./src/assets/fonts/roboto-mono/RobotoMono-Medium.ttf'), // Add this if you have it
          
          // For now, use RobotoMono for everything since that's what you have
          'PressStart2P-Regular': require('./src/assets/fonts/roboto-mono/RobotoMono-Regular.ttf'),
          'FiraCode-Regular': require('./src/assets/fonts/roboto-mono/RobotoMono-Regular.ttf'),
        });

        console.log('Custom fonts loaded successfully');
        
        // UPDATE: Use RobotoMono font names since that's what you're loading
        fonts.regular = 'RobotoMono-Regular';
        fonts.bold = 'RobotoMono-Bold';
        fonts.medium = 'RobotoMono-Medium';
        fonts.italic = 'RobotoMono-Italic';
        fonts.semiBold = 'RobotoMono-SemiBold' || 'RobotoMono-Bold'; // Fallback to Bold if no SemiBold
        fonts.pixel = 'PressStart2P-Regular';
        fonts.mono = 'FiraCode-Regular';

        // Request notification permissions early
        const { status } = await Notifications.getPermissionsAsync();
        if (status !== 'granted') {
          await Notifications.requestPermissionsAsync();
        }
        console.log('📱 Notification permission status:', status);

        // Optional delay for splash screen
        await new Promise(resolve => setTimeout(resolve, 1500)); //increased delay for splash screen
      } catch (e) {
        console.warn('Error loading custom fonts:', e);
        console.log('Using system fonts as fallback');
        
        // Fallback to system fonts if custom fonts fail
        fonts.regular = 'System';
        fonts.bold = 'System';
        fonts.medium = 'System';
        fonts.italic = 'System';
        fonts.semiBold = 'System';
        fonts.pixel = 'System';
        fonts.mono = 'System';
      } finally {
        setAppIsReady(true);
        // Hide splash screen directly here — more reliable than onLayout
        // which can fail to fire in some SafeAreaProvider/release build edge cases
        try {
          await new Promise(resolve => setTimeout(resolve, 100));
          await SplashScreen.hideAsync();
        } catch (_e) {}
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