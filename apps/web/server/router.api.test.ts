import { describe, expect, test } from 'bun:test'
import { TRPCError } from '@trpc/server'
import { asAdmin, asAnon, asUser } from '../test/callers'
import { TEST_ADMIN_EMAIL } from '../test/env'

describe('me', () => {
  test('returns the signed-in user, not an admin', async () => {
    const person = await asUser('Ada Lovelace')
    const me = await person.api.me()
    expect(me).toMatchObject({
      id: person.user.id,
      email: person.user.email,
      name: 'Ada Lovelace',
      isAdmin: false,
    })
    expect(me.createdAt).toBeInstanceOf(Date)
  })

  test('says isAdmin for an ADMIN_EMAILS address', async () => {
    const admin = await asAdmin()
    expect(await admin.api.me()).toMatchObject({ email: TEST_ADMIN_EMAIL, isAdmin: true })
  })

  test('rejects a signed-out caller', async () => {
    const anon = await asAnon()
    await expect(anon.api.me()).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
    await expect(anon.api.me()).rejects.toBeInstanceOf(TRPCError)
  })
})
