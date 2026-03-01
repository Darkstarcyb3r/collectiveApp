// Collective App Typography
// Font configurations and text styles

export const fonts = {
  // CUSTOM FONT NAMES - UPDATED to match what App.js loads
  regular: 'RobotoMono-Regular', // Your regular font
  bold: 'RobotoMono-Bold', // Your bold font
  medium: 'RobotoMono-Medium', // Medium weight
  italic: 'RobotoMono-Italic', // Italic style
  semiBold: 'RobotoMono-SemiBold', // Semi-bold (or use 'RobotoMono-Bold' if no SemiBold)
  pixel: 'PressStart2P-Regular', // Your pixel font (currently RobotoMono)
  mono: 'FiraCode-Regular', // Your mono font (currently RobotoMono)
}

export const fontSizes = {
  xs: 10,
  sm: 12,
  md: 14,
  base: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
  '4xl': 36,
  '5xl': 48,
}

export const lineHeights = {
  tight: 1.1,
  normal: 1.4,
  relaxed: 1.6,
}

export const letterSpacing = {
  tight: -0.5,
  normal: 0,
  wide: 0.5,
  wider: 1,
}

// Helper function to create text styles with custom fonts
const createTextStyle = (baseStyle, fontFamily = fonts.regular) => ({
  ...baseStyle,
  fontFamily,
})

// Italic text style helper
const createItalicStyle = (baseStyle) => ({
  ...baseStyle,
  fontFamily: fonts.italic,
  fontStyle: 'normal', // Important: set to normal when using italic font file
})

// Pre-defined text styles WITH CUSTOM FONTS
export const textStyles = {
  // Headings - using bold font
  h1: createTextStyle(
    {
      fontSize: fontSizes['4xl'],
      fontWeight: 'normal',
      letterSpacing: letterSpacing.tight,
      lineHeight: fontSizes['4xl'] * lineHeights.tight,
    },
    fonts.bold
  ),

  h2: createTextStyle(
    {
      fontSize: fontSizes['3xl'],
      fontWeight: 'normal',
      letterSpacing: letterSpacing.tight,
      lineHeight: fontSizes['3xl'] * lineHeights.tight,
    },
    fonts.bold
  ),

  h3: createTextStyle(
    {
      fontSize: fontSizes['2xl'],
      fontWeight: 'normal',
      lineHeight: fontSizes['2xl'] * lineHeights.normal,
    },
    fonts.bold
  ),

  h4: createTextStyle(
    {
      fontSize: fontSizes.xl,
      fontWeight: 'normal',
      lineHeight: fontSizes.xl * lineHeights.normal,
    },
    fonts.semiBold || fonts.bold
  ),

  // Body text - using regular font
  body: createTextStyle(
    {
      fontSize: fontSizes.base,
      lineHeight: fontSizes.base * lineHeights.normal,
    },
    fonts.regular
  ),

  bodySmall: createTextStyle(
    {
      fontSize: fontSizes.md,
      lineHeight: fontSizes.md * lineHeights.normal,
    },
    fonts.regular
  ),

  bodyLarge: createTextStyle(
    {
      fontSize: fontSizes.lg,
      lineHeight: fontSizes.lg * lineHeights.normal,
    },
    fonts.regular
  ),

  // Italic styles
  bodyItalic: createItalicStyle({
    fontSize: fontSizes.base,
    lineHeight: fontSizes.base * lineHeights.normal,
  }),

  // Special styles
  label: createTextStyle(
    {
      fontSize: fontSizes.sm,
      fontWeight: 'normal',
      letterSpacing: letterSpacing.wide,
      lineHeight: fontSizes.sm * lineHeights.normal,
    },
    fonts.medium || fonts.semiBold || fonts.regular
  ),

  caption: createTextStyle(
    {
      fontSize: fontSizes.xs,
      letterSpacing: letterSpacing.wide,
      lineHeight: fontSizes.xs * lineHeights.normal,
    },
    fonts.regular
  ),

  button: createTextStyle(
    {
      fontSize: fontSizes.base,
      fontWeight: 'normal',
      letterSpacing: letterSpacing.wide,
      lineHeight: fontSizes.base * lineHeights.normal,
    },
    fonts.semiBold || fonts.bold
  ),

  // Input styles
  input: createTextStyle(
    {
      fontSize: fontSizes.base,
      lineHeight: fontSizes.base * lineHeights.normal,
    },
    fonts.regular
  ),

  inputLabel: createTextStyle(
    {
      fontSize: fontSizes.md,
      fontWeight: 'normal',
      lineHeight: fontSizes.md * lineHeights.normal,
    },
    fonts.medium || fonts.semiBold || fonts.regular
  ),

  // Special font-specific styles
  pixelText: createTextStyle(
    {
      fontSize: fontSizes.base,
      lineHeight: fontSizes.base * lineHeights.normal,
    },
    fonts.pixel
  ),

  monoText: createTextStyle(
    {
      fontSize: fontSizes.md,
      lineHeight: fontSizes.md * lineHeights.normal,
      letterSpacing: letterSpacing.normal,
    },
    fonts.mono
  ),

  code: createTextStyle({
    fontSize: fontSizes.sm,
    lineHeight: fontSizes.sm * lineHeights.normal,
    fontFamily: fonts.mono,
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 3,
  }),
}

// Export individual style getters for easier use
export const getFontStyle = (variant = 'body', options = {}) => {
  const baseStyle = textStyles[variant] || textStyles.body

  return {
    ...baseStyle,
    ...options,
  }
}

// For direct usage in StyleSheet.create()
export const typography = {
  fonts,
  fontSizes,
  lineHeights,
  letterSpacing,
  textStyles,
  getFontStyle,
}

export default typography
