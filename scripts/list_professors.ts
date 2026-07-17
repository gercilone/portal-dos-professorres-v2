import { getFirestoreInstance } from '../src/firebase';
import { collection, getDocs } from 'firebase/firestore';

async function listProfessors() {
  const db = getFirestoreInstance();
  if (!db) {
    console.error('Could not initialize Firestore.');
    return;
  }
  try {
    const colRef = collection(db, 'professors');
    const snapshot = await getDocs(colRef);
    console.log('--- REGISTERED PROFESSORS IN CLOUD ---');
    snapshot.forEach(doc => {
      console.log(doc.id, '=>', doc.data());
    });
    console.log('--------------------------------------');
  } catch (err) {
    console.error('Error listing professors:', err);
  }
}

listProfessors();
