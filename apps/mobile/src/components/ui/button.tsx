import type { ComponentProps } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Pressable, Text } from 'react-native'
import { cn } from '~/lib/utils'

// Same variants and tokens as web's shadcn button (apps/web/src/components/ui).
const buttonVariants = cva(
  'flex-row items-center justify-center gap-2 rounded-md active:opacity-80 disabled:opacity-50',
  {
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
  }
)

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

type ButtonProps = ComponentProps<typeof Pressable> &
  VariantProps<typeof buttonVariants> & { label: string }

function Button({ className, variant, size, label, ...props }: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}>
      <Text className={buttonTextVariants({ variant })}>{label}</Text>
    </Pressable>
  )
}

export { Button, buttonVariants }
