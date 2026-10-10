import { PrismaClient, UserRole, QRType, QRStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { hashToken, hashTokenOffline, hashApiKey, hashActivationCode } from '../lib/crypto';

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Le seed contient des données de test : il ne doit pas être exécuté en production.');
  }

  console.log('🌱 Début du peuplement initial de ScanHub (Seeding)...');

  // 1. Utilisateurs (SUPER_ADMIN, ADMIN, AGENT)
  // 1. Espace client de démonstration (les comptes admin et agent en sont membres)
  let organization = await prisma.organization.findUnique({
    where: { slug: 'scanhub-niger' },
  });

  if (!organization) {
    organization = await prisma.organization.create({
      data: {
        name: 'ScanHub Organisation Niger',
        slug: 'scanhub-niger',
      },
    });
    console.log(`✅ Organisation créée : ${organization.name}`);
  }

  // Mots de passe : fournis par l'environnement, sinon générés aléatoirement et affichés
  // une seule fois. Aucun mot de passe n'est écrit dans le code source.
  const usersToSeed = [
    {
      name: 'Chaibou',
      email: process.env.SEED_SUPER_ADMIN_EMAIL || 'chaibouabdoulwahab@gmail.com',
      role: UserRole.SUPER_ADMIN,
      password: process.env.SEED_SUPER_ADMIN_PASSWORD,
    },
    {
      name: 'Admin Principal',
      email: 'admin@gmail.com',
      role: UserRole.ADMIN,
      password: process.env.SEED_ADMIN_PASSWORD,
    },
    {
      name: 'Agent Contrôleur',
      email: 'agent@scanhub.ne',
      role: UserRole.AGENT,
      password: process.env.SEED_AGENT_PASSWORD,
    },
  ];

  const createdUsers: Record<string, any> = {};

  for (const u of usersToSeed) {
    const existing = await prisma.user.findFirst({
      where: { email: u.email },
    });

    if (!existing) {
      const password = u.password || crypto.randomBytes(9).toString('base64url');
      createdUsers[u.email] = await prisma.user.create({
        data: {
          name: u.name,
          email: u.email,
          role: u.role,
          // Le SUPER_ADMIN est le propriétaire de la plateforme : il n'appartient à aucun espace
          organizationId: u.role === UserRole.SUPER_ADMIN ? null : organization.id,
          emailVerified: new Date(),
          password: await bcrypt.hash(password, 10),
        },
      });
      console.log(
        `✅ Utilisateur créé : ${u.email} (${u.role})` +
          (u.password ? '' : ` — mot de passe généré : ${password}`)
      );
    } else {
      // Un compte existant garde son mot de passe, sauf si un nouveau est fourni explicitement
      createdUsers[u.email] = await prisma.user.update({
        where: { id: existing.id },
        data: {
          role: u.role,
          organizationId: u.role === UserRole.SUPER_ADMIN ? null : organization.id,
          ...(u.password ? { password: await bcrypt.hash(u.password, 10) } : {}),
        },
      });
      console.log(`ℹ️ Utilisateur mis à jour : ${u.email}`);
    }
  }

  // 3. Sources d'intégration tierces (EventHub, JNJL)
  const sourcesData = [
    {
      name: 'EventHub Niger',
      slug: 'eventhub',
      apiKey: 'evthub_test_key_2026',
    },
    {
      name: 'JNJL Billetterie',
      slug: 'jnjl',
      apiKey: 'jnjl_test_key_2026',
    },
  ];

  const createdSources: Record<string, any> = {};

  for (const s of sourcesData) {
    const apiKeyHash = hashApiKey(s.apiKey);
    let source = await prisma.source.findUnique({
      where: { slug: s.slug },
    });

    if (!source) {
      source = await prisma.source.create({
        data: {
          name: s.name,
          slug: s.slug,
          apiKeyHash,
          organizationId: organization.id,
        },
      });
      console.log(`✅ Source partenaire créée : ${s.name} (clé: ${s.apiKey})`);
    } else {
      source = await prisma.source.update({
        where: { id: source.id },
        data: { apiKeyHash },
      });
    }
    createdSources[s.slug] = source;
  }

  // 4. Événement pilote
  const now = new Date();
  const startsAt = new Date(now.getTime() - 24 * 60 * 60 * 1000); // Début hier
  const endsAt = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000); // Fin dans 5 jours

  let event = await prisma.event.findFirst({
    where: { name: 'Tech Conference Niger 2026' },
  });

  if (!event) {
    event = await prisma.event.create({
      data: {
        name: 'Tech Conference Niger 2026',
        startsAt,
        endsAt,
        status: 'ACTIVE',
        organizationId: organization.id,
        sourceId: createdSources['eventhub']?.id,
      },
    });
    console.log(`✅ Événement créé : ${event.name}`);
  }

  // 5. Terminal de test en attente d'activation (code à saisir dans l'app mobile)
  const agentUser = createdUsers['agent@scanhub.ne'] || createdUsers['admin@gmail.com'];
  const testActivationCode = 'TEST2026';
  const testDeviceName = 'Terminal Mobile Porte Nord';

  if (agentUser) {
    const activation = {
      deviceKeyHash: null,
      activatedAt: null,
      active: true,
      activationCodeHash: hashActivationCode(testActivationCode),
      activationExpiresAt: new Date(now.getTime() + 30 * 24 * 3600 * 1000),
    };
    const existingDevice = await prisma.device.findFirst({ where: { name: testDeviceName } });

    if (existingDevice) {
      await prisma.device.update({ where: { id: existingDevice.id }, data: activation });
    } else {
      await prisma.device.create({
        data: { name: testDeviceName, userId: agentUser.id, ...activation },
      });
    }
    console.log(`✅ Terminal de test en attente d'activation (code: ${testActivationCode})`);
  }

  // 6. Les 5 QR Codes de test du Cahier des Charges
  const testQRs = [
    {
      token: 'TICKET_VALIDE_2026',
      type: QRType.TICKET,
      status: QRStatus.ACTIVE,
      reusable: false,
      expiresAt: new Date(now.getTime() + 48 * 3600 * 1000),
      metadata: {
        holderName: 'Ibrahim Moussa',
        holderRole: 'Participant Standard',
        ticketClass: 'Standard',
        seat: 'Rang B - Siège 12',
      },
    },
    {
      token: 'TICKET_USED_992',
      type: QRType.TICKET,
      status: QRStatus.USED,
      reusable: false,
      usedAt: new Date(now.getTime() - 2 * 3600 * 1000),
      metadata: {
        holderName: 'Amina Seyni',
        holderRole: 'Participant',
        ticketClass: 'Standard',
        scannedAtGate: 'Porte Nord',
      },
    },
    {
      token: 'BADGE_VIP_AMB',
      type: QRType.BADGE,
      status: QRStatus.ACTIVE,
      reusable: true,
      expiresAt: new Date(now.getTime() + 7 * 24 * 3600 * 1000),
      metadata: {
        holderName: 'S.E. Ambassadeur / VIP',
        holderRole: 'Accès VIP Permanent',
        vipLevel: 'Gold',
      },
    },
    {
      token: 'PASS_EXPIRED_2026',
      type: QRType.PASS,
      status: QRStatus.ACTIVE,
      reusable: false,
      expiresAt: new Date(now.getTime() - 3600 * 1000), // Expiré il y a 1h
      metadata: {
        holderName: 'Oumarou Dan',
        holderRole: 'Pass Exposant Jour 1',
      },
    },
    {
      token: 'PASS_REVOKED_999',
      type: QRType.TICKET,
      status: QRStatus.REVOKED,
      reusable: false,
      metadata: {
        holderName: 'Billet Annulé Fraude',
        holderRole: 'Non autorisé',
        revocationReason: 'Paiement contesté par la banque',
      },
    },
  ];

  for (const qrData of testQRs) {
    const tokenHash = hashToken(qrData.token);
    const existingQR = await prisma.qRCode.findUnique({
      where: { tokenHash },
    });

    if (!existingQR) {
      await prisma.qRCode.create({
        data: {
          tokenHash,
          offlineHash: hashTokenOffline(qrData.token),
          type: qrData.type,
          status: qrData.status,
          reusable: qrData.reusable,
          expiresAt: qrData.expiresAt || null,
          usedAt: (qrData as any).usedAt || null,
          sourceId: createdSources['eventhub'].id,
          eventId: event.id,
          metadata: qrData.metadata,
        },
      });
      console.log(`✅ QR Code créé : ${qrData.token} (${qrData.status})`);
    } else {
      await prisma.qRCode.update({
        where: { id: existingQR.id },
        data: {
          offlineHash: hashTokenOffline(qrData.token),
          status: qrData.status,
          expiresAt: qrData.expiresAt || null,
          usedAt: (qrData as any).usedAt || null,
          metadata: qrData.metadata,
        },
      });
      console.log(`ℹ️ QR Code rafraîchi : ${qrData.token}`);
    }
  }

  console.log('🎉 Seeding ScanHub terminé avec succès !');
}

main()
  .catch((error) => {
    console.error('❌ Erreur lors du seeding :', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
