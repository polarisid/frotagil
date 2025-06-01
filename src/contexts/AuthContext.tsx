
'use client';

import type { ReactNode } from 'react';
import { createContext, useState, useEffect } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase'; 
import type { User } from '@/lib/types'; 

interface AuthContextType {
  currentUser: User | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth) {
      console.warn("AuthContext: Firebase Auth is not initialized. User authentication will not function. This is likely due to missing Firebase environment variables in .env.local.");
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        if (!db) {
          console.warn("AuthContext: Firestore (db) is not initialized. Cannot fetch user details. This may be due to missing Firebase environment variables.");
          setCurrentUser(null); // Or handle as appropriate for your app
          setLoading(false);
          return;
        }
        try {
          const userDocRef = doc(db, 'users', user.uid);
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists()) {
            setCurrentUser({ id: userDocSnap.id, ...userDocSnap.data() } as User);
          } else {
            console.error("AuthContext: User data not found in Firestore for UID:", user.uid);
            setCurrentUser(null);
            // Potentially sign out the user if Firestore data is mandatory
            // await auth.signOut(); 
          }
        } catch (error) {
            console.error("AuthContext: Error fetching user data from Firestore:", error);
            setCurrentUser(null);
        }
      } else {
        setCurrentUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []); 

  const logout = async () => {
    if (auth) {
      try {
        await auth.signOut();
      } catch (error) {
        console.error("AuthContext: Error during sign out:", error);
      }
    } else {
      console.warn("AuthContext: Firebase Auth is not initialized. Cannot sign out.");
    }
    setCurrentUser(null);
    setFirebaseUser(null);
    // No need to manually redirect here, consuming components should handle this.
  };
  
  const value = {
    currentUser,
    firebaseUser,
    loading,
    logout,
  };

  // Render children only when loading is false to prevent UI flicker or errors
  // if components try to access currentUser before it's determined.
  return <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>;
}
