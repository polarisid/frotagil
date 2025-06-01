
import { db } from '@/lib/firebase';
import type { Incident } from '@/lib/types';
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

const incidentsCollection = collection(db, 'incidents');

export async function getIncidents(filters?: { vehicleId?: string; status?: string; operatorId?: string }): Promise<Incident[]> {
  let q = query(incidentsCollection, orderBy('date', 'desc'));

  if (filters?.vehicleId) {
    q = query(q, where('vehicleId', '==', filters.vehicleId));
  }
  if (filters?.status) {
    q = query(q, where('status', '==', filters.status));
  }
  if (filters?.operatorId) {
    q = query(q, where('operatorId', '==', filters.operatorId));
  }

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => {
    const data = doc.data();
    return { 
      id: doc.id, 
      ...data,
      date: data.date instanceof Timestamp ? data.date.toDate().toISOString() : data.date
    } as Incident;
  });
}

export async function getIncidentById(id: string): Promise<Incident | null> {
  const docRef = doc(db, 'incidents', id);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    const data = docSnap.data();
    return { 
        id: docSnap.id, 
        ...data,
        date: data.date instanceof Timestamp ? data.date.toDate().toISOString() : data.date
    } as Incident;
  }
  return null;
}

export async function addIncident(incidentData: Omit<Incident, 'id' | 'date'> & { date: Date }): Promise<Incident> {
   const dataToSave = {
    ...incidentData,
    date: Timestamp.fromDate(incidentData.date),
  };
  const docRef = await addDoc(incidentsCollection, dataToSave);
  return { 
    id: docRef.id, 
    ...incidentData,
    date: incidentData.date.toISOString()
  };
}

export async function updateIncident(id: string, incidentData: Partial<Omit<Incident, 'id'>>): Promise<void> {
  const docRef = doc(db, 'incidents', id);
  const dataToUpdate = { ...incidentData };
  if (incidentData.date && typeof incidentData.date === 'string') {
    (dataToUpdate as any).date = Timestamp.fromDate(new Date(incidentData.date));
  } else if (incidentData.date && incidentData.date instanceof Date) {
    (dataToUpdate as any).date = Timestamp.fromDate(incidentData.date);
  }
  await updateDoc(docRef, dataToUpdate);
}

export async function deleteIncident(id: string): Promise<void> {
  // Consider if incidents should be truly deleted or archived
  await deleteDoc(doc(db, 'incidents', id));
}

