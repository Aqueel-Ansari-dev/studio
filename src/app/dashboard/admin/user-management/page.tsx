
"use client";

import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";

export default function UserManagementPage() {
  return (
    <div className="space-y-6">
      <PageHeader 
        title="User Management" 
        description="Add, edit, and manage user accounts and roles."
        actions={
          <Button className="bg-accent hover:bg-accent/90 text-accent-foreground">
            <PlusCircle className="mr-2 h-4 w-4" /> Add New User
          </Button>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle className="font-headline">User List</CardTitle>
          <CardDescription>Displaying all users in the system. (Placeholder)</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            User management interface with table, search, filters, and actions (edit, delete, change role) will be implemented here.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
