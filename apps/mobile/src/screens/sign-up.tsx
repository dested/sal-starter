import { Link } from 'expo-router'
import { useState } from 'react'
import { Text, View } from 'react-native'
import { Screen } from '~/components/screen'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { authClient } from '~/lib/auth-client'

// autoSignIn is on server-side, so a successful sign-up flips the guard to (app).
export function SignUpScreen() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function submit() {
    setPending(true)
    setError(null)
    const { error } = await authClient.signUp.email({ name, email, password })
    setPending(false)
    if (error) setError(error.message ?? 'Sign up failed')
  }

  return (
    <Screen className="mx-auto w-full max-w-md justify-center gap-8">
      <Text className="font-display text-4xl font-bold tracking-tight text-foreground">
        Create account
      </Text>
      <View className="gap-5">
        <View className="gap-2">
          <Label>Name</Label>
          <Input value={name} onChangeText={setName} textContentType="name" />
        </View>
        <View className="gap-2">
          <Label>Email</Label>
          <Input
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
          />
        </View>
        <View className="gap-2">
          <Label>Password</Label>
          <Input
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType="newPassword"
          />
        </View>
        {error !== null && <Text className="text-sm text-destructive">{error}</Text>}
        <Button
          size="lg"
          className="mt-1"
          label={pending ? 'Creating account…' : 'Sign up'}
          disabled={pending || name === '' || email === '' || password === ''}
          onPress={submit}
        />
      </View>
      <Link href="/sign-in" className="self-start text-base font-medium text-foreground underline">
        I already have an account
      </Link>
    </Screen>
  )
}
