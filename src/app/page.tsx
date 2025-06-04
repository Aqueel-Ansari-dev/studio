
"use client";

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, KeyRound, AtSign, UserCheck, Building } from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { useRouter } from 'next/navigation';
import Image from 'next/image';


export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'employee' | 'supervisor' | 'admin' | ''>('');
  const [isLocationVerified, setIsLocationVerified] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const { login, user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    setIsClient(true);
    if (!loading && user) {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (role === 'employee' && !isLocationVerified) {
      alert("Please verify your location for employee login.");
      return;
    }
    if (role) {
      login(email, role as 'employee' | 'supervisor' | 'admin');
    } else {
      alert("Please select a role.");
    }
  };

  const handleVerifyLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          // In a real app, you would send position.coords.latitude and position.coords.longitude
          // to the backend to verify against the assigned site coordinates.
          // For this demo, we'll just simulate success.
          console.log("Location obtained:", position.coords.latitude, position.coords.longitude);
          alert("Location verified successfully! (Mocked)");
          setIsLocationVerified(true);
        },
        (error) => {
          alert(`Error verifying location: ${error.message}. Please ensure location services are enabled.`);
          console.error("Geolocation error:", error);
          setIsLocationVerified(false);
        }
      );
    } else {
      alert("Geolocation is not supported by this browser.");
      setIsLocationVerified(false);
    }
  };
  
  if (loading || (!loading && user)) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="p-4">Loading...</div>
      </div>
    );
  }

  return (
    <main className="flex items-center justify-center min-h-screen bg-gradient-to-br from-primary/30 via-background to-background p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 bg-primary text-primary-foreground rounded-full p-3 w-fit">
            <Building size={36} />
          </div>
          <CardTitle className="text-3xl font-headline">FieldOps MVP</CardTitle>
          <CardDescription>Welcome back! Please login to your account.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input id="email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required className="pl-10" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input id="password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required className="pl-10" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <div className="relative">
                 <UserCheck className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Select onValueChange={(value) => setRole(value as 'employee' | 'supervisor' | 'admin')} value={role}>
                  <SelectTrigger id="role" className="pl-10">
                    <SelectValue placeholder="Select your role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="employee">Employee</SelectItem>
                    <SelectItem value="supervisor">Supervisor</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {role === 'employee' && isClient && (
              <Button type="button" variant="outline" onClick={handleVerifyLocation} className="w-full">
                <MapPin className="mr-2 h-4 w-4" />
                {isLocationVerified ? "Location Verified" : "Verify Location (GPS)"}
              </Button>
            )}
            <Button type="submit" className="w-full bg-accent hover:bg-accent/90 text-accent-foreground" disabled={(role === 'employee' && !isLocationVerified && isClient)}>
              Login
            </Button>
          </form>
        </CardContent>
        <CardFooter className="text-center text-sm text-muted-foreground">
          <p>Ensure you are at your assigned site for GPS verification if logging in as an employee.</p>
        </CardFooter>
      </Card>
    </main>
  );
}
