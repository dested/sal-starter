import type { ReactNode } from 'react'
import { View } from 'react-native'
import { KeyboardAvoidingView, KeyboardAwareScrollView } from 'react-native-keyboard-controller'
import type { Edges } from 'react-native-safe-area-context'
import { withUniwind } from 'uniwind'
import { SafeAreaView } from '~/components/safe-area-view'
import { cn } from '~/lib/utils'

// Third-party views: withUniwind binds className (and contentContainerClassName).
const AwareScrollView = withUniwind(KeyboardAwareScrollView)
const AvoidingView = withUniwind(KeyboardAvoidingView)

type ScreenProps = {
  children: ReactNode
  /** Scrolls, keeping the focused input above the keyboard. Off: a fixed view that pads for the keyboard. */
  scroll?: boolean
  /** Safe-area edges to inset (default all four). */
  edges?: Edges
  /** The content container: padding, gap, alignment. */
  className?: string
}

// Every screen's frame: safe area, the token background, keyboard avoidance
// (react-native-keyboard-controller), optional scroll. Screens put content in it.
export function Screen({ children, scroll = true, edges, className }: ScreenProps) {
  return (
    <SafeAreaView className="flex-1 bg-background" edges={edges}>
      {scroll ? (
        <AwareScrollView
          bottomOffset={24}
          keyboardShouldPersistTaps="handled"
          contentContainerClassName={cn('grow p-6', className)}>
          {children}
        </AwareScrollView>
      ) : (
        <AvoidingView behavior="padding" className="flex-1">
          <View className={cn('flex-1 p-6', className)}>{children}</View>
        </AvoidingView>
      )}
    </SafeAreaView>
  )
}
