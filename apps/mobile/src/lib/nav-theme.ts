import { colors } from '@app/tokens'
import { DarkTheme, DefaultTheme, type Theme } from 'expo-router'
import { appConfig } from '~/lib/app-config'

// React Navigation's theme from the tokens, so headers, tab bars, the card
// behind every screen and transitions paint the look's colors, never
// navigation's white or black defaults. `dark` follows the one look.scheme.
const dark = appConfig.extra.colorScheme === 'dark'
const base = dark ? DarkTheme : DefaultTheme

export const navTheme: Theme = {
  ...base,
  dark,
  colors: {
    ...base.colors,
    primary: colors.primary,
    background: colors.background,
    card: colors.card,
    text: colors.foreground,
    border: colors.border,
    notification: colors.destructive,
  },
}
