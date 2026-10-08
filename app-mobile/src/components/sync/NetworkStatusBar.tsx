import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSyncStore } from '@/stores/syncStore';
import { useRouter } from 'expo-router';

export function NetworkStatusBar() {
  const router = useRouter();
  const { isOnline, pendingScans, isSyncing } = useSyncStore();
  const pendingCount = pendingScans.length;

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => router.push('/(protected)/sync')}
      style={[
        styles.container,
        isOnline ? styles.onlineBg : styles.offlineBg,
      ]}
    >
      <View style={styles.left}>
        <View
          style={[
            styles.dot,
            isOnline ? styles.dotOnline : styles.dotOffline,
          ]}
        />
        <Text style={[styles.statusText, isOnline ? styles.textOnline : styles.textOffline]}>
          {isOnline ? 'En ligne' : 'Mode Hors-Ligne'}
        </Text>
      </View>

      <View style={styles.right}>
        {pendingCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {pendingCount} scan{pendingCount > 1 ? 's' : ''} en attente
            </Text>
          </View>
        )}
        {isSyncing && <Text style={styles.syncingText}>Sync...</Text>}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  onlineBg: {
    backgroundColor: '#F0FDF4',
    borderBottomColor: '#DCFCE7',
  },
  offlineBg: {
    backgroundColor: '#FEF3C7',
    borderBottomColor: '#FDE68A',
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotOnline: {
    backgroundColor: '#16A34A',
  },
  dotOffline: {
    backgroundColor: '#D97706',
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  textOnline: {
    color: '#15803D',
  },
  textOffline: {
    color: '#B45309',
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  syncingText: {
    fontSize: 12,
    color: '#4B5563',
    fontStyle: 'italic',
  },
});
