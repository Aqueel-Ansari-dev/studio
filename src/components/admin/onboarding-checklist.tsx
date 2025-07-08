
"use client";

import React, { useState } from 'react';
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { motion } from 'framer-motion';
import { Settings, Users, Briefcase, MessageSquare, DollarSign, CalendarDays } from 'lucide-react';

interface OnboardingTask {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  completed: boolean;
}

const OnboardingChecklist: React.FC = () => {
  const [tasks, setTasks] = useState<OnboardingTask[]>([
    {
      id: "company-logo",
      label: "Upload Company Logo",
      description: "Add your company's logo for branding across the platform.",
      icon: <Settings className="h-5 w-5 text-primary" />,
      completed: false,
    },
    {
      id: "add-projects",
      label: "Add Your First Project(s)",
      description: "Create your initial projects to start assigning tasks.",
      icon: <Briefcase className="h-5 w-5 text-primary" />,
      completed: false,
    },
    {
      id: "invite-users",
      label: "Invite Supervisors & Employees",
      description: "Bring your team into FieldOps by inviting them.",
      icon: <Users className="h-5 w-5 text-primary" />,
      completed: false,
    },
    {
      id: "assign-roles",
      label: "Assign Roles (Supervisor, Employee)",
      description: "Define roles for your team members to manage permissions.",
      icon: <Users className="h-5 w-5 text-primary" />,
      completed: false,
    },
    {
      id: "leave-pay-settings",
      label: "Setup Leave & Payroll Settings",
      description: "Configure leave policies and payroll rules for your organization.",
      icon: <DollarSign className="h-5 w-5 text-primary" />,
      completed: false,
    },
    {
      id: "whatsapp-config",
      label: "Configure WhatsApp Number",
      description: "Enable WhatsApp alerts for real-time team communication.",
      icon: <MessageSquare className="h-5 w-5 text-primary" />,
      completed: false,
    },
  ]);

  const completedTasksCount = tasks.filter((task) => task.completed).length;
  const totalTasks = tasks.length;
  const progressValue = (completedTasksCount / totalTasks) * 100;

  const handleTaskCompletionChange = (taskId: string, checked: boolean) => {
    setTasks((prevTasks) =>
      prevTasks.map((task) =>
        task.id === taskId ? { ...task, completed: checked } : task
      )
    );
  };

  const itemVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: { opacity: 1, x: 0 },
  };

  return (
    <div className="bg-card p-6 rounded-lg shadow-lg max-w-2xl mx-auto">
      <h3 className="text-xl font-bold mb-6">Your Onboarding Checklist</h3>

      <div className="mb-6">
        <Progress value={progressValue} className="w-full h-3" />
        <p className="text-sm text-muted-foreground mt-2">
          {completedTasksCount} of {totalTasks} tasks completed
        </p>
      </div>

      <motion.div
        initial="hidden"
        animate="visible"
        variants={{
          visible: { transition: { staggerChildren: 0.07, delayChildren: 0.2 } },
        }}
        className="space-y-4"
      >
        {tasks.map((task) => (
          <motion.div
            key={task.id}
            variants={itemVariants}
            className={cn(
              "flex items-start p-3 rounded-md transition-colors duration-200",
              task.completed ? "bg-muted/30" : "hover:bg-muted/10"
            )}
          >
            <Checkbox
              id={task.id}
              checked={task.completed}
              onCheckedChange={(checked) =>
                handleTaskCompletionChange(task.id, checked as boolean)
              }
              className="mr-4 mt-1"
            />
            <div className="flex-1">
              <Label
                htmlFor={task.id}
                className={cn(
                  "text-base font-medium leading-none cursor-pointer",
                  task.completed && "line-through text-muted-foreground"
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                {task.icon} {task.label}
                </div>
              </Label>
              <p
                className={cn(
                  "text-sm text-muted-foreground",
                  task.completed && "line-through"
                )}
              >
                {task.description}
              </p>
            </div>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
};

export default OnboardingChecklist;
