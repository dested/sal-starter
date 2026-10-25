// demo: the template's reference for a tRPC query + mutation on native,
// prefetched on focus. Deleted by `bun run demo:drop` (a fork's build fails
// while it's present); copy the pattern, not the feature.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useFocusEffect } from 'expo-router'
import { useCallback, useState } from 'react'
import { Text, View } from 'react-native'
import { Button } from '~/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import { trpc, useTRPC } from '~/lib/trpc'

export function PostsDemo() {
  const t = useTRPC()
  const queryClient = useQueryClient()

  // Coming back to Home refreshes a stale list without a "Loading…" flash.
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

  return (
    <View className="gap-8">
      <View className="rounded-md border-2 border-dashed border-warning bg-warning/10 px-4 py-3">
        <Text className="text-sm font-medium text-foreground">
          Template demo · delete before shipping: bun run demo:drop
        </Text>
      </View>

      <Card>
        <CardHeader>
          <CardTitle>New post</CardTitle>
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
            <Text className="text-sm text-destructive">{createPost.error.message}</Text>
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
        <Text className="text-xl font-semibold text-foreground">Recent posts</Text>
        {postsQuery.isLoading && <Text className="text-sm text-muted-foreground">Loading…</Text>}
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
          <Text className="text-sm text-muted-foreground">No posts yet</Text>
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
              <Text className="text-sm text-card-foreground">{p.content}</Text>
            </CardContent>
          </Card>
        ))}
      </View>
    </View>
  )
}
