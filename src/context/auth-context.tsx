
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
import { doc, setDoc, getDoc } from 'firebase/firestore'; // Import Firestore functions
import { useToast } from '@/hooks/use-toast';
import type { UserRole } from '@/types/database';

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
  signup: (email: string, password: string, role: UserRole) => Promise<void>; // Added role
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
        // Fetch user role from Firestore
        const userDocRef = doc(db, "users", firebaseUser.uid);
        const userDocSnap = await getDoc(userDocRef);

        let assignedRole: UserRole = 'employee'; // Default if not found, though signup should create it
        let displayNameFromDb = firebaseUser.email?.split('@')[0];

        if (userDocSnap.exists()) {
          const userData = userDocSnap.data();
          assignedRole = userData.role || 'employee';
          displayNameFromDb = userData.displayName || displayNameFromDb;
        } else {
          // This case should ideally not happen for users signing up with the new flow.
          // Could be an old user, or Firestore write failed during signup.
          console.warn(`User document not found in Firestore for UID: ${firebaseUser.uid}. Defaulting role to 'employee'.`);
          // Optionally, create the user document here if it's missing and essential for all users
          // For now, we'll just default the role for the appUser object.
        }
        
        const appUser: User = {
          id: firebaseUser.uid,
          email: firebaseUser.email || 'unknown@example.com', 
          role: assignedRole, 
          displayName: firebaseUser.displayName || displayNameFromDb, // Prefer Firebase Auth displayName, fallback to DB, then email
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

  const signup = async (email: string, password: string, role: UserRole) => {
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;

      // Create user document in Firestore
      const userDocRef = doc(db, "users", firebaseUser.uid);
      await setDoc(userDocRef, {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        role: role,
        displayName: firebaseUser.email?.split('@')[0] || 'New User', // Default display name
        createdAt: new Date().toISOString(), // Optional: record creation time
      });

      toast({ title: "Sign Up Successful", description: `Your account has been created as a ${role}.` });
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
