import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';
import { useEventStore } from '@/stores/eventStore';
import { useSyncStore } from '@/stores/syncStore';

export default function HomeScreen() {
  const router = useRouter();
  const { user, device } = useAuthStore();
  const { activeEvent } = useEventStore();
  const { pendingScans } = useSyncStore();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Top Agent Bar */}
      <View style={styles.agentBar}>
        <View>
          <Text style={styles.welcomeText}>Connecté en tant que</Text>
          <Text style={styles.agentName}>{user?.name || 'Agent'}</Text>
        </View>
        <View style={styles.devicePill}>
          <Text style={styles.devicePillText}>
            {device?.name || 'Terminal non activé'}
          </Text>
        </View>
      </View>

      {/* Active Event Card */}
      <View style={styles.eventCard}>
        <View style={styles.eventCardHeader}>
          <Text style={styles.eventLabel}>ÉVÉNEMENT ACTIF</Text>
          <TouchableOpacity onPress={() => router.push('/(protected)/event')}>
            <Text style={styles.changeEventText}>Changer</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.eventName}>
          {activeEvent?.name || 'Aucun événement sélectionné'}
        </Text>
        <Text style={styles.eventLocation}>
          {activeEvent?.location || activeEvent?.organization?.name || ''}
        </Text>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>
              {activeEvent?.stats?.totalScanned || 0}
            </Text>
            <Text style={styles.statLabel}>Total Scans</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: '#16A34A' }]}>
              {activeEvent?.stats?.validScans || 0}
            </Text>
            <Text style={styles.statLabel}>Autorisés</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: '#DC2626' }]}>
              {activeEvent?.stats?.rejectedScans || 0}
            </Text>
            <Text style={styles.statLabel}>Refusés</Text>
          </View>
        </View>
      </View>

      {/* Primary Action Button: Launch Scanner */}
      <TouchableOpacity
        style={styles.mainScanButton}
        activeOpacity={0.85}
        onPress={() => router.push('/(protected)/scanner')}
      >
        <View style={styles.scanIconCircle}>
          <Text style={styles.scanIconSymbol}>⛶</Text>
        </View>
        <View style={styles.scanButtonTextBox}>
          <Text style={styles.mainScanButtonTitle}>LANCER LE SCANNER</Text>
          <Text style={styles.mainScanButtonSub}>
            Caméra prête • Contrôle instantané
          </Text>
        </View>
      </TouchableOpacity>

      {/* Grid of Navigation Quick Actions */}
      <View style={styles.menuGrid}>
        <TouchableOpacity
          style={styles.menuCard}
          onPress={() => router.push('/(protected)/history')}
        >
          <Text style={styles.menuIcon}>📋</Text>
          <Text style={styles.menuTitle}>Historique</Text>
          <Text style={styles.menuSub}>Derniers passages</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuCard}
          onPress={() => router.push('/(protected)/sync')}
        >
          <Text style={styles.menuIcon}>⚡</Text>
          <Text style={styles.menuTitle}>Synchronisation</Text>
          <Text style={styles.menuSub}>
            {pendingScans.length > 0
              ? `${pendingScans.length} en attente`
              : 'À jour'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuCard}
          onPress={() => router.push('/(protected)/event')}
        >
          <Text style={styles.menuIcon}>📍</Text>
          <Text style={styles.menuTitle}>Événements</Text>
          <Text style={styles.menuSub}>Changer de contexte</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuCard}
          onPress={() => router.push('/(protected)/settings')}
        >
          <Text style={styles.menuIcon}>⚙️</Text>
          <Text style={styles.menuTitle}>Paramètres</Text>
          <Text style={styles.menuSub}>Terminal & Compte</Text>
        </TouchableOpacity>
      </View>
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
    paddingBottom: 40,
  },
  agentBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  welcomeText: {
    fontSize: 12,
    color: '#64748B',
  },
  agentName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  devicePill: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  devicePillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  eventCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  eventCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  eventLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#2563EB',
    letterSpacing: 0.8,
  },
  changeEventText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2563EB',
  },
  eventName: {
    fontSize: 19,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  eventLocation: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  statLabel: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E2E8F0',
  },
  mainScanButton: {
    backgroundColor: '#2563EB',
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  scanIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  scanIconSymbol: {
    fontSize: 26,
    color: '#FFFFFF',
    fontWeight: '900',
  },
  scanButtonTextBox: {
    flex: 1,
  },
  mainScanButtonTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  mainScanButtonSub: {
    color: '#DBEAFE',
    fontSize: 13,
    marginTop: 2,
  },
  menuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  menuCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  menuIcon: {
    fontSize: 22,
    marginBottom: 8,
  },
  menuTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 2,
  },
  menuSub: {
    fontSize: 12,
    color: '#64748B',
  },
});
