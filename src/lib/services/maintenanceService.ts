
'use server';

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
  let q = query(maintenancesCollection); 
  
  if (filters?.vehicleId) {
    q = query(q, where('vehicleId', '==', filters.vehicleId));
  }
  if (filters?.status) {
    q = query(q, where('status', '==', filters.status));
  }
  // Adicionando ordenação para consistência, pode ser ajustado conforme necessário
  q = query(q, orderBy('scheduledDate', 'desc'), orderBy('description', 'asc'));


  const snapshot = await getDocs(q);
  return snapshot.docs.map(docSnap => {
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

export async function addMaintenance(maintenanceData: Omit<Maintenance, 'id'>): Promise<Maintenance> {
  const {
    vehicleId,
    type,
    description,
    priority,
    status: inputStatus,
    scheduledDate: inputScheduledDate,
    scheduledKm: inputScheduledKm,
    completionDate: inputCompletionDate,
    cost: inputCost,
    observations: inputObservations,
    attachments: inputAttachments,
  } = maintenanceData;

  const dataToSave: any = {
    vehicleId,
    type,
    description,
    priority,
    observations: inputObservations || null,
    status: inputStatus || 'planned',
    attachments: inputAttachments || null,
  };

  dataToSave.cost = (inputCost !== undefined && inputCost !== null && String(inputCost).trim() !== '') ? Number(inputCost) : null;
  dataToSave.scheduledKm = (inputScheduledKm !== undefined && inputScheduledKm !== null && String(inputScheduledKm).trim() !== '') ? Number(inputScheduledKm) : null;

  const parseAndSetDate = (dateInput: string | Date | undefined | null, fieldName: string) => {
    if (dateInput) {
      let dateObj;
      if (typeof dateInput === 'string') {
        // Handles YYYY-MM-DD format
        const dateParts = dateInput.split('-').map(part => parseInt(part, 10));
        if (dateParts.length === 3 && !isNaN(dateParts[0]) && !isNaN(dateParts[1]) && !isNaN(dateParts[2])) {
          // Use UTC to represent the date at midnight, avoiding timezone shifts for date-only fields
          dateObj = new Date(Date.UTC(dateParts[0], dateParts[1] - 1, dateParts[2]));
        }
      } else if (dateInput instanceof Date) {
        dateObj = dateInput;
      }

      if (dateObj && !isNaN(dateObj.getTime())) {
        dataToSave[fieldName] = Timestamp.fromDate(dateObj);
      } else {
        console.warn(`Invalid ${fieldName} format provided:`, dateInput, "- setting to null.");
        dataToSave[fieldName] = null;
      }
    } else {
      dataToSave[fieldName] = null;
    }
  };

  parseAndSetDate(inputScheduledDate, 'scheduledDate');

  if (dataToSave.status === 'completed') {
    parseAndSetDate(inputCompletionDate, 'completionDate');
    // If status is 'completed' but completionDate ends up null (e.g., not provided from Excel or invalid)
    // this might be something to flag or handle based on business rules. For now, it will be null.
  } else {
    dataToSave.completionDate = null; // Ensure completionDate is null if status is not 'completed'
  }
  
  const docRef = await addDoc(maintenancesCollection, dataToSave);
  const savedDocSnap = await getDoc(docRef); // Renamed to avoid conflict
  const savedData = savedDocSnap.data()!;

  return {
    id: docRef.id,
    vehicleId: savedData.vehicleId,
    type: savedData.type,
    description: savedData.description,
    priority: savedData.priority,
    status: savedData.status,
    observations: savedData.observations,
    cost: savedData.cost,
    scheduledKm: savedData.scheduledKm,
    scheduledDate: savedData.scheduledDate instanceof Timestamp ? savedData.scheduledDate.toDate().toISOString().split('T')[0] : undefined,
    completionDate: savedData.completionDate instanceof Timestamp ? savedData.completionDate.toDate().toISOString().split('T')[0] : undefined,
    attachments: savedData.attachments,
  } as Maintenance;
}


export async function updateMaintenance(id: string, maintenanceData: Partial<Omit<Maintenance, 'id'>>): Promise<void> {
  const docRef = doc(db, 'maintenances', id);
  const dataToUpdate: any = { ...maintenanceData }; 

  const parseAndPrepareDateForUpdate = (dateInput: string | Date | undefined | null, fieldName: string) => {
    if (dateInput === undefined && !maintenanceData.hasOwnProperty(fieldName)) {
      // Field not in update payload, do nothing
      return;
    }
    if (dateInput === null || dateInput === '') {
      dataToUpdate[fieldName] = null;
    } else if (dateInput) {
      let dateObj;
      if (typeof dateInput === 'string') {
        const dateParts = dateInput.split('-').map(part => parseInt(part, 10));
        if (dateParts.length === 3 && !isNaN(dateParts[0]) && !isNaN(dateParts[1]) && !isNaN(dateParts[2])) {
           dateObj = new Date(Date.UTC(dateParts[0], dateParts[1] - 1, dateParts[2]));
        }
      } else if (dateInput instanceof Date) {
        dateObj = dateInput;
      }

      if (dateObj && !isNaN(dateObj.getTime())) {
        dataToUpdate[fieldName] = Timestamp.fromDate(dateObj);
      } else {
        console.warn(`Invalid ${fieldName} format for update:`, dateInput, "- setting to null.");
        dataToUpdate[fieldName] = null;
      }
    } else {
      dataToUpdate[fieldName] = null;
    }
  };
  
  parseAndPrepareDateForUpdate(maintenanceData.scheduledDate, 'scheduledDate');
  parseAndPrepareDateForUpdate(maintenanceData.completionDate, 'completionDate');


  if (maintenanceData.hasOwnProperty('cost')) {
     dataToUpdate.cost = (maintenanceData.cost !== undefined && maintenanceData.cost !== null && String(maintenanceData.cost).trim() !== '') ? Number(maintenanceData.cost) : null;
  }
  if (maintenanceData.hasOwnProperty('scheduledKm')) {
    dataToUpdate.scheduledKm = (maintenanceData.scheduledKm !== undefined && maintenanceData.scheduledKm !== null && String(maintenanceData.scheduledKm).trim() !== '') ? Number(maintenanceData.scheduledKm) : null;
  }
  
  // Ensure completionDate is null if status is being updated to something other than 'completed'
  if (maintenanceData.hasOwnProperty('status') && maintenanceData.status !== 'completed') {
    dataToUpdate.completionDate = null;
  }
  // If status is being updated to 'completed' and no completionDate is provided, it might be set to null or a default.
  // The current EditMaintenanceForm sets today's date if status becomes 'completed' and completionDate is empty.

  // Remove undefined fields that were not explicitly set to null
  Object.keys(dataToUpdate).forEach(key => {
    if (dataToUpdate[key] === undefined && !maintenanceData.hasOwnProperty(key)) {
      delete dataToUpdate[key];
    } else if (dataToUpdate[key] === undefined && maintenanceData.hasOwnProperty(key) && maintenanceData[key as keyof typeof maintenanceData] === undefined){
        // If a field was explicitly passed as undefined in maintenanceData (e.g. from form logic that clears a field)
        // ensure it becomes null for Firestore.
        if(key === 'cost' || key === 'scheduledKm' || key === 'scheduledDate' || key === 'completionDate' || key === 'observations' || key === 'attachments'){
            dataToUpdate[key] = null;
        } else {
             // For other fields, undefined might mean "don't change" or could be an error.
             // For safety, if not a nullable field handled above, remove it to avoid Firestore error.
             delete dataToUpdate[key];
        }
    }
  });

  await updateDoc(docRef, dataToUpdate);
}

export async function deleteMaintenance(id: string): Promise<void> {
  await deleteDoc(doc(db, 'maintenances', id));
}

