// Email Verification Screen
// Shown after sign up — user must verify email before proceeding to profile setup

import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  Alert,
  Image,
  Dimensions,
  AppState,
} from 'react-native'
import { Button } from '../../components/common'
import { colors } from '../../theme'
import { fonts } from '../../theme/typography'
import { useAuth } from '../../contexts/AuthContext'
import { resendVerificationEmail, checkEmailVerified, logOut } from '../../services/authService'
import { playClick } from '../../services/soundService'

const { width, height } = Dimensions.get('window')

const EmailVerificationScreen = ({ navigation, route }) => {
  const { user, setIsEmailVerified } = useAuth()
  const [checking, setChecking] = useState(false)
  const [resending, setResending] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const cooldownRef = useRef(null)
  const appState = useRef(AppState.currentState)
  const fromLogin = route?.params?.fromLogin || false

  // Auto-send verification email for existing unverified users coming from login
  useEffect(() => {
    if (fromLogin) {
      handleResend(true) // silent = true, no alert on success
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // AppState listener — auto-check verification when app returns to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        // App came back to foreground — user may have clicked the email link
        handleCheckVerification(true) // silent = true
      }
      appState.current = nextAppState
    })

    return () => {
      subscription.remove()
      if (cooldownRef.current) {
        clearInterval(cooldownRef.current)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Cooldown timer
  const startCooldown = () => {
    setCooldown(60)
    if (cooldownRef.current) clearInterval(cooldownRef.current)
    cooldownRef.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(cooldownRef.current)
          cooldownRef.current = null
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  // Check if email has been verified
  const handleCheckVerification = useCallback(
    async (silent = false) => {
      setChecking(true)
      try {
        const result = await checkEmailVerified()
        if (result.verified) {
          setIsEmailVerified(true)
          // Navigate to profile setup
          navigation.navigate('ProfileSetup')
        } else if (!silent) {
          Alert.alert(
            'Not Verified Yet',
            'Please check your email and click the verification link, then try again.'
          )
        }
      } catch (_error) {
        if (!silent) {
          Alert.alert('Error', 'Could not check verification status. Please try again.')
        }
      }
      setChecking(false)
    },
    [navigation, setIsEmailVerified]
  )

  // Resend verification email
  const handleResend = async (silent = false) => {
    if (cooldown > 0) return

    setResending(true)
    const result = await resendVerificationEmail()
    setResending(false)

    if (result.success) {
      startCooldown()
      if (!silent) {
        Alert.alert('Email Sent', 'A new verification link has been sent to your email.')
      }
    } else {
      if (!silent) {
        Alert.alert('Error', result.error || 'Could not send verification email.')
      }
    }
  }

  // Sign out and go back to landing
  const handleBackToLogin = async () => {
    playClick()
    await logOut()
    navigation.navigate('Landing')
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      <View style={styles.content}>
        {/* Background Logo */}
        <View style={styles.backgroundLogo}>
          <Image
            source={require('../../assets/images/logo.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </View>

        {/* Title */}
        <Text style={styles.title}>v3rify email</Text>

        {/* Message */}
        <Text style={styles.message}>
          We sent a verification link to{'\n'}
          <Text style={styles.emailHighlight}>{user?.email || 'your email'}</Text>
        </Text>

        <Text style={styles.helpText}>
          Check your inbox and click the link to verify your email address.
        </Text>

        {/* I've Verified Button */}
        <Button
          title="I've Verified"
          variant="gradient"
          size="large"
          loading={checking}
          onPress={() => { playClick(); handleCheckVerification(false); }}
          style={styles.verifyButton}
        />

        {/* Resend Link */}
        <TouchableOpacity
          style={styles.resendButton}
          onPress={() => { playClick(); handleResend(false); }}
          disabled={cooldown > 0 || resending}
        >
          <Text
            style={[styles.resendText, (cooldown > 0 || resending) && styles.resendTextDisabled]}
          >
            {cooldown > 0
              ? `Resend in ${cooldown}s`
              : resending
                ? 'Sending...'
                : 'Resend verification email'}
          </Text>
        </TouchableOpacity>

        {/* Back to Login Link */}
        <TouchableOpacity style={styles.backButton} onPress={handleBackToLogin}>
          <Text style={styles.backText}>Back to Login</Text>
        </TouchableOpacity>
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
    paddingTop: 60,
    justifyContent: 'center',
  },
  backgroundLogo: {
    position: 'absolute',
    top: 60,
    right: -20,
    opacity: 0.15,
  },
  logoImage: {
    width: width * 0.9,
    height: height * 0.5,
  },
  title: {
    fontSize: 50,
    fontFamily: fonts.bold,
    color: colors.primary,
    marginBottom: 20,
    marginTop: 100,
  },
  message: {
    fontSize: 18,
    fontFamily: fonts.pixel,
    color: colors.textGreen,
    marginBottom: 16,
    lineHeight: 28,
    textAlign: 'center',
  },
  emailHighlight: {
    color: colors.textSecondary,
    fontFamily: fonts.italic,
  },
  helpText: {
    fontSize: 14,
    fontFamily: fonts.pixel,
    color: colors.textGreen,
    marginBottom: 40,
    lineHeight: 22,
    textAlign: 'center',
  },
  verifyButton: {
    width: '100%',
    marginBottom: 24,
  },
  resendButton: {
    alignSelf: 'center',
    paddingVertical: 12,
  },
  resendText: {
    color: colors.primary,
    fontSize: 14,
    fontFamily: fonts.regular,
    textDecorationLine: 'underline',
  },
  resendTextDisabled: {
    color: colors.offline,
    textDecorationLine: 'none',
  },
  backButton: {
    alignSelf: 'center',
    paddingVertical: 12,
    marginTop: 8,
  },
  backText: {
    color: colors.secondary,
    fontSize: 14,
    fontFamily: fonts.regular,
    textDecorationLine: 'underline',
  },
})

export default EmailVerificationScreen
