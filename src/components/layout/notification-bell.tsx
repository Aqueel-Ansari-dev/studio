"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/context/auth-context";
import { db } from "@/lib/firebase";
import { collection, query, where, orderBy, onSnapshot, updateDoc, doc } from "firebase/firestore";
import type { Notification } from "@/types/database";
import Link from "next/link";

export function NotificationBell() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "notifications"),
      where("userId", "==", user.id),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Notification) }));
      setNotifications(data);
    });
    return unsub;
  }, [user]);

  const unread = notifications.filter((n) => !n.read).length;

  const markAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, "notifications", id), { read: true });
    } catch (err) {
      console.error("Failed to mark notification as read", err);
    }
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <button className="relative h-8 w-8 inline-flex items-center justify-center">
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <Badge className="absolute -top-1 -right-1 rounded-full px-1 py-0 text-[10px]">
              {unread}
            </Badge>
          )}
          <span className="sr-only">Open notifications</span>
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="w-80 sm:w-96">
        <SheetHeader>
          <SheetTitle>Notifications</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-4">
          {notifications.length === 0 && (
            <p className="text-sm text-muted-foreground">No notifications</p>
          )}
          {notifications.map((n) => (
            <div key={n.id} className="border-b pb-2 text-sm">
              <p className="font-medium">{n.title}</p>
              <p>{n.body}</p>
              {n.relatedTaskId && (
                <Link
                  href={`/dashboard/supervisor/task-monitor?taskId=${n.relatedTaskId}`}
                  className="text-primary underline text-xs"
                >
                  View Task
                </Link>
              )}
              {!n.read && (
                <button
                  onClick={() => markAsRead(n.id)}
                  className="ml-2 text-blue-500 text-xs"
                >
                  Mark as read
                </button>
              )}
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
