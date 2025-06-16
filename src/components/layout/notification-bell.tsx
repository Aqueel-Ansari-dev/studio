
"use client";

import { useEffect, useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/context/auth-context";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { collection, query, where, orderBy, onSnapshot, updateDoc, doc, Timestamp } from "firebase/firestore";
import type { Notification } from "@/types/database";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns"; 
import { markAllNotificationsAsRead } from "@/app/actions/notificationsUtils";

export function NotificationBell() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false);

  useEffect(() => {
    if (!user?.id) { 
        setNotifications([]); 
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
          const createdAtDate = docData.createdAt instanceof Timestamp 
                                ? docData.createdAt.toDate() 
                                : new Date(); 
          return { 
              id: d.id, 
              ...(docData as Omit<Notification, 'id' | 'createdAt'>),
              createdAt: createdAtDate as any 
          };
      });
      setNotifications(data as Notification[]);
    });
    return unsub;
  }, [user?.id]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, "notifications", id), { read: true });
    } catch (err) {
      console.error("Failed to mark notification as read", err);
      toast({ title: "Error", description: "Could not mark notification as read.", variant: "destructive" });
    }
  };
  
  const handleMarkAllRead = async () => {
    if (!user?.id || unreadCount === 0) return;
    setIsMarkingAllRead(true);
    const result = await markAllNotificationsAsRead(user.id);
    if (result.success) {
      toast({ title: "Notifications Updated", description: result.message });
      // Firestore listener will update the UI automatically
    } else {
      toast({ title: "Error", description: result.message, variant: "destructive" });
    }
    setIsMarkingAllRead(false);
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
            if (user?.role === 'supervisor' || user?.role === 'admin') {
                return `/dashboard/supervisor/task-monitor?taskId=${item.relatedItemId}`;
            }
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
                <div className="flex justify-between items-center">
                  <SheetTitle>Notifications</SheetTitle>
                  {unreadCount > 0 && (
                    <Button 
                      variant="link" 
                      size="sm" 
                      onClick={handleMarkAllRead} 
                      disabled={isMarkingAllRead}
                      className="text-primary hover:text-primary/80 p-0 h-auto"
                    >
                      <CheckCheck className="mr-1 h-4 w-4" /> Mark all as read
                    </Button>
                  )}
                </div>
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
                        {n.createdAt instanceof Date 
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
                           const sheetCloseButton = document.querySelector('[data-radix-dialog-default-open="false"]'); 
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
