// Edit Quip Screen
// Screen to edit user's quip (status message)

import React, { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Button } from '../../components/common'
import { colors } from '../../theme'
import { useAuth } from '../../contexts/AuthContext'
import { updateQuip } from '../../services/userService'
import { fonts } from '../../theme/typography'

const EditQuipScreen = ({ navigation }) => {
  const { userProfile, refreshUserProfile } = useAuth()
  const [quip, setQuip] = useState(userProfile?.quip || '')
  const [loading, setLoading] = useState(false)

  const handleSave = async () => {
    setLoading(true)
    const result = await updateQuip(userProfile.uid, quip.trim())
    setLoading(false)

    if (result.success) {
      await refreshUserProfile()
      navigation.goBack()
    } else {
      Alert.alert('Error', result.error)
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.mainContainer}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
              <Ionicons name="chevron-back" size={28} color={colors.textGreen} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Edit Quip</Text>
            <View style={styles.headerSpacer} />
          </View>

          {/* Content */}
          <View style={styles.content}>
            <Text style={styles.label}>what's on my mind:</Text>
            <TextInput
              style={styles.input}
              value={quip}
              onChangeText={setQuip}
              placeholder="What's on your mind?"
              placeholderTextColor={colors.offline}
              multiline
              maxLength={150}
              autoFocus
            />
            <Text style={styles.charCount}>{quip.length}/150</Text>

            {/* Save Button */}
            <Button
              title="Save Changes"
              variant="primary"
              size="large"
              loading={loading}
              onPress={handleSave}
              style={styles.saveButton}
              textStyle={styles.saveButtonText}
            />

            {/* Bottom Logo Watermark */}
            <View style={styles.bottomLogo}>
              <Image
                source={require('../../assets/images/green-logo.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
          </View>
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
  keyboardView: {
    flex: 1,
  },
  mainContainer: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.primary,
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 16,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: fonts.regular,
    color: colors.textGreen,
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  label: {
    fontSize: 14,
    color: colors.textPrimary,
    fontFamily: fonts.italic,
    marginBottom: 12,
  },
  input: {
    backgroundColor: colors.inputBackground,
    borderRadius: 12,
    padding: 16,
    fontSize: 13,
    color: colors.textDark,
    fontFamily: fonts.pixel,
    minHeight: 120,
    textAlignVertical: 'top',
    marginBottom: 30,
  },
  charCount: {
    fontSize: 12,
    color: colors.textGreen,
    textAlign: 'right',
    marginTop: -24,
  },
  saveButton: {
    width: '100%',
    backgroundColor: colors.primary, // Example
    padding: 10,
    borderRadius: 18,
    marginTop: 25,
  },
  saveButtonText: {
    fontFamily: fonts.bold, // ← Font goes HERE
    fontSize: 16,
    color: colors.textDark,
    textAlign: 'center',
  },
  // Bottom Logo
  bottomLogo: {
    alignItems: 'center',
    marginTop: 0,
    paddingTop: 0,
  },
  logoImage: {
    width: 250,
    height: 250,
    opacity: 100,
  },
})

export default EditQuipScreen
