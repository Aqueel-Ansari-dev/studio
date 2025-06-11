
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
  arrayUnion,
  writeBatch,
} from 'firebase/firestore';
import type { AttendanceLog, User, Project, UserRole, AttendanceReviewStatus, Task } from '@/types/database';
import { format, isValid, parseISO, startOfMonth, endOfMonth } from 'date-fns';
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

// Helper function to calculate elapsed time in seconds
function calculateElapsedTimeSeconds(startTimeMillis?: number, endTimeMillis?: number): number {
  if (startTimeMillis && endTimeMillis && endTimeMillis > startTimeMillis) {
    return Math.round((endTimeMillis - startTimeMillis) / 1000);
  }
  return 0;
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
      selfieCheckInUrl: selfieCheckInUrl || undefined,
      reviewStatus: 'pending', 
      completedTaskIds: [],
      sessionNotes: '',
      sessionPhotoUrl: '',
      sessionAudioNoteUrl: '',
    };

    const docRef = await addDoc(attendanceCollectionRef, newAttendanceLogData);
    const newDocSnap = await getDoc(docRef);
    let checkInTimeISO = new Date().toISOString();

    if (newDocSnap.exists()) {
        const createdLog = newDocSnap.data();
        checkInTimeISO = createdLog?.checkInTime instanceof Timestamp
                                ? createdLog.checkInTime.toDate().toISOString()
                                : new Date().toISOString();

        const employeeName = await getUserDisplayName(employeeId);
        const projectName = await getProjectName(projectId);
        const checkInFormattedTime = format(parseISO(checkInTimeISO), 'p');
        const title = `Attendance: ${employeeName} Checked In`;
        const body = `${employeeName} checked in for project "${projectName}" at ${checkInFormattedTime}. Review may be needed.`;

        await createNotificationsForRole('supervisor', 'attendance-log-review-needed', title, body, docRef.id, 'attendance_log');
        await createNotificationsForRole('admin', 'attendance-log-review-needed', `Admin: ${title}`, body, docRef.id, 'attendance_log');

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

export interface CheckoutAttendanceInput {
  employeeId: string;
  projectId: string;
  gpsLocation?: { lat: number; lng: number; accuracy?: number };
  selfieCheckOutUrl?: string;
  completedTaskIds: string[];
  sessionNotes?: string;
  sessionPhotoDataUri?: string; // Data URI for photo
  sessionAudioDataUri?: string; // Data URI for audio
}

export async function checkoutAttendance(
  input: CheckoutAttendanceInput
): Promise<CheckoutAttendanceResult> {
  const { 
    employeeId, 
    projectId, 
    gpsLocation, 
    selfieCheckOutUrl, 
    completedTaskIds, 
    sessionNotes,
    sessionPhotoDataUri, 
    sessionAudioDataUri 
  } = input;

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
    const attendanceLogId = querySnapshot.docs[0].id;
    const currentTime = Date.now(); 

    const attendanceUpdates: Partial<Omit<AttendanceLog, 'id' | 'checkInTime'>> & { checkOutTime: any } = {
      checkOutTime: serverTimestamp(),
      selfieCheckOutUrl: selfieCheckOutUrl || undefined,
      completedTaskIds: completedTaskIds || [],
      sessionNotes: sessionNotes || '',
      sessionPhotoUrl: sessionPhotoDataUri || '', 
      sessionAudioNoteUrl: sessionAudioDataUri || '',
      updatedAt: serverTimestamp(), 
    };

    if (gpsLocation) {
      attendanceUpdates.gpsLocationCheckOut = {
        lat: gpsLocation.lat,
        lng: gpsLocation.lng,
        accuracy: gpsLocation.accuracy,
        timestamp: currentTime,
      };
    }
    
    const batch = writeBatch(db);
    batch.update(attendanceDocRef, attendanceUpdates);

    if (completedTaskIds && completedTaskIds.length > 0) {
      for (const taskId of completedTaskIds) {
        const taskRef = doc(db, 'tasks', taskId);
        const taskSnap = await getDoc(taskRef);

        if (taskSnap.exists()) {
          const taskData = taskSnap.data() as Task;
          const taskUpdates: Partial<Task> & {updatedAt: any} = { 
            status: 'needs-review', 
            updatedAt: serverTimestamp(),
            // Copy session notes and photo to task for easier review context
            employeeNotes: sessionNotes || taskData.employeeNotes || '', 
            submittedMediaUri: sessionPhotoDataUri || taskData.submittedMediaUri || '',
          };
          // Note: sessionAudioDataUri is not copied as Task type doesn't have a field for it.

          let taskStartTimeMillis: number | undefined;
          if (taskData.startTime instanceof Timestamp) {
            taskStartTimeMillis = taskData.startTime.toMillis();
          } else if (typeof taskData.startTime === 'number') {
            taskStartTimeMillis = taskData.startTime; 
          }
          
          if (taskData.status === 'in-progress' && taskStartTimeMillis) {
            const sessionElapsedTimeSeconds = calculateElapsedTimeSeconds(taskStartTimeMillis, currentTime);
            taskUpdates.elapsedTime = (taskData.elapsedTime || 0) + sessionElapsedTimeSeconds;
            taskUpdates.endTime = serverTimestamp();
            taskUpdates.startTime = null; 
          }
          batch.update(taskRef, taskUpdates);
        } else {
          console.warn(`[checkoutAttendance] Task ${taskId} not found during checkout task update.`);
        }
      }
    }
    await batch.commit();


    const updatedDocSnap = await getDoc(attendanceDocRef); 
    if (updatedDocSnap.exists()) {
        const updatedLog = updatedDocSnap.data();
        const checkOutTimeISO = updatedLog?.checkOutTime instanceof Timestamp
                                 ? updatedLog.checkOutTime.toDate().toISOString()
                                 : new Date().toISOString();
        
        const employeeName = await getUserDisplayName(employeeId);
        const projectName = await getProjectName(projectId);
        const checkOutFormattedTime = format(parseISO(checkOutTimeISO), 'p');
        const title = `Attendance: ${employeeName} Checked Out`;
        let body = `${employeeName} checked out from project "${projectName}" at ${checkOutFormattedTime}.`;
        if (completedTaskIds.length > 0) {
            body += ` Reported ${completedTaskIds.length} task(s) completed.`;
        }
        body += ` This log may require review.`;
        
        await createNotificationsForRole('supervisor', 'attendance-log-review-needed', title, body, attendanceLogId, 'attendance_log');
        await createNotificationsForRole('admin', 'attendance-log-review-needed', `Admin: ${title}`, body, attendanceLogId, 'attendance_log');

        return {
            success: true,
            message: `Checked out successfully at ${checkOutFormattedTime}. ${completedTaskIds.length} task(s) marked for review.`,
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
        timestamp: track.timestamp instanceof Timestamp ? track.timestamp.toMillis() : (typeof track.timestamp === 'string' ? parseISO(track.timestamp).getTime() : Number(track.timestamp))
    })) || [];


    const attendanceLogResult = {
      ...docData,
      id: querySnapshot.docs[0].id,
      checkInTime: checkInTimeISO,
      checkOutTime: checkOutTimeISO,
      locationTrack: locationTrackClient,
      completedTaskIds: docData.completedTaskIds || [],
      sessionNotes: docData.sessionNotes || '',
      sessionPhotoUrl: docData.sessionPhotoUrl || '',
      sessionAudioNoteUrl: docData.sessionAudioNoteUrl || '',
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
  reviewStatus?: AttendanceReviewStatus;
  reviewedBy?: string;
  reviewedAt?: string | null; // ISO string
  reviewNotes?: string;
  completedTaskIds?: string[];
  sessionNotes?: string;
  sessionPhotoUrl?: string;
  sessionAudioNoteUrl?: string;
}

export async function fetchAttendanceLogsForSupervisorReview(
  supervisorId: string,
  recordLimit: number = 50
): Promise<{ success: boolean; logs?: AttendanceLogForSupervisorView[]; error?: string }> {
  try {
    const attendanceCollectionRef = collection(db, 'attendanceLogs');
    let q = query(attendanceCollectionRef, orderBy('reviewStatus', 'asc'), orderBy('checkInTime', 'desc'));


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
      
      const reviewedAtISO = logData.reviewedAt instanceof Timestamp
                                ? logData.reviewedAt.toDate().toISOString()
                                : logData.reviewedAt === null ? null : (typeof logData.reviewedAt === 'string' ? logData.reviewedAt : undefined);

      const locationTrackClient = logData.locationTrack?.map(track => ({
        ...track,
        timestamp: track.timestamp instanceof Timestamp ? track.timestamp.toMillis() : (typeof track.timestamp === 'string' ? parseISO(track.timestamp).getTime() : Number(track.timestamp))
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
        reviewStatus: logData.reviewStatus || 'pending',
        reviewedBy: logData.reviewedBy,
        reviewedAt: reviewedAtISO,
        reviewNotes: logData.reviewNotes,
        completedTaskIds: logData.completedTaskIds || [],
        sessionNotes: logData.sessionNotes || '',
        sessionPhotoUrl: logData.sessionPhotoUrl || '',
        sessionAudioNoteUrl: logData.sessionAudioNoteUrl || '',
      } as AttendanceLogForSupervisorView;
    });

    const enrichedLogs = await Promise.all(logsPromises);
    return { success: true, logs: enrichedLogs };

  } catch (error) {
    console.error("Error fetching attendance logs for supervisor review:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
     if (errorMessage.includes('firestore/failed-precondition') && errorMessage.includes('requires an index')) {
      return { success: false, error: `Query requires a Firestore index on 'attendanceLogs' (e.g., for 'reviewStatus' ascending, 'checkInTime' descending). Please create it. Details: ${errorMessage}` };
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
        timestamp: track.timestamp instanceof Timestamp ? track.timestamp.toMillis() : (typeof track.timestamp === 'string' ? parseISO(track.timestamp).getTime() : Number(track.timestamp))
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
        completedTaskIds: data.completedTaskIds || [],
        sessionNotes: data.sessionNotes || '',
        sessionPhotoUrl: data.sessionPhotoUrl || '',
        sessionAudioNoteUrl: data.sessionAudioNoteUrl || '',
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

interface UpdateAttendanceReviewStatusInput {
  logId: string;
  reviewerId: string;
  status: AttendanceReviewStatus;
  reviewNotes?: string;
}

export interface UpdateAttendanceReviewStatusResult extends ServerActionResult {
  updatedLog?: AttendanceLogForSupervisorView; 
}

export async function updateAttendanceReviewStatus(
  input: UpdateAttendanceReviewStatusInput
): Promise<UpdateAttendanceReviewStatusResult> {
  const { logId, reviewerId, status, reviewNotes } = input;

  if (!logId || !reviewerId || !status) {
    return { success: false, message: 'Log ID, reviewer ID, and status are required.' };
  }

  try {
    const reviewerDoc = await getDoc(doc(db, 'users', reviewerId));
    if (!reviewerDoc.exists()) {
      return { success: false, message: 'Reviewer not found.' };
    }
    const reviewerRole = reviewerDoc.data()?.role as UserRole;
    if (reviewerRole !== 'supervisor' && reviewerRole !== 'admin') {
      return { success: false, message: 'User not authorized to review attendance logs.' };
    }

    const logDocRef = doc(db, 'attendanceLogs', logId);
    const logDocSnap = await getDoc(logDocRef);
    if (!logDocSnap.exists()) {
      return { success: false, message: 'Attendance log not found.' };
    }

    const updates: Partial<AttendanceLog> = {
      reviewStatus: status,
      reviewedBy: reviewerId,
      reviewedAt: serverTimestamp() as Timestamp, 
    };
    if (reviewNotes) {
      updates.reviewNotes = reviewNotes;
    } else if (status === 'rejected' && !reviewNotes) {
      updates.reviewNotes = "Rejected without specific notes."; 
    }


    await updateDoc(logDocRef, updates);
    
    const updatedSnap = await getDoc(logDocRef);
    const updatedData = updatedSnap.data() as AttendanceLog;

    const employeeName = await getUserDisplayName(updatedData.employeeId);
    const employeeDocSnap = await getDoc(doc(db, 'users', updatedData.employeeId));
    const employeeAvatar = employeeDocSnap.exists() ? employeeDocSnap.data()?.photoURL || `https://placehold.co/40x40.png?text=${employeeName.substring(0,2).toUpperCase()}` : `https://placehold.co/40x40.png?text=UE`;
    const projectName = await getProjectName(updatedData.projectId);
    
    const updatedLogForClient: AttendanceLogForSupervisorView = {
        id: updatedSnap.id,
        employeeId: updatedData.employeeId,
        employeeName,
        employeeAvatar,
        projectId: updatedData.projectId,
        projectName,
        date: updatedData.date,
        checkInTime: updatedData.checkInTime instanceof Timestamp ? updatedData.checkInTime.toDate().toISOString() : String(updatedData.checkInTime || ''),
        checkOutTime: updatedData.checkOutTime instanceof Timestamp ? updatedData.checkOutTime.toDate().toISOString() : (updatedData.checkOutTime ? String(updatedData.checkOutTime) : null),
        gpsLocationCheckIn: updatedData.gpsLocationCheckIn,
        gpsLocationCheckOut: updatedData.gpsLocationCheckOut,
        autoLoggedFromTask: updatedData.autoLoggedFromTask,
        locationTrack: updatedData.locationTrack?.map(t => ({...t, timestamp: t.timestamp instanceof Timestamp ? t.timestamp.toMillis() : Number(t.timestamp) })),
        selfieCheckInUrl: updatedData.selfieCheckInUrl,
        selfieCheckOutUrl: updatedData.selfieCheckOutUrl,
        reviewStatus: updatedData.reviewStatus || 'pending',
        reviewedBy: updatedData.reviewedBy,
        reviewedAt: updatedData.reviewedAt instanceof Timestamp ? updatedData.reviewedAt.toDate().toISOString() : (updatedData.reviewedAt ? String(updatedData.reviewedAt) : null),
        reviewNotes: updatedData.reviewNotes,
        completedTaskIds: updatedData.completedTaskIds || [],
        sessionNotes: updatedData.sessionNotes || '',
        sessionPhotoUrl: updatedData.sessionPhotoUrl || '',
        sessionAudioNoteUrl: updatedData.sessionAudioNoteUrl || '',
    };


    return { success: true, message: `Attendance log ${status} successfully.`, updatedLog: updatedLogForClient };

  } catch (error) {
    console.error('Error updating attendance review status:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { success: false, message: `Failed to update review status: ${errorMessage}` };
  }
}

export interface AttendanceLogForCalendar extends Omit<AttendanceLog, 'checkInTime' | 'checkOutTime' | 'reviewedAt' | 'locationTrack' | 'gpsLocationCheckIn' | 'gpsLocationCheckOut'> {
  id: string;
  checkInTime: string | null; // ISO String
  checkOutTime?: string | null; // ISO String
  reviewedAt?: string | null; // ISO String
  gpsLocationCheckIn: { lat: number; lng: number; accuracy?: number; timestamp?: number }; // timestamp as millis
  gpsLocationCheckOut?: { lat: number; lng: number; accuracy?: number; timestamp?: number } | null; // timestamp as millis
  locationTrack?: Array<{ timestamp: number; lat: number; lng: number }>; // timestamp as millis
}

export async function fetchAttendanceLogsForEmployeeByMonth(
  employeeId: string,
  year: number,
  month: number // 1-indexed month
): Promise<{ success: boolean; logs?: AttendanceLogForCalendar[]; error?: string }> {
  if (!employeeId) {
    return { success: false, error: "Employee ID is required." };
  }

  try {
    const dateInMonth = new Date(year, month - 1, 15); // Use 15th to avoid timezone shifts affecting month start/end
    const firstDay = startOfMonth(dateInMonth);
    const lastDay = endOfMonth(dateInMonth);
    
    const attendanceCollectionRef = collection(db, 'attendanceLogs');
    const q = query(
      attendanceCollectionRef,
      where('employeeId', '==', employeeId),
      where('date', '>=', format(firstDay, 'yyyy-MM-dd')),
      where('date', '<=', format(lastDay, 'yyyy-MM-dd')),
      orderBy('date', 'asc'),
      orderBy('checkInTime', 'asc')
    );

    const querySnapshot = await getDocs(q);
    const logs: AttendanceLogForCalendar[] = querySnapshot.docs.map(docSnap => {
      const data = docSnap.data() as AttendanceLog; // Assuming AttendanceLog has Timestamps from DB

      const convertTimestampToIso = (ts: Timestamp | string | null | undefined): string | null => {
        if (ts instanceof Timestamp) return ts.toDate().toISOString();
        if (typeof ts === 'string') return ts; // Assume it's already ISO
        return null;
      };
      
      const convertGpsTimestampToMillis = (gpsField: { lat: number; lng: number; accuracy?: number; timestamp?: number } | null | undefined): { lat: number; lng: number; accuracy?: number; timestamp?: number } | null => {
        if (!gpsField) return null;
        return {
            ...gpsField,
            timestamp: gpsField.timestamp // Assuming it's already millis or number
        };
      };

      return {
        id: docSnap.id,
        employeeId: data.employeeId,
        projectId: data.projectId,
        date: data.date, // Keep as yyyy-MM-dd string
        checkInTime: convertTimestampToIso(data.checkInTime),
        checkOutTime: convertTimestampToIso(data.checkOutTime),
        gpsLocationCheckIn: convertGpsTimestampToMillis(data.gpsLocationCheckIn)!, 
        gpsLocationCheckOut: convertGpsTimestampToMillis(data.gpsLocationCheckOut),
        autoLoggedFromTask: data.autoLoggedFromTask,
        locationTrack: data.locationTrack?.map(track => ({
          ...track,
          timestamp: track.timestamp instanceof Timestamp ? track.timestamp.toMillis() : (typeof track.timestamp === 'string' ? parseISO(track.timestamp).getTime() : Number(track.timestamp)),
        })) || [],
        selfieCheckInUrl: data.selfieCheckInUrl,
        selfieCheckOutUrl: data.selfieCheckOutUrl,
        reviewStatus: data.reviewStatus,
        reviewedBy: data.reviewedBy,
        reviewedAt: convertTimestampToIso(data.reviewedAt),
        reviewNotes: data.reviewNotes,
        completedTaskIds: data.completedTaskIds || [],
        sessionNotes: data.sessionNotes || '',
        sessionPhotoUrl: data.sessionPhotoUrl || '',
        sessionAudioNoteUrl: data.sessionAudioNoteUrl || '',
      };
    });

    return { success: true, logs };

  } catch (error) {
    console.error(`Error fetching attendance logs for employee ${employeeId}, month ${month}/${year}:`, error);
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
     if (errorMessage.includes('firestore/failed-precondition') && errorMessage.includes('requires an index')) {
      return { success: false, error: `Query requires a Firestore index. Check logs for details. Error: ${errorMessage}` };
    }
    return { success: false, error: `Failed to fetch logs: ${errorMessage}` };
  }
}
    

