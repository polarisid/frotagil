
'use server';

import { db } from '@/lib/firebase';
import type { Fine } from '@/lib/types';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';

const finesCollection = collection(db, 'fines');

// Get all fines with optional filters
export async function getFines(filters?: {
  operatorId?: string;
  vehicleId?: string;
  status?: Fine['status'];
  startDate?: string; // Infraction date range
  endDate?: string;   // Infraction date range
}): Promise<Fine[]> {
  let q = query(finesCollection);

  if (filters?.operatorId) {
    q = query(q, where('operatorId', '==', filters.operatorId));
  }
  if (filters?.vehicleId) {
    q = query(q, where('vehicleId', '==', filters.vehicleId));
  }
  if (filters?.status) {
    q = query(q, where('status', '==', filters.status));
  }
  if (filters?.startDate) {
    q = query(q, where('date', '>=', Timestamp.fromDate(new Date(filters.startDate + "T00:00:00Z"))));
  }
  if (filters?.endDate) {
    q = query(q, where('date', '<=', Timestamp.fromDate(new Date(filters.endDate + "T23:59:59Z"))));
  }
  
  q = query(q, orderBy('date', 'desc')); // Order by infraction date by default

  const snapshot = await getDocs(q);
  return snapshot.docs.map(docSnap => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      ...data,
      date: data.date instanceof Timestamp ? data.date.toDate().toISOString() : data.date,
      dueDate: data.dueDate instanceof Timestamp ? data.dueDate.toDate().toISOString() : data.dueDate,
      createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : data.createdAt,
    } as Fine;
  });
}

// Get fines for a specific operator
export async function getFinesByOperatorId(operatorId: string): Promise<Fine[]> {
  const q = query(finesCollection, where('operatorId', '==', operatorId), orderBy('date', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(docSnap => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      ...data,
      date: data.date instanceof Timestamp ? data.date.toDate().toISOString() : data.date,
      dueDate: data.dueDate instanceof Timestamp ? data.dueDate.toDate().toISOString() : data.dueDate,
      createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : data.createdAt,
    } as Fine;
  });
}

// Get a single fine by its ID
export async function getFineById(id: string): Promise<Fine | null> {
  const docRef = doc(db, 'fines', id);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      ...data,
      date: data.date instanceof Timestamp ? data.date.toDate().toISOString() : data.date,
      dueDate: data.dueDate instanceof Timestamp ? data.dueDate.toDate().toISOString() : data.dueDate,
      createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : data.createdAt,
    } as Fine;
  }
  return null;
}

// Add a new fine
export async function addFine(fineData: Omit<Fine, 'id' | 'createdAt'>): Promise<Fine> {
  const dataToSave = {
    ...fineData,
    date: Timestamp.fromDate(new Date(fineData.date)),
    dueDate: Timestamp.fromDate(new Date(fineData.dueDate)),
    createdAt: Timestamp.fromDate(new Date()), // System registration date
    amount: Number(fineData.amount), // Ensure amount is a number
  };
  const docRef = await addDoc(finesCollection, dataToSave);
  return { 
    id: docRef.id, 
    ...fineData, 
    amount: Number(fineData.amount),
    createdAt: (dataToSave.createdAt as Timestamp).toDate().toISOString() 
  };
}

// Update an existing fine
export async function updateFine(id: string, fineData: Partial<Omit<Fine, 'id' | 'createdAt'>>): Promise<void> {
  const docRef = doc(db, 'fines', id);
  const dataToUpdate: { [key: string]: any } = { ...fineData };

  if (fineData.date) {
    dataToUpdate.date = Timestamp.fromDate(new Date(fineData.date));
  }
  if (fineData.dueDate) {
    dataToUpdate.dueDate = Timestamp.fromDate(new Date(fineData.dueDate));
  }
  if (fineData.amount !== undefined) {
    dataToUpdate.amount = Number(fineData.amount);
  }
  
  // Prevent createdAt from being updated
  delete dataToUpdate.createdAt; 

  await updateDoc(docRef, dataToUpdate);
}

// Delete a fine (consider if soft delete is preferred)
// For now, this is a hard delete.
// export async function deleteFine(id: string): Promise<void> {
//   await deleteDoc(doc(db, 'fines', id));
// }
