
import { db } from '@/lib/firebase';
import type { Maintenance } from '@/lib/types';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  where,
  Timestamp
} from 'firebase/firestore';

const maintenancesCollection = collection(db, 'maintenances');

export async function getMaintenances(filters?: { vehicleId?: string; status?: string }): Promise<Maintenance[]> {
  // Start with a base query without default ordering that might hide items
  let q = query(maintenancesCollection); 
  
  // Apply filters
  if (filters?.vehicleId) {
    q = query(q, where('vehicleId', '==', filters.vehicleId));
  }
  if (filters?.status) {
    q = query(q, where('status', '==', filters.status));
  }

  // If a specific date-related sort is needed later, it can be added conditionally
  // For now, not ordering by scheduledDate by default to ensure all items appear.
  // If an order is strictly necessary, consider a field that always exists or a more complex ordering strategy.
  // For example, if you wanted to keep previous behavior but ensure items without scheduledDate are at the end:
  // q = query(q, orderBy('scheduledDate', 'desc')); // This was the original line, re-evaluate if needed.
  // One might need to query twice or sort client-side if Firestore's null handling in orderBy is problematic.

  // A common practice if a default order is needed is to order by a timestamp of creation if available,
  // or another consistently present field. For now, let's rely on Firestore's natural order or filtered order.

  const snapshot = await getDocs(q);
  return snapshot.docs.map(docSnap => { // Renamed doc to docSnap to avoid conflict
    const data = docSnap.data();
    return { 
      id: docSnap.id, 
      ...data,
      scheduledDate: data.scheduledDate instanceof Timestamp ? data.scheduledDate.toDate().toISOString().split('T')[0] : data.scheduledDate,
      completionDate: data.completionDate instanceof Timestamp ? data.completionDate.toDate().toISOString().split('T')[0] : data.completionDate,
    } as Maintenance;
  });
}

export async function getMaintenanceById(id: string): Promise<Maintenance | null> {
  const docRef = doc(db, 'maintenances', id);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    const data = docSnap.data();
    return { 
      id: docSnap.id, 
      ...data,
      scheduledDate: data.scheduledDate instanceof Timestamp ? data.scheduledDate.toDate().toISOString().split('T')[0] : data.scheduledDate,
      completionDate: data.completionDate instanceof Timestamp ? data.completionDate.toDate().toISOString().split('T')[0] : data.completionDate,
    } as Maintenance;
  }
  return null;
}

export async function addMaintenance(maintenanceData: Omit<Maintenance, 'id' | 'status' | 'completionDate'>): Promise<Maintenance> {
  const { cost, scheduledKm, scheduledDate, attachments, ...restOfData } = maintenanceData;

  const dataToSave: any = {
    ...restOfData,
    status: 'planned', // Default status for new maintenance
  };

  if (cost !== undefined) {
    dataToSave.cost = Number(cost); // Ensure it's a number
  }
  if (scheduledKm !== undefined) {
    dataToSave.scheduledKm = Number(scheduledKm); // Ensure it's a number
  } else {
    // Ensure scheduledKm is explicitly null or not set if not provided
    dataToSave.scheduledKm = null; 
  }

  if (scheduledDate) { // This is 'yyyy-MM-dd' string or undefined from the form
    const dateParts = scheduledDate.split('-').map(part => parseInt(part, 10));
    if (dateParts.length === 3 && !isNaN(dateParts[0]) && !isNaN(dateParts[1]) && !isNaN(dateParts[2])) {
        dataToSave.scheduledDate = Timestamp.fromDate(new Date(dateParts[0], dateParts[1] - 1, dateParts[2]));
    } else {
        console.warn("Invalid scheduledDate format received:", scheduledDate);
        dataToSave.scheduledDate = null; // Set to null if invalid
    }
  } else {
    dataToSave.scheduledDate = null; // Ensure scheduledDate is explicitly null if not provided
  }

  if (attachments !== undefined) { 
    dataToSave.attachments = attachments;
  }
  
  const docRef = await addDoc(maintenancesCollection, dataToSave);
  
  const savedDoc = await getDoc(docRef);
  const savedData = savedDoc.data();

  return {
    id: docRef.id,
    vehicleId: maintenanceData.vehicleId,
    type: maintenanceData.type,
    description: maintenanceData.description,
    priority: maintenanceData.priority,
    status: 'planned',
    observations: maintenanceData.observations,
    cost: savedData?.cost, 
    scheduledKm: savedData?.scheduledKm, 
    scheduledDate: savedData?.scheduledDate instanceof Timestamp ? savedData.scheduledDate.toDate().toISOString().split('T')[0] : undefined,
    attachments: savedData?.attachments,
  } as Maintenance;
}


export async function updateMaintenance(id: string, maintenanceData: Partial<Omit<Maintenance, 'id'>>): Promise<void> {
  const docRef = doc(db, 'maintenances', id);
  const dataToUpdate: any = { ...maintenanceData }; 

  if (maintenanceData.scheduledDate && typeof maintenanceData.scheduledDate === 'string') {
    const dateParts = maintenanceData.scheduledDate.split('-').map(part => parseInt(part, 10));
     if (dateParts.length === 3 && !isNaN(dateParts[0]) && !isNaN(dateParts[1]) && !isNaN(dateParts[2])) {
        dataToUpdate.scheduledDate = Timestamp.fromDate(new Date(dateParts[0], dateParts[1] - 1, dateParts[2]));
    } else {
        console.warn("Invalid scheduledDate format for update:", maintenanceData.scheduledDate);
        delete dataToUpdate.scheduledDate; 
    }
  } else if (maintenanceData.hasOwnProperty('scheduledDate') && maintenanceData.scheduledDate === undefined) {
    // If explicitly set to undefined (e.g. when scheduleBy changes), store as null
    dataToUpdate.scheduledDate = null;
  }


  if (maintenanceData.completionDate && typeof maintenanceData.completionDate === 'string') {
    const dateParts = maintenanceData.completionDate.split('-').map(part => parseInt(part, 10));
     if (dateParts.length === 3 && !isNaN(dateParts[0]) && !isNaN(dateParts[1]) && !isNaN(dateParts[2])) {
        dataToUpdate.completionDate = Timestamp.fromDate(new Date(dateParts[0], dateParts[1] - 1, dateParts[2]));
    } else {
        console.warn("Invalid completionDate format for update:", maintenanceData.completionDate);
        delete dataToUpdate.completionDate; 
    }
  } else if (maintenanceData.hasOwnProperty('completionDate') && maintenanceData.completionDate === undefined) {
    dataToUpdate.completionDate = null;
  }

  if (dataToUpdate.hasOwnProperty('cost') && dataToUpdate.cost !== undefined) {
     dataToUpdate.cost = Number(dataToUpdate.cost);
  } else if (dataToUpdate.hasOwnProperty('cost') && dataToUpdate.cost === undefined) {
    dataToUpdate.cost = null;
  }

  if (dataToUpdate.hasOwnProperty('scheduledKm') && dataToUpdate.scheduledKm !== undefined) {
    dataToUpdate.scheduledKm = Number(dataToUpdate.scheduledKm);
  } else if (dataToUpdate.hasOwnProperty('scheduledKm') && dataToUpdate.scheduledKm === undefined) {
     dataToUpdate.scheduledKm = null;
  }
  
  Object.keys(dataToUpdate).forEach(key => {
    if (dataToUpdate[key] === undefined && !maintenanceData.hasOwnProperty(key)) {
      // Avoid deleting fields not explicitly passed in maintenanceData unless they were set to undefined
      delete dataToUpdate[key];
    }
  });

  await updateDoc(docRef, dataToUpdate);
}

export async function deleteMaintenance(id: string): Promise<void> {
  await deleteDoc(doc(db, 'maintenances', id));
}
