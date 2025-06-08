'use client';

import { useOfflineQueue } from '@/context/offline-queue';
import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

export function OfflineBanner() {
  const { pendingActions } = useOfflineQueue();
  const [online, setOnline] = useState<typeof navigator extends undefined ? boolean : boolean>(typeof navigator === 'undefined' ? true : navigator.onLine);

  useEffect(() => {
    const onChange = () => setOnline(navigator.onLine);
    window.addEventListener('online', onChange);
    window.addEventListener('offline', onChange);
    return () => {
      window.removeEventListener('online', onChange);
      window.removeEventListener('offline', onChange);
    };
  }, []);

  if (online && pendingActions.length === 0) {
    return (
      <div className="fixed bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-md bg-green-600 px-3 py-1 text-sm text-white shadow">
        <CheckCircle2 className="h-4 w-4" />
        Synced
      </div>
    );
  }

  if (!online) {
    return (
      <div className="fixed bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-md bg-yellow-500 px-3 py-1 text-sm text-black shadow">
        <AlertCircle className="h-4 w-4" />
        Offline Mode: {pendingActions.length} actions pending
      </div>
    );
  }

  if (pendingActions.length > 0) {
    return (
      <div className="fixed bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-md bg-blue-600 px-3 py-1 text-sm text-white shadow">
        Syncing {pendingActions.length} actions...
      </div>
    );
  }

  return null;
}
