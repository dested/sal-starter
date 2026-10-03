import { pluginValue } from '@app/native-example'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as Updates from 'expo-updates'
import { useFocusEffect } from 'expo-router'
import { useCallback, useState } from 'react'
import { ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { nativeHello } from '../../modules/app-native'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { authClient } from '~/lib/auth-client'
import { trpc, useTRPC } from '~/lib/trpc'

// Mirrors web's /dashboard: posts list + create form, plus sign-out and the
// native examples. Prefetches on focus so coming back to Home refreshes a
// stale list without a "Loading…" flash.
export function HomeScreen() {
  const { data: session } = authClient.useSession()
  const t = useTRPC()
  const queryClient = useQueryClient()

  useFocusEffect(
    useCallback(() => {
      void queryClient.prefetchQuery(trpc.posts.list.queryOptions())
    }, [queryClient])
  )

  const postsQuery = useQuery(t.posts.list.queryOptions())
  const createPost = useMutation(
    t.posts.create.mutationOptions({
      onSuccess: () => queryClient.invalidateQueries({ queryKey: t.posts.list.queryKey() }),
    })
  )

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')

  if (!session) return null

  return (
    <SafeAreaView className="bg-background flex-1" edges={['top', 'left', 'right']}>
      <ScrollView contentContainerClassName="gap-8 p-6" keyboardShouldPersistTaps="handled">
        <View className="flex-row items-start justify-between gap-4">
          <View className="flex-1 gap-1">
            <Text className="text-foreground text-3xl font-bold tracking-tight">Home</Text>
            <Text className="text-muted-foreground">
              Welcome back, {session.user.name || session.user.email}.
            </Text>
          </View>
          <Button
            variant="outline"
            size="sm"
            label="Sign out"
            onPress={() => void authClient.signOut()}
          />
        </View>

        <Card>
          <CardHeader>
            <CardTitle>New post</CardTitle>
            <CardDescription>
              Posts are stored in Postgres via Prisma, fetched over tRPC.
            </CardDescription>
          </CardHeader>
          <CardContent className="gap-4">
            <View className="gap-2">
              <Label>Title</Label>
              <Input value={title} onChangeText={setTitle} />
            </View>
            <View className="gap-2">
              <Label>Content</Label>
              <Input value={content} onChangeText={setContent} />
            </View>
            {createPost.isError && (
              <Text className="text-destructive text-sm">{createPost.error.message}</Text>
            )}
            <Button
              label={createPost.isPending ? 'Posting…' : 'Post'}
              disabled={createPost.isPending || title === '' || content === ''}
              onPress={() =>
                createPost.mutate(
                  { title, content },
                  {
                    onSuccess: () => {
                      setTitle('')
                      setContent('')
                    },
                  }
                )
              }
            />
          </CardContent>
        </Card>

        <View className="gap-3">
          <Text className="text-foreground text-xl font-semibold">Recent posts</Text>
          {postsQuery.isLoading && <Text className="text-muted-foreground text-sm">Loading…</Text>}
          {postsQuery.isError && (
            <Card>
              <CardHeader>
                <CardTitle>Can’t reach the server</CardTitle>
                <CardDescription>{postsQuery.error.message}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" label="Retry" onPress={() => void postsQuery.refetch()} />
              </CardContent>
            </Card>
          )}
          {postsQuery.data?.length === 0 && (
            <Text className="text-muted-foreground text-sm">No posts yet — be the first.</Text>
          )}
          {postsQuery.data?.map((p) => (
            <Card key={p.id}>
              <CardHeader>
                <CardTitle>{p.title}</CardTitle>
                <CardDescription>
                  by {p.authorName ?? 'unknown'} · {p.createdAt.toISOString().slice(0, 10)}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Text className="text-card-foreground text-sm">{p.content}</Text>
              </CardContent>
            </Card>
          ))}
        </View>

        <NativeExamples />
      </ScrollView>
    </SafeAreaView>
  )
}

// Proves both native hosting modes. In dev it also shows the binary's
// fingerprint: compare it with `bun run fingerprint` to know when the Mac must
// rebuild the dev client (CLAUDE.md rule #20).
function NativeExamples() {
  const hello = nativeHello()
  const plist = pluginValue()
  return (
    <View className="gap-1 pb-6">
      <Text className="text-muted-foreground text-xs">
        modules/app-native: {hello ?? 'not in this build (rebuild the dev client)'}
      </Text>
      <Text className="text-muted-foreground text-xs">
        @app/native-example: {plist ?? 'not in this build (rebuild the dev client)'}
      </Text>
      {__DEV__ && (
        <Text className="text-muted-foreground text-xs">
          fingerprint: {Updates.runtimeVersion ?? 'unknown'}
        </Text>
      )}
    </View>
  )
}
