import { describe, expect, test } from 'bun:test'
import { emailMatches, isAdminEmail, signUpAllowed } from './access'
import { emailList } from './env'

describe('emailList', () => {
  test('splits, trims, lowercases and drops blanks', () => {
    expect(emailList.parse(' Ada@Example.com, ,@Acme.io ,')).toEqual([
      'ada@example.com',
      '@acme.io',
    ])
    expect(emailList.parse('')).toEqual([])
    expect(emailList.parse(undefined)).toEqual([])
  })
})

describe('emailMatches', () => {
  const entries = ['ada@example.com', '@acme.io']
  test('an exact address, case and whitespace aside', () => {
    expect(emailMatches('ada@example.com', entries)).toBe(true)
    expect(emailMatches(' ADA@Example.com ', entries)).toBe(true)
    expect(emailMatches('bob@example.com', entries)).toBe(false)
  })
  test('a whole domain, and only that domain', () => {
    expect(emailMatches('anyone@acme.io', entries)).toBe(true)
    expect(emailMatches('x@eng.acme.io', entries)).toBe(false)
    expect(emailMatches('x@notacme.io', entries)).toBe(false)
    expect(emailMatches('x@acme.io.evil.com', entries)).toBe(false)
  })
  test('the last @ decides the domain', () => {
    expect(emailMatches('"a@acme.io"@evil.com', entries)).toBe(false)
  })
  test('not an email', () => {
    expect(emailMatches('acme.io', entries)).toBe(false)
    expect(emailMatches('@acme.io', entries)).toBe(false)
    expect(emailMatches('', entries)).toBe(false)
  })
})

describe('signUpAllowed', () => {
  test('a blank allowlist is open', () => {
    expect(signUpAllowed('anyone@anywhere.com', { allowlist: [], admins: [] })).toBe(true)
  })
  test('a set allowlist admits its entries and the admins', () => {
    const rules = { allowlist: ['@acme.io'], admins: ['sal@example.com'] }
    expect(signUpAllowed('dev@acme.io', rules)).toBe(true)
    expect(signUpAllowed('sal@example.com', rules)).toBe(true)
    expect(signUpAllowed('eve@example.com', rules)).toBe(false)
  })
})

describe('isAdminEmail', () => {
  test('exact addresses only', () => {
    expect(isAdminEmail('Sal@Example.com', ['sal@example.com'])).toBe(true)
    expect(isAdminEmail('eve@example.com', ['sal@example.com'])).toBe(false)
    expect(isAdminEmail('eve@example.com', ['@example.com'])).toBe(false)
    expect(isAdminEmail(null, ['sal@example.com'])).toBe(false)
  })
})
