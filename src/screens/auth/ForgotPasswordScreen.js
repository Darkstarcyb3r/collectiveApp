// Forgot Password Screen
// Email entry for password reset

import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  Image,
  Dimensions,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Button, Input } from '../../components/common'
import { colors } from '../../theme'
import { sendResetEmail } from '../../services/authService'
import { fonts } from '../../theme/typography'

const { width, height } = Dimensions.get('window')

const ForgotPasswordScreen = ({ navigation }) => {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [emailSent, setEmailSent] = useState(false)

  const validateEmail = () => {
    if (!email.trim()) {
      setError('Email is required')
      return false
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      setError('Please enter a valid email')
      return false
    }
    setError('')
    return true
  }

  const handleSubmit = async () => {
    if (!validateEmail()) return

    setLoading(true)
    const result = await sendResetEmail(email.trim())
    setLoading(false)

    if (result.success) {
      setEmailSent(true)
    } else {
      Alert.alert('Error', result.error)
    }
  }

  const handleBackToLogin = () => {
    navigation.navigate('Login')
  }

  // Show success message after email is sent
  if (emailSent) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={colors.background} />

        <View style={styles.successContent}>
          {/* Background Logo */}
          <View style={styles.backgroundLogo}>
            <Image
              source={require('../../assets/images/logo.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>

          {/* Title */}
          <Text style={styles.title}>ch3ck y0ur e/\/\ail</Text>

          {/* Success Message */}
          <Text style={styles.successMessage}>
            We sent a reset link to{'\n'}
            <Text style={styles.emailHighlight}>{email}</Text>
          </Text>

          <Text style={styles.helpText}>
            Check your inbox and follow the link to reset your password.
          </Text>

          {/* Login Button */}
          <Button
            title="Login"
            variant="lime"
            size="large"
            onPress={handleBackToLogin}
            style={styles.loginButton}
          />
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
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

          {/* Title */}
          <Text style={styles.title}>forgo-|- pas5w0rd</Text>

          {/* Description */}
          <Text style={styles.description}>enter your email to reset{'\n'}your password</Text>

          {/* Form */}
          <View style={styles.form}>
            <Input
              label="email:"
              value={email}
              onChangeText={setEmail}
              placeholder="Enter your email"
              keyboardType="email-address"
              autoCapitalize="none"
              error={error}
            />
          </View>

          {/* Submit Button */}
          <Button
            title="Submit"
            variant="lime"
            size="large"
            loading={loading}
            onPress={handleSubmit}
            style={styles.submitButton}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 32,
    paddingTop: 16,
    paddingBottom: 40,
  },
  successContent: {
    flex: 1,
    paddingHorizontal: 32,
    paddingTop: 60,
    justifyContent: 'center',
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
    position: 'center',
  },
  description: {
    fontSize: 16,
    fontFamily: fonts.pixel,
    color: colors.primary,
    marginBottom: 40,
    lineHeight: 24,
  },
  successMessage: {
    fontSize: 18,
    fontFamily: fonts.pixel,
    color: colors.textGreen,
    marginBottom: 16,
    lineHeight: 28,
    textAlign: 'center',
  },
  emailHighlight: {
    color: colors.textPrimary,
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
  loginButton: {
    width: '100%',
    marginTop: 50,
    marginBottom: 200,
  },
  form: {
    marginBottom: 40,
  },
  submitButton: {
    width: '100%',
  },
})

export default ForgotPasswordScreen
