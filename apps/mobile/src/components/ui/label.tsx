import type { ComponentProps } from 'react'
import { Text } from 'react-native'
import { cn } from '~/lib/utils'

function Label({ className, ...props }: ComponentProps<typeof Text>) {
  return (
    <Text
      className={cn('text-sm leading-none font-medium text-foreground', className)}
      {...props}
    />
  )
}

export { Label }
