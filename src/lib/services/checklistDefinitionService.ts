
'use server';

import { db } from '@/lib/firebase';
import type { ChecklistItemDefinition } from '@/lib/types';
import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  writeBatch,
  where
} from 'firebase/firestore';

const checklistItemsDefinitionCollection = collection(db, 'checklistItemDefinitions');

// Initialize default checklist items if the collection is empty
export async function initializeDefaultChecklistItems() {
  const snapshot = await getDocs(query(checklistItemsDefinitionCollection));
  if (snapshot.empty) {
    const batch = writeBatch(db);
    const defaultItems: Omit<ChecklistItemDefinition, 'docId'>[] = [
      { itemId: "tires", label: "Pneus calibrados e em bom estado?", order: 1, isActive: true },
      { itemId: "lights", label: "Luzes (faróis, lanternas, setas, freio) funcionando?", order: 2, isActive: true },
      { itemId: "brakes", label: "Freios (pedal e de mão) com resposta normal?", order: 3, isActive: true },
      { itemId: "oilLevel", label: "Nível de óleo do motor verificado e normal?", order: 4, isActive: true },
      { itemId: "waterLevel", label: "Nível da água do radiador verificado e normal?", order: 5, isActive: true },
      { itemId: "brakeFluid", label: "Nível do fluido de freio verificado e normal?", order: 6, isActive: true },
      { itemId: "fireExtinguisher", label: "Extintor de incêndio válido e pressurizado?", order: 7, isActive: true },
      { itemId: "warningTriangle", label: "Triângulo de sinalização presente e em bom estado?", order: 8, isActive: true },
      { itemId: "jackAndWrench", label: "Macaco e chave de roda presentes e funcionais?", order: 9, isActive: true },
      { itemId: "vehicleDocuments", label: "Documentação do veículo (CRLV) presente e válida?", order: 10, isActive: true },
      { itemId: "interiorCleanliness", label: "Limpeza interna do veículo satisfatória?", order: 11, isActive: true },
      { itemId: "exteriorCleanliness", label: "Limpeza externa do veículo satisfatória?", order: 12, isActive: true },
    ];

    defaultItems.forEach(item => {
      const docRef = doc(checklistItemsDefinitionCollection); // Auto-generate ID
      batch.set(docRef, item);
    });
    await batch.commit();
    console.log('Default checklist items initialized.');
    return defaultItems.map((item, index) => ({ ...item, docId: 'temp_id_' + index })) as ChecklistItemDefinition[]; // Return with temp docIds
  }
  return []; // Return empty if not initialized here
}


export async function getChecklistItemDefinitions(activeOnly = false): Promise<ChecklistItemDefinition[]> {
  let q = query(checklistItemsDefinitionCollection, orderBy('order'));
  if (activeOnly) {
    q = query(q, where('isActive', '==', true));
  }
  const snapshot = await getDocs(q);
  if (snapshot.empty && !activeOnly) { // If empty and we are not filtering for active, try initializing
    const initializedItems = await initializeDefaultChecklistItems();
    if(initializedItems.length > 0) {
        // Refetch after initialization
        const newSnapshot = await getDocs(query(checklistItemsDefinitionCollection, orderBy('order')));
        return newSnapshot.docs.map(doc => ({ docId: doc.id, ...doc.data() } as ChecklistItemDefinition));
    }
  }
  return snapshot.docs.map(doc => ({ docId: doc.id, ...doc.data() } as ChecklistItemDefinition));
}

export async function addChecklistItemDefinition(itemData: Omit<ChecklistItemDefinition, 'docId'>): Promise<ChecklistItemDefinition> {
  // Ensure itemId is unique before adding
  const q = query(checklistItemsDefinitionCollection, where('itemId', '==', itemData.itemId));
  const existing = await getDocs(q);
  if (!existing.empty) {
    throw new Error(`Item com ID "${itemData.itemId}" já existe.`);
  }
  const docRef = await addDoc(checklistItemsDefinitionCollection, itemData);
  return { docId: docRef.id, ...itemData };
}

export async function updateChecklistItemDefinition(docId: string, updates: Partial<Omit<ChecklistItemDefinition, 'docId' | 'itemId'>>): Promise<void> {
  const docRef = doc(db, 'checklistItemDefinitions', docId);
  await updateDoc(docRef, updates);
}

export async function deleteChecklistItemDefinition(docId: string): Promise<void> {
  // This is a hard delete. Consider soft delete by setting isActive = false via updateChecklistItemDefinition.
  // For now, implementing as requested (delete)
  await deleteDoc(doc(db, 'checklistItemDefinitions', docId));
}

export async function reorderChecklistItemDefinitions(orderedItems: Pick<ChecklistItemDefinition, 'docId' | 'order'>[]): Promise<void> {
  const batch = writeBatch(db);
  orderedItems.forEach(item => {
    const docRef = doc(db, 'checklistItemDefinitions', item.docId);
    batch.update(docRef, { order: item.order });
  });
  await batch.commit();
}
