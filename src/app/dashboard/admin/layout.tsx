
"use client";

import { useAuth } from '@/context/auth-context';
import { useRouter } from 'next/navigation';
import { type ReactNode, useEffect, useState } from 'react';
import { PageHeader } from '@/components/shared/page-header';

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (isClient && !loading && user?.role !== 'admin') {
      router.push('/dashboard');
    }
  }, [user, loading, router, isClient]);

  if (loading || !user || user.role !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <PageHeader title="Access Denied" description="Admin access required." />
      </div>
    );
  }

  return <>{children}</>;
}
