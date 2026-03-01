// ChatInput - Message input bar with send button and image upload icon
// Supports 'dark' (default, for ChatScreen) and 'light' (for CyberLoungeDetailScreen) variants

import React, { useState } from 'react'
import { View, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../../theme'
import { fonts } from '../../theme/typography'

const ChatInput = ({ onSend, onPickImage, disabled, uploading, variant = 'dark' }) => {
  const [messageText, setMessageText] = useState('')
  const isLight = variant === 'light'

  const handleSend = () => {
    const trimmed = messageText.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setMessageText('')
  }

  return (
    <View style={[styles.container, isLight && styles.containerLight]}>
      {/* Image Upload Icon */}
      <TouchableOpacity
        style={[styles.addIconContainer, isLight && styles.addIconContainerLight]}
        onPress={onPickImage}
        disabled={disabled || uploading}
      >
        {uploading ? (
          <ActivityIndicator size="small" color={isLight ? colors.textDark : colors.primary} />
        ) : (
          <Ionicons name="add" size={22} color={isLight ? colors.textDark : colors.offline} />
        )}
      </TouchableOpacity>

      <View style={[styles.inputWrapper, isLight && styles.inputWrapperLight]}>
        <TextInput
          style={[styles.input, isLight && styles.inputLight]}
          placeholder="Type a message..."
          placeholderTextColor={colors.offline}
          value={messageText}
          onChangeText={setMessageText}
          multiline
          maxLength={1000}
          returnKeyType="default"
        />
      </View>
      <TouchableOpacity
        style={[
          styles.sendButton,
          isLight && styles.sendButtonLight,
          (!messageText.trim() || disabled) && styles.sendButtonDisabled,
        ]}
        onPress={handleSend}
        disabled={!messageText.trim() || disabled}
      >
        <Ionicons name="arrow-up" size={20} color={isLight ? '#ffffff' : colors.textDark} />
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  // Dark variant (default — for ChatScreen)
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  addIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: colors.backgroundCard,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    maxHeight: 100,
  },
  input: {
    color: colors.textPrimary,
    fontSize: 14,
    fontFamily: fonts.regular,
    maxHeight: 80,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },

  // Light variant overrides (for CyberLoungeDetailScreen)
  containerLight: {
    backgroundColor: colors.backgroundLight,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  addIconContainerLight: {
    borderColor: colors.textDark,
  },
  inputWrapperLight: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: colors.textDark,
  },
  inputLight: {
    color: colors.textDark,
  },
  sendButtonLight: {
    backgroundColor: colors.textDark,
  },
})

export default ChatInput
