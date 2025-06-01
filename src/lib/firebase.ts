
import { initializeApp, getApp, getApps, type FirebaseApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getAuth, type Auth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_APIKEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTHDOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECTID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGEBUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGINGSENDERID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APPID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENTID,
};

let app: FirebaseApp | undefined = undefined;
let db: Firestore | undefined = undefined;
let auth: Auth | undefined = undefined;

const criticalConfigPresent =
  firebaseConfig.apiKey &&
  firebaseConfig.authDomain &&
  firebaseConfig.projectId;

if (!criticalConfigPresent) {
  const missingKeys: string[] = [];
  if (!firebaseConfig.apiKey) missingKeys.push('NEXT_PUBLIC_FIREBASE_APIKEY');
  if (!firebaseConfig.authDomain) missingKeys.push('NEXT_PUBLIC_FIREBASE_AUTHDOMAIN');
  if (!firebaseConfig.projectId) missingKeys.push('NEXT_PUBLIC_FIREBASE_PROJECTID');

  const baseMessage = 'Firebase configuration is missing or incomplete.';
  const specificMissingMessage = `Please set the following required environment variables in your .env.local file: ${missingKeys.join(', ')}.`;
  const restartMessage = 'After setting them, restart your development server.';
  const consequenceMessage = 'Firebase services will not be available and parts of the application may not function correctly.';
  
  const fullConsoleWarningMessage = `${baseMessage} ${specificMissingMessage} ${restartMessage} ${consequenceMessage}`;

  console.warn( // Changed from console.error to console.warn as it's a configuration warning
    fullConsoleWarningMessage,
    {
      apiKey: !!firebaseConfig.apiKey,
      authDomain: !!firebaseConfig.authDomain,
      projectId: !!firebaseConfig.projectId,
      // Displaying other keys for completeness, even if not "critical" for basic init
      storageBucket: !!firebaseConfig.storageBucket,
      messagingSenderId: !!firebaseConfig.messagingSenderId,
      appId: !!firebaseConfig.appId,
      measurementId: !!firebaseConfig.measurementId,
    }
  );
  // app, db, auth will remain undefined. The application should degrade gracefully.
} else {
  // All critical Firebase config keys are present, attempt initialization.
  if (typeof window !== 'undefined') { // Ensure this runs only on client-side for getApps()
    if (!getApps().length) {
      try {
        app = initializeApp(firebaseConfig);
      } catch (e) {
        console.error("Firebase initialization error:", e);
        // app will remain undefined
      }
    } else {
      app = getApp();
    }

    if (app) {
      try {
        db = getFirestore(app);
        auth = getAuth(app);
      } catch (e) {
        console.error("Firebase service (Firestore/Auth) initialization error:", e);
        // db and auth might remain undefined or be partially initialized
      }
    }
  } else {
    // For server-side, Next.js might handle multiple initializations differently or
    // this code might be bundled. Simple check for existing apps.
    if (!getApps().length) {
        try {
            app = initializeApp(firebaseConfig);
        } catch (e) {
            console.error("SSR Firebase initialization error:", e);
        }
    } else {
        app = getApp();
    }
     if (app) {
        try {
            db = getFirestore(app);
            auth = getAuth(app);
        } catch (e) {
            console.error("SSR Firebase service (Firestore/Auth) initialization error:", e);
        }
    }
  }
}

export { db, auth, app };
