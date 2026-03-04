// Sign Up Screen
// New user registration

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
  Linking,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Button, Input } from '../../components/common'
import { colors } from '../../theme'
import { signUp } from '../../services/authService'
import { formatPhoneNumber, stripPhoneFormatting } from '../../utils/formatPhoneNumber'
import { fonts } from '../../theme/typography'
import { playClick } from '../../services/soundService'

const { width, height } = Dimensions.get('window')

const SignUpScreen = ({ navigation }) => {
  const [email, setEmail] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState({})
  const [ageConfirmed, setAgeConfirmed] = useState(false)

  const validateForm = () => {
    const newErrors = {}

    if (!email.trim()) {
      newErrors.email = 'Email is required'
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Please enter a valid email'
    }

    if (!phoneNumber.trim()) {
      newErrors.phoneNumber = 'Phone number is required'
    }

    if (!password) {
      newErrors.password = 'Password is required'
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSignUp = async () => {
    playClick()
    if (!validateForm()) return

    setLoading(true)
    const result = await signUp(email.trim(), password, stripPhoneFormatting(phoneNumber))
    setLoading(false)

    if (result.success) {
      // User is now authenticated — send them to verify their email first
      navigation.navigate('EmailVerification')
    } else {
      Alert.alert('Sign Up Failed', result.error)
    }
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
          <Text style={styles.title}>Si9n Up</Text>

          {/* Form */}
          <View style={styles.form}>
            <Input
              label="email:"
              value={email}
              onChangeText={setEmail}
              placeholder="Enter your email"
              keyboardType="email-address"
              autoCapitalize="none"
              error={errors.email}
            />

            <Input
              label="phone number:"
              value={phoneNumber}
              onChangeText={(text) => setPhoneNumber(formatPhoneNumber(text))}
              placeholder="(555) 555-5555"
              keyboardType="phone-pad"
              error={errors.phoneNumber}
              maxLength={14}
            />

            <Input
              label="password:"
              value={password}
              onChangeText={setPassword}
              placeholder="Enter your password"
              secureTextEntry
              error={errors.password}
            />
          </View>

          {/* Legal Section */}
          <View style={styles.legalSection}>
            {/* Age Confirmation Checkbox */}
            <TouchableOpacity
              style={[styles.checkboxRow, { opacity: ageConfirmed ? 1 : 0.4 }]}
              onPress={() => { playClick(); setAgeConfirmed(!ageConfirmed); }}
              activeOpacity={0.7}
            >
              <Ionicons
                name={ageConfirmed ? 'checkbox' : 'square-outline'}
                size={22}
                color={colors.primary}
              />
              <Text style={styles.checkboxLabel}>I confirm that I am 13 years of age or older</Text>
            </TouchableOpacity>

            {/* Terms & Privacy Text */}
            <Text style={styles.legalText}>
              By creating an account, you agree to our{' '}
              <Text
                style={styles.legalLink}
                onPress={() =>
                  Linking.openURL(
                    'https://darkstarcyb3r.github.io/CollectiveLegal/TermsOfAgreement.html'
                  )
                }
              >
                Terms of Service
              </Text>{' '}
              and{' '}
              <Text
                style={styles.legalLink}
                onPress={() =>
                  Linking.openURL(
                    'https://darkstarcyb3r.github.io/CollectiveLegal/PrivacyPolicy.html'
                  )
                }
              >
                Privacy Policy
              </Text>
            </Text>
          </View>

          {/* Sign Up Button */}
          <Button
            title="Sign Up"
            variant="gradient"
            size="large"
            loading={loading}
            disabled={!ageConfirmed}
            onPress={handleSignUp}
            style={styles.signUpButton}
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
    fontFamily: fonts.bold,
    color: colors.primary,
    marginBottom: 40,
    marginTop: 60,
  },
  form: {
    marginBottom: 24,
  },
  legalSection: {
    marginBottom: 24,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  checkboxLabel: {
    color: colors.textPrimary,
    fontSize: 13,
    fontFamily: fonts.regular,
    marginLeft: 10,
    flex: 1,
  },
  legalText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontFamily: fonts.regular,
    lineHeight: 18,
  },
  legalLink: {
    color: colors.primary,
    textDecorationLine: 'underline',
  },
  signUpButton: {
    width: '100%',
  },
})

export default SignUpScreen
