
'use server';

import { db } from '@/lib/firebase';
import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  serverTimestamp,
  Timestamp,
  doc,
  updateDoc,
  getDoc
} from 'firebase/firestore';
import type { AttendanceLog } from '@/types/database';
import { format } from 'date-fns';

interface ServerActionResult {
  success: boolean;
  message: string;
  error?: string;
}

export interface LogAttendanceResult extends ServerActionResult {
  attendanceId?: string;
  checkInTime?: string; // ISO string
}

export async function logAttendance(
  employeeId: string,
  projectId: string,
  gpsLocation: { lat: number; lng: number; accuracy?: number },
  autoLoggedFromTask: boolean = false
): Promise<LogAttendanceResult> {
  if (!employeeId || !projectId) {
    return { success: false, message: 'Employee ID and Project ID are required.' };
  }

  const todayDateString = format(new Date(), 'yyyy-MM-dd');

  // Check for existing open attendance log for today and this project
  const attendanceCollectionRef = collection(db, 'attendanceLogs');
  const qExisting = query(
    attendanceCollectionRef,
    where('employeeId', '==', employeeId),
    where('projectId', '==', projectId),
    where('date', '==', todayDateString),
    where('checkOutTime', '==', null), // Check for open logs specifically
    limit(1)
  );

  try {
    const existingSnapshot = await getDocs(qExisting);
    if (!existingSnapshot.empty) {
      const existingLog = existingSnapshot.docs[0].data() as AttendanceLog;
      const checkInTime = existingLog.checkInTime instanceof Timestamp ? existingLog.checkInTime.toDate().toISOString() : new Date().toISOString();
      return {
        success: true, // Or false if you consider this an "error" for UI
        message: 'Already checked in for this project today.',
        attendanceId: existingSnapshot.docs[0].id,
        checkInTime: checkInTime,
      };
    }

    const newAttendanceLog: Omit<AttendanceLog, 'id'> = {
      employeeId,
      projectId,
      date: todayDateString,
      checkInTime: serverTimestamp() as Timestamp, // Firestore will set this
      gpsLocationCheckIn: {
        lat: gpsLocation.lat,
        lng: gpsLocation.lng,
        accuracy: gpsLocation.accuracy,
        timestamp: Date.now(), // Client-side timestamp of GPS fix
      },
      autoLoggedFromTask,
      checkOutTime: null, // Explicitly set to null for new check-ins
      gpsLocationCheckOut: null,
    };

    const docRef = await addDoc(attendanceCollectionRef, newAttendanceLog);
    
    // Fetch the just created doc to get the server timestamp for checkInTime
    const newDocSnap = await getDoc(docRef);
    if (newDocSnap.exists()) {
        const createdLog = newDocSnap.data() as AttendanceLog;
        const checkInTime = createdLog.checkInTime instanceof Timestamp ? createdLog.checkInTime.toDate().toISOString() : new Date().toISOString();
        return {
            success: true,
            message: `Checked in successfully at ${format(new Date(checkInTime), 'p')}.`,
            attendanceId: docRef.id,
            checkInTime: checkInTime,
        };
    } else {
         return { success: true, message: 'Checked in successfully (timestamp pending).', attendanceId: docRef.id };
    }


  } catch (error) {
    console.error('Error logging attendance:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, message: `Failed to log attendance: ${errorMessage}`, error: errorMessage };
  }
}

export interface CheckoutAttendanceResult extends ServerActionResult {
  checkOutTime?: string; // ISO string
}

export async function checkoutAttendance(
  employeeId: string,
  projectId: string, // Require projectId to ensure checking out from correct log
  gpsLocation?: { lat: number; lng: number; accuracy?: number }
): Promise<CheckoutAttendanceResult> {
  if (!employeeId || !projectId) {
    return { success: false, message: 'Employee ID and Project ID are required for checkout.' };
  }

  const todayDateString = format(new Date(), 'yyyy-MM-dd');
  const attendanceCollectionRef = collection(db, 'attendanceLogs');

  // Find the most recent open attendance log for this employee, project, and date
  const q = query(
    attendanceCollectionRef,
    where('employeeId', '==', employeeId),
    where('projectId', '==', projectId),
    where('date', '==', todayDateString),
    where('checkOutTime', '==', null),
    orderBy('checkInTime', 'desc'),
    limit(1)
  );

  try {
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
      return { success: false, message: 'No active check-in found for this project today to checkout.' };
    }

    const attendanceDocRef = querySnapshot.docs[0].ref;
    const updates: Partial<AttendanceLog> = {
      checkOutTime: serverTimestamp() as Timestamp,
    };
    if (gpsLocation) {
      updates.gpsLocationCheckOut = {
        lat: gpsLocation.lat,
        lng: gpsLocation.lng,
        accuracy: gpsLocation.accuracy,
        timestamp: Date.now(),
      };
    }

    await updateDoc(attendanceDocRef, updates);

    // Fetch the updated doc to get the server timestamp for checkOutTime
    const updatedDocSnap = await getDoc(attendanceDocRef);
    if (updatedDocSnap.exists()) {
        const updatedLog = updatedDocSnap.data() as AttendanceLog;
        const checkOutTime = updatedLog.checkOutTime instanceof Timestamp ? updatedLog.checkOutTime.toDate().toISOString() : new Date().toISOString();
        return {
            success: true,
            message: `Checked out successfully at ${format(new Date(checkOutTime), 'p')}.`,
            checkOutTime: checkOutTime,
        };
    } else {
        return { success: true, message: 'Checked out successfully (timestamp pending).' };
    }
  } catch (error) {
    console.error('Error during checkout:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, message: `Failed to checkout: ${errorMessage}`, error: errorMessage };
  }
}

export interface FetchTodayAttendanceResult extends ServerActionResult {
  attendanceLog?: AttendanceLog & { id: string }; // Include id
  checkInTime?: string; // ISO string
  checkOutTime?: string; // ISO string
}

export async function fetchTodaysAttendance(employeeId: string, projectId: string): Promise<FetchTodayAttendanceResult> {
  if (!employeeId || !projectId) {
    return { success: false, message: 'Employee ID and Project ID are required.' };
  }
  const todayDateString = format(new Date(), 'yyyy-MM-dd');
  const attendanceCollectionRef = collection(db, 'attendanceLogs');
  const q = query(
    attendanceCollectionRef,
    where('employeeId', '==', employeeId),
    where('projectId', '==', projectId),
    where('date', '==', todayDateString),
    orderBy('checkInTime', 'desc'), // Get the latest one for the day if multiple (shouldn't happen with current logic)
    limit(1)
  );

  try {
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
      return { success: true, message: 'No attendance log found for today and this project.' };
    }
    const docData = querySnapshot.docs[0].data() as AttendanceLog;
    const attendanceLog = { ...docData, id: querySnapshot.docs[0].id };

    return {
      success: true,
      message: 'Attendance log fetched.',
      attendanceLog,
      checkInTime: attendanceLog.checkInTime instanceof Timestamp ? attendanceLog.checkInTime.toDate().toISOString() : undefined,
      checkOutTime: attendanceLog.checkOutTime instanceof Timestamp ? attendanceLog.checkOutTime.toDate().toISOString() : undefined,
    };
  } catch (error) {
    console.error('Error fetching today\'s attendance:', error);
    return { success: false, message: `Failed to fetch attendance: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
}
