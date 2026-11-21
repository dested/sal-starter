import { describe, expect, test } from 'bun:test'
import { resolveApiUrl, type ApiUrlInputs } from './resolve-api-url'

const base: ApiUrlInputs = {
  envUrl: undefined,
  hostUri: '192.168.1.20:4781',
  dev: true,
  apiPort: 4780,
  deployedUrl: 'https://demo.dested.com',
}

describe('resolveApiUrl', () => {
  test('EXPO_PUBLIC_API_URL wins, without its trailing slash', () => {
    expect(resolveApiUrl({ ...base, envUrl: 'https://tunnel.example.com/' })).toBe(
      'https://tunnel.example.com'
    )
    expect(resolveApiUrl({ ...base, dev: false, envUrl: 'https://x.example.com' })).toBe(
      'https://x.example.com'
    )
  })

  test('dev: the API next to Metro on the LAN, on apiPort', () => {
    expect(resolveApiUrl(base)).toBe('http://192.168.1.20:4780')
  })

  test('dev: an IPv6 Metro host keeps its brackets', () => {
    expect(resolveApiUrl({ ...base, hostUri: '[fe80::1]:4781' })).toBe('http://[fe80::1]:4780')
  })

  test('dev without a Metro host falls back to the deployed server', () => {
    expect(resolveApiUrl({ ...base, hostUri: undefined })).toBe('https://demo.dested.com')
    expect(resolveApiUrl({ ...base, hostUri: '' })).toBe('https://demo.dested.com')
  })

  test('release builds and OTA bundles talk to the deployed server', () => {
    expect(resolveApiUrl({ ...base, dev: false })).toBe('https://demo.dested.com')
  })
})
