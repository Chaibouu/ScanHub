import React, { useEffect } from 'react';
import { Redirect, Stack } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { NetworkStatusBar } from '@/components/sync/NetworkStatusBar';
import { useSync } from '@/hooks/useSync';
import { useAuthStore } from '@/stores/authStore';
import { eventStore } from '@/stores/eventStore';

export default function ProtectedLayout() {
  // Automatically monitors network connectivity and triggers background sync on reconnection
  useSync();

  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated) {
      eventStore.getState().loadEvents();
    }
  }, [isAuthenticated]);

  // Garde d'accès : sans session, aucune route protégée n'est rendue
  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <View style={styles.container}>
      <NetworkStatusBar />
      <Stack
        screenOptions={{
          headerShown: true,
          headerStyle: { backgroundColor: '#FFFFFF' },
          headerTintColor: '#0F172A',
          headerTitleStyle: { fontWeight: '700' },
          headerShadowVisible: false,
        }}
      >
        <Stack.Screen
          name="index"
          options={{
            title: 'ScanHub Accueil',
            headerLargeTitle: false,
          }}
        />
        <Stack.Screen
          name="scanner"
          options={{
            title: 'Contrôle QR',
            headerShown: false, // Fullscreen camera view
          }}
        />
        <Stack.Screen
          name="result"
          options={{
            title: 'Résultat du Scan',
            presentation: 'modal',
          }}
        />
        <Stack.Screen
          name="history"
          options={{
            title: 'Historique des Scans',
          }}
        />
        <Stack.Screen
          name="event"
          options={{
            title: 'Sélectionner un Événement',
          }}
        />
        <Stack.Screen
          name="sync"
          options={{
            title: 'Synchronisation Offline',
          }}
        />
        <Stack.Screen
          name="settings"
          options={{
            title: 'Paramètres du Terminal',
          }}
        />
      </Stack>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
});
