// Collective App Theme
// Central theme configuration

import { colors } from './colors'
import typography from './typography'

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  '2xl': 32,
  '3xl': 48,
  '4xl': 64,
}

export const borderRadius = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  '2xl': 24,
  full: 9999,
}

export const shadows = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  sm: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  lg: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
}

// Common component styles
export const commonStyles = {
  // Screen container
  screenContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  screenContainerLight: {
    flex: 1,
    backgroundColor: colors.backgroundLight,
  },

  // Cards
  card: {
    backgroundColor: colors.backgroundLight,
    borderRadius: borderRadius.xl,
    padding: spacing.base,
    ...shadows.md,
  },
  cardDark: {
    backgroundColor: colors.backgroundCard,
    borderRadius: borderRadius.xl,
    padding: spacing.base,
    borderWidth: 1,
    borderColor: colors.border,
  },

  // Buttons
  buttonPrimary: {
    backgroundColor: colors.buttonPrimary,
    borderRadius: borderRadius.full,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonSecondary: {
    backgroundColor: colors.buttonSecondary,
    borderRadius: borderRadius.full,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonOutline: {
    backgroundColor: 'transparent',
    borderRadius: borderRadius.full,
    borderWidth: 2,
    borderColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonLight: {
    backgroundColor: colors.backgroundLight,
    borderRadius: borderRadius.full,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Inputs
  input: {
    backgroundColor: colors.inputBackground,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.base,
    fontSize: typography.fontSizes.base,
    color: colors.textDark,
  },
  inputLabel: {
    fontSize: typography.fontSizes.md,
    color: colors.textDark,
    opacity: 0.6,
    marginBottom: spacing.xs,
    fontWeight: '500',
  },

  // Avatar styles
  avatarSmall: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarMedium: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  avatarLarge: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarXLarge: {
    width: 150,
    height: 150,
    borderRadius: 75,
  },

  // Profile avatar (egg shape from design)
  profileAvatar: {
    width: 180,
    height: 220,
    borderRadius: 90,
  },

  // Flex utilities
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
}

const theme = {
  colors,
  ...typography,
  spacing,
  borderRadius,
  shadows,
  commonStyles,
}

export { colors }
export default theme
