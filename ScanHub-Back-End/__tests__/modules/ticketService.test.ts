/** @jest-environment node */
import { parseTicketCsv } from '@/modules/tickets/ticketService'

// parseTicketCsv est une fonction pure : ni base ni chiffrement
jest.mock('@/lib/prisma', () => ({ __esModule: true, default: {}, prisma: {} }))
jest.mock('@/lib/tokens', () => ({ encryptSecret: jest.fn(), decryptSecret: jest.fn() }))

describe('parseTicketCsv', () => {
  it('reads a semicolon file with French headers', () => {
    const csv = 'Nom;Email;Catégorie;Type\nAïcha Mahamadou;aicha@exemple.com;VIP;badge\nMoussa Ibrahim;;;'
    expect(parseTicketCsv(csv, 'TICKET')).toEqual([
      { holderName: 'Aïcha Mahamadou', holderEmail: 'aicha@exemple.com', holderRole: 'VIP', type: 'BADGE' },
      { holderName: 'Moussa Ibrahim', holderEmail: undefined, holderRole: undefined, type: 'TICKET' },
    ])
  })

  it('reads a comma file whatever the column order', () => {
    const csv = 'email,name\nali@exemple.com,Ali Issa'
    expect(parseTicketCsv(csv, 'INVITATION')).toEqual([
      { holderName: 'Ali Issa', holderEmail: 'ali@exemple.com', holderRole: undefined, type: 'INVITATION' },
    ])
  })

  it('falls back to name;email;role when there is no header line', () => {
    const [ticket] = parseTicketCsv('Fatima Oumarou;fatima@exemple.com;Exposant', 'PASS')
    expect(ticket).toEqual({
      holderName: 'Fatima Oumarou',
      holderEmail: 'fatima@exemple.com',
      holderRole: 'Exposant',
      type: 'PASS',
    })
  })

  it('handles quoted cells containing the separator', () => {
    const [ticket] = parseTicketCsv('nom;catégorie\n"Garba; Amina";"Presse ""TV"""', 'TICKET')
    expect(ticket.holderName).toBe('Garba; Amina')
    expect(ticket.holderRole).toBe('Presse "TV"')
  })

  it('ignores blank lines, rows without a name and an Excel BOM', () => {
    const csv = '﻿nom;email\n\n;orphelin@exemple.com\nHassane Seydou;\n'
    expect(parseTicketCsv(csv, 'TICKET').map((t) => t.holderName)).toEqual(['Hassane Seydou'])
  })

  it('returns nothing for an empty file', () => {
    expect(parseTicketCsv('   \n ', 'TICKET')).toEqual([])
  })
})
