
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
  getDoc,
  arrayUnion
} from 'firebase/firestore';
import type { AttendanceLog, User, Project } from '@/types/database';
import { format, isValid, parseISO } from 'date-fns';
import { createNotificationsForRole, getUserDisplayName, getProjectName } from '@/app/actions/notificationsUtils';

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
  autoLoggedFromTask: boolean = false,
  selfieCheckInUrl?: string
): Promise<LogAttendanceResult> {
  if (!employeeId || !projectId) {
    return { success: false, message: 'Employee ID and Project ID are required.' };
  }

  const todayDateString = format(new Date(), 'yyyy-MM-dd');
  const attendanceCollectionRef = collection(db, 'attendanceLogs');

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
    }

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
        success: true,
        message: 'Already checked in for this project today.',
        attendanceId: existingLogDoc.id,
        checkInTime: checkInTimeISO,
      };
    }

    const newAttendanceLogData: Partial<Omit<AttendanceLog, 'id' | 'checkInTime'>> & { checkInTime: any } = {
      employeeId,
      projectId,
      date: todayDateString,
      checkInTime: serverTimestamp(),
      gpsLocationCheckIn: {
        lat: gpsLocation.lat,
        lng: gpsLocation.lng,
        accuracy: gpsLocation.accuracy,
        timestamp: Date.now(),
      },
      autoLoggedFromTask,
      checkOutTime: null,
      gpsLocationCheckOut: null,
      locationTrack: [],
    };

    if (selfieCheckInUrl) {
      newAttendanceLogData.selfieCheckInUrl = selfieCheckInUrl;
    }

    const docRef = await addDoc(attendanceCollectionRef, newAttendanceLogData);
    const newDocSnap = await getDoc(docRef);
    let checkInTimeISO = new Date().toISOString();

    if (newDocSnap.exists()) {
        const createdLog = newDocSnap.data();
        checkInTimeISO = createdLog?.checkInTime instanceof Timestamp
                                ? createdLog.checkInTime.toDate().toISOString()
                                : new Date().toISOString();

        // Notifications
        const employeeName = await getUserDisplayName(employeeId);
        const projectName = await getProjectName(projectId);
        const checkInFormattedTime = format(parseISO(checkInTimeISO), 'p');
        const title = `Attendance: ${employeeName} Checked In`;
        const body = `${employeeName} checked in for project "${projectName}" at ${checkInFormattedTime}.`;

        await createNotificationsForRole('supervisor', 'attendance-check-in', title, body, docRef.id, 'attendance_log');
        await createNotificationsForRole('admin', 'attendance-check-in', `Admin: ${title}`, body, docRef.id, 'attendance_log');

        return {
            success: true,
            message: `Checked in successfully at ${checkInFormattedTime}.`,
            attendanceId: docRef.id,
            checkInTime: checkInTimeISO,
        };
    } else {
         return { success: true, message: 'Checked in successfully (timestamp pending).', attendanceId: docRef.id };
    }

  } catch (error) {
    console.error("Error logging attendance:", error);
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
  gpsLocation?: { lat: number; lng: number; accuracy?: number },
  selfieCheckOutUrl?: string
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
    const updates: Partial<Omit<AttendanceLog, 'id' | 'checkInTime'>> & { checkOutTime: any } = {
      checkOutTime: serverTimestamp(),
    };

    if (gpsLocation) {
      updates.gpsLocationCheckOut = {
        lat: gpsLocation.lat,
        lng: gpsLocation.lng,
        accuracy: gpsLocation.accuracy,
        timestamp: Date.now(),
      };
    }

    if (selfieCheckOutUrl) {
      updates.selfieCheckOutUrl = selfieCheckOutUrl;
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
            message: `Checked out successfully at ${format(parseISO(checkOutTimeISO), 'p')}.`,
            checkOutTime: checkOutTimeISO,
        };
    } else {
        return { success: true, message: 'Checked out successfully (timestamp pending).' };
    }
  } catch (error) {
    console.error('Error during checkout:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    if (errorMessage.includes('firestore/failed-precondition') && errorMessage.includes('requires an index')) {
         return { success: false, message: `Query requires a Firestore index. Please check server logs for a link to create it. Details: ${errorMessage}`, error: errorMessage };
    }
    return { success: false, message: `Failed to checkout: ${errorMessage}`, error: errorMessage };
  }
}


export interface FetchTodayAttendanceResult extends ServerActionResult {
  attendanceLog?: AttendanceLog & { id: string; checkInTime?: string; checkOutTime?: string; locationTrack?: Array<{ timestamp: string | number; lat: number; lng: number }> };
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
    const docData = querySnapshot.docs[0].data() as Omit<AttendanceLog, 'id'>;

    const checkInTimeISO = docData.checkInTime instanceof Timestamp
                             ? docData.checkInTime.toDate().toISOString()
                             : (typeof docData.checkInTime === 'string' ? docData.checkInTime : undefined);
    const checkOutTimeISO = docData.checkOutTime instanceof Timestamp
                              ? docData.checkOutTime.toDate().toISOString()
                              : docData.checkOutTime === null ? undefined : (typeof docData.checkOutTime === 'string' ? docData.checkOutTime : undefined);

    const locationTrackClient = docData.locationTrack?.map(track => ({
        ...track,
        timestamp: track.timestamp instanceof Timestamp ? track.timestamp.toMillis() : (typeof track.timestamp === 'string' ? parseISO(track.timestamp).getTime() : track.timestamp)
    })) || [];


    const attendanceLogResult = {
      ...docData,
      id: querySnapshot.docs[0].id,
      checkInTime: checkInTimeISO,
      checkOutTime: checkOutTimeISO,
      locationTrack: locationTrackClient,
    } as AttendanceLog & { id: string; checkInTime?: string; checkOutTime?: string; locationTrack?: Array<{ timestamp: string | number; lat: number; lng: number }> };


    return {
      success: true,
      message: 'Attendance log fetched.',
      attendanceLog: attendanceLogResult,
    };
  } catch (error) {
    console.error("Error fetching today's attendance:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (errorMessage.includes('firestore/failed-precondition') && errorMessage.includes('requires an index')) {
      return { success: false, message: `Query requires a Firestore index. Details: ${errorMessage}` };
    }
    return { success: false, message: `Failed to fetch attendance: ${errorMessage}` };
  }
}

export interface GlobalActiveCheckInResult {
  activeLog?: {
    projectId: string;
    projectName: string;
    checkInTime: string; // ISO string
    attendanceId: string;
  } | null;
  error?: string;
}

export async function getGlobalActiveCheckIn(employeeId: string): Promise<GlobalActiveCheckInResult> {
  if (!employeeId) {
    return { error: 'Employee ID is required.' };
  }
  const todayDateString = format(new Date(), 'yyyy-MM-dd');
  const attendanceCollectionRef = collection(db, 'attendanceLogs');

  const q = query(
    attendanceCollectionRef,
    where('employeeId', '==', employeeId),
    where('date', '==', todayDateString),
    where('checkOutTime', '==', null),
    limit(1)
  );

  try {
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
      return { activeLog: null };
    }

    const activeLogDoc = querySnapshot.docs[0];
    const activeLogData = activeLogDoc.data() as AttendanceLog;

    let projectName = activeLogData.projectId;
    try {
      const projectDocRef = doc(db, 'projects', activeLogData.projectId);
      const projectDocSnap = await getDoc(projectDocRef);
      if (projectDocSnap.exists()) {
        projectName = projectDocSnap.data()?.name || activeLogData.projectId;
      }
    } catch (projectFetchError) {
      console.warn(`Could not fetch project name for ${activeLogData.projectId} in getGlobalActiveCheckIn`, projectFetchError);
    }

    const checkInTimeISO = activeLogData.checkInTime instanceof Timestamp
                           ? activeLogData.checkInTime.toDate().toISOString()
                           : (typeof activeLogData.checkInTime === 'string' ? activeLogData.checkInTime : new Date(0).toISOString());

    return {
      activeLog: {
        projectId: activeLogData.projectId,
        projectName,
        checkInTime: checkInTimeISO,
        attendanceId: activeLogDoc.id,
      }
    };
  } catch (error) {
    console.error('Error fetching global active check-in:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    if (errorMessage.includes('firestore/failed-precondition') && errorMessage.includes('requires an index')) {
      return { error: `Query requires a Firestore index. Details: ${errorMessage}` };
    }
    return { error: `Failed to fetch global active check-in: ${errorMessage}` };
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
  locationTrack?: Array<{ timestamp: string | number; lat: number; lng: number }>;
  selfieCheckInUrl?: string;
  selfieCheckOutUrl?: string;
}

export async function fetchAttendanceLogsForSupervisorReview(
  supervisorId: string,
  recordLimit: number = 50
): Promise<{ success: boolean; logs?: AttendanceLogForSupervisorView[]; error?: string }> {
  try {
    const attendanceCollectionRef = collection(db, 'attendanceLogs');

    let q = query(attendanceCollectionRef, orderBy('checkInTime', 'desc'));

    if (recordLimit > 0) {
        q = query(q, limit(recordLimit));
    } else if (recordLimit === 0) {
        console.warn("fetchAttendanceLogsForSupervisorReview called with recordLimit 0. Returning empty array.");
        return { success: true, logs: [] };
    }

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
                                : logData.checkOutTime === null ? null : (typeof logData.checkOutTime === 'string' ? logData.checkOutTime : undefined);

      const locationTrackClient = logData.locationTrack?.map(track => ({
        ...track,
        timestamp: track.timestamp instanceof Timestamp ? track.timestamp.toMillis() : (typeof track.timestamp === 'string' ? parseISO(track.timestamp).getTime() : track.timestamp)
      })) || [];

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
        locationTrack: locationTrackClient,
        selfieCheckInUrl: logData.selfieCheckInUrl,
        selfieCheckOutUrl: logData.selfieCheckOutUrl,
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


export interface FetchAttendanceLogsForMapFilters {
  date: string; // YYYY-MM-DD
  employeeId?: string;
  projectId?: string;
}
export interface AttendanceLogForMap extends AttendanceLog {
  id: string;
  checkInTime: string | null;
  checkOutTime?: string | null;
  locationTrack?: Array<{ timestamp: string | number; lat: number; lng: number }>;
}

export async function fetchAttendanceLogsForMap(
  filters: FetchAttendanceLogsForMapFilters
): Promise<{ success: boolean; logs?: AttendanceLogForMap[]; error?: string; message?: string }> {
  if (!filters.date || !isValid(parseISO(filters.date))) {
    return { success: false, error: "A valid date (YYYY-MM-DD) is required." };
  }

  try {
    const attendanceCollectionRef = collection(db, 'attendanceLogs');
    let q = query(attendanceCollectionRef, where('date', '==', filters.date));

    if (filters.employeeId) {
      q = query(q, where('employeeId', '==', filters.employeeId));
    }
    if (filters.projectId) {
      q = query(q, where('projectId', '==', filters.projectId));
    }
    q = query(q, orderBy('checkInTime', 'asc'));

    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return { success: true, logs: [], message: "No attendance logs found for the selected criteria." };
    }

    const logs: AttendanceLogForMap[] = querySnapshot.docs.map(docSnap => {
      const data = docSnap.data() as Omit<AttendanceLog, 'id'>;

      const checkInTimeISO = data.checkInTime instanceof Timestamp
                               ? data.checkInTime.toDate().toISOString()
                               : (typeof data.checkInTime === 'string' ? data.checkInTime : null);
      const checkOutTimeISO = data.checkOutTime
                                ? (data.checkOutTime instanceof Timestamp
                                  ? data.checkOutTime.toDate().toISOString()
                                  : (typeof data.checkOutTime === 'string' ? data.checkOutTime : null))
                                : null;

      const locationTrackClient = data.locationTrack?.map(track => ({
        ...track,
        timestamp: track.timestamp instanceof Timestamp ? track.timestamp.toMillis() : (typeof track.timestamp === 'string' ? parseISO(track.timestamp).getTime() : track.timestamp)
      })) || [];

      return {
        ...data,
        id: docSnap.id,
        checkInTime: checkInTimeISO,
        checkOutTime: checkOutTimeISO,
        gpsLocationCheckIn: data.gpsLocationCheckIn,
        gpsLocationCheckOut: data.gpsLocationCheckOut,
        locationTrack: locationTrackClient,
        autoLoggedFromTask: data.autoLoggedFromTask,
        selfieCheckInUrl: data.selfieCheckInUrl,
        selfieCheckOutUrl: data.selfieCheckOutUrl,
      } as AttendanceLogForMap;
    });

    return { success: true, logs };

  } catch (error) {
    console.error("Error fetching attendance logs for map:", error);
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
    if (errorMessage.includes('firestore/failed-precondition') && errorMessage.includes('requires an index')) {
         return { success: false, error: `Query requires a Firestore index. Please check server logs for details. (Likely on 'date', 'employeeId'/'projectId', and 'checkInTime'). Error: ${errorMessage}` };
    }
    return { success: false, error: `Failed to fetch logs for map: ${errorMessage}` };
  }
}

// New server action to update location track
interface LocationPointClient {
  lat: number;
  lng: number;
  timestamp: number; // Milliseconds from client
  accuracy?: number;
}

export async function updateLocationTrack(
  attendanceLogId: string,
  trackPoints: LocationPointClient[]
): Promise<ServerActionResult> {
  if (!attendanceLogId) {
    return { success: false, message: 'Attendance Log ID is required.' };
  }
  if (!trackPoints || trackPoints.length === 0) {
    return { success: false, message: 'No track points provided.' };
  }

  try {
    const attendanceDocRef = doc(db, 'attendanceLogs', attendanceLogId);

    const convertedTrackPoints = trackPoints.map(point => ({
      ...point,
      timestamp: Timestamp.fromMillis(point.timestamp),
    }));

    await updateDoc(attendanceDocRef, {
      locationTrack: arrayUnion(...convertedTrackPoints),
      updatedAt: serverTimestamp(),
    });

    return { success: true, message: 'Location track updated successfully.' };
  } catch (error) {
    console.error('Error updating location track:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, message: `Failed to update location track: ${errorMessage}` };
  }
}
