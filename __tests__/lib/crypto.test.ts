/** @jest-environment node */
import crypto from 'crypto'
import {
  generateSecret,
  generateToken,
  hashActivationCode,
  hashApiKey,
  hashToken,
  hashTokenOffline,
} from '@/lib/crypto'

describe('QR token hashing', () => {
  it('is deterministic and ignores surrounding whitespace', () => {
    expect(hashToken('TKT_ABC')).toBe(hashToken('  TKT_ABC  '))
    expect(hashToken('TKT_ABC')).not.toBe(hashToken('TKT_ABD'))
  })

  it('offline hash is a plain SHA-256 the mobile app can recompute', () => {
    const expected = crypto.createHash('sha256').update('TKT_ABC').digest('hex')
    expect(hashTokenOffline(' TKT_ABC ')).toBe(expected)
  })

  it('peppered hash differs from the offline hash', () => {
    expect(hashToken('TKT_ABC')).not.toBe(hashTokenOffline('TKT_ABC'))
  })
})

describe('secrets', () => {
  it('generates 128-bit QR tokens with the given prefix', () => {
    const token = generateToken('TKT')
    expect(token).toMatch(/^TKT_[0-9A-F]{32}$/)
    expect(generateToken('TKT')).not.toBe(token)
  })

  it('generates 256-bit secrets', () => {
    expect(generateSecret('dvk')).toMatch(/^dvk_[0-9a-f]{64}$/)
  })

  it('activation codes are case, space and dash insensitive', () => {
    expect(hashActivationCode('k7mp-2xq9')).toBe(hashActivationCode(' K7MP 2XQ9 '))
  })

  it('an activation code hash never collides with an API key hash of the same value', () => {
    expect(hashActivationCode('K7MP2XQ9')).not.toBe(hashApiKey('K7MP2XQ9'))
  })
})

describe('missing secrets in production', () => {
  const env = process.env as Record<string, string | undefined>
  const original = { NODE_ENV: env.NODE_ENV, QR_PEPPER: env.QR_PEPPER }

  afterEach(() => {
    env.NODE_ENV = original.NODE_ENV
    env.QR_PEPPER = original.QR_PEPPER
  })

  it('refuses to hash without QR_PEPPER', () => {
    env.NODE_ENV = 'production'
    delete env.QR_PEPPER
    expect(() => hashToken('TKT_ABC')).toThrow(/QR_PEPPER/)
  })
})
