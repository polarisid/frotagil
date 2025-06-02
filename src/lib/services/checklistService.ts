
import { db } from '@/lib/firebase';
import type { Checklist, Vehicle } from '@/lib/types';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
  limit
} from 'firebase/firestore';
import { createVehicleUsageLog, getActiveUsageLogForVehicleAndOperator } from './vehicleUsageLogService';
import { updateVehicle as updateVehicleService, getVehicleById } from './vehicleService'; // Renamed to avoid conflict

const checklistsCollection = collection(db, 'checklists');

export async function getChecklists(filters?: { vehicleId?: string; operatorId?: string; date?: string }): Promise<Checklist[]> {
  let q = query(checklistsCollection, orderBy('date', 'desc'));

  if (filters?.vehicleId) {
    q = query(q, where('vehicleId', '==', filters.vehicleId));
  }
  if (filters?.operatorId) {
    q = query(q, where('operatorId', '==', filters.operatorId));
  }
  if (filters?.date) {
    const startDate = Timestamp.fromDate(new Date(filters.date + "T00:00:00"));
    const endDate = Timestamp.fromDate(new Date(filters.date + "T23:59:59"));
    q = query(q, where('date', '>=', startDate), where('date', '<=', endDate));
  }

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      date: data.date instanceof Timestamp ? data.date.toDate().toISOString() : data.date
    } as Checklist;
  });
}

export async function getChecklistById(id: string): Promise<Checklist | null> {
  const docRef = doc(db, 'checklists', id);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    const data = docSnap.data();
    return {
        id: docSnap.id,
        ...data,
        date: data.date instanceof Timestamp ? data.date.toDate().toISOString() : data.date
    } as Checklist;
  }
  return null;
}

export async function addChecklist(checklistData: Omit<Checklist, 'id' | 'date'> & { date: Date }): Promise<Checklist> {
  const dataToSave = {
    ...checklistData,
    date: Timestamp.fromDate(checklistData.date),
  };
  const docRef = await addDoc(checklistsCollection, dataToSave);

  // Update vehicle mileage
  if (checklistData.mileage !== undefined) {
    await updateVehicleService(checklistData.vehicleId, { mileage: checklistData.mileage });
  }

  // Check if this is the first checklist for the current vehicle possession
  // and create VehicleUsageLog if needed.
  const vehicle = await getVehicleById(checklistData.vehicleId);
  if (vehicle && vehicle.pickedUpDate && vehicle.assignedOperatorId === checklistData.operatorId) {
    const checklistTimestamp = Timestamp.fromDate(checklistData.date);
    const pickedUpTimestamp = Timestamp.fromDate(new Date(vehicle.pickedUpDate));

    if (checklistTimestamp >= pickedUpTimestamp) {
      const existingActiveLog = await getActiveUsageLogForVehicleAndOperator(checklistData.vehicleId, checklistData.operatorId);
      if (!existingActiveLog) {
        if (checklistData.mileage === undefined) {
          console.warn(`Cannot create VehicleUsageLog for checklist ${docRef.id} because checklist mileage is undefined.`);
        } else {
          await createVehicleUsageLog(
            checklistData.vehicleId,
            vehicle.plate, // Assuming vehicle object has plate
            checklistData.operatorId,
            checklistData.operatorName,
            checklistData.mileage // This is the initial mileage for the usage log
          );
        }
      }
    }
  }


  return {
    id: docRef.id,
    ...checklistData,
    date: checklistData.date.toISOString()
  };
}

export async function updateChecklist(id: string, checklistData: Partial<Omit<Checklist, 'id'>>): Promise<void> {
  const docRef = doc(db, 'checklists', id);
  const dataToUpdate = { ...checklistData };
  if (checklistData.date && typeof checklistData.date === 'string') {
    (dataToUpdate as any).date = Timestamp.fromDate(new Date(checklistData.date));
  } else if (checklistData.date && checklistData.date instanceof Date) {
     (dataToUpdate as any).date = Timestamp.fromDate(checklistData.date);
  }
  await updateDoc(docRef, dataToUpdate);
}

export async function deleteChecklist(id: string): Promise<void> {
  await deleteDoc(doc(db, 'checklists', id));
}

export async function getChecklistsForOperator(
  operatorId: string,
  filters?: { vehicleId?: string; date?: string }
): Promise<Checklist[]> {
  let q = query(checklistsCollection, where('operatorId', '==', operatorId));

  if (filters?.vehicleId) {
    q = query(q, where('vehicleId', '==', filters.vehicleId));
  }
  if (filters?.date) {
    const startDate = Timestamp.fromDate(new Date(filters.date + "T00:00:00Z"));
    const endDate = Timestamp.fromDate(new Date(filters.date + "T23:59:59Z"));
    q = query(q, where('date', '>=', startDate), where('date', '<=', endDate));
  }
  
  q = query(q, orderBy('date', 'desc'));

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => {
    const data = doc.data();
    return {
        id: doc.id,
        ...data,
        date: data.date instanceof Timestamp ? data.date.toDate().toISOString() : data.date
    } as Checklist;
  });
}

export async function getTodayChecklistForVehicle(vehicleId: string, operatorId: string): Promise<Checklist | null> {
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
  const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

  const q = query(checklistsCollection,
    where('vehicleId', '==', vehicleId),
    where('operatorId', '==', operatorId),
    where('date', '>=', Timestamp.fromDate(startOfDay)),
    where('date', '<=', Timestamp.fromDate(endOfDay)),
    orderBy('date', 'desc'),
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
    date: data.date instanceof Timestamp ? data.date.toDate().toISOString() : data.date
  } as Checklist;
}

export async function getChecklistForCurrentPossession(
  vehicleId: string,
  operatorId: string,
  pickedUpDateISO: string 
): Promise<Checklist | null> {
  if (!pickedUpDateISO || typeof pickedUpDateISO !== 'string') {
      console.warn('getChecklistForCurrentPossession: pickedUpDateISO é inválida ou não fornecida.');
      return null;
  }

  let pickedUpTimestamp;
  try {
    pickedUpTimestamp = Timestamp.fromDate(new Date(pickedUpDateISO));
  } catch (error) {
    console.error('getChecklistForCurrentPossession: Erro ao converter pickedUpDateISO para Timestamp:', error);
    return null;
  }

  const q = query(
    checklistsCollection,
    where('vehicleId', '==', vehicleId),
    where('operatorId', '==', operatorId),
    where('date', '>=', pickedUpTimestamp), 
    orderBy('date', 'desc'),
    limit(1)
  );

  try {
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      return null;
    }
    const data = snapshot.docs[0].data();
    return {
      id: snapshot.docs[0].id,
      ...data,
      date: data.date instanceof Timestamp ? data.date.toDate().toISOString() : data.date,
    } as Checklist;
  } catch (error) {
    console.error("Erro ao buscar checklist para posse atual:", error);
    if ((error as any)?.code === 'failed-precondition') {
        console.warn("Firestore query failed, likely due to a missing composite index. Please check Firebase console for index creation link.");
    }
    return null;
  }
}

export async function getWeeklyChecklistsByOperator(
  startDate: Date,
  endDate: Date
): Promise<{ [operatorId: string]: number }> {
  const startTimestamp = Timestamp.fromDate(startDate);
  const endTimestamp = Timestamp.fromDate(endDate);

  const q = query(
    checklistsCollection,
    where('date', '>=', startTimestamp),
    where('date', '<=', endTimestamp)
  );

  try {
    const snapshot = await getDocs(q);
    const checklistsByOperator: { [operatorId: string]: number } = {};

    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const operatorId = data.operatorId as string;
      checklistsByOperator[operatorId] = (checklistsByOperator[operatorId] || 0) + 1;
    });

    return checklistsByOperator;
  } catch (error) {
    console.error("Erro ao buscar checklists semanais por operador:", error);
    throw error; 
  }
}

