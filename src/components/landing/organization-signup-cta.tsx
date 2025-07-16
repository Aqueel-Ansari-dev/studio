
"use client";

import React from 'react';
import { motion, useInView } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { Rocket } from 'lucide-react';
import { useRef } from 'react';
import Link from 'next/link';

interface OrganizationSignupCTAProps {}

const OrganizationSignupCTA: React.FC<OrganizationSignupCTAProps> = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.5 });

  const ctaVariants = {
    hidden: { opacity: 0, y: 50 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
  };

  return (
    <section className="py-24 bg-muted/50">
      <div className="container mx-auto px-4">
        <motion.div
          ref={ref}
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          variants={ctaVariants}
          className="bg-card rounded-lg p-8 md:p-12 text-center shadow-lg border"
        >
          <h2 className="text-3xl md:text-4xl font-bold font-headline mb-4">
            Ready to Streamline Your Operations?
          </h2>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            Join hundreds of teams building better, faster, and smarter with FieldOps. Start your free trial today—no credit card required.
          </p>
          <Button size="lg" asChild className="text-lg">
            <Link href="/register">
              <Rocket className="mr-2 h-5 w-5"/> Start Your Free Trial
            </Link>
          </Button>
        </motion.div>
      </div>
    </section>
  );
};

export default OrganizationSignupCTA;
