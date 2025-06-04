
"use client";

import { useState, useEffect }_ROOT_SIMULATION_SLEEP_MS from 'react';
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle, FileSearch, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { analyzeComplianceRisk, ComplianceRiskAnalysisOutput } from "@/ai/flows/compliance-risk-analysis";
import Image from "next/image";

interface ComplianceReportItem {
  id: string;
  taskId: string;
  taskName: string;
  employeeName: string;
  employeeAvatar: string;
  submissionDate: string;
  status: 'compliant' | 'non-compliant' | 'pending-review';
  aiAnalysis?: ComplianceRiskAnalysisOutput;
  isLoadingAi?: boolean;
  mediaDataUriMock?: string; // For AI flow simulation
  locationDataMock?: string;
  supervisorNotesMock?: string;
}

const mockComplianceItems: ComplianceReportItem[] = [
  { id: "cr1", taskId: "task1a", taskName: "Install Workstations", employeeName: "Alice Smith", employeeAvatar: "https://placehold.co/40x40.png?text=AS", submissionDate: "2024-07-28", status: "pending-review", mediaDataUriMock: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/200", locationDataMock: "34.05N, 118.24W", supervisorNotesMock: "Standard installation, photo of setup required." },
  { id: "cr2", taskId: "task2b", taskName: "Plumbing Check - Apt 101", employeeName: "Bob Johnson", employeeAvatar: "https://placehold.co/40x40.png?text=BJ", submissionDate: "2024-07-27", status: "compliant" },
  { id: "cr3", taskId: "task-xyz", taskName: "Safety Equipment Check", employeeName: "David Brown", employeeAvatar: "https://placehold.co/40x40.png?text=DB", submissionDate: "2024-07-29", status: "pending-review", mediaDataUriMock: "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", locationDataMock: "33.90N, 118.10W", supervisorNotesMock: "Ensure all safety gear is visible in photo." },
];

export default function ComplianceReportsPage() {
  const [reports, setReports] = useState<ComplianceReportItem[]>(mockComplianceItems);
  const { toast } = useToast();

  const runAiComplianceCheck = async (reportId: string) => {
    setReports(prevReports => prevReports.map(report => report.id === reportId ? { ...report, isLoadingAi: true } : report));
    
    const reportToAnalyze = reports.find(report => report.id === reportId);
    if (!reportToAnalyze || !reportToAnalyze.mediaDataUriMock || !reportToAnalyze.locationDataMock || !reportToAnalyze.supervisorNotesMock) {
        toast({ title: "AI Error", description: "Missing data for AI analysis.", variant: "destructive" });
        setReports(prevReports => prevReports.map(report => report.id === reportId ? { ...report, isLoadingAi: false } : report));
        return;
    }

    try {
      const aiResult = await analyzeComplianceRisk({
        mediaDataUri: reportToAnalyze.mediaDataUriMock,
        locationData: reportToAnalyze.locationDataMock,
        supervisorNotes: reportToAnalyze.supervisorNotesMock,
      });

      setReports(prevReports => prevReports.map(report => 
        report.id === reportId ? { ...report, aiAnalysis: aiResult, isLoadingAi: false } : report
      ));
      toast({ title: "AI Compliance Check Complete", description: `Analysis for task "${reportToAnalyze.taskName}" finished.` });
    } catch (error) {
      console.error("AI Compliance Check Error:", error);
      setReports(prevReports => prevReports.map(report => report.id === reportId ? { ...report, isLoadingAi: false } : report));
      toast({ title: "AI Error", description: "Could not complete AI compliance check.", variant: "destructive" });
    }
  };

  const handleComplianceAction = (reportId: string, newStatus: 'compliant' | 'non-compliant') => {
    setReports(prevReports => prevReports.map(report => 
      report.id === reportId ? { ...report, status: newStatus, aiAnalysis: undefined } : report // Clear AI analysis after action
    ));
    const taskName = reports.find(r => r.id === reportId)?.taskName;
    toast({ title: `Compliance ${newStatus.charAt(0).toUpperCase() + newStatus.slice(1)}`, description: `Task "${taskName}" has been marked as ${newStatus}.`});
  };

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Task Compliance Reports" 
        description="Review task submissions for compliance, with AI-powered assistance."
      />

      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Submissions for Review</CardTitle>
          <CardDescription>Tasks flagged or pending compliance verification.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Task</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>AI Insights</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reports.filter(report => report.status === 'pending-review').map((report) => (
                <TableRow key={report.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Image src={report.employeeAvatar} alt={report.employeeName} width={32} height={32} className="rounded-full" data-ai-hint="employee avatar"/>
                      <span className="font-medium">{report.employeeName}</span>
                    </div>
                  </TableCell>
                  <TableCell>{report.taskName}</TableCell>
                  <TableCell>{report.submissionDate}</TableCell>
                  <TableCell>
                    <Badge variant={report.status === 'compliant' ? 'default' : report.status === 'non-compliant' ? 'destructive' : 'outline'}
                    className={report.status === 'compliant' ? 'bg-green-500 text-white' : report.status === 'pending-review' ? 'border-yellow-500 text-yellow-600' : ''}>
                      {report.status.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {report.isLoadingAi ? (
                      <span className="text-xs text-muted-foreground">Analyzing...</span>
                    ) : report.aiAnalysis ? (
                      report.aiAnalysis.complianceRisks.length > 0 ? (
                        <div className="text-xs text-destructive">
                          <p className="flex items-center"><AlertTriangle className="w-4 h-4 mr-1" />Risks: {report.aiAnalysis.complianceRisks.join(', ')}</p>
                          <p className="mt-1">Info needed: {report.aiAnalysis.additionalInformationNeeded}</p>
                        </div>
                      ) : (
                        <div className="text-xs text-green-600 flex items-center">
                          <CheckCircle className="w-4 h-4 mr-1" />
                          No immediate risks detected.
                        </div>
                      )
                    ) : (
                      <Button variant="link" size="sm" onClick={() => runAiComplianceCheck(report.id)} className="p-0 h-auto text-xs">Run AI Check</Button>
                    )}
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button variant="outline" size="sm" onClick={() => handleComplianceAction(report.id, 'non-compliant')} className="border-destructive text-destructive hover:bg-destructive/10">Mark Non-Compliant</Button>
                    <Button size="sm" onClick={() => handleComplianceAction(report.id, 'compliant')} className="bg-green-500 hover:bg-green-600">Mark Compliant</Button>
                  </TableCell>
                </TableRow>
              ))}
              {reports.filter(report => report.status === 'pending-review').length === 0 && (
                 <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No compliance reports currently require review.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Processed Compliance Reports</CardTitle>
        </CardHeader>
        <CardContent>
           <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Task</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
             {reports.filter(report => report.status !== 'pending-review').map((report) => (
                <TableRow key={report.id}>
                    <TableCell>
                        <div className="flex items-center gap-2">
                         <Image src={report.employeeAvatar} alt={report.employeeName} width={32} height={32} className="rounded-full" data-ai-hint="employee avatar"/>
                        <span className="font-medium">{report.employeeName}</span>
                        </div>
                    </TableCell>
                    <TableCell>{report.taskName}</TableCell>
                    <TableCell>
                        <Badge variant={report.status === 'compliant' ? 'default' : 'destructive'}
                        className={report.status === 'compliant' ? 'bg-green-500 text-white' : ''}>
                        {report.status.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </Badge>
                    </TableCell>
                </TableRow>
             ))}
             {reports.filter(report => report.status !== 'pending-review').length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    No processed compliance reports yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
           </Table>
        </CardContent>
       </Card>
    </div>
  );
}
