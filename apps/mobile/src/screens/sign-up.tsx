import { Link } from 'expo-router'
import { useState } from 'react'
import { KeyboardAvoidingView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
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
    <SafeAreaView className="bg-background flex-1">
      <KeyboardAvoidingView behavior="padding" className="flex-1 justify-center p-6">
        <Card className="mx-auto w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl">Create an account</CardTitle>
            <CardDescription>It takes ten seconds.</CardDescription>
          </CardHeader>
          <CardContent className="gap-4">
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
            {error !== null && <Text className="text-destructive text-sm">{error}</Text>}
            <Button
              label={pending ? 'Creating account…' : 'Sign up'}
              disabled={pending}
              onPress={submit}
            />
            <Text className="text-muted-foreground text-center text-sm">
              Have an account?{' '}
              <Link href="/sign-in" className="text-foreground underline">
                Sign in
              </Link>
            </Text>
          </CardContent>
        </Card>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
