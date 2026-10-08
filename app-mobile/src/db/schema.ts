// Offline SQLite schema definition according to Section 9.3 of the specification

export const SQLITE_TABLES = {
  OFFLINE_QR: `
    CREATE TABLE IF NOT EXISTS offline_qr (
      id TEXT PRIMARY KEY,
      tokenHash TEXT UNIQUE NOT NULL,
      type TEXT NOT NULL,
      status TEXT NOT NULL,
      reusable INTEGER NOT NULL DEFAULT 0,
      eventId TEXT NOT NULL,
      holderName TEXT,
      holderRole TEXT,
      expiresAt TEXT,
      metadata TEXT,
      updatedAt TEXT NOT NULL
    );
  `,
  PENDING_SCANS: `
    CREATE TABLE IF NOT EXISTS pending_scans (
      clientId TEXT PRIMARY KEY,
      token TEXT NOT NULL,
      qrId TEXT,
      eventId TEXT NOT NULL,
      userId TEXT NOT NULL,
      deviceId TEXT,
      result TEXT NOT NULL,
      scannedAt TEXT NOT NULL,
      syncStatus TEXT DEFAULT 'PENDING'
    );
  `,
};

// Colonnes ajoutées après la première version du schéma (bases locales déjà créées)
export const SQLITE_MIGRATIONS = [
  `ALTER TABLE offline_qr ADD COLUMN reusable INTEGER NOT NULL DEFAULT 0;`,
];
