
"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/context/auth-context";
import { db } from "@/lib/firebase";
import { collection, query, where, orderBy, onSnapshot, updateDoc, doc, Timestamp } from "firebase/firestore";
import type { Notification } from "@/types/database";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns"; 

export function NotificationBell() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    if (!user?.id) { // Ensure user.id is present
        setNotifications([]); // Clear notifications if no user
        return;
    }
    const q = query(
      collection(db, "notifications"),
      where("userId", "==", user.id),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => {
          const docData = d.data();
          // Ensure createdAt is a Date object for formatDistanceToNow
          const createdAtDate = docData.createdAt instanceof Timestamp 
                                ? docData.createdAt.toDate() 
                                : new Date(); // Fallback or handle as error
          return { 
              id: d.id, 
              ...(docData as Omit<Notification, 'id' | 'createdAt'>),
              createdAt: createdAtDate as any // Keep as Date object for direct use
          };
      });
      setNotifications(data as Notification[]);
    });
    return unsub;
  }, [user]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, "notifications", id), { read: true });
    } catch (err) {
      console.error("Failed to mark notification as read", err);
    }
  };

  const getTooltipContent = () => {
    if (unreadCount === 0) return "No new notifications";
    if (unreadCount === 1) return "1 unread notification";
    return `${unreadCount} unread notifications`;
  };
  
  const getRelatedItemLink = (item: Notification): string | null => {
    if (!item.relatedItemId || !item.relatedItemType) return null;
    switch(item.relatedItemType) {
        case 'task':
            // Assuming supervisors/admins view tasks in task-monitor or compliance-reports
            // This might need adjustment based on specific roles or more granular task views
            if (user?.role === 'supervisor' || user?.role === 'admin') {
                return `/dashboard/supervisor/task-monitor?taskId=${item.relatedItemId}`;
            }
            // Employees might view tasks in their project task list
            // This requires knowing the project ID for the task, which isn't in the notification directly.
            // For now, tasks are supervisor/admin focused from notifications.
            return null; 
        case 'expense':
             if (user?.role === 'supervisor' || user?.role === 'admin') {
                return `/dashboard/supervisor/expense-review?expenseId=${item.relatedItemId}`;
            }
            return null;
        case 'leave_request':
            if (user?.role === 'supervisor' || user?.role === 'admin') {
                return `/dashboard/admin/leave-review?leaveId=${item.relatedItemId}`;
            }
            return null;
        // Add more cases for 'attendance_log', 'user', 'project' if specific views exist
        default:
            return null;
    }
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Sheet>
            <SheetTrigger asChild>
              <button className="relative h-8 w-8 inline-flex items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <Badge className="absolute -top-1 -right-1 rounded-full px-1 py-0 text-[10px] h-4 min-w-[1rem] flex items-center justify-center">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </Badge>
                )}
                <span className="sr-only">Open notifications</span>
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full max-w-md sm:max-w-lg flex flex-col">
              <SheetHeader className="pb-4 border-b">
                <SheetTitle>Notifications</SheetTitle>
              </SheetHeader>
              <div className="flex-1 overflow-y-auto py-4 space-y-3">
                {notifications.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-10">No notifications yet.</p>
                )}
                {notifications.map((n) => {
                  const itemLink = getRelatedItemLink(n);
                  return (
                  <div 
                    key={n.id} 
                    className={`p-3 rounded-lg border ${n.read ? 'bg-muted/50 opacity-70' : 'bg-background shadow-sm'}`}
                  >
                    <div className="flex justify-between items-start">
                      <p className="font-medium text-sm">{n.title}</p>
                      {!n.read && <Badge variant="destructive" className="text-xs px-1.5 py-0.5">New</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{n.body}</p>
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-xs text-muted-foreground">
                        {n.createdAt instanceof Date // Now createdAt is a Date object
                          ? formatDistanceToNow(n.createdAt, { addSuffix: true })
                          : 'Unknown time'}
                      </span>
                      {!n.read && (
                        <button
                          onClick={() => markAsRead(n.id)}
                          className="text-primary hover:underline text-xs font-medium"
                        >
                          Mark as read
                        </button>
                      )}
                    </div>
                     {itemLink && (
                      <Link
                        href={itemLink}
                        className="text-primary hover:underline text-xs block mt-1"
                        onClick={() => {
                           const sheetCloseButton = document.querySelector('[data-radix-dialog-default-open="false"]'); // Radix uses data-radix-dialog-default-open for sheet's internal dialog
                           if(sheetCloseButton instanceof HTMLElement) sheetCloseButton.click();
                        }}
                      >
                        View Details
                      </Link>
                    )}
                  </div>
                )})}
              </div>
            </SheetContent>
          </Sheet>
        </TooltipTrigger>
        <TooltipContent side="bottom" align="center">
          <p>{getTooltipContent()}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

    