
"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Briefcase, CheckCircle, Rocket, Users, Zap, DollarSign } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
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
              Manage Your Field Operations, <span className="text-primary">Effortlessly</span>.
            </h1>
            <p className="mt-6 max-w-3xl mx-auto text-lg text-muted-foreground">
              From task assignment and GPS-based attendance to compliance checks and invoicing, FieldOps is the all-in-one platform to streamline your on-site work.
            </p>
            <div className="mt-8 flex justify-center gap-4">
              <Button size="lg" asChild className="text-lg">
                <Link href="/register">Get Started For Free</Link>
              </Button>
              <Button size="lg" variant="outline" asChild className="text-lg">
                <Link href="#features">Learn More</Link>
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
              <FeatureCard icon={Rocket} title="Streamlined Onboarding" description="Get your entire organization set up and operational in minutes with our guided process." />
              <FeatureCard icon={DollarSign} title="Integrated Billing" description="Generate and send invoices, manage payroll, and track project expenses, all in one place." />
              <FeatureCard icon={Briefcase} title="Role-Based Dashboards" description="Customized views for every role, ensuring everyone sees what they need to succeed." />
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
