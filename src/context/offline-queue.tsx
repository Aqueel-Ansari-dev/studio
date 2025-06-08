'use client';

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';

export type QueuedActionType = 'check-in' | 'complete-task' | 'log-expense';

export interface QueuedAction {
  id: string;
  type: QueuedActionType;
  payload: any;
  timestamp: number;
}

interface OfflineQueueContextType {
  pendingActions: QueuedAction[];
  enqueue: (action: Omit<QueuedAction, 'id' | 'timestamp'>) => void;
  registerExecutor: (type: QueuedActionType, fn: (payload: any) => Promise<void>) => void;
}

const OfflineQueueContext = createContext<OfflineQueueContextType | undefined>(undefined);

const STORAGE_KEY = 'fieldops_offline_queue';

export function OfflineQueueProvider({ children }: { children: React.ReactNode }) {
  const [pendingActions, setPendingActions] = useState<QueuedAction[]>([]);
  const executorsRef = useRef<Record<QueuedActionType, (payload: any) => Promise<void>>>({
    'check-in': async () => {},
    'complete-task': async () => {},
    'log-expense': async () => {},
  });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        setPendingActions(JSON.parse(raw));
      }
    } catch (e) {
      console.warn('Failed to load offline queue', e);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pendingActions));
    } catch (e) {
      console.warn('Failed to save offline queue', e);
    }
  }, [pendingActions]);

  useEffect(() => {
    async function processQueue() {
      if (!navigator.onLine || pendingActions.length === 0) return;
      for (const action of [...pendingActions]) {
        const executor = executorsRef.current[action.type];
        if (!executor) continue;
        try {
          await executor(action.payload);
          setPendingActions(q => q.filter(a => a.id !== action.id));
        } catch (err) {
          console.error('Failed to process queued action', err);
          break;
        }
      }
    }
    const interval = setInterval(processQueue, 10000);
    window.addEventListener('online', processQueue);
    return () => {
      clearInterval(interval);
      window.removeEventListener('online', processQueue);
    };
  }, [pendingActions]);

  const enqueue = (action: Omit<QueuedAction, 'id' | 'timestamp'>) => {
    const finalAction: QueuedAction = { ...action, id: crypto.randomUUID(), timestamp: Date.now() };
    if (navigator.onLine) {
      const executor = executorsRef.current[action.type];
      if (executor) {
        executor(action.payload).catch(() => {
          setPendingActions(q => [...q, finalAction]);
        });
      } else {
        setPendingActions(q => [...q, finalAction]);
      }
    } else {
      setPendingActions(q => [...q, finalAction]);
    }
  };

  const registerExecutor = (type: QueuedActionType, fn: (payload: any) => Promise<void>) => {
    executorsRef.current[type] = fn;
  };

  return (
    <OfflineQueueContext.Provider value={{ pendingActions, enqueue, registerExecutor }}>
      {children}
    </OfflineQueueContext.Provider>
  );
}

export function useOfflineQueue() {
  const ctx = useContext(OfflineQueueContext);
  if (!ctx) throw new Error('useOfflineQueue must be used within OfflineQueueProvider');
  return ctx;
}
