// Custom Button Component
// Matches the Figma design with rounded buttons

import React from 'react'
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { colors } from '../../theme'

const Button = ({
  title,
  onPress,
  variant = 'primary', // primary, secondary, outline, light, lime, gradient
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
      case 'gradient':
        // No background — handled by LinearGradient wrapper
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
      case 'gradient':
        baseTextStyle.push(styles.gradientText)
        break
      default:
        baseTextStyle.push(styles.primaryText)
    }

    if (disabled) {
      baseTextStyle.push(styles.disabledText)
    }

    return baseTextStyle
  }

  const content = loading ? (
    <ActivityIndicator
      color={variant === 'outline' ? colors.primary : colors.textDark}
      size="small"
    />
  ) : (
    <Text style={[...getTextStyle(), textStyle]}>{title}</Text>
  )

  // Gradient variant wraps with LinearGradient
  if (variant === 'gradient') {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={disabled || loading}
        activeOpacity={0.8}
        style={[disabled && styles.disabled, style]}
      >
        <LinearGradient
          colors={['#cafb6c', '#71f200', '#23ff0d']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.base, styles[size], styles.gradientInner]}
        >
          {content}
        </LinearGradient>
      </TouchableOpacity>
    )
  }

  return (
    <TouchableOpacity
      style={[...getButtonStyle(), style]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {content}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Sizes
  small: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  medium: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  large: {
    paddingVertical: 16,
    paddingHorizontal: 32,
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
  gradientInner: {
    overflow: 'hidden',
  },

  // Disabled
  disabled: {
    opacity: 0.5,
  },

  // Text sizes
  smallText: {
    fontSize: 13,
  },
  mediumText: {
    fontSize: 15,
  },
  largeText: {
    fontSize: 17,
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
  gradientText: {
    color: colors.textDark,
  },
  disabledText: {
    color: colors.textSecondary,
  },
})

export default Button
