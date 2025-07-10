
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
import { collection, query, where, orderBy, onSnapshot, updateDoc, doc, Timestamp, limit } from "firebase/firestore";
import type { Notification } from "@/types/database";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns"; 
import { markAllNotificationsAsRead } from "@/app/actions/notificationsUtils";

const NOTIFICATION_FETCH_LIMIT = 50;

export function NotificationBell() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false);

  useEffect(() => {
    if (!user?.id) { 
        setNotifications([]); 
        return;
    }
    const q = query(
      collection(db, "notifications"),
      where("userId", "==", user.id),
      orderBy("createdAt", "desc"),
      limit(NOTIFICATION_FETCH_LIMIT)
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
          category: docData.category || 'general',
          priority: docData.priority || 'normal',
          createdAt: createdAtDate as any,
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
                const status = (item.type === 'task-needs-review' || item.type === 'task-rejected-by-supervisor') ? 'needs-review' : 'all';
                return `/dashboard/supervisor/task-monitor?status=${status}`;
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
        case 'attendance_log':
             if (user?.role === 'supervisor' || user?.role === 'admin') {
                return `/dashboard/supervisor/attendance-review?logId=${item.relatedItemId}`;
            }
            return null;
        default:
            return null;
    }
  }

  const NotificationItem = ({ notification }: { notification: Notification }) => {
    const itemLink = getRelatedItemLink(notification);
    
    const content = (
      <div
        key={notification.id}
        className={`p-3 rounded-lg border ${notification.read ? 'bg-muted/50 opacity-70' : 'bg-background shadow-sm'}`}
      >
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-2 pr-2">
            <p className="font-medium text-sm">{notification.title}</p>
            {notification.priority !== 'normal' && (
              <Badge
                variant={notification.priority === 'critical' ? 'destructive' : 'secondary'}
                className="text-[10px] px-1.5 py-0.5 capitalize"
              >
                {notification.priority}
              </Badge>
            )}
          </div>
          {!notification.read && (
            <Badge variant="destructive" className="text-xs px-1.5 py-0.5">New</Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{notification.body}</p>
        <div className="flex justify-between items-center mt-2">
          <span className="text-xs text-muted-foreground">
            {notification.createdAt instanceof Date 
              ? formatDistanceToNow(notification.createdAt, { addSuffix: true })
              : 'Unknown time'}
          </span>
          {!notification.read && (
            <button
              onClick={(e) => { e.stopPropagation(); markAsRead(notification.id); }}
              className="text-primary hover:underline text-xs font-medium"
            >
              Mark as read
            </button>
          )}
        </div>
      </div>
    );

    if (itemLink) {
      return (
        <Link href={itemLink} onClick={() => setIsSheetOpen(false)} className="focus:outline-none focus:ring-2 focus:ring-ring rounded-lg">
          {content}
        </Link>
      );
    }
    return content;
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
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
                {notifications.map((n) => <NotificationItem key={n.id} notification={n} />)}
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
