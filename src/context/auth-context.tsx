
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
import { doc, setDoc, getDoc, serverTimestamp, updateDoc, Timestamp } from 'firebase/firestore'; // Import Firestore functions
import { useToast } from '@/hooks/use-toast';
import type { UserRole, PayMode } from '@/types/database';
import { getGlobalActiveCheckIn } from '@/app/actions/attendance';
import { fetchMyActiveTasks } from '@/app/actions/employee/fetchEmployeeData';

export interface User {
  id: string; // Firebase UID
  email: string;
  role: UserRole; 
  organizationId: string;
  planId?: 'free' | 'pro' | 'business' | 'enterprise';
  subscriptionStatus?: 'active' | 'trialing' | 'canceled' | 'overdue';
  trialEndsAt?: Timestamp | string | null;
  displayName?: string | null;
  photoURL?: string | null;
  payMode?: PayMode;
  rate?: number;
  phoneNumber?: string;
  whatsappOptIn?: boolean;
  isActive?: boolean;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<{ error?: Error } | void>;
  signup: (email: string, password: string, role: UserRole, payMode?: PayMode, rate?: number) => Promise<{ error?: Error } | void>;
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
          const userMappingDocRef = doc(db, "users", firebaseUser.uid);
          const userMappingDocSnap = await getDoc(userMappingDocRef);

          if (userMappingDocSnap.exists()) {
              const mappingData = userMappingDocSnap.data();
              const organizationId = mappingData.organizationId;
              
              if (!organizationId) {
                  await signOut(auth);
                  setUser(null);
                  localStorage.removeItem('fieldops_user');
                  toast({ title: "Login Failed", description: "Your user account is not associated with an organization.", variant: "destructive" });
                  setLoading(false);
                  router.push('/');
                  return;
              }

              const userProfileDocRef = doc(db, 'organizations', organizationId, 'users', firebaseUser.uid);
              const orgDocRef = doc(db, 'organizations', organizationId);
              
              const [userProfileDocSnap, orgDocSnap] = await Promise.all([
                  getDoc(userProfileDocRef),
                  getDoc(orgDocRef)
              ]);

              if (userProfileDocSnap.exists() && orgDocSnap.exists()) {
                  const userData = userProfileDocSnap.data();
                  const orgData = orgDocSnap.data();

                  if (userData.isActive === false) {
                      await signOut(auth);
                      setUser(null);
                      localStorage.removeItem('fieldops_user');
                      toast({ title: "Login Failed", description: "Your account is inactive. Please contact an administrator.", variant: "destructive" });
                      setLoading(false);
                      router.push('/');
                      return;
                  }
                  
                  if (orgData.subscriptionStatus === 'canceled' || orgData.subscriptionStatus === 'overdue') {
                      await signOut(auth);
                      setUser(null);
                      localStorage.removeItem('fieldops_user');
                      toast({ title: "Account Suspended", description: "Your organization's plan has expired. Please contact your admin to renew.", variant: "destructive" });
                      setLoading(false);
                      router.push('/dashboard/admin/billing');
                      return;
                  }
                  
                  let finalPlanId = orgData.planId || 'free';
                  const trialEndDate = (orgData.trialEndsAt as Timestamp)?.toDate();
                  if (orgData.subscriptionStatus === 'trialing' && trialEndDate && trialEndDate < new Date()) {
                    finalPlanId = 'free';
                    toast({ title: "Trial Ended", description: "Your Pro trial has ended. Your plan has been downgraded to Free.", variant: "info", duration: 7000 });
                  }

                  const appUser: User = {
                      id: firebaseUser.uid,
                      email: firebaseUser.email || userData.email || 'unknown@example.com',
                      organizationId: organizationId,
                      planId: finalPlanId,
                      subscriptionStatus: orgData.subscriptionStatus,
                      trialEndsAt: orgData.trialEndsAt || null,
                      role: userData.role || 'employee',
                      displayName: userData.displayName || firebaseUser.email?.split('@')[0],
                      photoURL: userData.photoURL || firebaseUser.photoURL,
                      payMode: userData.payMode || 'not_set',
                      rate: typeof userData.rate === 'number' ? userData.rate : 0,
                      phoneNumber: userData.phoneNumber,
                      whatsappOptIn: !!userData.whatsappOptIn,
                      isActive: userData.isActive !== undefined ? userData.isActive : true,
                  };
                  setUser(appUser);
                  localStorage.setItem('fieldops_user', JSON.stringify(appUser));
              } else {
                   await signOut(auth);
                   setUser(null);
                   localStorage.removeItem('fieldops_user');
                   const errorMsg = !userProfileDocSnap.exists() ? "User profile not found in org." : "Organization data not found.";
                   toast({ title: "Login Error", description: `${errorMsg} Please contact support.`, variant: "destructive" });
              }
          } else {
             await signOut(auth);
             setUser(null);
             localStorage.removeItem('fieldops_user');
             toast({ title: "Login Error", description: "User data mapping not found. Please sign up or contact support.", variant: "destructive" });
          }
        } else {
          setUser(null);
          localStorage.removeItem('fieldops_user');
        }
      } catch (error) {
        console.error('Auth state change error:', error);
        setUser(null);
        localStorage.removeItem('fieldops_user');
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [toast, router]);

  useEffect(() => {
    if (!loading) {
      const publicPaths = ['/', '/register', '/join'];
      const isPublicPath = publicPaths.some(p => pathname.startsWith(p));

      if (!user && !isPublicPath) { 
        router.push('/');
      } else if (user && (pathname === '/' || pathname === '/register')) {
        router.push('/dashboard');
      }
    }
  }, [user, loading, pathname, router]);

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // onAuthStateChanged will handle the rest, including Firestore doc check.
      toast({ title: "Login Successful", description: "Welcome back!" });
    } catch (error: any) {
      console.error('Login error:', error);
      toast({ title: "Login Failed", description: error.message || "Please check your credentials.", variant: "destructive" });
      setLoading(false);
      return { error };
    }
  }, [toast]);
  
  const signup = useCallback(async (
    email: string, 
    password: string, 
    role: UserRole,
    payMode: PayMode = 'not_set', 
    rate: number = 0 
  ) => {
      toast({ title: "Signup Disabled", description: "Please ask your organization's admin to invite you.", variant: "destructive" });
      return { error: new Error("Public signup is disabled.") };
  }, [toast]);

  const logout = useCallback(async () => {
    try {
      if (user?.id) {
        const [activeAttendance, activeTasks] = await Promise.all([
          getGlobalActiveCheckIn(user.id),
          fetchMyActiveTasks(user.id, user.organizationId)
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
      router.push('/');
    } catch (error: any) {
      console.error('Logout error:', error);
      toast({ title: 'Logout Failed', description: error.message || 'Could not log out.', variant: 'destructive' });
    }
  }, [toast, user, router]);

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
