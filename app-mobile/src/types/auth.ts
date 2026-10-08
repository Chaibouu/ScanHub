export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'AGENT';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn?: number;
}

export interface Device {
  id: string;
  name: string;
  active: boolean;
  registeredAt: string;
  lastSeenAt?: string | null;
}

export interface LoginResponse {
  requires2FA?: false;
  user: User;
  tokens: AuthTokens;
  device?: Device | null;
}

/** Réponse du login quand le compte exige un second facteur (TOTP) */
export interface TwoFactorChallenge {
  requires2FA: true;
  tempToken: string;
}
