import { Link } from 'expo-router'
import { useState } from 'react'
import { KeyboardAvoidingView, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from '~/components/safe-area-view'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { authClient } from '~/lib/auth-client'

// The root layout's Stack.Protected guard swaps to (app) once the session
// lands, so there's no navigate() here.
export function SignInScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function submit() {
    setPending(true)
    setError(null)
    const { error } = await authClient.signIn.email({ email, password })
    setPending(false)
    if (error) setError(error.message ?? 'Sign in failed')
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView behavior="padding" className="flex-1">
        <ScrollView
          contentContainerClassName="mx-auto w-full max-w-md grow justify-center gap-8 p-6"
          keyboardShouldPersistTaps="handled">
          <Text className="font-display text-4xl font-bold tracking-tight text-foreground">
            Sign in
          </Text>
          <View className="gap-5">
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
                textContentType="password"
              />
            </View>
            {error !== null && <Text className="text-sm text-destructive">{error}</Text>}
            <Button
              size="lg"
              className="mt-1"
              label={pending ? 'Signing in…' : 'Sign in'}
              disabled={pending}
              onPress={submit}
            />
          </View>
          <Link href="/sign-up" className="text-base font-medium text-foreground">
            Create an account
          </Link>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
