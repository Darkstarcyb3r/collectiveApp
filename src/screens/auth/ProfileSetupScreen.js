// Profile Setup Screen
// Initial profile setup after sign up

import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  Image,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Dimensions,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { Button, Input } from '../../components/common'
import { colors } from '../../theme'
import { useAuth } from '../../contexts/AuthContext'
import { setupProfile } from '../../services/userService'
import { validateImageAsset } from '../../utils/imageValidation'
import { fonts } from '../../theme/typography'
import { playClick } from '../../services/soundService'

const { width, height } = Dimensions.get('window')

const ProfileSetupScreen = ({ navigation }) => {
  const { user, refreshUserProfile } = useAuth()
  const [name, setName] = useState('')
  const [profilePhoto, setProfilePhoto] = useState(null)
  const [photoMeta, setPhotoMeta] = useState(null)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState({})

  const pickImage = async () => {
    // Request permission
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant permission to access your photos.')
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.8,
    })

    if (!result.canceled) {
      const asset = result.assets[0]
      const validation = await validateImageAsset(asset)
      if (!validation.valid) {
        Alert.alert('Image Error', validation.error)
        return
      }
      setProfilePhoto(asset.uri)
      setPhotoMeta({ fileSize: validation.fileSize, mimeType: validation.mimeType })
    }
  }

  const takePhoto = async () => {
    // Request permission
    const { status } = await ImagePicker.requestCameraPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant permission to access your camera.')
      return
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.8,
    })

    if (!result.canceled) {
      const asset = result.assets[0]
      const validation = await validateImageAsset(asset)
      if (!validation.valid) {
        Alert.alert('Image Error', validation.error)
        return
      }
      setProfilePhoto(asset.uri)
      setPhotoMeta({ fileSize: validation.fileSize, mimeType: validation.mimeType })
    }
  }

  const showImageOptions = () => {
    playClick()
    Alert.alert('Select Photo', 'Choose how you want to add your profile photo', [
      { text: 'Camera', onPress: takePhoto },
      { text: 'Photo Library', onPress: pickImage },
      { text: 'Cancel', style: 'cancel' },
    ])
  }

  const validateForm = () => {
    const newErrors = {}

    if (!name.trim()) {
      newErrors.name = 'Name is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleDone = async () => {
    playClick()
    if (!validateForm()) return
    if (!user) {
      Alert.alert('Error', 'User not found. Please try signing up again.')
      return
    }

    setLoading(true)
    // Phone number is already saved from signup — don't overwrite it
    const result = await setupProfile(
      user.uid,
      name.trim(),
      null,
      profilePhoto,
      false,
      photoMeta || {}
    )
    setLoading(false)

    if (result.success) {
      await refreshUserProfile()
      // Replace ProfileSetup with AddFriends so there's no back-stack
      // to return to after contacts permission dialog
      navigation.replace('AddFriends')
    } else {
      Alert.alert('Error', result.error)
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      {/* Background Logo - MOVED OUTSIDE KeyboardAvoidingView */}
      <View style={styles.backgroundLogo}>
        <Image
          source={require('../../assets/images/logo.png')}
          style={styles.backgroundLogoImage}
          resizeMode="contain"
        />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header with back button and title */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
              <Ionicons name="chevron-back" size={28} color={colors.textGreen} />
            </TouchableOpacity>
          </View>

          <Text style={styles.title}>Profile Setup</Text>

          {/* Form Fields */}
          <View style={styles.formSection}>
            <Input
              label="Name:"
              value={name}
              onChangeText={setName}
              placeholder="Enter your name"
              autoCapitalize="words"
              error={errors.name}
            />
          </View>

          {/* Profile Photo Section */}
          <View style={styles.photoSection}>
            <TouchableOpacity style={styles.photoContainer} onPress={showImageOptions}>
              {profilePhoto ? (
                <Image source={{ uri: profilePhoto }} style={styles.profilePhoto} />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <Ionicons name="person" size={80} color={colors.border} />
                </View>
              )}
            </TouchableOpacity>

            {/* Camera Button */}
            <TouchableOpacity style={styles.cameraButton} onPress={showImageOptions}>
              <Ionicons name="camera-outline" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Done Button */}
          <Button
            title="done"
            variant="gradient"
            size="medium"
            loading={loading}
            onPress={handleDone}
            style={styles.doneButton}
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
  },
  backgroundLogo: {
    position: 'absolute',
    bottom: 40,
    right: -20,
    zIndex: -1,
    opacity: 0.5,
  },
  backgroundLogoImage: {
    width: width * 0.85,
    height: height * 0.4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 16,
    marginBottom: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    color: colors.textGreen,
  },
  title: {
    fontSize: 24,
    fontFamily: fonts.pixel,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  formSection: {
    marginBottom: 20,
  },
  photoSection: {
    alignItems: 'center',
    marginBottom: 30,
    position: 'relative',
  },
  photoContainer: {
    width: 180,
    height: 220,
    borderRadius: 90,
    overflow: 'hidden',
    backgroundColor: colors.backgroundLight,
  },
  profilePhoto: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  photoPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.backgroundLight,
  },
  cameraButton: {
    position: 'absolute',
    bottom: 10,
    right: '25%',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.border,
    opacity: 0.8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneButton: {
    alignSelf: 'flex-start',
    minWidth: 100,
  },
})

export default ProfileSetupScreen
