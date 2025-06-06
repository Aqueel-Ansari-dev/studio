
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

  // --- NEW CHECK: Prevent check-in if active on ANY other project ---
  const qActiveOnAnyProject = query(
    attendanceCollectionRef,
    where('employeeId', '==', employeeId),
    where('date', '==', todayDateString),
    where('checkOutTime', '==', null)
  );

  try {
    const activeOnAnyProjectSnapshot = await getDocs(qActiveOnAnyProject);
    if (!activeOnAnyProjectSnapshot.empty) {
      for (const activeDoc of activeOnAnyProjectSnapshot.docs) {
        const activeLogData = activeDoc.data();
        if (activeLogData.projectId !== projectId) {
          let activeProjectName = activeLogData.projectId;
          try {
            const activeProjectDocRef = doc(db, 'projects', activeLogData.projectId);
            const activeProjectDocSnap = await getDoc(activeProjectDocRef);
            if (activeProjectDocSnap.exists()) {
              activeProjectName = activeProjectDocSnap.data()?.name || activeLogData.projectId;
            }
          } catch (projectFetchError) {
            console.warn(`Could not fetch project name for ${activeLogData.projectId}`, projectFetchError);
          }
          return {
            success: false,
            message: `You are already checked in to project "${activeProjectName}". Please check out first before checking into a new project.`,
          };
        }
      }
      // If all active logs are for the CURRENT projectId, it means they are already checked in to this project.
      // The qExisting check below will handle this and prevent duplicate active logs for the same project.
    }

    // Check if already checked in for THIS project today and not checked out
    const qExisting = query(
      attendanceCollectionRef,
      where('employeeId', '==', employeeId),
      where('projectId', '==', projectId),
      where('date', '==', todayDateString),
      where('checkOutTime', '==', null),
      limit(1)
    );

    const existingSnapshot = await getDocs(qExisting);
    if (!existingSnapshot.empty) {
      const existingLogDoc = existingSnapshot.docs[0];
      const existingLogData = existingLogDoc.data() as AttendanceLog;
      const checkInTimeISO = existingLogData.checkInTime instanceof Timestamp
                                ? existingLogData.checkInTime.toDate().toISOString()
                                : (typeof existingLogData.checkInTime === 'string' ? existingLogData.checkInTime : new Date().toISOString());
      return {
        success: true, // Still true, just informing they are already checked in
        message: 'Already checked in for this project today.',
        attendanceId: existingLogDoc.id,
        checkInTime: checkInTimeISO,
      };
    }

    // If no active check-in for THIS project, create a new one
    const newAttendanceLogData: Omit<AttendanceLog, 'id'> = {
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
    const newDocSnap = await getDoc(docRef);
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

  // Find the latest active check-in for this specific project for this employee today
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
    
    const updatedDocSnap = await getDoc(attendanceDocRef);
    if (updatedDocSnap.exists()) {
        const updatedLog = updatedDocSnap.data();
        const checkOutTimeISO = updatedLog?.checkOutTime instanceof Timestamp
                                 ? updatedLog.checkOutTime.toDate().toISOString()
                                 : new Date().toISOString();
        return {
            success: true,
            message: `Checked out successfully at ${format(new Date(checkOutTimeISO), 'p')}.`,
            checkOutTime: checkOutTimeISO,
        };
    } else {
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

  // Fetch the latest log for this project and employee today, regardless of checkOutTime
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
    const docData = querySnapshot.docs[0].data() as Omit<AttendanceLog, 'id'>;
    
    const checkInTimeISO = docData.checkInTime instanceof Timestamp
                             ? docData.checkInTime.toDate().toISOString()
                             : (typeof docData.checkInTime === 'string' ? docData.checkInTime : undefined);
    const checkOutTimeISO = docData.checkOutTime instanceof Timestamp
                              ? docData.checkOutTime.toDate().toISOString()
                              : (docData.checkOutTime === null ? undefined : (typeof docData.checkOutTime === 'string' ? docData.checkOutTime : undefined));


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
  supervisorId: string, // Keep supervisorId for future filtering, though not used directly in query yet
  recordLimit: number = 50
): Promise<{ success: boolean; logs?: AttendanceLogForSupervisorView[]; error?: string }> {
  try {
    const attendanceCollectionRef = collection(db, 'attendanceLogs');
    
    let q = query(attendanceCollectionRef, orderBy('checkInTime', 'desc'));
    if (recordLimit > 0) { // Ensure limit is only applied if positive
        q = query(q, limit(recordLimit));
    } else if (recordLimit === 0) { // Explicitly handle 0, though Firestore doesn't support it
        // Return empty or a specific error/message if 0 is intentionally passed
        console.warn("fetchAttendanceLogsForSupervisorReview called with recordLimit 0. Returning empty array.");
        return { success: true, logs: [] };
    }
    // If recordLimit is undefined or negative, it fetches all (default behavior of not applying limit)
    
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return { success: true, logs: [] };
    }

    const logsPromises = querySnapshot.docs.map(async (logDoc) => {
      const logData = logDoc.data() as AttendanceLog; 

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
                                : logData.checkOutTime === null ? null : undefined;

      return {
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
