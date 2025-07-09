
"use client";

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KeyRound, AtSign, Briefcase, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { cn } from "@/lib/utils";

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const { login, user, loading: authLoading } = useAuth();
  const router = useRouter();
  
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

    const result = await login(email, password);
    
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
            Welcome to FieldOps
          </CardTitle>
          <CardDescription>
            Enter your credentials to access your dashboard.
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
            <Button type="submit" className="w-full bg-accent hover:bg-accent/90 text-accent-foreground h-11 text-base font-semibold" disabled={isProcessing}>
              {isProcessing ? <Loader2 className="h-5 w-5 animate-spin" /> : "Login"}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex items-center justify-center p-6 bg-muted/30">
          <Button
            type="button"
            variant="link"
            asChild
            className="text-muted-foreground hover:text-primary"
          >
            <Link href="/join">Have an invite? Join here</Link>
          </Button>
        </CardFooter>
      </Card>
    </main>
  );
}
