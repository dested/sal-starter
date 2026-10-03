import { Link } from 'expo-router'
import { useState } from 'react'
import { KeyboardAvoidingView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
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
    <SafeAreaView className="bg-background flex-1">
      <KeyboardAvoidingView behavior="padding" className="flex-1 justify-center p-6">
        <Card className="mx-auto w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl">Sign in</CardTitle>
            <CardDescription>Welcome back.</CardDescription>
          </CardHeader>
          <CardContent className="gap-4">
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
            {error !== null && <Text className="text-destructive text-sm">{error}</Text>}
            <Button
              label={pending ? 'Signing in…' : 'Sign in'}
              disabled={pending}
              onPress={submit}
            />
            <Text className="text-muted-foreground text-center text-sm">
              No account?{' '}
              <Link href="/sign-up" className="text-foreground underline">
                Sign up
              </Link>
            </Text>
          </CardContent>
        </Card>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
