// Reset Password Screen
// Set new password after verification

import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  Dimensions,
} from 'react-native'
import { Button, Input } from '../../components/common'
import { colors } from '../../theme'
import { playClick } from '../../services/soundService'

const { width, height } = Dimensions.get('window')

const ResetPasswordScreen = ({ navigation, route }) => {
  const { _email, _code } = route.params
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState({})

  const validateForm = () => {
    const newErrors = {}

    if (!newPassword) {
      newErrors.newPassword = 'Password is required'
    } else if (newPassword.length < 6) {
      newErrors.newPassword = 'Password must be at least 6 characters'
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password'
    } else if (newPassword !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleResetPassword = async () => {
    playClick()
    if (!validateForm()) return

    setLoading(true)

    // Note: Firebase uses a magic link approach for password reset.
    // For a real implementation with code verification,
    // you'd need a custom backend or use Firebase's confirmPasswordReset
    // with the oobCode from the email link.

    setTimeout(() => {
      setLoading(false)
      navigation.navigate('PasswordResetSuccess')
    }, 1000)
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
          {/* Background Logo */}
          <View style={styles.backgroundLogo}>
            <Image
              source={require('../../assets/images/logo.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>

          {/* Title */}
          <Text style={styles.title}>Set @ neW pas5w0rd</Text>

          {/* Form */}
          <View style={styles.form}>
            <Input
              label="new password:"
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="Enter your password"
              secureTextEntry
              error={errors.newPassword}
            />

            <Input
              label="confirm new password:"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="confirm password"
              secureTextEntry
              error={errors.confirmPassword}
            />
          </View>

          {/* Reset Button */}
          <Button
            title="Reset Password"
            variant="gradient"
            size="large"
            loading={loading}
            onPress={handleResetPassword}
            style={styles.resetButton}
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
    paddingTop: 80,
    paddingBottom: 40,
  },
  backgroundLogo: {
    position: 'absolute',
    top: 60,
    right: -20,
    opacity: 0.15,
  },
  logoImage: {
    width: width * 0.6,
    height: height * 0.3,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 60,
    marginTop: 80,
  },
  form: {
    marginBottom: 40,
  },
  resetButton: {
    width: '100%',
  },
})

export default ResetPasswordScreen
