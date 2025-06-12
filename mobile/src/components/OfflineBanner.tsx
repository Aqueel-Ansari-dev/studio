import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useOfflineQueue } from '../context/offline-queue';

export function OfflineBanner() {
  const { pendingActions } = useOfflineQueue();
  const [isConnected, setIsConnected] = useState(true);

  useEffect(() => {
    const sub = NetInfo.addEventListener(state => {
      setIsConnected(state.isConnected ?? false);
    });
    return sub;
  }, []);

  if (!isConnected) {
    return (
      <View style={[styles.banner, styles.offline]}>
        <Text style={styles.text}>
          Offline Mode: {pendingActions.length > 0 ? `${pendingActions.length} action(s) pending.` : 'You are currently offline.'}
        </Text>
      </View>
    );
  }

  if (pendingActions.length > 0) {
    return (
      <View style={[styles.banner, styles.syncing]}>
        <Text style={styles.text}>Syncing {pendingActions.length} action(s)...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.banner, styles.synced]}>
      <Text style={styles.text}>Synced</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    bottom: 16,
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  text: {
    color: '#fff',
    fontSize: 14,
  },
  offline: {
    backgroundColor: '#f59e0b',
  },
  syncing: {
    backgroundColor: '#2563eb',
  },
  synced: {
    backgroundColor: '#16a34a',
  },
});
