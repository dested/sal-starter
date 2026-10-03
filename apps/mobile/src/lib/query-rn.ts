import { focusManager, onlineManager } from '@tanstack/react-query'
import * as Network from 'expo-network'
import { AppState } from 'react-native'

// React Query's browser defaults (window focus, navigator.onLine) don't exist
// on native. Wire them to AppState and expo-network once, at startup.
export function wireReactQueryToNative(): () => void {
  onlineManager.setEventListener((setOnline) => {
    const sub = Network.addNetworkStateListener((state) => {
      setOnline(state.isConnected === true)
    })
    return () => sub.remove()
  })
  const sub = AppState.addEventListener('change', (status) => {
    focusManager.setFocused(status === 'active')
  })
  return () => sub.remove()
}
