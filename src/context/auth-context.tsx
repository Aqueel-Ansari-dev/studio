
"use client";

import type { ReactNode } from 'react';
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

type UserRole = 'employee' | 'supervisor' | 'admin';

interface User {
  id: string;
  email: string;
  role: UserRole;
  assignedSiteCoordinates?: { lat: number; lon: number }; // For GPS verification
}

interface AuthContextType {
  user: User | null;
  login: (email: string, role: UserRole) => void;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const MOCK_USERS: Record<string, User> = {
  'employee@fieldops.com': { id: 'emp1', email: 'employee@fieldops.com', role: 'employee', assignedSiteCoordinates: { lat: 34.0522, lon: -118.2437 } },
  'supervisor@fieldops.com': { id: 'sup1', email: 'supervisor@fieldops.com', role: 'supervisor' },
  'admin@fieldops.com': { id: 'adm1', email: 'admin@fieldops.com', role: 'admin' },
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Simulate checking for a logged-in user (e.g., from localStorage)
    const storedUser = localStorage.getItem('fieldops_user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!loading) {
      if (!user && pathname !== '/' && !pathname.startsWith('/_next/')) { // Allow access to root (login) page
        router.push('/');
      } else if (user && pathname === '/') {
        router.push('/dashboard');
      }
    }
  }, [user, loading, pathname, router]);

  const login = (email: string, role: UserRole) => {
    // In a real app, this would involve an API call
    const foundUser = Object.values(MOCK_USERS).find(u => u.email === email && u.role === role);
    if (foundUser) {
      setUser(foundUser);
      localStorage.setItem('fieldops_user', JSON.stringify(foundUser));
      router.push('/dashboard');
    } else {
      // Handle login failure (e.g., show an error message)
      alert('Invalid credentials or role');
      console.error('Login failed for email:', email, 'role:', role);
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('fieldops_user');
    router.push('/');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
