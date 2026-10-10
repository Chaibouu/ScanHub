/** @jest-environment node */
import { evaluateQR } from '@/modules/qr/qrService'

// evaluateQR est une fonction pure : la base n'est jamais sollicitée
jest.mock('@/lib/prisma', () => ({ __esModule: true, default: {}, prisma: {} }))

type QR = Parameters<typeof evaluateQR>[0]

const now = new Date('2026-10-08T12:00:00Z')

function makeQR(overrides: Record<string, unknown> = {}): QR {
  return {
    id: 'qr_1',
    tokenHash: 'hash',
    offlineHash: null,
    type: 'TICKET',
    status: 'ACTIVE',
    reusable: false,
    expiresAt: null,
    usedAt: null,
    sourceId: 'src_1',
    eventId: 'evt_1',
    metadata: null,
    createdAt: now,
    updatedAt: now,
    source: { id: 'src_1', name: 'EventHub', slug: 'eventhub' },
    event: { id: 'evt_1', name: 'Conf', status: 'ACTIVE' },
    ...overrides,
  } as unknown as QR
}

describe('evaluateQR', () => {
  it('accepts an active ticket for its own event', () => {
    expect(evaluateQR(makeQR(), { eventId: 'evt_1', at: now }).code).toBe('VALID')
  })

  it('rejects revoked and blocked passes', () => {
    expect(evaluateQR(makeQR({ status: 'REVOKED' }), { at: now }).code).toBe('REVOKED')
    expect(evaluateQR(makeQR({ status: 'BLOCKED' }), { at: now }).code).toBe('REVOKED')
  })

  it('rejects passes that are not activated yet', () => {
    expect(evaluateQR(makeQR({ status: 'PENDING' }), { at: now }).code).toBe('INVALID')
  })

  it('rejects an already used single-use ticket', () => {
    expect(evaluateQR(makeQR({ status: 'USED' }), { at: now }).code).toBe('ALREADY_USED')
  })

  it('keeps accepting a reusable badge', () => {
    expect(evaluateQR(makeQR({ type: 'BADGE', reusable: true }), { at: now }).code).toBe('VALID')
  })

  it('rejects expired passes, by status or by date', () => {
    expect(evaluateQR(makeQR({ status: 'EXPIRED' }), { at: now }).code).toBe('EXPIRED')
    const past = new Date(now.getTime() - 1000)
    expect(evaluateQR(makeQR({ expiresAt: past }), { at: now }).code).toBe('EXPIRED')
  })

  it('evaluates expiry at the time of the scan (offline reconciliation)', () => {
    const expiresAt = new Date('2026-10-08T10:00:00Z')
    const scannedBefore = new Date('2026-10-08T09:00:00Z')
    expect(evaluateQR(makeQR({ expiresAt }), { at: scannedBefore }).code).toBe('VALID')
  })

  it('rejects a pass presented at another event', () => {
    expect(evaluateQR(makeQR(), { eventId: 'evt_2', at: now }).code).toBe('UNAUTHORIZED')
  })

  it('rejects scans when the event is paused or closed', () => {
    for (const status of ['PAUSED', 'CLOSED']) {
      const qr = makeQR({ event: { id: 'evt_1', name: 'Conf', status } })
      expect(evaluateQR(qr, { eventId: 'evt_1', at: now }).code).toBe('EVENT_CLOSED')
    }
  })

  it('revocation wins over every other state', () => {
    const past = new Date(now.getTime() - 1000)
    expect(evaluateQR(makeQR({ status: 'REVOKED', expiresAt: past }), { at: now }).code).toBe('REVOKED')
  })
})
