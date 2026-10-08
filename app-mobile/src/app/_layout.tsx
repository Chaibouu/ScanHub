import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { authStore, useAuthStore } from '@/stores/authStore';
import { eventStore } from '@/stores/eventStore';

export default function RootLayout() {
  const { isLoading } = useAuthStore();

  // Relit la session et l'événement actif persistés avant d'afficher la moindre route
  useEffect(() => {
    authStore.getState().hydrate();
    eventStore.getState().hydrate();
  }, []);

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' }}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(protected)" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      </Stack>
    </SafeAreaProvider>
  );
}
