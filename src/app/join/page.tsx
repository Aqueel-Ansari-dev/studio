
"use client";

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { getInviteDetails, type InviteDetails } from '@/app/actions/invites/getInviteDetails';
import { acceptInvite } from '@/app/actions/invites/acceptInvite';
import { Loader2, KeyRound, User, Briefcase, XCircle, CheckCircle } from 'lucide-react';
import { cn } from "@/lib/utils";

function JoinPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteDetails, setInviteDetails] = useState<InviteDetails | null>(null);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authError, setAuthError] = useState(false);

  useEffect(() => {
    const inviteId = searchParams.get('inviteId');
    if (!inviteId) {
      setError("No invite ID provided. Please use the link from your invitation.");
      setIsLoading(false);
      return;
    }

    async function fetchDetails() {
      const result = await getInviteDetails(inviteId);
      if (result.success && result.details) {
        setInviteDetails(result.details);
        setDisplayName(result.details.displayName || '');
      } else {
        setError(result.error || "Failed to validate invite.");
      }
      setIsLoading(false);
    }
    fetchDetails();
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteDetails) return;
    if (password !== confirmPassword) {
      toast({ title: "Error", description: "Passwords do not match.", variant: "destructive" });
      setAuthError(true);
      setTimeout(() => setAuthError(false), 1000);
      return;
    }
    
    setIsSubmitting(true);
    setAuthError(false);

    const result = await acceptInvite({ inviteId: inviteDetails.id, displayName, password });

    if (result.success) {
      toast({
        title: "Account Created!",
        description: "You have successfully joined. Please log in.",
        variant: "default",
      });
      router.push('/login');
    } else {
      toast({
        title: "Registration Failed",
        description: result.message,
        variant: "destructive",
      });
      setAuthError(true);
      setTimeout(() => setAuthError(false), 1000);
    }
    setIsSubmitting(false);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Validating your invitation...</p>
      </div>
    );
  }
  
  if (error) {
     return (
       <div className="flex flex-col items-center justify-center min-h-screen text-center">
         <XCircle className="h-16 w-16 text-destructive mb-4" />
         <h2 className="text-2xl font-bold">Invite Invalid</h2>
         <p className="text-muted-foreground mt-2 max-w-sm">{error}</p>
         <Button onClick={() => router.push('/login')} className="mt-6">Go to Login</Button>
       </div>
    );
  }

  if (!inviteDetails) {
     return <div className="p-4">An unexpected error occurred.</div>
  }

  return (
    <Card className={cn(
        "w-full max-w-md shadow-2xl border-border/50",
        authError && "animate-shake"
      )}>
        <CardHeader className="text-center p-8 bg-muted/30">
          <div className="mx-auto mb-4 bg-primary text-primary-foreground rounded-full p-3 w-fit ring-4 ring-background">
            <CheckCircle size={28} />
          </div>
          <CardTitle className="text-2xl font-semibold font-headline text-foreground">
            You're Invited!
          </CardTitle>
          <CardDescription>
            Join <span className="font-bold">{inviteDetails.organizationName}</span> on FieldOps.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 md:p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
             <div className="space-y-1">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={inviteDetails.email} readOnly disabled />
            </div>
            <div className="space-y-1">
              <Label htmlFor="displayName">Full Name</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  id="displayName" 
                  type="text" 
                  value={displayName} 
                  onChange={(e) => setDisplayName(e.target.value)} 
                  required 
                  className="pl-10" 
                />
              </div>
            </div>
             <div className="space-y-1">
              <Label htmlFor="password">Set Your Password</Label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className="pl-10" />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="confirmPassword" type="password" placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={6} className="pl-10" />
              </div>
            </div>
             <div className="space-y-1">
              <Label>Assigned Role</Label>
              <Input value={inviteDetails.role.charAt(0).toUpperCase() + inviteDetails.role.slice(1)} readOnly disabled />
            </div>
            <Button type="submit" className="w-full bg-accent hover:bg-accent/90 text-accent-foreground h-11 text-base font-semibold" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : "Create Account & Join"}
            </Button>
          </form>
        </CardContent>
    </Card>
  );
}


export default function JoinPageWrapper() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin"/></div>}>
      <main className="flex items-center justify-center min-h-screen bg-background p-4">
        <JoinPageContent />
      </main>
    </Suspense>
  )
}
