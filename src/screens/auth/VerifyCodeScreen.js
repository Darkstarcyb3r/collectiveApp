// Verify Code Screen
// 5-digit code entry for password reset verification

import React, { useState, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  TextInput,
  Alert,
  Image,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { Button } from '../../components/common'
import { colors } from '../../theme'

const { width, height } = Dimensions.get('window')

const VerifyCodeScreen = ({ navigation, route }) => {
  const { email } = route.params
  const [code, setCode] = useState(['', '', '', '', ''])
  const [loading, setLoading] = useState(false)
  const inputRefs = useRef([])

  const handleCodeChange = (value, index) => {
    // Only allow numbers
    if (!/^\d*$/.test(value)) return

    const newCode = [...code]
    newCode[index] = value
    setCode(newCode)

    // Auto-focus next input
    if (value && index < 4) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handleKeyPress = (e, index) => {
    // Handle backspace - move to previous input
    if (e.nativeEvent.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handleVerify = async () => {
    const fullCode = code.join('')

    if (fullCode.length !== 5) {
      Alert.alert('Error', 'Please enter the complete 5-digit code')
      return
    }

    setLoading(true)

    // Note: Firebase sends a magic link, not a code.
    // For a real code verification, you'd need a custom backend.
    // For now, we'll simulate success and proceed to reset password.

    setTimeout(() => {
      setLoading(false)
      navigation.navigate('ResetPassword', { email, code: fullCode })
    }, 1000)
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={styles.content}>
          {/* Background Logo */}
          <View style={styles.backgroundLogo}>
            <Image
              source={require('../../assets/images/logo.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>

          {/* Code Input Boxes */}
          <View style={styles.codeContainer}>
            {code.map((digit, index) => (
              <TextInput
                key={index}
                ref={(ref) => (inputRefs.current[index] = ref)}
                style={styles.codeInput}
                value={digit}
                onChangeText={(value) => handleCodeChange(value, index)}
                onKeyPress={(e) => handleKeyPress(e, index)}
                keyboardType="number-pad"
                maxLength={1}
                selectTextOnFocus
              />
            ))}
          </View>

          {/* Description */}
          <Text style={styles.description}>
            We sent a reset link to{'\n'}
            <Text style={styles.emailText}>{email}</Text> enter{'\n'}
            the 5 digit code mentioned{'\n'}
            in the email
          </Text>

          {/* Verify Button */}
          <Button
            title="Verify"
            variant="lime"
            size="large"
            loading={loading}
            onPress={handleVerify}
            style={styles.verifyButton}
          />
        </View>
      </KeyboardAvoidingView>
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
    justifyContent: 'center',
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
  codeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 40,
    paddingHorizontal: 10,
  },
  codeInput: {
    width: 55,
    height: 55,
    backgroundColor: colors.primaryDark,
    borderRadius: 8,
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    color: colors.primary,
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: 40,
  },
  emailText: {
    fontWeight: '600',
  },
  verifyButton: {
    width: '100%',
  },
})

export default VerifyCodeScreen
