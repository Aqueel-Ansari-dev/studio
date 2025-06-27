
"use client";

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { KeyRound, AtSign, Users, Briefcase, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import type { UserRole } from '@/types/database';
import { cn } from "@/lib/utils";

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>('employee');
  const [isSignUpMode, setIsSignUpMode] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const { login, signup, user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  
  const [isClient, setIsClient] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [authError, setAuthError] = useState(false);

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
    setIsProcessing(true);
    setAuthError(false);

    let result;
    if (isSignUpMode) {
      if (password !== confirmPassword) {
        toast({ title: "Sign Up Error", description: "Passwords do not match.", variant: "destructive" });
        setIsProcessing(false);
        setAuthError(true);
        setTimeout(() => setAuthError(false), 1000);
        return;
      }
      result = await signup(email, password, selectedRole);
    } else {
      result = await login(email, password);
    }
    
    // The useAuth hook handles redirects on success.
    // We only need to handle the failure case here for UI feedback.
    if (result?.error) {
      setAuthError(true);
      setTimeout(() => setAuthError(false), 1000);
    }

    setIsProcessing(false);
  };
  
  if (authLoading || (isClient && user)) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const availableRoles: UserRole[] = ['employee', 'supervisor', 'admin'];

  return (
    <main className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className={cn(
        "w-full max-w-md shadow-2xl border-border/50",
        authError && "animate-shake"
      )}>
        <CardHeader className="text-center p-8 bg-muted/30">
           <div className="mx-auto mb-4 bg-primary text-primary-foreground rounded-full p-3 w-fit ring-4 ring-background">
            <Briefcase size={28} />
          </div>
          <CardTitle className="text-2xl font-semibold font-headline text-foreground">
            {isSignUpMode ? "Create Your Account" : "Welcome to FieldOps"}
          </CardTitle>
          <CardDescription>
            {isSignUpMode ? "Join your team to streamline operations." : "Enter your credentials to access your dashboard."}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 md:p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="you@company.com" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  required 
                  className="pl-10" 
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  id="password" 
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  required 
                  className="pl-10 pr-10"
                  minLength={isSignUpMode ? 6 : undefined}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            {isSignUpMode && (
              <>
                <div className="space-y-1">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      id="confirmPassword" 
                      type="password"
                      placeholder="••••••••" 
                      value={confirmPassword} 
                      onChange={(e) => setConfirmPassword(e.target.value)} 
                      required 
                      className="pl-10"
                      minLength={6}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="role">Your Role</Label>
                  <div className="relative">
                    <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                     <Select value={selectedRole} onValueChange={(value) => setSelectedRole(value as UserRole)}>
                        <SelectTrigger id="role" className="pl-10">
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
            <Button type="submit" className="w-full bg-accent hover:bg-accent/90 text-accent-foreground h-11 text-base font-semibold" disabled={isProcessing}>
              {isProcessing ? <Loader2 className="h-5 w-5 animate-spin" /> : (isSignUpMode ? "Create Account" : "Login")}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex items-center justify-center p-6 bg-muted/30">
          <Button
            type="button"
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
