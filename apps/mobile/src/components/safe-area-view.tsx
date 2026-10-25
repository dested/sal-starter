import { SafeAreaView as SafeAreaContextView } from 'react-native-safe-area-context'
import { withUniwind } from 'uniwind'

// Uniwind binds className on react-native's own components only. A third-party
// native view (this one) needs withUniwind, or its className is silently
// dropped on device. Import SafeAreaView from here, never from the library.
export const SafeAreaView = withUniwind(SafeAreaContextView)
