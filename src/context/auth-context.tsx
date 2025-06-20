
"use client";

import type { ReactNode } from 'react';
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { auth, db } from '@/lib/firebase'; // Import db for Firestore
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  User as FirebaseUser 
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore'; // Import Firestore functions
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
  isActive?: boolean; // Added isActive status
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, role: UserRole, payMode?: PayMode, rate?: number) => Promise<void>;
  logout: () => Promise<void>;
  updateUserProfileInContext: (updatedFields: Partial<User>) => void;
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
        let isActiveFromDb = true; // Default to true

        if (userDocSnap.exists()) {
          const userData = userDocSnap.data();
          
          if (userData.isActive === false) { // Check isActive status
            await signOut(auth);
            setUser(null);
            localStorage.removeItem('fieldops_user');
            toast({ title: "Login Failed", description: "Your account is inactive. Please contact an administrator.", variant: "destructive" });
            setLoading(false);
            router.push('/'); // Redirect to login if inactive
            return;
          }

          assignedRole = userData.role || 'employee';
          displayNameFromDb = userData.displayName || displayNameFromDb;
          payModeFromDb = userData.payMode || 'not_set';
          rateFromDb = typeof userData.rate === 'number' ? userData.rate : 0;
          phoneNumberFromDb = userData.phoneNumber || undefined;
          whatsappOptInFromDb = !!userData.whatsappOptIn;
          isActiveFromDb = userData.isActive === undefined ? true : userData.isActive;
        } else {
          // New user, create Firestore document
           await setDoc(userDocRef, {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            role: 'employee', 
            displayName: firebaseUser.email?.split('@')[0] || 'New User',
            payMode: 'not_set',
            rate: 0,
            phoneNumber: '',
            whatsappOptIn: false,
            isActive: true, // New users are active by default
            createdAt: serverTimestamp(),
            photoURL: firebaseUser.photoURL || '',
            assignedProjectIds: [],
          });
          isActiveFromDb = true; // Ensure it's set for the appUser object below
          console.log(`Created Firestore document for new user: ${firebaseUser.uid}`);
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
          isActive: isActiveFromDb,
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast, router]); // Added router to dependency array for redirection

  useEffect(() => {
    const storedUser = localStorage.getItem('fieldops_user');
    if (storedUser && !user && loading) { 
      try {
        const parsedUser = JSON.parse(storedUser);
        if (parsedUser && parsedUser.id && parsedUser.email && parsedUser.role) {
            if (parsedUser.isActive === false) { // Check stored user status
                 localStorage.removeItem('fieldops_user'); // Remove inactive user from storage
                 setLoading(false);
                 // Optionally redirect or show toast here too, though onAuthStateChanged should handle it.
            } else {
                 setUser(parsedUser);
            }
        } else {
            localStorage.removeItem('fieldops_user');
        }
      } catch (e) {
        console.warn("Failed to parse stored user, removing item.");
        localStorage.removeItem('fieldops_user');
      }
    }
  }, [user, loading]); 

  useEffect(() => {
    if (!loading) {
      const publicPaths = ['/']; 
      const isPublicPath = publicPaths.includes(pathname);

      if (!user && !isPublicPath && !pathname.startsWith('/_next/')) { 
        router.push('/');
      } else if (user && user.isActive && pathname === '/') { // Check if user is active before redirecting
        router.push('/dashboard');
      } else if (user && !user.isActive && pathname !== '/') { // If user is loaded but inactive, and not on login page
        signOut(auth); // Log them out from Firebase
        setUser(null); // Clear context
        localStorage.removeItem('fieldops_user');
        toast({ title: "Account Inactive", description: "Your account is currently inactive. Please contact an administrator.", variant: "destructive", duration: 7000 });
        router.push('/');
      }
    }
  }, [user, loading, pathname, router, toast]);

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;

      // Check Firestore for isActive status immediately after Firebase auth
      const userDocRef = doc(db, "users", firebaseUser.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists() && userDocSnap.data().isActive === false) {
        await signOut(auth); // Sign out from Firebase Auth
        setUser(null); // Clear user from context
        localStorage.removeItem('fieldops_user');
        toast({ title: "Login Failed", description: "Your account is inactive. Please contact an administrator.", variant: "destructive" });
        setLoading(false); // Explicitly set loading to false here
        router.push('/'); // Ensure redirection to login
        return;
      }
      // If active or doc doesn't exist (handled by onAuthStateChanged), onAuthStateChanged will set the user
      toast({ title: "Login Successful", description: "Welcome back!" });
    } catch (error: any) {
      console.error('Login error:', error);
      toast({ title: "Login Failed", description: error.message || "Please check your credentials.", variant: "destructive" });
      setLoading(false); // Set loading false on login error
    }
  }, [toast, router]);

  const signup = useCallback(async (
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
        phoneNumber: '',
        whatsappOptIn: false,
        isActive: true, // New users are active by default
        createdAt: serverTimestamp(), 
        photoURL: firebaseUser.photoURL || '', 
        assignedProjectIds: [], 
      });
      // onAuthStateChanged will handle setting the user state
      toast({ title: "Sign Up Successful", description: `Your account has been created as a ${role}.` });
    } catch (error: any) {
      console.error('Signup error:', error);
      toast({ title: "Sign Up Failed", description: error.message || "Could not create account.", variant: "destructive" });
      setLoading(false); // Set loading false on signup error
    }
  }, [toast]);

  const logout = useCallback(async () => {
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
      // onAuthStateChanged will handle clearing user state and localStorage
      toast({ title: 'Logged Out', description: 'You have been successfully logged out.' });
       router.push('/'); // Redirect to login page on logout
    } catch (error: any) {
      console.error('Logout error:', error);
      toast({ title: 'Logout Failed', description: error.message || 'Could not log out.', variant: 'destructive' });
    }
  }, [toast, user?.id, router]);

  const updateUserProfileInContext = useCallback((updatedFields: Partial<User>) => {
    setUser(prevUser => {
      if (prevUser) {
        const newUser = { ...prevUser, ...updatedFields };
        localStorage.setItem('fieldops_user', JSON.stringify(newUser));
        return newUser;
      }
      return null;
    });
  }, []);

  const contextValue = useMemo(() => ({
    user,
    login,
    signup,
    logout,
    updateUserProfileInContext,
    loading
  }), [user, login, signup, logout, updateUserProfileInContext, loading]);

  return (
    <AuthContext.Provider value={contextValue}>
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
