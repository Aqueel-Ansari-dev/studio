

"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// This component simply redirects to the main owner overview page.
// The content of the overview page now resides in /dashboard/owner/overview/page.tsx
export default function OwnerDashboardRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard/owner/overview');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
        <p>Redirecting to Owner Dashboard...</p>
    </div>
  );
}
