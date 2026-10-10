/** @jest-environment node */
import {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  formatError,
  handleApiError,
} from '@/lib/errors'

describe('Error Classes', () => {
  it('should create AppError with default values', () => {
    const error = new AppError('Test error')
    expect(error.message).toBe('Test error')
    expect(error.statusCode).toBe(500)
    expect(error.isOperational).toBe(true)
  })

  it('should create ValidationError with fields', () => {
    const fields = { email: ['Invalid email'] }
    const error = new ValidationError('Validation failed', fields)
    expect(error.statusCode).toBe(400)
    expect(error.code).toBe('VALIDATION_ERROR')
    expect(error.fields).toEqual(fields)
  })

  it('should create AuthenticationError', () => {
    const error = new AuthenticationError()
    expect(error.statusCode).toBe(401)
    expect(error.code).toBe('AUTHENTICATION_ERROR')
  })

  it('should create AuthorizationError', () => {
    const error = new AuthorizationError()
    expect(error.statusCode).toBe(403)
    expect(error.code).toBe('AUTHORIZATION_ERROR')
  })

  it('should create NotFoundError', () => {
    const error = new NotFoundError('User')
    expect(error.message).toBe('User non trouvé(e)')
    expect(error.statusCode).toBe(404)
  })
})

describe('formatError', () => {
  it('should format AppError correctly', () => {
    const error = new ValidationError('Invalid input', { email: ['Required'] })
    const formatted = formatError(error)
    
    expect(formatted.message).toBe('Invalid input')
    expect(formatted.statusCode).toBe(400)
    expect(formatted.code).toBe('VALIDATION_ERROR')
    expect(formatted.fields).toEqual({ email: ['Required'] })
  })

  it('should format generic Error', () => {
    const error = new Error('Generic error')
    const formatted = formatError(error)
    
    expect(formatted.message).toBe('Generic error')
    expect(formatted.statusCode).toBe(500)
  })

  it('should format unknown error', () => {
    const formatted = formatError('Unknown')
    expect(formatted.statusCode).toBe(500)
  })
})

describe('handleApiError', () => {
  it('should return JSON response with error details', async () => {
    const error = new ValidationError('Invalid input')
    const response = handleApiError(error)
    const json = await response.json()
    
    expect(response.status).toBe(400)
    expect(json.error).toBe('Invalid input')
    expect(json.code).toBe('VALIDATION_ERROR')
  })
})
