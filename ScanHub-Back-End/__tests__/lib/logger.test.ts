/** @jest-environment node */
import { logger, maskEmail } from '@/lib/logger'

describe('maskEmail', () => {
  it('masks the local part but keeps the domain', () => {
    expect(maskEmail('john.doe@example.com')).toBe('jo***@example.com')
  })

  it('returns undefined when no email is given', () => {
    expect(maskEmail(undefined)).toBeUndefined()
  })
})

describe('Logger', () => {
  it('exposes the Pino levels', () => {
    for (const level of ['trace', 'debug', 'info', 'warn', 'error', 'fatal'] as const) {
      expect(typeof logger[level]).toBe('function')
    }
  })

  it('logs with and without context without throwing', () => {
    expect(() => logger.info('Test info')).not.toThrow()
    expect(() => logger.info({ userId: '123', action: 'login' }, 'Test with context')).not.toThrow()
    expect(() => logger.error({ err: new Error('boom') }, 'Test error')).not.toThrow()
  })

  it('business helpers do not throw', () => {
    expect(() => logger.logRequest('GET', '/api/users', 200, 150)).not.toThrow()
    expect(() => logger.logAuth('LOGIN_SUCCESS', 'user123', 'test@example.com')).not.toThrow()
    expect(() => logger.logDatabase('query', 'user.findUnique', 8)).not.toThrow()
    expect(() => logger.logSecurity('RATE_LIMIT', { ip: '127.0.0.1' })).not.toThrow()
  })
})
