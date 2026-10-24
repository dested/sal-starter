import { colors } from '@app/tokens'
import type { ComponentProps } from 'react'
import { TextInput } from 'react-native'
import { cn } from '~/lib/utils'

function Input({ className, ...props }: ComponentProps<typeof TextInput>) {
  return (
    <TextInput
      className={cn(
        'h-11 w-full rounded-md border border-input bg-transparent px-3 text-base text-foreground',
        className
      )}
      // TextInput has no className mapping for placeholder color: use the token hex.
      placeholderTextColor={colors.mutedForeground}
      {...props}
    />
  )
}

export { Input }
