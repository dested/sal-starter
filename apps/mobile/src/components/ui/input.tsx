import type { ComponentProps } from 'react'
import { TextInput } from 'react-native'
import { cn } from '~/lib/utils'

function Input({ className, ...props }: ComponentProps<typeof TextInput>) {
  return (
    <TextInput
      className={cn(
        'border-input text-foreground h-11 w-full rounded-md border bg-transparent px-3 text-base',
        className
      )}
      // TextInput has no className mapping for placeholder color; this gray reads in both themes.
      placeholderTextColor="#8a8a8a"
      {...props}
    />
  )
}

export { Input }
