import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { API_CONFIG } from '@/utils/constants';
import { authApi } from '@/api/authApi';
import { eventStore } from '@/stores/eventStore';

export default function SettingsScreen() {
  const router = useRouter();
  const { user, device, logout } = useAuthStore();

  const handleLogout = () => {
    Alert.alert('Déconnexion', 'Êtes-vous sûr de vouloir fermer la session ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Déconnexion',
        style: 'destructive',
        onPress: async () => {
          // Révoque la session côté serveur ; hors-ligne, on ferme quand même la session locale
          await authApi.logout().catch(() => {});
          await logout();
          await eventStore.getState().reset();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Operator Card */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>OPÉRATEUR CONNECTÉ</Text>
        <Text style={styles.userName}>{user?.name || 'Agent'}</Text>
        <Text style={styles.userEmail}>{user?.email || '—'}</Text>

        <View style={styles.roleRow}>
          <Text style={styles.roleLabel}>Rôle système :</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>{user?.role || 'AGENT'}</Text>
          </View>
        </View>
      </View>

      {/* Terminal & Hardware Device Info */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>APPAREIL & TERMINAL</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoKey}>Nom du poste :</Text>
          <Text style={styles.infoVal}>{device?.name || 'Non activé'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoKey}>Statut matériel :</Text>
          <Text style={[styles.infoVal, { color: device ? '#16A34A' : '#DC2626' }]}>
            {device ? '✓ Activé' : '✕ Non activé'}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoKey}>ID Appareil :</Text>
          <Text style={styles.infoVal}>{device?.id || '—'}</Text>
        </View>
      </View>

      {/* API Configuration */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>CONFIGURATION DU SERVEUR</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoKey}>Point d’accès API :</Text>
          <Text style={styles.infoValUrl}>{API_CONFIG.BASE_URL}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoKey}>Version de ScanHub :</Text>
          <Text style={styles.infoVal}>v1.0.0 (Septembre 2026)</Text>
        </View>
      </View>

      {/* Logout Button */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutButtonText}>Fermer la session (Déconnexion)</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    padding: 20,
    gap: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  userName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  userEmail: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 12,
  },
  roleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 10,
  },
  roleLabel: {
    fontSize: 13,
    color: '#64748B',
  },
  roleBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#2563EB',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  infoKey: {
    fontSize: 13,
    color: '#64748B',
  },
  infoVal: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
  infoValUrl: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563EB',
  },
  logoutButton: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  logoutButtonText: {
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '700',
  },
});
