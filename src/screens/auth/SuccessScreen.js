// Success Screen
// Generic success screen for various flows

import React from 'react'
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  Image,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Button } from '../../components/common'
import { colors } from '../../theme'
import { fonts } from '../../theme/typography'

const SuccessScreen = ({ navigation, route }) => {
  const {
    title = 'SuCce5',
    message = 'Operation completed successfully.',
    buttonText = 'Continue',
    navigateTo = 'Login',
  } = route.params || {}

  const handleContinue = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: navigateTo }],
    })
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      <View style={styles.content}>
        {/* Back Button */}
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={28} color={colors.textGreen} />
        </TouchableOpacity>

        {/* Background Logo */}
        <View style={styles.backgroundLogo}>
          <Image
            source={require('../../assets/images/logo.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </View>

        {/* Success Content */}
        <View style={styles.successContent}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
        </View>

        {/* Continue Button */}
        <Button
          title={buttonText}
          variant="lime"
          size="large"
          onPress={handleContinue}
          style={styles.continueButton}
        />
      </View>
    </SafeAreaView>
  )
}

// Password Reset Success Screen (specific variant)
export const PasswordResetSuccessScreen = ({ navigation }) => {
  const handleLogin = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'Landing' }],
    })
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      <View style={styles.content}>
        {/* Back Button */}
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={28} color={colors.textGreen} />
        </TouchableOpacity>

        {/* Background Logo */}
        <View style={styles.backgroundLogo}>
          <Image
            source={require('../../assets/images/logo.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </View>

        {/* Success Content */}
        <View style={styles.successContent}>
          <Text style={styles.title}>SuCce5</Text>
          <Text style={styles.message}>
            Your password has been{'\n'}
            successfully reset. Click{'\n'}
            Continue to login.
          </Text>
        </View>

        {/* Login Button */}
        <Button
          title="Login"
          variant="lime"
          size="large"
          onPress={handleLogin}
          style={styles.continueButton}
        />
      </View>
    </SafeAreaView>
  )
}

// Account Setup Success Screen (specific variant)
export const AccountSetupSuccessScreen = ({ navigation }) => {
  const handleLogin = () => {
    // This will trigger AuthContext to check auth state
    // and redirect to main app if logged in
    navigation.reset({
      index: 0,
      routes: [{ name: 'Landing' }],
    })
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      <View style={styles.content}>
        {/* Back Button */}
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={28} color={colors.textGreen} />
        </TouchableOpacity>

        {/* Background Logo */}
  <View style={styles.backgroundLogo}>
    <Image
      source={require('../../assets/images/logo.png')}
      style={styles.logoImage}
      resizeMode="contain"
    />
  </View>

        {/* Success Content */}
        <View style={styles.successContent}>
          <Text style={styles.title}>SuCce5</Text>
          <Text style={styles.message}>
            your account has been set up{'\n'}
            Hack on in.
          </Text>
        </View>

        {/* Login Button */}
        <Button
          title="Login"
          variant="light"
          size="large"
          onPress={handleLogin}
          style={styles.continueButton}
        />
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: 32,
    paddingTop: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  backgroundLogo: {
    position: 'absolute',
    top: 100,
    left: 20,
    opacity: 0.15,
  },
  logoImage: {
    width: 400, // Adjust size as needed
    height: 400, // Adjust size as needed
  },
  successContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 60,
    fontFamily: fonts.bold,
    color: colors.primary,
    marginBottom: 40,
  },
  message: {
    fontSize: 16,
    color: colors.primary,
    textAlign: 'center',
    lineHeight: 26,
    fontFamily: fonts.regular,
  },
  continueButton: {
    width: '100%',
    marginBottom: 200,
  },
})

export default SuccessScreen
