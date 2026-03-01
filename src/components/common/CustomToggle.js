// Custom Toggle Component
// Clean pill-shaped toggle with smooth animation
// Replaces the native Switch component for consistent styling

import React, { useEffect, useRef } from 'react'
import { TouchableOpacity, Animated, StyleSheet } from 'react-native'
import { colors } from '../../theme'

const CustomToggle = ({
  value,
  onValueChange,
  size = 'default', // 'small' | 'default'
  activeColor = colors.primary,
  inactiveColor = '#333333',
  thumbActiveColor = '#ffffff',
  thumbInactiveColor = '#666666',
}) => {
  const animatedValue = useRef(new Animated.Value(value ? 1 : 0)).current

  useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: value ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const isSmall = size === 'small'
  const trackWidth = isSmall ? 34 : 44
  const trackHeight = isSmall ? 20 : 24
  const thumbSize = isSmall ? 16 : 20
  const thumbMargin = 2

  const translateX = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [thumbMargin, trackWidth - thumbSize - thumbMargin],
  })

  const trackColor = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [inactiveColor, activeColor],
  })

  const thumbColor = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [thumbInactiveColor, thumbActiveColor],
  })

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => onValueChange(!value)}
      style={{ padding: 2 }}
    >
      <Animated.View
        style={[
          styles.track,
          {
            width: trackWidth,
            height: trackHeight,
            borderRadius: trackHeight / 2,
            backgroundColor: trackColor,
          },
        ]}
      >
        <Animated.View
          style={[
            styles.thumb,
            {
              width: thumbSize,
              height: thumbSize,
              borderRadius: thumbSize / 2,
              backgroundColor: thumbColor,
              transform: [{ translateX }],
            },
          ]}
        />
      </Animated.View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  track: {
    justifyContent: 'center',
  },
  thumb: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
})

export default CustomToggle
