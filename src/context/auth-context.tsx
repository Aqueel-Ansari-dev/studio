
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
import { getGlobalActiveCheckIn } from '@/app/actions/attendance';
import { fetchMyActiveTasks } from '@/app/actions/employee/fetchEmployeeData';

export interface User {
  id: string; // Firebase UID
  email: string;
  role: UserRole; 
  displayName?: string | null;
  photoURL?: string | null;
  payMode?: PayMode;
  rate?: number;
  phoneNumber?: string;
  whatsappOptIn?: boolean;
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
      try {
        if (firebaseUser) {
          const userDocRef = doc(db, "users", firebaseUser.uid);
          const userDocSnap = await getDoc(userDocRef);

        let assignedRole: UserRole = 'employee';
        let displayNameFromDb = firebaseUser.email?.split('@')[0];
        let payModeFromDb: PayMode = 'not_set';
        let rateFromDb = 0;
        let phoneNumberFromDb: string | undefined = undefined;
        let whatsappOptInFromDb = false;

        if (userDocSnap.exists()) {
          const userData = userDocSnap.data();
          assignedRole = userData.role || 'employee';
          displayNameFromDb = userData.displayName || displayNameFromDb;
          payModeFromDb = userData.payMode || 'not_set';
          rateFromDb = typeof userData.rate === 'number' ? userData.rate : 0;
          phoneNumberFromDb = userData.phoneNumber || undefined;
          whatsappOptInFromDb = !!userData.whatsappOptIn;
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
          phoneNumber: phoneNumberFromDb,
          whatsappOptIn: whatsappOptInFromDb,
        };
        setUser(appUser);
        localStorage.setItem('fieldops_user', JSON.stringify(appUser));
      } else {
        setUser(null);
        localStorage.removeItem('fieldops_user');
      }
      setLoading(false);
      } catch (error) {
        console.error('Auth state change error:', error);
        setUser(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [toast]); // Added toast to dependency array as it's used in the effect

  useEffect(() => {
    const storedUser = localStorage.getItem('fieldops_user');
    if (storedUser && !user && loading) { // Only restore from localStorage if auth is still loading and user is not yet set
      try {
        const parsedUser = JSON.parse(storedUser);
        // Basic validation of stored user object
        if (parsedUser && parsedUser.id && parsedUser.email && parsedUser.role) {
             setUser(parsedUser);
        } else {
            localStorage.removeItem('fieldops_user');
        }
      } catch (e) {
        console.warn("Failed to parse stored user, removing item.");
        localStorage.removeItem('fieldops_user');
      }
    }
  }, [user, loading]); // Rerun if user or loading state changes

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
      // onAuthStateChanged will handle setting the user state and redirecting
      toast({ title: "Login Successful", description: "Welcome back!" });
    } catch (error: any) {
      console.error('Login error:', error);
      toast({ title: "Login Failed", description: error.message || "Please check your credentials.", variant: "destructive" });
      setLoading(false); // Ensure loading is false on login failure
    }
    // setLoading(false) is mainly handled by onAuthStateChanged now
  };

  const signup = async (
    email: string, 
    password: string, 
    role: UserRole,
    payMode: PayMode = 'not_set', 
    rate: number = 0 
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
        createdAt: serverTimestamp(), 
        photoURL: firebaseUser.photoURL || '', 
        assignedProjectIds: [], 
      });
      // onAuthStateChanged will handle setting the user state and redirecting
      toast({ title: "Sign Up Successful", description: `Your account has been created as a ${role}.` });
    } catch (error: any) {
      console.error('Signup error:', error);
      toast({ title: "Sign Up Failed", description: error.message || "Could not create account.", variant: "destructive" });
      setLoading(false); // Ensure loading is false on signup failure
    }
     // setLoading(false) is mainly handled by onAuthStateChanged now
  };

  const logout = async () => {
    // setLoading(true); // Not strictly necessary to set loading true on logout start
    try {
      if (user?.id) {
        const [activeAttendance, activeTasks] = await Promise.all([
          getGlobalActiveCheckIn(user.id),
          fetchMyActiveTasks(user.id)
        ]);

        if (activeAttendance.activeLog) {
          toast({
            title: 'Logout Blocked',
            description: `Please checkout from project "${activeAttendance.activeLog.projectName}" first.`,
            variant: 'destructive'
          });
          return;
        }

        if (activeTasks.success && activeTasks.tasks && activeTasks.tasks.length > 0) {
          toast({
            title: 'Logout Blocked',
            description: 'You have tasks in progress. Complete or pause them before logging out.',
            variant: 'destructive'
          });
          return;
        }
      }

      await signOut(auth);
      toast({ title: 'Logged Out', description: 'You have been successfully logged out.' });
    } catch (error: any) {
      console.error('Logout error:', error);
      toast({ title: 'Logout Failed', description: error.message || 'Could not log out.', variant: 'destructive' });
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
