
"use client";

import React from 'react';
import { motion, useInView } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { Rocket } from 'lucide-react';
import { useRef } from 'react';

interface OrganizationSignupCTAProps {}

const OrganizationSignupCTA: React.FC<OrganizationSignupCTAProps> = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.5 }); // Trigger when 50% in view

  const ctaVariants = {
    hidden: { opacity: 0, y: 50 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
  };

  return (
    <section className="py-16 md:py-24 bg-gradient-to-r from-primary/10 to-accent/10 dark:from-primary/20 dark:to-accent/20 text-center relative overflow-hidden">
      <div className="container mx-auto px-4 max-w-6xl">
        <motion.div
          ref={ref}
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          variants={ctaVariants}
        >
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 text-foreground leading-tight">
            Start managing your field teams better
          </h2>
          <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Register your organization & onboard your team in minutes.
          </p>

          <Button
            size="lg"
            className="py-3 px-8 text-lg md:text-xl font-semibold rounded-full shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 bg-primary text-primary-foreground"
            onClick={() => {
              // TODO: Replace with actual registration route
              window.location.href = "/register";
            }}
          >
            Register Organization
          </Button>

          <div className="mt-12 md:mt-16 relative">
            {/* Placeholder for Illustration */}
            <div className="relative w-full max-w-3xl mx-auto h-64 md:h-80 bg-primary/20 rounded-lg flex items-center justify-center text-primary-foreground/50 overflow-hidden shadow-xl">
              <Rocket className="h-24 w-24 md:h-32 md:w-32 text-primary/50 animate-pulse" />
              <div className="absolute -bottom-10 left-0 right-0 h-20 bg-gradient-to-t from-primary/30 to-transparent" />
              <div className="absolute -top-10 left-0 right-0 h-20 bg-gradient-to-b from-primary/30 to-transparent" />
              <p className="absolute bottom-4 text-sm md:text-base">Illustration: Field Operations Management</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Testimonials Section Placeholder */}
      <div className="mt-20 md:mt-32 px-4 container mx-auto max-w-6xl">
        <h3 className="text-2xl md:text-3xl font-bold mb-10 text-foreground">What our users say:</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <div className="bg-card p-6 rounded-lg shadow-md text-left">
            <p className="text-lg font-semibold text-foreground mb-3">"A game changer for our business!"</p>
            <p className="text-muted-foreground text-sm">"FieldOps has revolutionized how we manage our on-site teams. The efficiency gains are incredible."
            </p>
            <p className="mt-4 text-sm font-medium text-right text-primary">- Alex, Construction Manager</p>
          </div>
          <div className="bg-card p-6 rounded-lg shadow-md text-left">
            <p className="text-lg font-semibold text-foreground mb-3">"Intuitive and powerful."</p>
            <p className="text-muted-foreground text-sm">"From task assignment to progress tracking, everything is seamless. Highly recommended for any field service company."
            </p>
            <p className="mt-4 text-sm font-medium text-right text-primary">- Maria, Operations Head</p>
          </div>
          <div className="bg-card p-6 rounded-lg shadow-md text-left">
            <p className="text-lg font-semibold text-foreground mb-3">"Excellent support and features."</p>
            <p className="text-muted-foreground text-sm">"The team behind FieldOps is responsive, and the features cover all our needs for managing a large field team."
            </p>
            <p className="mt-4 text-sm font-medium text-right text-primary">- David, Electrical Contractor</p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default OrganizationSignupCTA;
