"use client";

import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";

export default function AboutPage() {
  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="About FieldOps MVP"
        description="Learn about the core features of this field operations management app."
      />
      <Card>
        <CardContent className="prose max-w-none p-6">
          <h2 className="font-headline text-xl mb-2">Core Features</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>GPS-Based Login for location verified access.</li>
            <li>Project Selection to view assigned projects.</li>
            <li>Task Management with start and stop timers.</li>
            <li>Task Submission supporting photo or video uploads.</li>
            <li>Automated Attendance tied to task activity.</li>
            <li>Supervisor Task Assignment dashboards.</li>
            <li>AI-Powered Compliance checks for flagged risks.</li>
          </ul>
          <h2 className="font-headline text-xl mt-6 mb-2">Style Highlights</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Primary color dusty blue <span className="font-mono">#6B8ECA</span>.</li>
            <li>Light gray background for a clean layout.</li>
            <li>Accent color muted orange <span className="font-mono">#D2691E</span>.</li>
            <li>PT Sans font for headings and body text.</li>
            <li>Mobile-first responsive design with subtle animations.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
