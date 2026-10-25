import { brand } from '@app/brand'
import * as SplashScreen from 'expo-splash-screen'
import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { Image, type ImageRequireSource, StyleSheet } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'

// The JS splash. It opens as an exact copy of the native one (same color, same
// mark, same size, centred: packages/brand), takes over by hiding the native
// splash once its own frame is drawn, and leaves when `ready` turns true.
// Mounted last in the root layout, over everything: <BrandSplash ready={…} />.
const MARK = require<ImageRequireSource>('../../assets/splash-icon.png')
const EXIT = { duration: 350, easing: Easing.out(Easing.cubic) }
// If the mark never reports loaded, hide the native splash anyway: a launch
// must never hang on it.
const REVEAL_FALLBACK_MS = 1000

// `onGone` fires once the exit has finished and the overlay is unmounting
// (the root layout holds OTA reloads until then).
export function BrandSplash({ ready, onGone }: { ready: boolean; onGone?: () => void }) {
  const reduceMotion = useReducedMotion()
  const [handedOff, setHandedOff] = useState(false)
  const [gone, setGone] = useState(false)
  const drawn = useRef({ layout: false, mark: false, hidden: false })
  const opacity = useSharedValue(1)
  const scale = useSharedValue(1)

  // Native → JS: hide the native splash once this overlay is laid out with
  // the mark drawn, so the swap is pixel-identical.
  const reveal = (part: 'layout' | 'mark') => {
    const d = drawn.current
    d[part] = true
    if (d.hidden || !(d.layout && d.mark)) return
    d.hidden = true
    const handOff = () => setHandedOff(true)
    void SplashScreen.hideAsync().then(handOff, handOff)
  }

  useEffect(() => {
    const fallback = setTimeout(() => reveal('mark'), REVEAL_FALLBACK_MS)
    return () => clearTimeout(fallback)
    // Once, from mount: `reveal` only touches the ref and a state setter.
  }, [])

  // An effect event, so a new `onGone` each render never restarts the exit.
  const notifyGone = useEffectEvent(() => onGone?.())

  // The exit: the mark grows a little as the overlay fades (a plain fade with
  // reduced motion), then the overlay unmounts.
  useEffect(() => {
    if (!ready || !handedOff) return
    const done = () => {
      setGone(true)
      notifyGone()
    }
    if (!reduceMotion) scale.set(withTiming(1.12, EXIT))
    opacity.set(
      withTiming(0, EXIT, (finished) => {
        if (finished) scheduleOnRN(done)
      })
    )
  }, [ready, handedOff, reduceMotion, opacity, scale])

  const overlay = useAnimatedStyle(() => ({ opacity: opacity.get() }))
  const mark = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }))

  if (gone) return null

  return (
    <Animated.View
      onLayout={() => reveal('layout')}
      style={[styles.overlay, { pointerEvents: ready ? 'none' : 'auto' }, overlay]}>
      <Animated.View style={mark}>
        <Image
          source={MARK}
          fadeDuration={0}
          onLoadEnd={() => reveal('mark')}
          resizeMode="contain"
          style={styles.mark}
        />
      </Animated.View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 1000,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: brand.splash.background,
  },
  mark: { width: brand.splash.markWidth, height: brand.splash.markWidth },
})
