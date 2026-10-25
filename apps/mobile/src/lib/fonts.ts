import { useFonts, type FontSource } from 'expo-font'

// The font files the root layout loads behind the splash, by the family name
// global.css maps (`@theme { --font-sans: 'Inter_400Regular'; }`; native takes
// one family name per weight). Empty = the system font, which is what
// tokens.css names until the kickoff. The kickoff swaps the family:
//   bunx expo install @expo-google-fonts/<family>
//   import { Inter_400Regular, Inter_600SemiBold } from '@expo-google-fonts/inter'
//   FONTS = { Inter_400Regular, Inter_600SemiBold }
export const FONTS: Record<string, FontSource> = {}

/** True once FONTS are loaded, or failed to (the system font stands in: a font never holds the splash). */
export function useAppFonts(): boolean {
  const [loaded, error] = useFonts(FONTS)
  return loaded || error !== null
}
