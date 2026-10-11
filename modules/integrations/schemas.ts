import { z } from 'zod';

export const QR_TYPES = ['TICKET', 'INVITATION', 'BADGE', 'PASS', 'COUPON'] as const;

/** Champs d'un code QR créé par l'API développeur (création unitaire et en lot). */
export const qrItemSchema = z.object({
  externalId: z.string().trim().min(1).max(200).optional(),
  type: z.enum(QR_TYPES).optional(),
  eventId: z.string().min(1).optional(),
  reusable: z.boolean().optional(),
  expiresAt: z.string().datetime({ offset: true }).optional(),
  holderName: z.string().trim().min(1).max(150).optional(),
  holderEmail: z.string().trim().email().max(200).optional(),
  holderRole: z.string().trim().max(100).optional(),
  metadata: z.record(z.unknown()).optional(),
  token: z.string().optional(),
});

export type QRItemInput = z.infer<typeof qrItemSchema>;
