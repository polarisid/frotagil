
'use server';

import { db } from '@/lib/firebase';
import type { VehicleUsageLog, Checklist } from '@/lib/types';
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  query,
  where,
  getDocs,
  Timestamp, // Certifique-se de que Timestamp está importado
  orderBy,
  limit,
} from 'firebase/firestore';
import { differenceInMinutes } from 'date-fns';

const vehicleUsageLogsCollection = collection(db, 'vehicleUsageLogs');
const checklistsCollection = collection(db, 'checklists');

export async function createVehicleUsageLog(
  vehicleId: string,
  vehiclePlate: string,
  operatorId: string,
  operatorName: string,
  initialMileage: number
): Promise<string> {
  const pickedUpTimestamp = new Date();
  
  const logEntry: Omit<VehicleUsageLog, 'id' | 'returnedTimestamp' | 'durationMinutes' | 'finalMileage' | 'kmDriven' | 'routeDescription'> = {
    vehicleId,
    vehiclePlate,
    operatorId,
    operatorName,
    pickedUpTimestamp: pickedUpTimestamp.toISOString(),
    status: 'active',
    initialMileage,
  };
  const docRef = await addDoc(vehicleUsageLogsCollection, {
    ...logEntry,
    pickedUpTimestamp: Timestamp.fromDate(pickedUpTimestamp),
  });
  return docRef.id;
}

export async function completeVehicleUsageLog(
  vehicleId: string,
  operatorId: string,
  finalMileage: number
): Promise<void> {
  const qLog = query(
    vehicleUsageLogsCollection,
    where('vehicleId', '==', vehicleId),
    where('operatorId', '==', operatorId),
    where('status', '==', 'active'),
    orderBy('pickedUpTimestamp', 'desc'),
    limit(1)
  );

  const logSnapshot = await getDocs(qLog);
  if (logSnapshot.empty) {
    console.warn(`No active usage log found for vehicle ${vehicleId} and operator ${operatorId} to complete.`);
    return;
  }

  const logDoc = logSnapshot.docs[0];
  const logData = logDoc.data() as Omit<VehicleUsageLog, 'id' | 'pickedUpTimestamp'> & { pickedUpTimestamp: Timestamp, initialMileage: number };
  
  const returnedTimestamp = new Date();
  const returnedTimestampFs = Timestamp.fromDate(returnedTimestamp);
  let durationMinutes = 0;
  let kmDriven: number | undefined = undefined;
  let routeDescriptionFromChecklist: string | undefined = undefined;

  if (logData.pickedUpTimestamp instanceof Timestamp) {
    durationMinutes = differenceInMinutes(returnedTimestamp, logData.pickedUpTimestamp.toDate());

    const qChecklist = query(
      checklistsCollection,
      where('vehicleId', '==', vehicleId),
      where('operatorId', '==', operatorId),
      where('date', '>=', logData.pickedUpTimestamp),
      where('date', '<=', returnedTimestampFs),
      orderBy('date', 'desc'),
      limit(1)
    );
    const checklistSnapshot = await getDocs(qChecklist);
    if (!checklistSnapshot.empty) {
      const checklistData = checklistSnapshot.docs[0].data() as Checklist;
      routeDescriptionFromChecklist = checklistData.routeDescription;
    }
  } else if (typeof logData.pickedUpTimestamp === 'string') { 
     const pickedUpDateObj = new Date(logData.pickedUpTimestamp);
     durationMinutes = differenceInMinutes(returnedTimestamp, pickedUpDateObj);

     const qChecklist = query(
        checklistsCollection,
        where('vehicleId', '==', vehicleId),
        where('operatorId', '==', operatorId),
        where('date', '>=', Timestamp.fromDate(pickedUpDateObj)),
        where('date', '<=', returnedTimestampFs),
        orderBy('date', 'desc'),
        limit(1)
      );
      const checklistSnapshot = await getDocs(qChecklist);
      if (!checklistSnapshot.empty) {
        const checklistData = checklistSnapshot.docs[0].data() as Checklist;
        routeDescriptionFromChecklist = checklistData.routeDescription;
      }
  }

  if (typeof finalMileage === 'number') {
    if (finalMileage >= logData.initialMileage) {
      kmDriven = finalMileage - logData.initialMileage;
    } else {
      console.warn(`Final mileage (${finalMileage}) is less than initial mileage (${logData.initialMileage}) for log ${logDoc.id}. kmDriven will be 0.`);
      kmDriven = 0; 
    }
  }

  const updateData: Partial<VehicleUsageLog> = {
    returnedTimestamp: returnedTimestamp.toISOString(),
    durationMinutes,
    finalMileage,
    kmDriven,
    status: 'completed',
  };

  if (routeDescriptionFromChecklist) {
    updateData.routeDescription = routeDescriptionFromChecklist;
  }

  await updateDoc(doc(db, 'vehicleUsageLogs', logDoc.id), {
    ...updateData,
    returnedTimestamp: returnedTimestampFs,
  });
}

export async function getVehicleUsageLogs(filters: {
  startDate?: string;
  endDate?: string;
  vehicleId?: string;
  operatorId?: string;
  status?: 'active' | 'completed';
}): Promise<VehicleUsageLog[]> {
  let q = query(vehicleUsageLogsCollection);

  if (filters.startDate) {
    const start = Timestamp.fromDate(new Date(filters.startDate + "T00:00:00Z"));
    q = query(q, where('pickedUpTimestamp', '>=', start));
  }
  if (filters.endDate) {
    const end = Timestamp.fromDate(new Date(filters.endDate + "T23:59:59Z"));
    q = query(q, where('pickedUpTimestamp', '<=', end));
  }
  if (filters.vehicleId) {
    q = query(q, where('vehicleId', '==', filters.vehicleId));
  }
  if (filters.operatorId) {
    q = query(q, where('operatorId', '==', filters.operatorId));
  }
  if (filters.status) {
    q = query(q, where('status', '==', filters.status));
  }
  
  q = query(q, orderBy('pickedUpTimestamp', 'desc'));

  const snapshot = await getDocs(q);
  return snapshot.docs.map(docSnap => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      ...data,
      pickedUpTimestamp: data.pickedUpTimestamp instanceof Timestamp ? data.pickedUpTimestamp.toDate().toISOString() : data.pickedUpTimestamp,
      returnedTimestamp: data.returnedTimestamp instanceof Timestamp ? data.returnedTimestamp.toDate().toISOString() : (data.returnedTimestamp || null),
      routeDescription: data.routeDescription || undefined,
    } as VehicleUsageLog;
  });
}

export async function getUsageLogsForPeriod(startDate: Date, endDate: Date, status: 'completed' | 'active' | 'all' = 'completed'): Promise<VehicleUsageLog[]> {
  const startTimestamp = Timestamp.fromDate(startDate);
  const endTimestamp = Timestamp.fromDate(endDate);

  let q = query(
    vehicleUsageLogsCollection,
    where('pickedUpTimestamp', '>=', startTimestamp),
    where('pickedUpTimestamp', '<=', endTimestamp)
  );

  if (status !== 'all') {
    q = query(q, where('status', '==', status));
  }
  
  q = query(q, orderBy('pickedUpTimestamp', 'desc'));

  const snapshot = await getDocs(q);
  return snapshot.docs.map(docSnap => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      ...data,
      pickedUpTimestamp: data.pickedUpTimestamp instanceof Timestamp ? data.pickedUpTimestamp.toDate().toISOString() : data.pickedUpTimestamp,
      returnedTimestamp: data.returnedTimestamp instanceof Timestamp ? data.returnedTimestamp.toDate().toISOString() : (data.returnedTimestamp || null),
      routeDescription: data.routeDescription || undefined,
    } as VehicleUsageLog;
  });
}

interface DailyMileage {
  date: string;
  km: number;
}

interface OperatorWeeklyMileage {
  operatorId: string;
  operatorName: string;
  totalWeeklyKm: number;
  dailyBreakdown: DailyMileage[];
}

export async function getWeeklyMileageByOperator(startDate: Date, endDate: Date): Promise<OperatorWeeklyMileage[]> {
  const startTimestamp = Timestamp.fromDate(startDate);
  const endTimestamp = Timestamp.fromDate(endDate);

  const q = query(
    vehicleUsageLogsCollection,
    where('pickedUpTimestamp', '>=', startTimestamp),
    where('pickedUpTimestamp', '<=', endTimestamp),
    where('status', '==', 'completed')
  );

  const snapshot = await getDocs(q);
  const logs = snapshot.docs.map(docSnap => docSnap.data() as VehicleUsageLog);

  const operatorMileageMap: { [operatorId: string]: OperatorWeeklyMileage } = {};

  logs.forEach(log => {
    if (!operatorMileageMap[log.operatorId]) {
      operatorMileageMap[log.operatorId] = {
        operatorId: log.operatorId,
        operatorName: log.operatorName,
        totalWeeklyKm: 0,
        dailyBreakdown: [],
      };
    }
    const kmDriven = log.kmDriven || 0;
    operatorMileageMap[log.operatorId].totalWeeklyKm += kmDriven;

    if (log.pickedUpTimestamp) {
      const logDate = new Date(log.pickedUpTimestamp);
      const dateString = logDate.toISOString().split('T')[0];
      const dailyEntry = operatorMileageMap[log.operatorId].dailyBreakdown.find(d => d.date === dateString);
      if (dailyEntry) {
        dailyEntry.km += kmDriven;
      } else {
        operatorMileageMap[log.operatorId].dailyBreakdown.push({ date: dateString, km: kmDriven });
      }
    }
  });

  Object.values(operatorMileageMap).forEach(operator => {
    operator.dailyBreakdown.sort((a, b) => a.date.localeCompare(b.date));
  });

  return Object.values(operatorMileageMap);
}

export async function getActiveUsageLogForVehicleAndOperator(vehicleId: string, operatorId: string): Promise<VehicleUsageLog | null> {
    const q = query(
        vehicleUsageLogsCollection,
        where('vehicleId', '==', vehicleId),
        where('operatorId', '==', operatorId),
        where('status', '==', 'active'),
        orderBy('pickedUpTimestamp', 'desc'),
        limit(1)
    );

    const snapshot = await getDocs(q);
    if (snapshot.empty) {
        return null;
    }
    const data = snapshot.docs[0].data();
    return {
        id: snapshot.docs[0].id,
        ...data,
        pickedUpTimestamp: data.pickedUpTimestamp instanceof Timestamp ? data.pickedUpTimestamp.toDate().toISOString() : data.pickedUpTimestamp,
        routeDescription: data.routeDescription || undefined,
    } as VehicleUsageLog;
}

/**
 * Finds the operatorId for a given vehicle at a specific timestamp.
 * IMPORTANT: This query requires composite indexes in Firestore.
 * Check Firebase console if errors occur.
 * Example index needed: Collection: vehicleUsageLogs, Fields: vehicleId (ASC), status (ASC), pickedUpTimestamp (DESC)
 * Another for completed: vehicleId (ASC), status (ASC), pickedUpTimestamp (DESC), returnedTimestamp (ASC)
 */
export async function getOperatorForVehicleAtTime(vehicleId: string, infractionTimestampISO: string): Promise<string | null> {
  if (!vehicleId || !infractionTimestampISO) {
    console.log('[FrotaAgil-Debug][getOperatorForVehicleAtTime] Early exit: Missing vehicleId or infractionTimestampISO.');
    return null;
  }

  let infractionDateObj;
  try {
    infractionDateObj = new Date(infractionTimestampISO);
    if (isNaN(infractionDateObj.getTime())) {
      throw new Error('Invalid date string');
    }
  } catch (e) {
    console.error('[FrotaAgil-Debug][getOperatorForVehicleAtTime] Error parsing infractionTimestampISO:', infractionTimestampISO, e);
    return null;
  }
  
  const infractionTimeFs = Timestamp.fromDate(infractionDateObj);
  console.log(`[FrotaAgil-Debug][getOperatorForVehicleAtTime] Searching for vehicleId: "${vehicleId}" at infractionTime: ${infractionTimestampISO} (Firestore Timestamp: ${infractionTimeFs.toDate().toISOString()})`);

  // Query 1: Check completed logs
  // Find logs where pickedUpTimestamp <= infractionTimeFs
  // Then filter in code for returnedTimestamp >= infractionTimeFs
  const qCompleted = query(
    vehicleUsageLogsCollection,
    where('vehicleId', '==', vehicleId),
    where('status', '==', 'completed'),
    where('pickedUpTimestamp', '<=', infractionTimeFs),
    orderBy('pickedUpTimestamp', 'desc') // Process most recent relevant pickups first
  );

  try {
    console.log('[FrotaAgil-Debug][getOperatorForVehicleAtTime] Querying completed logs...');
    const completedSnapshot = await getDocs(qCompleted);
    console.log(`[FrotaAgil-Debug][getOperatorForVehicleAtTime] Found ${completedSnapshot.docs.length} potentially matching completed logs.`);

    for (const docSnap of completedSnapshot.docs) {
      const logData = docSnap.data();
      // Ensure returnedTimestamp exists and is a Firestore Timestamp
      if (logData.returnedTimestamp && logData.returnedTimestamp instanceof Timestamp) {
        const returnedTimestampFs = logData.returnedTimestamp as Timestamp;
        // Check if infraction falls within [pickedUpTimestamp, returnedTimestamp]
        if (logData.pickedUpTimestamp <= infractionTimeFs && returnedTimestampFs >= infractionTimeFs) {
          console.log(`[FrotaAgil-Debug][getOperatorForVehicleAtTime] Match found in COMPLETED log ${docSnap.id}. Operator: ${logData.operatorId}`);
          return logData.operatorId as string;
        }
      } else {
         console.warn(`[FrotaAgil-Debug][getOperatorForVehicleAtTime] Completed log ${docSnap.id} for vehicle ${vehicleId} is missing or has an invalid returnedTimestamp. Log data:`, JSON.stringify(logData));
      }
    }
  } catch (error: any) {
    console.error("[FrotaAgil-Debug][getOperatorForVehicleAtTime] Error querying completed logs:", error.message, error.code);
    if (error.code === 'failed-precondition') {
      console.error("Firestore query for completed logs failed due to a missing composite index. Please check Firebase console. Suggested index: collection 'vehicleUsageLogs', fields: vehicleId (ASC), status (ASC), pickedUpTimestamp (DESC). You might also need one including returnedTimestamp for more complex queries if this doesn't resolve.");
    }
    // Do not re-throw; proceed to check active logs.
  }

  // Query 2: Check active logs
  // Find active logs where pickedUpTimestamp <= infractionTimeFs
  const qActive = query(
    vehicleUsageLogsCollection,
    where('vehicleId', '==', vehicleId),
    where('status', '==', 'active'),
    where('pickedUpTimestamp', '<=', infractionTimeFs),
    orderBy('pickedUpTimestamp', 'desc'), // Get the most recent active log picked up before/at infraction
    limit(1)
  );

  try {
    console.log('[FrotaAgil-Debug][getOperatorForVehicleAtTime] Querying active logs...');
    const activeSnapshot = await getDocs(qActive);
    if (!activeSnapshot.empty) {
      const activeLogData = activeSnapshot.docs[0].data();
      console.log(`[FrotaAgil-Debug][getOperatorForVehicleAtTime] Match found in ACTIVE log ${activeSnapshot.docs[0].id}. Operator: ${activeLogData.operatorId}`);
      return activeLogData.operatorId as string;
    }
    console.log('[FrotaAgil-Debug][getOperatorForVehicleAtTime] No matching active log found.');
  } catch (error: any) {
    console.error("[FrotaAgil-Debug][getOperatorForVehicleAtTime] Error querying active logs:", error.message, error.code);
    if (error.code === 'failed-precondition') {
      console.error("Firestore query for active logs failed due to a missing composite index. Please check Firebase console. Suggested index: collection 'vehicleUsageLogs', fields: vehicleId (ASC), status (ASC), pickedUpTimestamp (DESC).");
    }
  }

  console.log('[FrotaAgil-Debug][getOperatorForVehicleAtTime] No operator found for the given criteria after checking both completed and active logs.');
  return null;
}
