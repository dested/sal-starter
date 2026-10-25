import { Stack } from 'expo-router'

// fullScreenGestureEnabled: false keeps iOS 26's back swipe on the screen edge;
// left undefined, react-native-screens turns any sideways drag (a slider, a
// horizontal list) into "go back".
export default function AppLayout() {
  return <Stack screenOptions={{ headerShown: false, fullScreenGestureEnabled: false }} />
}
