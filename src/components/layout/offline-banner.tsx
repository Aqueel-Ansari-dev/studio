
'use client';

import { useOfflineQueue } from '@/context/offline-queue';
import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

export function OfflineBanner() {
  const { pendingActions } = useOfflineQueue();
  const [online, setOnline] = useState<boolean>(true);
  const [showSyncedMessage, setShowSyncedMessage] = useState(false);

  useEffect(() => {
    if (typeof navigator !== 'undefined') {
      setOnline(navigator.onLine);
      const handleOnline = () => {
        setOnline(true);
        // Only show synced message if there were no pending actions to begin with
        // or after all pending actions are cleared (which will be handled by the other effect).
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
  }, [pendingActions.length]); // Rerun if pendingActions changes to potentially show synced message

  useEffect(() => {
    // Show Synced message when online and no pending actions
    if (online && pendingActions.length === 0) {
      setShowSyncedMessage(true);
    }
  }, [online, pendingActions.length]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (showSyncedMessage) {
      timer = setTimeout(() => {
        setShowSyncedMessage(false);
      }, 3000); 
    }
    return () => clearTimeout(timer);
  }, [showSyncedMessage]);

  if (!online) {
    return (
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 rounded-lg bg-amber-500 px-4 py-3 text-sm font-medium text-white shadow-xl animate-pulse">
        <AlertCircle className="h-6 w-6" />
        <span>
          Offline Mode: {pendingActions.length > 0 ? `${pendingActions.length} action(s) pending.` : "You are currently offline."}
        </span>
      </div>
    );
  }

  if (pendingActions.length > 0) { // This implies online but still syncing
    return (
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium text-white shadow-xl">
        <RefreshCw className="h-6 w-6 animate-spin" />
        <span>Syncing {pendingActions.length} action(s)...</span>
      </div>
    );
  }

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
