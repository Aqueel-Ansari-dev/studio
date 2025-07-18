
"use client";

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KeyRound, AtSign, Briefcase, Eye, EyeOff, Loader2, User as UserIcon } from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { cn } from "@/lib/utils";
import { fetchPublicBranding } from '../actions/common/fetchPublicBranding';

interface PublicBranding {
    name: string;
    logoUrl?: string | null;
    primaryColor?: string | null;
}

function LoginPageContent() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const { login, user, loading: authLoading } = useAuth();
  const router = useRouter();
  
  const [isClient, setIsClient] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [authError, setAuthError] = useState(false);
  const [branding, setBranding] = useState<PublicBranding | null>(null);

  const searchParams = useSearchParams();

  useEffect(() => {
    setIsClient(true);
    const orgId = searchParams.get('orgId');
    if (orgId) {
      fetchPublicBranding(orgId).then(result => {
        if (result.success && result.branding) {
          setBranding(result.branding);
        }
      });
    }
  }, [searchParams]);
  
  useEffect(() => {
    if (isClient && !authLoading && user) {
      router.push('/dashboard');
    }
  }, [user, authLoading, router, isClient]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    setAuthError(false);

    const result = await login(identifier, password);
    
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

  const loginButtonStyle = branding?.primaryColor ? { backgroundColor: branding.primaryColor } : {};
  const headerStyle = branding?.primaryColor ? { color: branding.primaryColor } : {};

  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
       <Link href="/" className="absolute top-6 left-6 flex items-center gap-2 text-foreground/80 hover:text-foreground">
          <Briefcase className="h-5 w-5" />
          <span className="font-semibold">FieldOps</span>
      </Link>
      <Card className={cn(
        "w-full max-w-md shadow-2xl border-border/50 z-10",
        authError && "animate-shake"
      )}>
        <CardHeader className="text-center p-8 bg-muted/30">
           {branding?.logoUrl ? (
             <Image src={branding.logoUrl} alt={`${branding.name} Logo`} width={120} height={60} className="mx-auto h-16 w-auto object-contain mb-4" data-ai-hint="company logo"/>
           ) : (
            <div className="mx-auto mb-4 bg-primary text-primary-foreground rounded-full p-3 w-fit ring-4 ring-background">
              <Briefcase size={28} />
            </div>
           )}
          <CardTitle className="text-2xl font-semibold font-headline text-foreground" style={headerStyle}>
            Welcome to {branding?.name || 'FieldOps'}
          </CardTitle>
          <CardDescription>
            Enter your credentials to access your dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 md:p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="identifier">Email or Phone Number</Label>
              <div className="relative">
                <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <UserIcon className="absolute left-8 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  id="identifier" 
                  type="text" 
                  placeholder="you@company.com or +91..." 
                  value={identifier} 
                  onChange={(e) => setIdentifier(e.target.value)} 
                  required 
                  className="pl-14" 
                />
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <Label htmlFor="password">Password</Label>
                <Button variant="link" asChild className="p-0 h-auto text-xs text-muted-foreground hover:text-primary">
                    <Link href="/forgot-password">Forgot password?</Link>
                </Button>
              </div>
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
            <Button type="submit" className="w-full bg-accent hover:bg-accent/90 text-accent-foreground h-11 text-base font-semibold" disabled={isProcessing} style={loginButtonStyle}>
              {isProcessing ? <Loader2 className="h-5 w-5 animate-spin" /> : "Login"}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex items-center justify-center p-6 bg-muted/30">
          <p className="text-sm text-muted-foreground">
            Have an invite? Use the link in your email.
          </p>
        </CardFooter>
      </Card>
      
      <div className="mt-8 text-center">
         <p className="text-sm text-muted-foreground">Don't have an organization account?</p>
         <Button variant="link" asChild className="text-primary"><Link href="/register">Register your organization</Link></Button>
      </div>
    </main>
  );
}

export default function LoginPageWrapper() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin"/></div>}>
      <LoginPageContent />
    </Suspense>
  );
}
