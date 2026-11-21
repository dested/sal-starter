import { describe, expect, test } from 'bun:test'
import { assertTestDatabase, databaseName, withDatabase } from './db'

describe('assertTestDatabase', () => {
  test('the template is a *_test database or gate’s gate_*', () => {
    expect(() => assertTestDatabase('app_test', 'app_test', 'template')).not.toThrow()
    expect(() =>
      assertTestDatabase('gate_app_ab12cd34_0', 'gate_app_ab12cd34_0', 'template')
    ).not.toThrow()
    for (const bad of ['app', 'app_testing', 'test', 'postgres', 'app_test; DROP']) {
      expect(() => assertTestDatabase(bad, bad, 'template')).toThrow(/not a test template/)
    }
  })

  test('a clone is <template>_<suffix>, never the template or the dev database', () => {
    expect(() => assertTestDatabase('app_test_p123', 'app_test', 'clone')).not.toThrow()
    expect(() => assertTestDatabase('app_test_e2e', 'app_test', 'clone')).not.toThrow()
    expect(() =>
      assertTestDatabase('gate_app_ab12cd34_0_p9', 'gate_app_ab12cd34_0', 'clone')
    ).not.toThrow()
    for (const bad of [
      'app_test',
      'app',
      'app_testx',
      'other_test_p1',
      'app_test_"x"',
      `app_test_${'x'.repeat(60)}`,
    ]) {
      expect(() => assertTestDatabase(bad, 'app_test', 'clone')).toThrow(/Refusing/)
    }
  })

  test('the template check is not satisfied by its clones', () => {
    expect(() => assertTestDatabase('app_test_p1', 'app_test', 'template')).toThrow(/Refusing/)
  })
})

describe('withDatabase', () => {
  test('swaps only the database, keeping server and credentials', () => {
    const url = withDatabase('postgres://u:p%40ss@db.local:5433/app?sslmode=require', 'app_test')
    expect(url).toBe('postgres://u:p%40ss@db.local:5433/app_test?sslmode=require')
    expect(databaseName(url)).toBe('app_test')
  })
})
