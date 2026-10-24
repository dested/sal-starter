import type { ComponentProps } from 'react'
import { Text, View } from 'react-native'
import { cn } from '~/lib/utils'

function Card({ className, ...props }: ComponentProps<typeof View>) {
  return (
    <View
      className={cn('gap-6 rounded-xl border border-border bg-card py-6 shadow-card', className)}
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
      className={cn('leading-none font-semibold tracking-tight text-card-foreground', className)}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: ComponentProps<typeof Text>) {
  return <Text className={cn('text-sm text-muted-foreground', className)} {...props} />
}

function CardContent({ className, ...props }: ComponentProps<typeof View>) {
  return <View className={cn('px-6', className)} {...props} />
}

export { Card, CardHeader, CardTitle, CardDescription, CardContent }
