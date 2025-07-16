
"use client";

import React, { useState, useEffect } from 'react';
import { motion, useInView } from 'framer-motion';
import { Briefcase, CheckCircle, Rocket, Users, Zap, DollarSign, UserPlus, ClipboardList, Send, BarChart } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from '@/components/ui/card';
import OrganizationSignupCTA from '@/components/landing/organization-signup-cta';
import { Badge } from '@/components/ui/badge';
import { getPlans, type PlanDetails } from '@/lib/plans';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';


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
      { step < 4 && <div className="w-px h-16 bg-border mt-2"></div> }
    </div>
    <div>
      <h3 className="text-lg font-semibold mb-1 font-headline">Step {step}: {title}</h3>
      <p className="text-muted-foreground">{description}</p>
    </div>
  </div>
);

const AnimatedSection = ({ children, className }: { children: React.ReactNode, className?: string }) => {
  const ref = React.useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.2 });

  return (
    <motion.section
      ref={ref}
      initial={{ opacity: 0, y: 50 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.section>
  );
};

export default function LandingPage() {
  const [plans, setPlans] = useState<PlanDetails[]>([])
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

  useEffect(() => {
    async function loadPlans() {
      const fetched = await getPlans();
      // Filter out the free plan and plans that require contacting sales, then sort by price
      setPlans(fetched.filter(p => p.id !== 'free' && !p.contactUs).sort((a, b) => (a.priceMonthly > b.priceMonthly) ? 1 : -1));
    }
    loadPlans();
  }, [])

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
        <AnimatedSection className="py-24 bg-muted/50">
          <div id="features" className="container mx-auto px-4">
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
        </AnimatedSection>
        
        {/* How It Works Section */}
        <AnimatedSection className="py-24">
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
        </AnimatedSection>

        {/* Pricing Section */}
        <AnimatedSection id="pricing" className="py-24 bg-muted/50">
            <div className="container mx-auto px-4">
              <h2 className="text-3xl font-bold text-center font-headline mb-4">Transparent Pricing</h2>
              <p className="text-muted-foreground text-center max-w-2xl mx-auto mb-8">Choose the plan that's right for your team. Start free and upgrade as you grow.</p>
              <div className="flex justify-center mb-8">
                <Tabs
                  value={billingCycle}
                  onValueChange={(value) => setBillingCycle(value as "monthly" | "yearly")}
                  className="w-[200px]"
                >
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="monthly">Monthly</TabsTrigger>
                    <TabsTrigger value="yearly">Yearly</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                {plans.map((plan) => (
                  <Card
                    key={plan.name}
                    className={cn(
                      "flex flex-col justify-between transition-all border-2",
                      plan.recommended ? "border-primary shadow-lg" : "border-border"
                    )}
                  >
                    <CardHeader className="pb-4">
                      <div className="flex justify-between items-center mb-2">
                        <CardTitle className="text-xl font-bold">{plan.name}</CardTitle>
                        {plan.recommended && <Badge variant="default">Recommended</Badge>}
                      </div>
                      <p className="text-4xl font-bold">
                          INR{" "}
                          {billingCycle === "monthly"
                            ? plan.priceMonthly
                            : plan.priceYearly}
                          <span className="text-base font-normal text-muted-foreground">
                            /{billingCycle === 'monthly' ? 'month' : 'year'}
                          </span>
                      </p>
                      <p className="text-sm text-muted-foreground">Up to {plan.userLimit} users</p>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm flex-grow">
                      {plan.features.map((feature, index) => (
                        <div key={index} className="flex items-center">
                          <CheckCircle className="mr-2 h-4 w-4 text-primary" /> {feature}
                        </div>
                      ))}
                    </CardContent>
                    <CardFooter className="p-6 pt-4">
                       <Button asChild className="w-full text-lg h-12" variant={plan.recommended ? 'default' : 'outline'}>
                         <Link href="/register">Choose Plan</Link>
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            </div>
        </AnimatedSection>


        {/* Testimonials Section */}
        <AnimatedSection className="py-24">
            <div className="container mx-auto px-4">
              <h2 className="text-3xl font-bold text-center font-headline mb-4">Trusted by Industry Leaders</h2>
              <p className="text-muted-foreground text-center max-w-2xl mx-auto mb-12">See how companies like yours are succeeding with FieldOps.</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                 <Card className="p-6">
                   <p className="text-muted-foreground mb-4">"FieldOps has been a game-changer for our project management. The real-time tracking and automated reporting save us hours every week."</p>
                   <div className="flex items-center gap-4">
                     <Avatar><AvatarImage src="https://placehold.co/40x40.png" alt="User" data-ai-hint="person construction" /><AvatarFallback>JD</AvatarFallback></Avatar>
                     <div><p className="font-semibold">John Doe</p><p className="text-sm text-muted-foreground">Project Manager, BuildWell Inc.</p></div>
                   </div>
                 </Card>
                 <Card className="p-6">
                   <p className="text-muted-foreground mb-4">"The mobile app is incredibly intuitive for our field team. Attendance and task updates are now seamless, which has dramatically improved our payroll accuracy."</p>
                   <div className="flex items-center gap-4">
                     <Avatar><AvatarImage src="https://placehold.co/40x40.png" alt="User" data-ai-hint="woman architect" /><AvatarFallback>JS</AvatarFallback></Avatar>
                     <div><p className="font-semibold">Jane Smith</p><p className="text-sm text-muted-foreground">Operations Head, Spark Electricals</p></div>
                   </div>
                 </Card>
                 <Card className="p-6">
                   <p className="text-muted-foreground mb-4">"The AI compliance feature is like having an extra safety officer on every site. It helps us catch potential issues before they become problems."</p>
                   <div className="flex items-center gap-4">
                     <Avatar><AvatarImage src="https://placehold.co/40x40.png" alt="User" data-ai-hint="man engineer" /><AvatarFallback>MA</AvatarFallback></Avatar>
                     <div><p className="font-semibold">Mike Anderson</p><p className="text-sm text-muted-foreground">Owner, Interior Creations</p></div>
                   </div>
                 </Card>
              </div>
            </div>
        </AnimatedSection>


        {/* Final CTA Section */}
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
