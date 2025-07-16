
"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Briefcase, CheckCircle, Rocket, Users, Zap, DollarSign, UserPlus, ClipboardList, Send, BarChart } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import OrganizationSignupCTA from '@/components/landing/organization-signup-cta';
import { Badge } from '@/components/ui/badge';

const FeatureCard = ({ icon, title, description }: { icon: React.ElementType, title: string, description: string }) => (
  <Card className="text-center p-6 bg-card/50 hover:shadow-lg transition-shadow">
    <div className="mb-4 text-primary w-12 h-12 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
      {React.createElement(icon, { className: "w-6 h-6" })}
    </div>
    <CardTitle className="text-lg font-semibold font-headline mb-2">{title}</CardTitle>
    <CardContent className="text-muted-foreground text-sm p-0">{description}</CardContent>
  </Card>
);

const HowItWorksStep = ({ icon, title, description, step }: { icon: React.ElementType, title: string, description: string, step: number }) => (
  <div className="flex items-start gap-4">
    <div className="flex flex-col items-center">
      <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 text-primary font-bold text-xl">
        {React.createElement(icon, { className: "w-6 h-6" })}
      </div>
      <div className="w-px h-16 bg-border mt-2"></div>
    </div>
    <div>
      <h3 className="text-lg font-semibold mb-1 font-headline">Step {step}: {title}</h3>
      <p className="text-muted-foreground">{description}</p>
    </div>
  </div>
);


export default function LandingPage() {
  return (
    <div className="bg-background text-foreground">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
          <Link href="/" className="flex items-center gap-2">
            <Briefcase className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold font-headline">FieldOps</span>
          </Link>
          <nav className="flex items-center gap-4">
            <Button variant="ghost" asChild>
              <Link href="/login">Login</Link>
            </Button>
            <Button asChild>
              <Link href="/register">Get Started</Link>
            </Button>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <main className="pt-16">
        <section className="py-24 md:py-32 text-center container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Badge variant="outline" className="mb-4 border-primary/50 text-primary">Now with AI-powered Compliance Checks</Badge>
            <h1 className="text-4xl md:text-6xl font-bold font-headline tracking-tight">
              Transform Your Field Operations. <span className="text-primary">One Powerful Platform.</span>
            </h1>
            <p className="mt-6 max-w-3xl mx-auto text-lg text-muted-foreground">
              Manage teams, track projects, automate payroll, and improve field productivity — all in one place.
            </p>
            <div className="mt-8 flex justify-center gap-4">
              <Button size="lg" asChild className="text-lg animate-pulse hover:animate-none">
                <Link href="/register">Get Started Free</Link>
              </Button>
            </div>
          </motion.div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-24 bg-muted/50">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold text-center font-headline mb-4">Everything Your Field Team Needs</h2>
            <p className="text-muted-foreground text-center max-w-2xl mx-auto mb-12">
              Empower your employees, supervisors, and admins with tools designed for their specific roles, ensuring smooth operations from the field to the office.
            </p>
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              <FeatureCard icon={Zap} title="Task Management" description="Assign tasks, track progress with start/stop timers, and manage workflows with ease." />
              <FeatureCard icon={Users} title="Team Attendance" description="Use GPS-verified, selfie-based login to ensure your team is on-site and on time." />
              <FeatureCard icon={CheckCircle} title="AI Compliance Checks" description="Leverage AI to analyze task media for compliance risks and get actionable insights." />
              <FeatureCard icon={DollarSign} title="Payroll & Expenses" description="Automate payroll calculations based on work hours and approved expenses." />
              <FeatureCard icon={BarChart} title="Analytics Dashboard" description="Get a high-level view of project costs, team productivity, and overall progress." />
              <FeatureCard icon={Briefcase} title="Role-Based Dashboards" description="Customized views for every role, ensuring everyone sees what they need to succeed." />
            </div>
          </div>
        </section>
        
        {/* How It Works Section */}
        <section className="py-24">
            <div className="container mx-auto px-4">
                <h2 className="text-3xl font-bold text-center font-headline mb-4">Get Started in Minutes</h2>
                <p className="text-muted-foreground text-center max-w-2xl mx-auto mb-12">
                    Onboarding your organization is simple and fast. Follow these easy steps to revolutionize your field operations.
                </p>
                <div className="max-w-md mx-auto">
                    <HowItWorksStep 
                        step={1} 
                        icon={Rocket} 
                        title="Register Your Organization" 
                        description="Sign up and create your organization's dedicated workspace in under a minute." 
                    />
                    <HowItWorksStep 
                        step={2} 
                        icon={UserPlus} 
                        title="Onboard Your Team" 
                        description="Invite your supervisors and employees via email. They can join and set up their accounts instantly." 
                    />
                    <HowItWorksStep 
                        step={3} 
                        icon={ClipboardList} 
                        title="Assign Tasks" 
                        description="Create projects and start assigning tasks to your team members with due dates and instructions." 
                    />
                    <HowItWorksStep 
                        step={4} 
                        icon={Send} 
                        title="Go Live!" 
                        description="Your team can now use FieldOps on their mobile devices to track time, complete tasks, and log expenses." 
                    />
                </div>
            </div>
        </section>

        {/* CTA Section */}
        <OrganizationSignupCTA />
      </main>

      {/* Footer */}
      <footer className="bg-background border-t">
        <div className="container mx-auto py-6 px-4 md:px-6 text-center text-muted-foreground text-sm">
          &copy; {new Date().getFullYear()} FieldOps. All Rights Reserved.
        </div>
      </footer>
    </div>
  );
}
