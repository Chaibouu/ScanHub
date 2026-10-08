import React from 'react';
import { Redirect, Stack } from 'expo-router';
import { useAuthStore } from '@/stores/authStore';

export default function AuthLayout() {
  const { isAuthenticated } = useAuthStore();

  // Une session active n'a rien à faire sur les écrans de connexion
  if (isAuthenticated) {
    return <Redirect href="/(protected)" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: '#FFFFFF' },
        headerTintColor: '#111827',
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="login" options={{ title: 'Connexion Agent' }} />
      <Stack.Screen name="device" options={{ title: 'Activation Appareil' }} />
    </Stack>
  );
}
