// Login Screen
// Email and password login

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
import { signIn } from '../../services/authService'
import { useAuth } from '../../contexts/AuthContext'
import { fonts } from '../../theme/typography'

const { width, height } = Dimensions.get('window')

const LoginScreen = ({ navigation }) => {
  const { refreshUserProfile } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState({})

  const validateForm = () => {
    const newErrors = {}

    if (!email.trim()) {
      newErrors.email = 'Email is required'
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Please enter a valid email'
    }

    if (!password) {
      newErrors.password = 'Password is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleLogin = async () => {
    if (!validateForm()) return

    setLoading(true)
    const result = await signIn(email.trim(), password)

    if (result.success) {
      await refreshUserProfile()

      // Check email verification first
      if (!result.user.emailVerified) {
        // Existing user with unverified email — send to verification screen
        navigation.navigate('EmailVerification', { fromLogin: true })
      } else {
        // Email is verified — check if profile is set up
        const { db } = require('../../config/firebase')
        const userDoc = await db.collection('users').doc(result.user.uid).get()
        const data = userDoc.exists ? userDoc.data() : null
        if (!data?.profileSetup) {
          navigation.navigate('ProfileSetup')
        }
        // If profileSetup is true, onAuthStateChanged + refreshUserProfile
        // will automatically swap to MainNavigator
      }
    } else {
      Alert.alert('Login Failed', result.error)
    }
    setLoading(false)
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
          <Text style={styles.title}>L0giN</Text>

          {/* Form */}
          <View style={styles.form}>
            <Input
              label="email :"
              value={email}
              onChangeText={setEmail}
              placeholder="Enter your email"
              keyboardType="email-address"
              autoCapitalize="none"
              error={errors.email}
            />

            <Input
              label="password :"
              value={password}
              onChangeText={setPassword}
              placeholder="Enter your password"
              secureTextEntry
              error={errors.password}
            />

            <TouchableOpacity
              style={styles.forgotPassword}
              onPress={() => navigation.navigate('ForgotPassword')}
            >
              <Text style={styles.forgotPasswordText}>Forgot password?</Text>
            </TouchableOpacity>
          </View>

          {/* Login Button */}
          <Button
            title="Login"
            variant="lime"
            size="large"
            loading={loading}
            onPress={handleLogin}
            style={styles.loginButton}
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
    fontSize: 48,
    fontFamily: fonts.regular,
    color: colors.primary,
    marginBottom: 40,
    marginTop: 60,
  },
  form: {
    marginBottom: 40,
    fontFamily: fonts.pixel,
    color: colors.textDark,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginTop: 8,
  },
  forgotPasswordText: {
    color: colors.primary,
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  loginButton: {
    width: '100%',
    color: colors.buttonSecondary,
  },
})

export default LoginScreen
