
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
import type { AttendanceLog, User, Project } from '@/types/database'; // Added User and Project
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

  const attendanceCollectionRef = collection(db, 'attendanceLogs');
  const qExisting = query(
    attendanceCollectionRef,
    where('employeeId', '==', employeeId),
    where('projectId', '==', projectId),
    where('date', '==', todayDateString),
    where('checkOutTime', '==', null),
    limit(1)
  );

  try {
    const existingSnapshot = await getDocs(qExisting);
    if (!existingSnapshot.empty) {
      const existingLogDoc = existingSnapshot.docs[0];
      const existingLogData = existingLogDoc.data() as AttendanceLog; // Firestore data
      const checkInTimeISO = existingLogData.checkInTime instanceof Timestamp
                                ? existingLogData.checkInTime.toDate().toISOString()
                                : (typeof existingLogData.checkInTime === 'string' ? existingLogData.checkInTime : new Date().toISOString());
      return {
        success: true,
        message: 'Already checked in for this project today.',
        attendanceId: existingLogDoc.id,
        checkInTime: checkInTimeISO,
      };
    }

    const newAttendanceLogData: Omit<AttendanceLog, 'id'> = { // id is auto-generated
      employeeId,
      projectId,
      date: todayDateString,
      checkInTime: serverTimestamp() as Timestamp,
      gpsLocationCheckIn: {
        lat: gpsLocation.lat,
        lng: gpsLocation.lng,
        accuracy: gpsLocation.accuracy,
        timestamp: Date.now(),
      },
      autoLoggedFromTask,
      checkOutTime: null,
      gpsLocationCheckOut: null,
    };

    const docRef = await addDoc(attendanceCollectionRef, newAttendanceLogData);
    const newDocSnap = await getDoc(docRef); // Fetch to get server timestamp
    if (newDocSnap.exists()) {
        const createdLog = newDocSnap.data();
        const checkInTimeISO = createdLog?.checkInTime instanceof Timestamp
                                ? createdLog.checkInTime.toDate().toISOString()
                                : new Date().toISOString();
        return {
            success: true,
            message: `Checked in successfully at ${format(new Date(checkInTimeISO), 'p')}.`,
            attendanceId: docRef.id,
            checkInTime: checkInTimeISO,
        };
    } else {
         // This case should ideally not happen if addDoc was successful
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
  projectId: string,
  gpsLocation?: { lat: number; lng: number; accuracy?: number }
): Promise<CheckoutAttendanceResult> {
  if (!employeeId || !projectId) {
    return { success: false, message: 'Employee ID and Project ID are required for checkout.' };
  }

  const todayDateString = format(new Date(), 'yyyy-MM-dd');
  const attendanceCollectionRef = collection(db, 'attendanceLogs');

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
    const updates: Partial<Omit<AttendanceLog, 'id' | 'checkInTime'>> & { checkOutTime: Timestamp | null } & { gpsLocationCheckOut?: any } = {
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
    
    const updatedDocSnap = await getDoc(attendanceDocRef); // Fetch to get server timestamp
    if (updatedDocSnap.exists()) {
        const updatedLog = updatedDocSnap.data();
        const checkOutTimeISO = updatedLog?.checkOutTime instanceof Timestamp
                                 ? updatedLog.checkOutTime.toDate().toISOString()
                                 : new Date().toISOString(); // Fallback, should ideally always be a Timestamp
        return {
            success: true,
            message: `Checked out successfully at ${format(new Date(checkOutTimeISO), 'p')}.`,
            checkOutTime: checkOutTimeISO,
        };
    } else {
        // This case should ideally not happen if updateDoc succeeds and doc still exists
        return { success: true, message: 'Checked out successfully (timestamp pending).' };
    }
  } catch (error)
    {
    console.error('Error during checkout:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    if (errorMessage.includes('firestore/failed-precondition') && errorMessage.includes('requires an index')) {
         return { success: false, message: `Query requires a Firestore index. Please check server logs for a link to create it. Details: ${errorMessage}`, error: errorMessage };
    }
    return { success: false, message: `Failed to checkout: ${errorMessage}`, error: errorMessage };
  }
}

export interface FetchTodayAttendanceResult extends ServerActionResult {
  attendanceLog?: AttendanceLog & { id: string; checkInTime?: string; checkOutTime?: string };
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
    orderBy('checkInTime', 'desc'),
    limit(1)
  );

  try {
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
      return { success: true, message: 'No attendance log found for today and this project.' };
    }
    const docData = querySnapshot.docs[0].data() as Omit<AttendanceLog, 'id'>; // Firestore data
    
    const checkInTimeISO = docData.checkInTime instanceof Timestamp
                             ? docData.checkInTime.toDate().toISOString()
                             : undefined;
    const checkOutTimeISO = docData.checkOutTime instanceof Timestamp
                              ? docData.checkOutTime.toDate().toISOString()
                              : undefined;

    const attendanceLogResult = {
      ...docData,
      id: querySnapshot.docs[0].id,
      checkInTime: checkInTimeISO,
      checkOutTime: checkOutTimeISO,
    } as AttendanceLog & { id: string; checkInTime?: string; checkOutTime?: string };


    return {
      success: true,
      message: 'Attendance log fetched.',
      attendanceLog: attendanceLogResult,
    };
  } catch (error) {
    console.error('Error fetching today\'s attendance:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (errorMessage.includes('firestore/failed-precondition') && errorMessage.includes('requires an index')) {
      return { success: false, message: `Query requires a Firestore index. Details: ${errorMessage}` };
    }
    return { success: false, message: `Failed to fetch attendance: ${errorMessage}` };
  }
}


export interface AttendanceLogForSupervisorView {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeAvatar: string;
  projectId: string;
  projectName: string;
  date: string;
  checkInTime: string; // ISO string
  checkOutTime?: string | null; // ISO string
  gpsLocationCheckIn: { lat: number; lng: number; accuracy?: number; timestamp?: number };
  gpsLocationCheckOut?: { lat: number; lng: number; accuracy?: number; timestamp?: number } | null;
  autoLoggedFromTask?: boolean;
}

export async function fetchAttendanceLogsForSupervisorReview(
  // supervisorId: string, // TODO: Use this to filter by supervisor's team in future
  recordLimit: number = 50
): Promise<{ success: boolean; logs?: AttendanceLogForSupervisorView[]; error?: string }> {
  try {
    const attendanceCollectionRef = collection(db, 'attendanceLogs');
    // For now, fetching all recent logs. Future: filter by supervisor's team.
    const q = query(attendanceCollectionRef, orderBy('checkInTime', 'desc'), limit(recordLimit));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return { success: true, logs: [] };
    }

    const logsPromises = querySnapshot.docs.map(async (logDoc) => {
      const logData = logDoc.data() as AttendanceLog; // Raw data from Firestore

      let employeeName = 'Unknown Employee';
      let employeeAvatar = `https://placehold.co/40x40.png?text=UE`;
      if (logData.employeeId) {
        const userDocRef = doc(db, 'users', logData.employeeId);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          const userData = userDocSnap.data() as User;
          employeeName = userData.displayName || userData.email || logData.employeeId;
          employeeAvatar = userData.photoURL || `https://placehold.co/40x40.png?text=${employeeName.substring(0,2).toUpperCase()}`;
        }
      }

      let projectName = 'Unknown Project';
      if (logData.projectId) {
        const projectDocRef = doc(db, 'projects', logData.projectId);
        const projectDocSnap = await getDoc(projectDocRef);
        if (projectDocSnap.exists()) {
          const projectData = projectDocSnap.data() as Project;
          projectName = projectData.name || logData.projectId;
        }
      }
      
      const checkInTimeISO = logData.checkInTime instanceof Timestamp 
                              ? logData.checkInTime.toDate().toISOString() 
                              : (typeof logData.checkInTime === 'string' ? logData.checkInTime : new Date(0).toISOString());
      
      const checkOutTimeISO = logData.checkOutTime instanceof Timestamp
                                ? logData.checkOutTime.toDate().toISOString()
                                : logData.checkOutTime === null ? null : undefined; // Handle null case

      return {
        // Explicitly map fields to ensure only serializable data and correct types
        id: logDoc.id,
        employeeId: logData.employeeId,
        employeeName,
        employeeAvatar,
        projectId: logData.projectId,
        projectName,
        date: logData.date,
        checkInTime: checkInTimeISO,
        checkOutTime: checkOutTimeISO,
        gpsLocationCheckIn: logData.gpsLocationCheckIn,
        gpsLocationCheckOut: logData.gpsLocationCheckOut,
        autoLoggedFromTask: logData.autoLoggedFromTask,
      } as AttendanceLogForSupervisorView;
    });

    const enrichedLogs = await Promise.all(logsPromises);
    return { success: true, logs: enrichedLogs };

  } catch (error) {
    console.error("Error fetching attendance logs for supervisor review:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
     if (errorMessage.includes('firestore/failed-precondition') && errorMessage.includes('requires an index')) {
      return { success: false, error: `Query requires a Firestore index on 'attendanceLogs' (e.g., for 'checkInTime' descending). Please create it. Details: ${errorMessage}` };
    }
    return { success: false, error: errorMessage };
  }
}
