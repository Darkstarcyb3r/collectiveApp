// Confirm Modal Component
// Dark themed confirmation dialog with optional icon
// All action buttons use primary green theme

import React from 'react'
import { Modal, View, Text, TouchableOpacity, StyleSheet, Pressable } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors } from '../../theme'
import { fonts } from '../../theme/typography'

const ConfirmModal = ({
  visible,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  icon = null, // Ionicons name string, e.g. 'trash-outline'
  iconColor = null, // Override icon color (defaults to primary green)
}) => {
  const resolvedIconColor = iconColor || colors.primary

  return (
    <Modal visible={visible} transparent={true} animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.overlay} onPress={onCancel}>
        <Pressable style={styles.modalContainer} onPress={(e) => e.stopPropagation()}>
          {icon && <Ionicons name={icon} size={28} color={resolvedIconColor} style={styles.icon} />}
          {title && <Text style={styles.title}>{title}</Text>}
          {message && <Text style={styles.message}>{message}</Text>}

          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.cancelButton} onPress={onCancel} activeOpacity={0.7}>
              <Text style={styles.cancelText}>{cancelText}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={onConfirm} activeOpacity={0.7}>
              <Text style={styles.actionText}>{confirmText}</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    paddingVertical: 24,
    paddingHorizontal: 24,
    width: 280,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  icon: {
    marginBottom: 12,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 17,
    fontFamily: fonts.bold,
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    color: '#AAAAAA',
    fontSize: 13,
    fontFamily: fonts.regular,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#333333',
  },
  cancelText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: fonts.medium,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  actionText: {
    color: '#000000',
    fontSize: 14,
    fontFamily: fonts.bold,
  },
})

export default ConfirmModal
