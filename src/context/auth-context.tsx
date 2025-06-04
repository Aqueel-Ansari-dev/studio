
"use client";

import type { ReactNode } from 'react';
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { auth, db } from '@/lib/firebase'; // Import db for Firestore
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  User as FirebaseUser 
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore'; // Import Firestore functions
import { useToast } from '@/hooks/use-toast';
import type { UserRole, PayMode } from '@/types/database';

export interface User {
  id: string; // Firebase UID
  email: string;
  role: UserRole; 
  displayName?: string | null;
  photoURL?: string | null;
  payMode?: PayMode;
  rate?: number;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, role: UserRole, payMode?: PayMode, rate?: number) => Promise<void>;
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
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        const userDocRef = doc(db, "users", firebaseUser.uid);
        const userDocSnap = await getDoc(userDocRef);

        let assignedRole: UserRole = 'employee';
        let displayNameFromDb = firebaseUser.email?.split('@')[0];
        let payModeFromDb: PayMode = 'not_set';
        let rateFromDb = 0;

        if (userDocSnap.exists()) {
          const userData = userDocSnap.data();
          assignedRole = userData.role || 'employee';
          displayNameFromDb = userData.displayName || displayNameFromDb;
          payModeFromDb = userData.payMode || 'not_set';
          rateFromDb = typeof userData.rate === 'number' ? userData.rate : 0;
        } else {
          console.warn(`User document not found in Firestore for UID: ${firebaseUser.uid}. Defaulting role, payMode, and rate.`);
        }
        
        const appUser: User = {
          id: firebaseUser.uid,
          email: firebaseUser.email || 'unknown@example.com', 
          role: assignedRole, 
          displayName: firebaseUser.displayName || displayNameFromDb,
          photoURL: firebaseUser.photoURL,
          payMode: payModeFromDb,
          rate: rateFromDb,
        };
        setUser(appUser);
        localStorage.setItem('fieldops_user', JSON.stringify(appUser));
      } else {
        setUser(null);
        localStorage.removeItem('fieldops_user');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const storedUser = localStorage.getItem('fieldops_user');
    if (storedUser && !user) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        localStorage.removeItem('fieldops_user');
      }
    }
  }, [user]);

  useEffect(() => {
    if (!loading) {
      const publicPaths = ['/']; 
      const isPublicPath = publicPaths.includes(pathname);

      if (!user && !isPublicPath && !pathname.startsWith('/_next/')) { 
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
    } catch (error: any) {
      console.error('Login error:', error);
      toast({ title: "Login Failed", description: error.message || "Please check your credentials.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const signup = async (
    email: string, 
    password: string, 
    role: UserRole,
    payMode: PayMode = 'not_set', // Default value
    rate: number = 0 // Default value
  ) => {
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;

      const userDocRef = doc(db, "users", firebaseUser.uid);
      await setDoc(userDocRef, {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        role: role,
        displayName: firebaseUser.email?.split('@')[0] || 'New User',
        payMode: payMode,
        rate: rate,
        createdAt: serverTimestamp(), // Use Firestore server timestamp
        photoURL: firebaseUser.photoURL || '', // Ensure photoURL is at least an empty string
        assignedProjectIds: [], // Initialize with empty array
      });

      toast({ title: "Sign Up Successful", description: `Your account has been created as a ${role}.` });
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
