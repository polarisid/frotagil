
'use server';

import { db } from '@/lib/firebase';
import type { Vehicle, VehicleUsageLog } from '@/lib/types';
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  query,
  where,
  getDocs,
  Timestamp,
  orderBy,
  limit,
  getDoc
} from 'firebase/firestore';
import { differenceInMinutes } from 'date-fns';

const vehicleUsageLogsCollection = collection(db, 'vehicleUsageLogs');
const vehiclesCollection = collection(db, 'vehicles'); // For fetching vehicle mileage

export async function createVehicleUsageLog(
  vehicleId: string,
  vehiclePlate: string,
  operatorId: string,
  operatorName: string
): Promise<string> {
  const pickedUpTimestamp = new Date();
  
  let initialMileage: number = 0; // Initialize with 0
  try {
    const vehicleDocRef = doc(vehiclesCollection, vehicleId);
    const vehicleDocSnap = await getDoc(vehicleDocRef);
    if (vehicleDocSnap.exists()) {
      const vehicleData = vehicleDocSnap.data() as Vehicle;
      initialMileage = vehicleData.mileage ?? 0; // Use existing mileage or default to 0
    } else {
      console.warn(`Vehicle with ID ${vehicleId} not found when creating usage log. Initial mileage set to 0.`);
      initialMileage = 0; 
    }
  } catch (error) {
    console.error(`Error fetching vehicle ${vehicleId} for initial mileage:`, error);
    initialMileage = 0; 
  }

  const logEntry: Omit<VehicleUsageLog, 'id' | 'returnedTimestamp' | 'durationMinutes' | 'finalMileage' | 'kmDriven'> = {
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
    pickedUpTimestamp: Timestamp.fromDate(pickedUpTimestamp), // Store as Firestore Timestamp
  });
  return docRef.id;
}

export async function completeVehicleUsageLog(
  vehicleId: string,
  operatorId: string,
  finalMileage: number // New KM reading at the time of return
): Promise<void> {
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
    console.warn(`No active usage log found for vehicle ${vehicleId} and operator ${operatorId} to complete.`);
    return;
  }

  const logDoc = snapshot.docs[0];
  const logData = logDoc.data() as Omit<VehicleUsageLog, 'id' | 'pickedUpTimestamp'> & { pickedUpTimestamp: Timestamp, initialMileage?: number };
  
  const returnedTimestamp = new Date();
  let durationMinutes = 0;
  let kmDriven: number | undefined = undefined;

  if (logData.pickedUpTimestamp instanceof Timestamp) {
    durationMinutes = differenceInMinutes(returnedTimestamp, logData.pickedUpTimestamp.toDate());
  } else if (typeof logData.pickedUpTimestamp === 'string') { 
     durationMinutes = differenceInMinutes(returnedTimestamp, new Date(logData.pickedUpTimestamp));
  }

  if (typeof logData.initialMileage === 'number' && typeof finalMileage === 'number') {
    if (finalMileage >= logData.initialMileage) {
      kmDriven = finalMileage - logData.initialMileage;
    } else {
      console.warn(`Final mileage (${finalMileage}) is less than initial mileage (${logData.initialMileage}) for log ${logDoc.id}. kmDriven will be 0.`);
      kmDriven = 0; 
    }
  }

  await updateDoc(doc(db, 'vehicleUsageLogs', logDoc.id), {
    returnedTimestamp: Timestamp.fromDate(returnedTimestamp),
    durationMinutes,
    finalMileage,
    kmDriven,
    status: 'completed',
  });
}

export async function getVehicleUsageLogs(filters: {
  startDate?: string; // ISO Date string yyyy-MM-dd
  endDate?: string;   // ISO Date string yyyy-MM-dd
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
    } as VehicleUsageLog;
  });
}


interface DailyMileage {
  date: string; // YYYY-MM-DD
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
    where('status', '==', 'completed') // Only consider completed logs for KM driven
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

    // Add to daily breakdown
    if (log.pickedUpTimestamp) { // Ensure timestamp exists
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

  // Sort daily breakdown by date
  Object.values(operatorMileageMap).forEach(operator => {
    operator.dailyBreakdown.sort((a, b) => a.date.localeCompare(b.date));
  });

  // Convert map to array
  const result = Object.values(operatorMileageMap);

  return result;
}
