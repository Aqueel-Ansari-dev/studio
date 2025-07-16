
"use client";

import { useAuth } from '@/context/auth-context';
import { useRouter } from 'next/navigation';
import { type ReactNode, useEffect, useState } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { RefreshCw } from 'lucide-react';

export default function OwnerLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    if (!loading) {
      if (user?.role === 'owner') {
        setIsAuthorized(true);
      } else {
        setIsAuthorized(false);
        router.push('/dashboard');
      }
    }
  }, [user, loading, router]);

  if (isAuthorized === null || loading) {
     return (
       <div className="flex items-center justify-center min-h-[calc(100vh-theme(spacing.16))]">
        <div className="flex items-center gap-2 text-muted-foreground">
            <RefreshCw className="h-5 w-5 animate-spin" />
            <span>Verifying owner access...</span>
        </div>
      </div>
    );
  }
  
  if (!isAuthorized) {
    return (
       <div className="flex items-center justify-center min-h-[calc(100vh-theme(spacing.16))]">
        <PageHeader title="Access Denied" description="You do not have permission to view this page." />
      </div>
    );
  }

  return <>{children}</>;
}
