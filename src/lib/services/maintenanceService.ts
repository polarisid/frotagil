
'use server';

import { db } from '@/lib/firebase';
import type { Maintenance, WorkshopChecklist } from '@/lib/types';
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
  Timestamp,
  writeBatch,
} from 'firebase/firestore';

const maintenancesCollection = collection(db, 'maintenances');

export async function getMaintenances(filters?: { vehicleId?: string; status?: string }): Promise<Maintenance[]> {
  let q = query(maintenancesCollection);

  if (filters?.vehicleId) {
    q = query(q, where('vehicleId', '==', filters.vehicleId));
    // Adicionando ordenação para a consulta específica do diálogo de detalhes
    // Isso provavelmente exigirá um índice: vehicleId ASC, scheduledDate DESC (ou ASC)
    q = query(q, orderBy('scheduledDate', 'desc')); 
  } else if (filters?.status) {
    // Se o status é filtrado, mas não o vehicleId, ordena por scheduledDate
    q = query(q, where('status', '==', filters.status));
    q = query(q, orderBy('scheduledDate', 'asc'));
  } else {
    // Se nenhum filtro específico é aplicado, ordena por scheduledDate como padrão
    q = query(q, orderBy('scheduledDate', 'asc'));
  }


  const snapshot = await getDocs(q);
  return snapshot.docs.map(docSnap => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      ...data,
      scheduledDate: data.scheduledDate instanceof Timestamp ? data.scheduledDate.toDate().toISOString().split('T')[0] : data.scheduledDate,
      completionDate: data.completionDate instanceof Timestamp ? data.completionDate.toDate().toISOString().split('T')[0] : data.completionDate,
      workshopDropOffDate: data.workshopDropOffDate instanceof Timestamp ? data.workshopDropOffDate.toDate().toISOString() : data.workshopDropOffDate,
      workshopPickUpDate: data.workshopPickUpDate instanceof Timestamp ? data.workshopPickUpDate.toDate().toISOString() : data.workshopPickUpDate,
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
      workshopDropOffDate: data.workshopDropOffDate instanceof Timestamp ? data.workshopDropOffDate.toDate().toISOString() : data.workshopDropOffDate,
      workshopPickUpDate: data.workshopPickUpDate instanceof Timestamp ? data.workshopPickUpDate.toDate().toISOString() : data.workshopPickUpDate,
    } as Maintenance;
  }
  return null;
}

export async function addMaintenance(maintenanceData: Partial<Omit<Maintenance, 'id'>>): Promise<Maintenance> {
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
    observations: inputObservations === undefined ? null : inputObservations, 
    status: inputStatus || 'planned',
    attachments: inputAttachments === undefined ? null : inputAttachments, 
  };

  dataToSave.cost = (inputCost !== undefined && inputCost !== null && String(inputCost).trim() !== '') ? Number(inputCost) : null;
  dataToSave.scheduledKm = (inputScheduledKm !== undefined && inputScheduledKm !== null && String(inputScheduledKm).trim() !== '') ? Number(inputScheduledKm) : null;

  const parseAndSetDate = (dateInput: string | Date | undefined | null, fieldName: string) => {
    if (dateInput === undefined || dateInput === null || String(dateInput).trim() === '') {
        dataToSave[fieldName] = null;
    } else {
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
        dataToSave[fieldName] = Timestamp.fromDate(dateObj);
      } else {
        console.warn(`Invalid ${fieldName} format provided:`, dateInput, "- setting to null.");
        dataToSave[fieldName] = null;
      }
    }
  };

  parseAndSetDate(inputScheduledDate, 'scheduledDate');

  if (dataToSave.status === 'completed') {
    parseAndSetDate(inputCompletionDate, 'completionDate');
  } else {
    dataToSave.completionDate = null;
  }

  const docRef = await addDoc(maintenancesCollection, dataToSave);
  const savedDocSnap = await getDoc(docRef);
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
    if (maintenanceData.hasOwnProperty(fieldName)) { 
        if (dateInput === undefined || dateInput === null || String(dateInput).trim() === '') {
          dataToUpdate[fieldName] = null;
        } else {
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
        }
    } else if (dataToUpdate.hasOwnProperty(fieldName)) { 
        delete dataToUpdate[fieldName]; 
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

  if (maintenanceData.hasOwnProperty('observations')) {
    dataToUpdate.observations = maintenanceData.observations === undefined ? null : maintenanceData.observations;
  }
   if (maintenanceData.hasOwnProperty('attachments')) {
    dataToUpdate.attachments = maintenanceData.attachments === undefined ? null : maintenanceData.attachments;
  }


  if (maintenanceData.hasOwnProperty('status') && maintenanceData.status !== 'completed') {
    dataToUpdate.completionDate = null;
  }

  
  Object.keys(dataToUpdate).forEach(key => {
    if (dataToUpdate[key] === undefined && !maintenanceData.hasOwnProperty(key as keyof typeof maintenanceData)) {
      delete dataToUpdate[key];
    }
  });

  await updateDoc(docRef, dataToUpdate);
}

export async function deleteMaintenance(id: string): Promise<void> {
  await deleteDoc(doc(db, 'maintenances', id));
}

export async function dropOffVehicleAtWorkshop(data: {
    maintenanceId: string,
    vehicleId: string,
    mileage: number,
    workshopName: string,
    workshopChecklist: WorkshopChecklist,
    workshopDropOffObservations?: string,
}): Promise<void> {

    const batch = writeBatch(db);

    // 1. Update vehicle status and mileage
    const vehicleRef = doc(db, 'vehicles', data.vehicleId);
    batch.update(vehicleRef, { 
        status: 'maintenance',
        mileage: data.mileage 
    });

    // 2. Update maintenance record
    const maintenanceRef = doc(db, 'maintenances', data.maintenanceId);
    batch.update(maintenanceRef, {
        status: 'in_progress',
        workshopName: data.workshopName,
        workshopChecklist: data.workshopChecklist,
        workshopDropOffDate: Timestamp.fromDate(new Date()),
        workshopDropOffObservations: data.workshopDropOffObservations || null,
    });
    
    await batch.commit();
}

export async function pickUpVehicleFromWorkshop(data: {
    maintenanceId: string,
    vehicleId: string,
    workshopChecklist: WorkshopChecklist,
    workshopPickUpObservations?: string,
    cost?: number,
}): Promise<void> {

    const batch = writeBatch(db);
    const completionDate = new Date();

    // 1. Update vehicle status to 'active'
    const vehicleRef = doc(db, 'vehicles', data.vehicleId);
    batch.update(vehicleRef, { status: 'active' });

    // 2. Update maintenance record to 'completed'
    const maintenanceRef = doc(db, 'maintenances', data.maintenanceId);
    const updatePayload: Partial<Maintenance> & { [key: string]: any } = {
        status: 'completed',
        workshopChecklist: data.workshopChecklist,
        workshopPickUpDate: Timestamp.fromDate(completionDate),
        completionDate: Timestamp.fromDate(completionDate),
        workshopPickUpObservations: data.workshopPickUpObservations || null,
    };
    if (data.cost !== undefined) {
        updatePayload.cost = data.cost;
    }

    batch.update(maintenanceRef, updatePayload);
    
    await batch.commit();
}


    
