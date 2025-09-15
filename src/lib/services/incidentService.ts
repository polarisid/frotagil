

'use server';

import { db } from '@/lib/firebase';
import type { Incident, Vehicle } from '@/lib/types';
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
import { getVehicleById } from './vehicleService';
import { getUserById } from './userService';

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

  const newIncident: Incident = { 
    id: docRef.id, 
    ...incidentData,
    date: incidentData.date.toISOString()
  };

  // N8N Webhook Notification for new incident
  const webhookUrl = process.env.N8N_INCIDENT_WEBHOOK_URL;
  if (webhookUrl) {
    try {
      const vehicle = await getVehicleById(newIncident.vehicleId);
      const payload = {
        event: 'incident_reported',
        timestamp: new Date().toISOString(),
        incident: newIncident,
        vehicle: vehicle ? { id: vehicle.id, plate: vehicle.plate, make: vehicle.make, model: vehicle.model } : null,
      };

      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      console.log(`Notificação de nova ocorrência (${newIncident.id}) enviada para o webhook.`);
    } catch (error) {
      console.error('Falha ao enviar notificação de webhook para nova ocorrência:', error);
    }
  }

  return newIncident;
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

export async function getWeeklyIncidentsByOperator(startDate: Date, endDate: Date): Promise<{ operatorId: string; count: number }[]> {
  const startTimestamp = Timestamp.fromDate(startDate);
  const endTimestamp = Timestamp.fromDate(endDate);

  const q = query(
    incidentsCollection,
    where('date', '>=', startTimestamp),
    where('date', '<=', endTimestamp),
    orderBy('date', 'desc') // Ordering by date is still useful for the query
  );

  const snapshot = await getDocs(q);
  const incidentsByOperator: { [key: string]: number } = {};

  snapshot.docs.forEach(doc => {
    const data = doc.data();
    const operatorId = data.operatorId as string;
    if (operatorId) {
      incidentsByOperator[operatorId] = (incidentsByOperator[operatorId] || 0) + 1;
    }
  });

  return Object.keys(incidentsByOperator).map(operatorId => ({ operatorId, count: incidentsByOperator[operatorId] }));
}
