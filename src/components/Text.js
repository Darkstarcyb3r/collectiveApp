import React from 'react'
import { Text as RNText } from 'react-native'
import { textStyles, fonts } from '../theme/typography'

function CustomText({ children, variant = 'body', style, bold, italic, align, color, ...props }) {
  const baseStyle = textStyles[variant] || textStyles.body
  let fontFamily = baseStyle.fontFamily || fonts.regular
  if (bold && fonts.bold) fontFamily = fonts.bold
  if (italic && fonts.italic) fontFamily = fonts.italic

  return (
    <RNText
      style={[baseStyle, { fontFamily, textAlign: align, color: color || '#000' }, style]}
      {...props}
    >
      {children}
    </RNText>
  )
}

export default CustomText
