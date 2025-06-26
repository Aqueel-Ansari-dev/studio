
"use client";

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { KeyRound, AtSign, Building, Users, Briefcase } from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import type { UserRole } from '@/types/database';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>('employee');
  const [isSignUpMode, setIsSignUpMode] = useState(false);
  
  const { login, signup, user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);
  
  useEffect(() => {
    if (isClient && !authLoading && user) {
      router.push('/dashboard');
    }
  }, [user, authLoading, router, isClient]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSignUpMode) {
      if (password !== confirmPassword) {
        toast({ title: "Sign Up Error", description: "Passwords do not match.", variant: "destructive" });
        return;
      }
      if (!selectedRole) {
        toast({ title: "Sign Up Error", description: "Please select a role.", variant: "destructive" });
        return;
      }
      await signup(email, password, selectedRole);
    } else {
      await login(email, password);
    }
  };
  
  if (authLoading || (isClient && !authLoading && user)) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="p-4">Loading...</div>
      </div>
    );
  }

  const availableRoles: UserRole[] = ['employee', 'supervisor', 'admin'];

  return (
    <main className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="w-full max-w-md shadow-2xl overflow-hidden border-2 border-primary/10">
        <CardHeader className="text-center p-8 bg-primary/5">
           <div className="mx-auto mb-4 bg-primary text-primary-foreground rounded-full p-3 w-fit ring-4 ring-background">
            <Briefcase size={32} />
          </div>
          <CardTitle className="text-3xl font-headline text-primary">
            {isSignUpMode ? "Create Account" : "FieldOps Login"}
          </CardTitle>
          <CardDescription className="text-base">
            {isSignUpMode ? "Join your team on FieldOps." : "Access your operational dashboard."}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 md:p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="you@company.com" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  required 
                  className="pl-10 h-11" 
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input 
                  id="password" 
                  type="password" 
                  placeholder="••••••••" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  required 
                  className="pl-10 h-11" 
                  minLength={isSignUpMode ? 6 : undefined}
                />
              </div>
            </div>
            {isSignUpMode && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input 
                      id="confirmPassword" 
                      type="password" 
                      placeholder="••••••••" 
                      value={confirmPassword} 
                      onChange={(e) => setConfirmPassword(e.target.value)} 
                      required 
                      className="pl-10 h-11"
                      minLength={6}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <div className="relative">
                    <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                     <Select value={selectedRole} onValueChange={(value) => setSelectedRole(value as UserRole)}>
                        <SelectTrigger id="role" className="pl-10 h-11">
                            <SelectValue placeholder="Select a role" />
                        </SelectTrigger>
                        <SelectContent>
                            {availableRoles.map(role => (
                                <SelectItem key={role} value={role}>
                                    {role.charAt(0).toUpperCase() + role.slice(1)}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                  </div>
                </div>
              </>
            )}
            <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground h-12 text-base font-bold" disabled={authLoading}>
              {authLoading ? "Processing..." : (isSignUpMode ? "Sign Up" : "Login")}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex items-center justify-center p-6 bg-primary/5">
          <Button
            variant="link"
            onClick={() => setIsSignUpMode(!isSignUpMode)}
            className="text-muted-foreground hover:text-primary"
          >
            {isSignUpMode ? "Already have an account? Login" : "Need an account? Sign Up"}
          </Button>
        </CardFooter>
      </Card>
    </main>
  );
}
