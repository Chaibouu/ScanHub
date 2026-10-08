// Jest setup file
// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom'

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
      back: jest.fn(),
      pathname: '/',
      query: {},
      asPath: '/',
    }
  },
  usePathname() {
    return '/'
  },
  useSearchParams() {
    return new URLSearchParams()
  },
}))

// Mock environment variables
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'
process.env.QR_PEPPER = 'test-qr-pepper'
process.env.API_KEY_PEPPER = 'test-api-key-pepper'
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test'
process.env.LOG_LEVEL = 'silent'
