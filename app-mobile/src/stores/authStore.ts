import { User, Device } from '@/types/auth';
import { secureStorage } from '@/lib/secureStore';
import { STORAGE_KEYS } from '@/utils/constants';
import { SimpleStore, useStore } from './createStore';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  device: Device | null;
  /** Clé secrète du terminal, émise une seule fois à l'activation */
  deviceKey: string | null;
  isAuthenticated: boolean;
  /** true tant que la session persistée n'a pas été relue au démarrage */
  isLoading: boolean;
  hydrate: () => Promise<void>;
  setAuth: (user: User, accessToken: string, refreshToken: string) => Promise<void>;
  setTokens: (accessToken: string, refreshToken: string) => Promise<void>;
  setDevice: (device: Device, deviceKey: string) => Promise<void>;
  logout: () => Promise<void>;
}

function parseJson<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export const authStore = new SimpleStore<AuthState>({
  user: null,
  accessToken: null,
  refreshToken: null,
  device: null,
  deviceKey: null,
  isAuthenticated: false,
  isLoading: true,

  hydrate: async () => {
    try {
      const [accessToken, refreshToken, userRaw, deviceRaw, deviceKey] = await Promise.all([
        secureStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN),
        secureStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN),
        secureStorage.getItem(STORAGE_KEYS.USER_DATA),
        secureStorage.getItem(STORAGE_KEYS.DEVICE_DATA),
        secureStorage.getItem(STORAGE_KEYS.DEVICE_KEY),
      ]);

      const user = parseJson<User>(userRaw);
      const device = parseJson<Device>(deviceRaw);

      authStore.setState({
        user,
        accessToken,
        refreshToken,
        device: deviceKey ? device : null,
        deviceKey,
        isAuthenticated: Boolean(user && refreshToken),
        isLoading: false,
      });
    } catch {
      authStore.setState({ isLoading: false });
    }
  },

  setAuth: async (user, accessToken, refreshToken) => {
    authStore.setState({ user, accessToken, refreshToken, isAuthenticated: true, isLoading: false });
    await secureStorage.setTokens(accessToken, refreshToken);
    await secureStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(user));
  },

  setTokens: async (accessToken, refreshToken) => {
    authStore.setState({ accessToken, refreshToken });
    await secureStorage.setTokens(accessToken, refreshToken);
  },

  setDevice: async (device, deviceKey) => {
    authStore.setState({ device, deviceKey });
    await secureStorage.setItem(STORAGE_KEYS.DEVICE_KEY, deviceKey);
    await secureStorage.setItem(STORAGE_KEYS.DEVICE_DATA, JSON.stringify(device));
  },

  // La déconnexion ferme la session de l'agent mais conserve l'activation du terminal
  logout: async () => {
    authStore.setState({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
    });
    await secureStorage.clearTokens();
    await secureStorage.deleteItem(STORAGE_KEYS.USER_DATA);
  },
});

export function useAuthStore() {
  return useStore(authStore);
}
