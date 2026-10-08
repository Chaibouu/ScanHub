import { apiClient } from './client';
import { Device, LoginResponse, TwoFactorChallenge, User } from '@/types/auth';

export const authApi = {
  async login(email: string, password: string): Promise<LoginResponse | TwoFactorChallenge> {
    return apiClient<LoginResponse | TwoFactorChallenge>('/auth/login', {
      method: 'POST',
      auth: false,
      body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
    });
  },

  async me(): Promise<{ user: User; device: Device | null }> {
    return apiClient<{ user: User; device: Device | null }>('/auth/me', { method: 'GET' });
  },

  async logout(): Promise<void> {
    await apiClient('/auth/logout', { method: 'POST' });
  },

  /** Échange un code d'activation à usage unique contre la clé du terminal */
  async activateDevice(
    activationCode: string,
    deviceName?: string
  ): Promise<{ device: Device & { deviceKey: string }; agent: { name: string } }> {
    return apiClient('/devices/activate', {
      method: 'POST',
      auth: false,
      body: JSON.stringify({
        activationCode: activationCode.trim(),
        ...(deviceName?.trim() ? { deviceName: deviceName.trim() } : {}),
      }),
    });
  },
};
