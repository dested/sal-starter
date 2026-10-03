import type { ComponentProps } from 'react'
import { Text, View } from 'react-native'
import { cn } from '~/lib/utils'

function Card({ className, ...props }: ComponentProps<typeof View>) {
  return (
    <View
      className={cn('bg-card border-border gap-6 rounded-xl border py-6 shadow-sm', className)}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: ComponentProps<typeof View>) {
  return <View className={cn('gap-1.5 px-6', className)} {...props} />
}

function CardTitle({ className, ...props }: ComponentProps<typeof Text>) {
  return (
    <Text
      className={cn('text-card-foreground leading-none font-semibold tracking-tight', className)}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: ComponentProps<typeof Text>) {
  return <Text className={cn('text-muted-foreground text-sm', className)} {...props} />
}

function CardContent({ className, ...props }: ComponentProps<typeof View>) {
  return <View className={cn('px-6', className)} {...props} />
}

export { Card, CardHeader, CardTitle, CardDescription, CardContent }
