import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from './src/context/auth-context';
import { OfflineQueueProvider } from './src/context/offline-queue';
import { OfflineBanner } from './src/components/OfflineBanner';

function HomeScreen() {
  const { user, loading } = useAuth();
  if (loading) return <Text>Loading...</Text>;
  return <Text>{user ? `Logged in as ${user.email}` : 'Not authenticated'}</Text>;
}

export default function App() {
  return (
    <AuthProvider>
      <OfflineQueueProvider>
        <View style={styles.container}>
          <HomeScreen />
          <OfflineBanner />
          <StatusBar style="auto" />
        </View>
      </OfflineQueueProvider>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
