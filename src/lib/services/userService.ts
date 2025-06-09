
import { db, auth } from '@/lib/firebase';
import type { User } from '@/lib/types';
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
  setDoc
} from 'firebase/firestore';
import { sendPasswordResetEmail } from 'firebase/auth';

const usersCollection = collection(db, 'users');

export async function getUsers(): Promise<User[]> {
  const snapshot = await getDocs(usersCollection);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
}

export async function getUserById(id: string): Promise<User | null> {
  const docRef = doc(db, 'users', id);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? ({ id: docSnap.id, ...docSnap.data() } as User) : null;
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const q = query(usersCollection, where('email', '==', email));
  const snapshot = await getDocs(q);
  if (snapshot.empty) {
    return null;
  }
  const doc = snapshot.docs[0];
  return { id: doc.id, ...doc.data() } as User;
}


// Note: For actual user creation with authentication, use Firebase Auth.
// This function adds a user document to Firestore, assuming UID is Firebase Auth UID.
export async function addUser(userId: string, userData: Omit<User, 'id' | 'status'> & { status?: 'active' | 'inactive'}): Promise<User> {
  const userRef = doc(db, 'users', userId);
  const fullUserData: User = {
    id: userId, // This should be the Firebase Auth UID
    ...userData,
    status: userData.status || 'active',
  };
  await setDoc(userRef, {
    name: fullUserData.name,
    email: fullUserData.email,
    role: fullUserData.role,
    status: fullUserData.status,
  });
  return fullUserData;
}


export async function updateUser(id: string, userData: Partial<Omit<User, 'id'>>): Promise<void> {
  const docRef = doc(db, 'users', id);
  await updateDoc(docRef, userData);
}

export async function deleteUser(id: string): Promise<void> {
  // Instead of deleting, consider marking as inactive for data integrity
  // await deleteDoc(doc(db, 'users', id));
  await updateDoc(doc(db, 'users', id), { status: 'inactive' });
}

export async function sendPasswordResetEmailToUser(email: string): Promise<void> {
  if (!auth) {
    throw new Error("Firebase Auth não está inicializado.");
  }
  await sendPasswordResetEmail(auth, email);
}
