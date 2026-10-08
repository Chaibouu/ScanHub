import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { authApi } from '@/api/authApi';
import { ApiError } from '@/api/client';
import { authStore } from '@/stores/authStore';

export default function DeviceActivationScreen() {
  const router = useRouter();
  const [activationCode, setActivationCode] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleActivate = async () => {
    if (!activationCode.trim()) {
      Alert.alert('Erreur', 'Veuillez saisir le code d’activation.');
      return;
    }
    setLoading(true);

    try {
      const { device } = await authApi.activateDevice(activationCode, deviceName);
      const { deviceKey, ...deviceInfo } = device;
      // La clé du terminal n'est transmise qu'une fois : elle part dans le stockage sécurisé
      await authStore.getState().setDevice(deviceInfo, deviceKey);

      Alert.alert('Succès', `Terminal « ${device.name} » activé.`, [
        { text: 'Continuer', onPress: () => router.back() },
      ]);
    } catch (err) {
      Alert.alert(
        'Activation impossible',
        err instanceof ApiError ? err.message : 'Une erreur inattendue est survenue.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>SÉCURITÉ MATÉRIELLE</Text>
        </View>

        <Text style={styles.title}>Enregistrement Terminal</Text>
        <Text style={styles.subtitle}>
          Associez ce smartphone à la flotte d’appareils autorisés de votre organisation.
        </Text>

        <View style={styles.card}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Nom de l’appareil / Poste</Text>
            <TextInput
              style={styles.input}
              value={deviceName}
              onChangeText={setDeviceName}
              placeholder="Ex: Entrée VIP Porte A (optionnel)"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Code d’activation (8 caractères)</Text>
            <TextInput
              style={[styles.input, styles.codeInput]}
              value={activationCode}
              onChangeText={(text) => setActivationCode(text.toUpperCase())}
              placeholder="Ex: K7MP2XQ9"
              autoCorrect={false}
              autoCapitalize="characters"
              maxLength={12}
            />
          </View>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleActivate}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>Activer l’appareil</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    padding: 24,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 12,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563EB',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
    marginBottom: 24,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#0F172A',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  codeInput: {
    letterSpacing: 2,
    fontWeight: '700',
    textAlign: 'center',
    fontSize: 18,
  },
  button: {
    backgroundColor: '#0F172A',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
