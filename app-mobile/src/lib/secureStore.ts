import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { STORAGE_KEYS } from '@/utils/constants';

// Le trousseau sécurisé n'existe que sur iOS / Android. Sur le web (aperçu de dev),
// les valeurs restent en mémoire le temps de la session.
const useNative = Platform.OS !== 'web';
const memoryStorage: Record<string, string> = {};

export const secureStorage = {
  async setItem(key: string, value: string): Promise<void> {
    if (useNative) {
      await SecureStore.setItemAsync(key, value);
    } else {
      memoryStorage[key] = value;
    }
  },

  async getItem(key: string): Promise<string | null> {
    if (useNative) {
      return await SecureStore.getItemAsync(key);
    }
    return memoryStorage[key] || null;
  },

  async deleteItem(key: string): Promise<void> {
    if (useNative) {
      await SecureStore.deleteItemAsync(key);
    } else {
      delete memoryStorage[key];
    }
  },

  async setTokens(access: string, refresh: string): Promise<void> {
    await this.setItem(STORAGE_KEYS.ACCESS_TOKEN, access);
    await this.setItem(STORAGE_KEYS.REFRESH_TOKEN, refresh);
  },

  async clearTokens(): Promise<void> {
    await this.deleteItem(STORAGE_KEYS.ACCESS_TOKEN);
    await this.deleteItem(STORAGE_KEYS.REFRESH_TOKEN);
  },
};
