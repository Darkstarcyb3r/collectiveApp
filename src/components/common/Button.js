// Custom Button Component
// Matches the Figma design with rounded buttons

import React from 'react'
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native'
import { colors } from '../../theme'

const Button = ({
  title,
  onPress,
  variant = 'primary', // primary, secondary, outline, light, lime
  size = 'medium', // small, medium, large
  disabled = false,
  loading = false,
  style,
  textStyle,
}) => {
  const getButtonStyle = () => {
    const baseStyle = [styles.base, styles[size]]

    switch (variant) {
      case 'primary':
        baseStyle.push(styles.primary)
        break
      case 'secondary':
        baseStyle.push(styles.secondary)
        break
      case 'outline':
        baseStyle.push(styles.outline)
        break
      case 'light':
        baseStyle.push(styles.light)
        break
      case 'lime':
        baseStyle.push(styles.lime)
        break
      default:
        baseStyle.push(styles.primary)
    }

    if (disabled) {
      baseStyle.push(styles.disabled)
    }

    return baseStyle
  }

  const getTextStyle = () => {
    const baseTextStyle = [styles.text, styles[`${size}Text`]]

    switch (variant) {
      case 'primary':
        baseTextStyle.push(styles.primaryText)
        break
      case 'secondary':
        baseTextStyle.push(styles.secondaryText)
        break
      case 'outline':
        baseTextStyle.push(styles.outlineText)
        break
      case 'light':
        baseTextStyle.push(styles.lightText)
        break
      case 'lime':
        baseTextStyle.push(styles.limeText)
        break
      default:
        baseTextStyle.push(styles.primaryText)
    }

    if (disabled) {
      baseTextStyle.push(styles.disabledText)
    }

    return baseTextStyle
  }

  return (
    <TouchableOpacity
      style={[...getButtonStyle(), style]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'outline' ? colors.primary : colors.textDark}
          size="small"
        />
      ) : (
        <Text style={[...getTextStyle(), textStyle]}>{title}</Text>
      )}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Variants
  primary: {
    backgroundColor: colors.primary,
  },
  secondary: {
    backgroundColor: colors.tertiary,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: colors.primary,
  },
  light: {
    backgroundColor: colors.backgroundLight,
  },
  lime: {
    backgroundColor: colors.secondary, // #d8ff1b - Lime
  },

  // Disabled
  disabled: {
    opacity: 0.5,
  },

  // Text styles
  text: {
    fontWeight: '600',
  },
  primaryText: {
    color: colors.textDark,
  },
  secondaryText: {
    color: colors.textDark,
  },
  outlineText: {
    color: colors.primary,
  },
  lightText: {
    color: colors.textDark,
  },
  limeText: {
    color: colors.textDark,
  },
  disabledText: {
    color: colors.textSecondary,
  },
})

export default Button
