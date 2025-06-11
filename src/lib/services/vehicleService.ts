
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
import { completeVehicleUsageLog } from './vehicleUsageLogService'; 
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
      initialMileageSystem: data.initialMileageSystem, // Make sure to return this field
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
      initialMileageSystem: data.initialMileageSystem, // Make sure to return this field
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

  // vehicleData from the form already includes initialMileageSystem set to the input mileage
  const dataToSave = {
    ...vehicleData, 
    plate: vehicleData.plate.toUpperCase(),
    acquisitionDate: vehicleData.acquisitionDate ? Timestamp.fromDate(new Date(vehicleData.acquisitionDate)) : null,
    pickedUpDate: vehicleData.pickedUpDate === undefined ? null : (vehicleData.pickedUpDate ? Timestamp.fromDate(new Date(vehicleData.pickedUpDate)) : null),
    // mileage is already in vehicleData
    // initialMileageSystem is already in vehicleData (and correctly set by the form)
  };

  const docRef = await addDoc(vehiclesCollection, dataToSave);
  const savedData = (await getDoc(docRef)).data()!; // Get the actual saved data
  
  return { 
    id: docRef.id, 
    // Construct the response object based on the structure of Vehicle type
    // ensuring all fields are present as expected.
    plate: savedData.plate,
    model: savedData.model,
    make: savedData.make,
    year: savedData.year,
    acquisitionDate: savedData.acquisitionDate instanceof Timestamp ? savedData.acquisitionDate.toDate().toISOString().split('T')[0] : savedData.acquisitionDate,
    status: savedData.status,
    imageUrl: savedData.imageUrl,
    assignedOperatorId: savedData.assignedOperatorId,
    mileage: savedData.mileage,
    initialMileageSystem: savedData.initialMileageSystem,
    pickedUpDate: savedData.pickedUpDate instanceof Timestamp ? savedData.pickedUpDate.toDate().toISOString() : savedData.pickedUpDate,
  };
}

export async function updateVehicle(id: string, vehicleData: Partial<Omit<Vehicle, 'id' | 'plate'>>): Promise<void> {
  const docRef = doc(db, 'vehicles', id);
  const dataToUpdate = { ...vehicleData } as any;

  if (vehicleData.acquisitionDate && typeof vehicleData.acquisitionDate === 'string') {
    dataToUpdate.acquisitionDate = Timestamp.fromDate(new Date(vehicleData.acquisitionDate));
  }
  
  if (vehicleData.hasOwnProperty('pickedUpDate')) {
    if (vehicleData.pickedUpDate === null) {
      dataToUpdate.pickedUpDate = null;
    } else if (typeof vehicleData.pickedUpDate === 'string') {
      dataToUpdate.pickedUpDate = Timestamp.fromDate(new Date(vehicleData.pickedUpDate));
    }
  }
  // initialMileageSystem should not be updated here as it's the KM at system entry
  if (dataToUpdate.hasOwnProperty('initialMileageSystem')) {
    delete dataToUpdate.initialMileageSystem;
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

  await completeVehicleUsageLog(vehicleId, operatorId, newMileage);
}

