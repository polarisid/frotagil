
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
      initialMileage = vehicleData.mileage;
    } else {
      console.warn(`Vehicle with ID ${vehicleId} not found when creating usage log. Initial mileage set to 0.`);
 initialMileage = 0; // Ensure it's 0 if vehicle not found
    }
  } catch (error) {
    console.error(`Error fetching vehicle ${vehicleId} for initial mileage:`, error);
    initialMileage = 0; // Ensure it's 0 if fetching fails
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
  // Explicitly type logData to include initialMileage and ensure pickedUpTimestamp is a Firestore Timestamp for conversion
  const logData = logDoc.data() as Omit<VehicleUsageLog, 'id' | 'pickedUpTimestamp'> & { pickedUpTimestamp: Timestamp, initialMileage?: number };
  
  const returnedTimestamp = new Date();
  let durationMinutes = 0;
  let kmDriven: number | undefined = undefined;

  if (logData.pickedUpTimestamp instanceof Timestamp) {
    durationMinutes = differenceInMinutes(returnedTimestamp, logData.pickedUpTimestamp.toDate());
  } else if (typeof logData.pickedUpTimestamp === 'string') { // Should not happen for new logs
     durationMinutes = differenceInMinutes(returnedTimestamp, new Date(logData.pickedUpTimestamp));
  }

  if (typeof logData.initialMileage === 'number' && typeof finalMileage === 'number') {
    if (finalMileage >= logData.initialMileage) {
      kmDriven = finalMileage - logData.initialMileage;
    } else {
      // This case should ideally be caught by form validation when submitting final mileage
      console.warn(`Final mileage (${finalMileage}) is less than initial mileage (${logData.initialMileage}) for log ${logDoc.id}. kmDriven will be 0 or undefined.`);
      kmDriven = 0; // Or handle as an error/undefined
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
