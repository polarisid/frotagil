
import { db } from '@/lib/firebase';
import type { Vehicle } from '@/lib/types';
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
  Timestamp
} from 'firebase/firestore';
import { completeVehicleUsageLog } from './vehicleUsageLogService'; // createVehicleUsageLog removed
import { getUserById } from './userService';

const vehiclesCollection = collection(db, 'vehicles');

export async function getVehicles(): Promise<Vehicle[]> {
  const snapshot = await getDocs(vehiclesCollection);
  return snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      acquisitionDate: data.acquisitionDate instanceof Timestamp ? data.acquisitionDate.toDate().toISOString().split('T')[0] : data.acquisitionDate,
      pickedUpDate: data.pickedUpDate instanceof Timestamp ? data.pickedUpDate.toDate().toISOString() : data.pickedUpDate,
    } as Vehicle;
  });
}

export async function getVehicleById(id: string): Promise<Vehicle | null> {
  const docRef = doc(db, 'vehicles', id);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      ...data,
      acquisitionDate: data.acquisitionDate instanceof Timestamp ? data.acquisitionDate.toDate().toISOString().split('T')[0] : data.acquisitionDate,
      pickedUpDate: data.pickedUpDate instanceof Timestamp ? data.pickedUpDate.toDate().toISOString() : data.pickedUpDate,
    } as Vehicle;
  }
  return null;
}

export async function addVehicle(vehicleData: Omit<Vehicle, 'id'>): Promise<Vehicle> {
  const q = query(vehiclesCollection, where('plate', '==', vehicleData.plate.toUpperCase()));
  const existing = await getDocs(q);
  if (!existing.empty) {
    throw new Error(`Veículo com placa ${vehicleData.plate} já existe.`);
  }

  const dataToSave = {
    ...vehicleData,
    plate: vehicleData.plate.toUpperCase(),
    acquisitionDate: vehicleData.acquisitionDate ? Timestamp.fromDate(new Date(vehicleData.acquisitionDate)) : null,
    pickedUpDate: null, // Initialize pickedUpDate as null
  };

  const docRef = await addDoc(vehiclesCollection, dataToSave);
  return { 
    id: docRef.id, 
    ...vehicleData,
    acquisitionDate: vehicleData.acquisitionDate
  };
}

export async function updateVehicle(id: string, vehicleData: Partial<Omit<Vehicle, 'id' | 'plate'>>): Promise<void> {
  const docRef = doc(db, 'vehicles', id);
  const dataToUpdate = { ...vehicleData } as any;

  if (vehicleData.acquisitionDate && typeof vehicleData.acquisitionDate === 'string') {
    dataToUpdate.acquisitionDate = Timestamp.fromDate(new Date(vehicleData.acquisitionDate));
  }
  
  // Handle pickedUpDate: allow setting to null or a new Timestamp
  if (vehicleData.hasOwnProperty('pickedUpDate')) {
    if (vehicleData.pickedUpDate === null) {
      dataToUpdate.pickedUpDate = null;
    } else if (typeof vehicleData.pickedUpDate === 'string') {
      dataToUpdate.pickedUpDate = Timestamp.fromDate(new Date(vehicleData.pickedUpDate));
    }
  }


  await updateDoc(docRef, dataToUpdate);
}

export async function deleteVehicle(id: string): Promise<void> {
  const vehicleRef = doc(db, 'vehicles', id);
  const vehicleDoc = await getDoc(vehicleRef);
  if (vehicleDoc.exists() && vehicleDoc.data().assignedOperatorId) {
      throw new Error("Não é possível excluir um veículo que está atualmente atribuído a um operador.");
  }
  await deleteDoc(vehicleRef);
}

export async function pickUpVehicle(vehicleId: string, operatorId: string): Promise<void> {
  const vehicleRef = doc(db, 'vehicles', vehicleId);
  const vehicleSnap = await getDoc(vehicleRef);
  if (!vehicleSnap.exists()) throw new Error('Veículo não encontrado.');
  
  const vehicleData = vehicleSnap.data() as Vehicle;
  if (vehicleData.assignedOperatorId) throw new Error('Veículo já está atribuído.');
  if (vehicleData.status !== 'active') throw new Error('Veículo não está ativo.');

  const operatorVehiclesQuery = query(vehiclesCollection, where('assignedOperatorId', '==', operatorId));
  const operatorVehiclesSnap = await getDocs(operatorVehiclesQuery);
  if (!operatorVehiclesSnap.empty) throw new Error('Operador já possui um veículo atribuído.');

  // No longer creating VehicleUsageLog here. It will be created upon checklist submission.
  await updateDoc(vehicleRef, { 
    assignedOperatorId: operatorId,
    pickedUpDate: Timestamp.fromDate(new Date())
  });
}

export async function returnVehicle(vehicleId: string, operatorId: string, newMileage: number): Promise<void> {
  const vehicleRef = doc(db, 'vehicles', vehicleId);
  const vehicleSnap = await getDoc(vehicleRef);
  if (!vehicleSnap.exists()) throw new Error('Veículo não encontrado.');
  
  const vehicleData = vehicleSnap.data() as Vehicle;
  if (vehicleData.assignedOperatorId !== operatorId) throw new Error('Veículo não está atribuído a este operador.');

  const updates: Partial<Vehicle> = {
    assignedOperatorId: null,
    pickedUpDate: null
  };

  if (typeof vehicleData.mileage === 'number' && newMileage < vehicleData.mileage) {
    throw new Error(`Nova quilometragem (${newMileage.toLocaleString('pt-BR')}) não pode ser menor que a anterior (${vehicleData.mileage.toLocaleString('pt-BR')}).`);
  }
  updates.mileage = newMileage;
  
  await updateDoc(vehicleRef, updates);

  // Attempt to complete the active usage log.
  // If no active log (e.g., checklist wasn't submitted), this will do nothing gracefully.
  await completeVehicleUsageLog(vehicleId, operatorId, newMileage);
}

