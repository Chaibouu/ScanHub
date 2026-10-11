/** @jest-environment node */
import crypto from 'crypto'
import { signWebhook, validateWebhookUrl, WebhookError } from '@/modules/webhooks/webhookService'

// Fonctions pures : ni base ni chiffrement
jest.mock('@/lib/prisma', () => ({ __esModule: true, default: {}, prisma: {} }))
jest.mock('@/lib/tokens', () => ({ encryptSecret: jest.fn(), decryptSecret: jest.fn() }))

const env = process.env as Record<string, string | undefined>

describe('signWebhook', () => {
  it('is an HMAC-SHA256 of "<timestamp>.<body>"', () => {
    const expected = crypto.createHmac('sha256', 'whsec_test').update('1700000000.{"a":1}').digest('hex')
    expect(signWebhook('whsec_test', 1700000000, '{"a":1}')).toBe(expected)
  })

  it('changes with the secret, the timestamp and the body', () => {
    const base = signWebhook('s1', 1, 'body')
    expect(signWebhook('s2', 1, 'body')).not.toBe(base)
    expect(signWebhook('s1', 2, 'body')).not.toBe(base)
    expect(signWebhook('s1', 1, 'body2')).not.toBe(base)
  })
})

describe('validateWebhookUrl', () => {
  const original = env.NODE_ENV
  afterEach(() => {
    env.NODE_ENV = original
  })

  it('rejects malformed addresses, other protocols and embedded credentials', () => {
    expect(() => validateWebhookUrl('pas une adresse')).toThrow(WebhookError)
    expect(() => validateWebhookUrl('ftp://exemple.test/hook')).toThrow(WebhookError)
    expect(() => validateWebhookUrl('https://user:pass@exemple.test/hook')).toThrow(WebhookError)
  })

  it('accepts http and local addresses outside production (local development)', () => {
    expect(validateWebhookUrl('http://localhost:3199/hook')).toBe('http://localhost:3199/hook')
  })

  describe('in production', () => {
    beforeEach(() => {
      env.NODE_ENV = 'production'
    })

    it('requires https', () => {
      expect(() => validateWebhookUrl('http://exemple.test/hook')).toThrow(/https/)
      expect(validateWebhookUrl('https://exemple.test/hook')).toBe('https://exemple.test/hook')
    })

    it.each([
      'https://localhost/hook',
      'https://127.0.0.1/hook',
      'https://10.0.0.5/hook',
      'https://172.16.4.1/hook',
      'https://192.168.1.20/hook',
      'https://169.254.169.254/latest/meta-data',
      'https://[::1]/hook',
      'https://service.local/hook',
    ])('refuses the internal address %s', (url) => {
      expect(() => validateWebhookUrl(url)).toThrow(/interne/)
    })

    it('does not mistake a public host for an internal one', () => {
      expect(validateWebhookUrl('https://fcbarcelona.example/hook')).toBe('https://fcbarcelona.example/hook')
      expect(validateWebhookUrl('https://11.2.3.4/hook')).toBe('https://11.2.3.4/hook')
    })
  })
})
