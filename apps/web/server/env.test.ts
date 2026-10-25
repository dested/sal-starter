import { describe, expect, test } from 'bun:test'
import { MissingEnvError, optionalSecret, requireValue } from './env'

describe('optionalSecret', () => {
  test('unset and blank both mean not configured', () => {
    expect(optionalSecret.parse(undefined)).toBeUndefined()
    expect(optionalSecret.parse('')).toBeUndefined()
    expect(optionalSecret.parse('   ')).toBeUndefined()
    expect(optionalSecret.parse('sk-123')).toBe('sk-123')
  })
})

describe('requireValue', () => {
  test('returns a set key', () => {
    expect(requireValue('API_KEY', 'k')).toBe('k')
  })
  test('throws a MissingEnvError that says where to set it', () => {
    expect(() => requireValue('API_KEY', undefined)).toThrow(MissingEnvError)
    expect(() => requireValue('API_KEY', undefined)).toThrow(/API_KEY is not set.*Drydock/)
  })
})
