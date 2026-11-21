// demo: deleted by `bun run demo:drop` with the rest of the Post demo.
import { describe, expect, test } from 'bun:test'
import { asAdmin, asAnon, asUser } from '../test/callers'
import { prisma } from './prisma'

describe('posts.list', () => {
  test('anyone sees posts newest first, with the author name and a real Date', async () => {
    const author = await asUser('List Author')
    const older = await prisma.post.create({
      data: {
        title: 'older',
        content: 'a',
        authorId: author.user.id,
        createdAt: new Date('2026-01-01T00:00:00Z'),
      },
    })
    const newer = await prisma.post.create({
      data: {
        title: 'newer',
        content: 'b',
        authorId: author.user.id,
        createdAt: new Date('2026-01-02T00:00:00Z'),
      },
    })
    const list = await (await asAnon()).api.posts.list()
    const mine = list.filter((p) => p.id === older.id || p.id === newer.id)
    expect(mine.map((p) => p.title)).toEqual(['newer', 'older'])
    expect(mine[0]).toEqual({
      id: newer.id,
      title: 'newer',
      content: 'b',
      createdAt: new Date('2026-01-02T00:00:00Z'),
      authorName: 'List Author',
    })
  })

  test('returns at most 50', async () => {
    const author = await asUser()
    await prisma.post.createMany({
      data: Array.from({ length: 51 }, (_, i) => ({
        title: `bulk ${i}`,
        content: 'x',
        authorId: author.user.id,
      })),
    })
    expect(await (await asAnon()).api.posts.list()).toHaveLength(50)
  })
})

describe('posts.create', () => {
  test('writes a post owned by the caller and returns it', async () => {
    const person = await asUser()
    const created = await person.api.posts.create({ title: 'Hello', content: 'World' })
    const row = await prisma.post.findUniqueOrThrow({ where: { id: created.id } })
    expect(row).toMatchObject({ title: 'Hello', content: 'World', authorId: person.user.id })
    expect(created).toEqual(row)
  })

  test('an admin may post too', async () => {
    const admin = await asAdmin()
    const created = await admin.api.posts.create({ title: 'From admin', content: 'x' })
    expect(created.authorId).toBe(admin.user.id)
  })

  test('rejects a signed-out caller and writes nothing', async () => {
    const before = await prisma.post.count()
    const anon = await asAnon()
    await expect(anon.api.posts.create({ title: 'nope', content: 'nope' })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    })
    expect(await prisma.post.count()).toBe(before)
  })

  test('rejects an empty or too-long title or content', async () => {
    const person = await asUser()
    for (const input of [
      { title: '', content: 'x' },
      { title: 'x', content: '' },
      { title: 'x'.repeat(201), content: 'x' },
      { title: 'x', content: 'x'.repeat(2001) },
    ]) {
      await expect(person.api.posts.create(input)).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    }
    expect(await prisma.post.count({ where: { authorId: person.user.id } })).toBe(0)
  })
})
