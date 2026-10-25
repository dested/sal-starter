import type { ComponentProps } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import * as Haptics from 'expo-haptics'
import { Pressable, Text } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { withUniwind } from 'uniwind'
import { cn } from '~/lib/utils'

// Same variants and tokens as web's shadcn button (apps/web/src/components/ui).
const buttonVariants = cva('flex-row items-center justify-center gap-2 rounded-md', {
  variants: {
    variant: {
      default: 'bg-primary',
      destructive: 'bg-destructive',
      outline: 'border border-input bg-background',
      secondary: 'bg-secondary',
      ghost: '',
    },
    size: {
      default: 'h-11 px-4',
      sm: 'h-9 px-3',
      lg: 'h-12 px-6',
    },
  },
  defaultVariants: { variant: 'default', size: 'default' },
})

const buttonTextVariants = cva('text-sm font-medium', {
  variants: {
    variant: {
      default: 'text-primary-foreground',
      destructive: 'text-destructive-foreground',
      outline: 'text-foreground',
      secondary: 'text-secondary-foreground',
      ghost: 'text-foreground',
    },
  },
  defaultVariants: { variant: 'default' },
})

// A Reanimated Pressable is a third-party view to Uniwind: withUniwind binds its className.
const AnimatedPressable = withUniwind(Animated.createAnimatedComponent(Pressable))
const PRESS = { duration: 120 }

type ButtonProps = Omit<ComponentProps<typeof Pressable>, 'style' | 'children'> &
  VariantProps<typeof buttonVariants> & { label: string; className?: string }

function Button({
  className,
  variant,
  size,
  label,
  disabled,
  onPressIn,
  onPressOut,
  ...props
}: ButtonProps) {
  const reduceMotion = useReducedMotion()
  const scale = useSharedValue(1)
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }))

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled === true }}
      disabled={disabled}
      className={cn(
        buttonVariants({ variant, size }),
        disabled === true && 'opacity-50',
        className
      )}
      // A plain style, never Pressable's `({ pressed }) => …` function: Uniwind drops className next to one.
      style={pressStyle}
      onPressIn={(e) => {
        if (!reduceMotion) scale.set(withTiming(0.96, PRESS))
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        onPressIn?.(e)
      }}
      onPressOut={(e) => {
        scale.set(withTiming(1, PRESS))
        onPressOut?.(e)
      }}
      {...props}>
      <Text className={buttonTextVariants({ variant })}>{label}</Text>
    </AnimatedPressable>
  )
}

export { Button, buttonVariants }
