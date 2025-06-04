
"use client";

import type { ReactNode } from 'react';
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  User as FirebaseUser 
} from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import type { UserRole } from '@/types/database'; // Import UserRole from the new central location

export interface User {
  id: string; // Firebase UID
  email: string;
  role: UserRole; 
  displayName?: string | null;
  photoURL?: string | null;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        // FIXME: Assigning default 'employee' role. Implement proper role management (e.g., Firestore or Custom Claims).
        // For MVP, determine role based on email or assign a fixed role.
        let assignedRole: UserRole = 'employee'; 
        if (firebaseUser.email?.endsWith('@supervisor.example.com')) {
          assignedRole = 'supervisor';
        } else if (firebaseUser.email?.endsWith('@admin.example.com')) {
          assignedRole = 'admin';
        }
        
        const appUser: User = {
          id: firebaseUser.uid,
          email: firebaseUser.email || 'unknown@example.com', 
          role: assignedRole, 
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL,
        };
        setUser(appUser);
        localStorage.setItem('fieldops_user', JSON.stringify(appUser));
      } else {
        setUser(null);
        localStorage.removeItem('fieldops_user');
      }
      setLoading(false);
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // Attempt to load user from localStorage on initial mount to reduce flicker
    const storedUser = localStorage.getItem('fieldops_user');
    if (storedUser && !user) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        localStorage.removeItem('fieldops_user'); // Clear if invalid
      }
    }
    // setLoading(false) is handled by onAuthStateChanged to ensure Firebase state is definitive
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount

  useEffect(() => {
    if (!loading) {
      const publicPaths = ['/']; // Define public paths that don't require auth
      const isPublicPath = publicPaths.includes(pathname);

      if (!user && !isPublicPath && !pathname.startsWith('/_next/')) { // Allow Next.js internal paths
        router.push('/');
      } else if (user && pathname === '/') {
        router.push('/dashboard');
      }
    }
  }, [user, loading, pathname, router]);

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      toast({ title: "Login Successful", description: "Welcome back!" });
      // onAuthStateChanged will handle setting user state and navigation
    } catch (error: any) {
      console.error('Login error:', error);
      toast({ title: "Login Failed", description: error.message || "Please check your credentials.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const signup = async (email: string, password: string) => {
    setLoading(true);
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      toast({ title: "Sign Up Successful", description: "Welcome to FieldOps MVP! Your account has been created." });
      // onAuthStateChanged will handle setting user state and navigation
    } catch (error: any) {
      console.error('Signup error:', error);
      toast({ title: "Sign Up Failed", description: error.message || "Could not create account.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await signOut(auth);
      toast({ title: "Logged Out", description: "You have been successfully logged out." });
      // onAuthStateChanged will handle clearing user and navigation will be handled by useEffect
    } catch (error: any) {
      console.error('Logout error:', error);
      toast({ title: "Logout Failed", description: error.message || "Could not log out.", variant: "destructive" });
    } finally {
      setLoading(false); 
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, signup, logout, loading }}>
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
