
'use client';

import { useOfflineQueue } from '@/context/offline-queue';
import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react'; // Added RefreshCw for syncing
import { cn } from '@/lib/utils';

export function OfflineBanner() {
  const { pendingActions } = useOfflineQueue();
  const [online, setOnline] = useState<boolean>(true);
  const [showSyncedMessage, setShowSyncedMessage] = useState(false);

  useEffect(() => {
    // Ensure navigator is available (client-side only)
    if (typeof navigator !== 'undefined') {
      setOnline(navigator.onLine);
      const handleOnline = () => {
        setOnline(true);
        if (pendingActions.length === 0) {
          setShowSyncedMessage(true);
        }
      };
      const handleOffline = () => setOnline(false);

      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }
  }, [pendingActions.length]);

  useEffect(() => {
    // Show Synced message when initially online and no pending actions, or when actions clear
    if (online && pendingActions.length === 0) {
      setShowSyncedMessage(true);
    }
  }, [online, pendingActions.length]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (showSyncedMessage) {
      timer = setTimeout(() => {
        setShowSyncedMessage(false);
      }, 3000); // Show for 3 seconds
    }
    return () => clearTimeout(timer);
  }, [showSyncedMessage]);

  if (!online) {
    return (
      <div className="fixed bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-md bg-yellow-500 px-3 py-2 text-sm text-black shadow-lg animate-pulse">
        <AlertCircle className="h-5 w-5" />
        Offline Mode: {pendingActions.length > 0 ? `${pendingActions.length} action(s) pending.` : "You are offline."}
      </div>
    );
  }

  if (pendingActions.length > 0) {
    return (
      <div className="fixed bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm text-white shadow-lg">
        <RefreshCw className="h-5 w-5 animate-spin" />
        Syncing {pendingActions.length} action(s)...
      </div>
    );
  }

  // Redesigned Synced message
  return (
    <div
      className={cn(
        "fixed bottom-4 left-4 flex items-center gap-2 rounded-full bg-green-600 px-4 py-2 text-sm text-white shadow-lg transition-opacity duration-500 ease-in-out",
        showSyncedMessage ? "opacity-100" : "opacity-0 pointer-events-none"
      )}
    >
      <CheckCircle2 className="h-5 w-5" />
      Synced
    </div>
  );
}
