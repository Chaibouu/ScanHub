import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { authStore, useAuthStore } from '@/stores/authStore';
import { authApi } from '@/api/authApi';
import { ApiError } from '@/api/client';

export default function LoginScreen() {
  const router = useRouter();
  const { device } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Veuillez renseigner tous les champs.');
      return;
    }
    setError(null);
    setLoading(true);

    try {
      const res = await authApi.login(email, password);

      if (res.requires2FA) {
        setError(
          'Ce compte exige la double authentification, pas encore prise en charge sur mobile. Utilisez un compte agent sans 2FA.'
        );
        return;
      }

      await authStore.getState().setAuth(res.user, res.tokens.accessToken, res.tokens.refreshToken);
      router.replace('/(protected)');
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Échec de la connexion. Vérifiez vos identifiants.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.headerBox}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoText}>SH</Text>
          </View>
          <Text style={styles.title}>ScanHub Operator</Text>
          <Text style={styles.subtitle}>
            Plateforme centralisée de contrôle & vérification QR
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Authentification</Text>

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email professionnel</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="agent@domaine.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Mot de passe</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              secureTextEntry
            />
          </View>

          <TouchableOpacity
            style={[styles.primaryButton, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>Se connecter</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.deviceLink}
            onPress={() => router.push('/(auth)/device')}
          >
            <Text style={styles.deviceLinkText}>
              {device
                ? `Terminal activé : ${device.name} (réactiver →)`
                : 'Activer cet appareil avec un code →'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  headerBox: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  logoText: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    maxWidth: 280,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 20,
  },
  errorBox: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 13,
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
  primaryButton: {
    backgroundColor: '#2563EB',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  deviceLink: {
    marginTop: 18,
    alignItems: 'center',
  },
  deviceLinkText: {
    color: '#3B82F6',
    fontSize: 13,
    fontWeight: '600',
  },
});
