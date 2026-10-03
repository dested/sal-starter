import type { ComponentProps } from 'react'
import { Text } from 'react-native'
import { cn } from '~/lib/utils'

function Label({ className, ...props }: ComponentProps<typeof Text>) {
  return (
    <Text
      className={cn('text-foreground text-sm leading-none font-medium', className)}
      {...props}
    />
  )
}

export { Label }
