import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  writeBatch
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Helper to remove any 'undefined' or un-serializable fields recursively so Firestore never crashes
export function cleanDataForFirestore(obj: any): any {
  if (obj === null || obj === undefined) {
    return null;
  }
  if (obj instanceof Date) {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(item => cleanDataForFirestore(item)).filter(item => item !== undefined);
  }
  if (typeof obj === 'object') {
    const cleaned: any = {};
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (val !== undefined && typeof val !== 'function' && typeof val !== 'symbol') {
        cleaned[key] = cleanDataForFirestore(val);
      }
    }
    return cleaned;
  }
  if (typeof obj === 'function' || typeof obj === 'symbol') {
    return null;
  }
  return obj;
}

// Lazy safe Firestore initialization
let firestoreInstance: any = null;

export function getFirestoreInstance() {
  if (firestoreInstance) return firestoreInstance;
  try {
    if (!firebaseConfig || !firebaseConfig.apiKey) {
      console.warn('Firebase configuration is missing or invalid. Offline mode active.');
      return null;
    }
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    firestoreInstance = getFirestore(app, firebaseConfig.firestoreDatabaseId || '(default)');
    return firestoreInstance;
  } catch (error) {
    console.error('Failed to initialize Firebase / Firestore:', error);
    return null;
  }
}

// Interface for Professor account matching App.tsx
export interface ProfessorAccount {
  username: string;
  password:  string;
  teacherName: string;
  dbName: string;
  passwordHint?: string;
  securityQuestion?: string;
  securityAnswer?: string;
  authEnabled: boolean;
}

// 1. PROFESSORS PROFILES SYNC (Cloud Database Shared Registry)
export async function syncProfessorsListInCloud() {
  const dbInstance = getFirestoreInstance();
  if (!dbInstance) {
    const localStr = localStorage.getItem('portal_professors_list');
    return localStr ? JSON.parse(localStr) : [];
  }

  try {
    // A. Pull latest professors list from cloud
    const professorsCol = collection(dbInstance, 'professors');
    const snapshot = await getDocs(professorsCol);
    const cloudList: ProfessorAccount[] = [];
    
    snapshot.forEach((doc) => {
      cloudList.push(doc.data() as ProfessorAccount);
    });

    // If the cloud is completely empty, try to seed it from local list, or default list
    if (cloudList.length === 0) {
      const localStr = localStorage.getItem('portal_professors_list');
      let localList: ProfessorAccount[] = [];
      if (localStr) {
        try {
          localList = JSON.parse(localStr);
        } catch (e) {
          console.error('Error parsing local professors list:', e);
        }
      }

      if (localList.length === 0) {
        const defaultProf: ProfessorAccount = {
          username: 'professor',
          password: '123456',
          teacherName: 'Gercilone',
          dbName: 'TeacherDatabase',
          authEnabled: false
        };
        localList = [defaultProf];
      }

      for (const prof of localList) {
        const usernameLower = prof.username.toLowerCase();
        const cleanedProf = cleanDataForFirestore(prof);
        await setDoc(doc(dbInstance, 'professors', usernameLower), cleanedProf);
        cloudList.push(prof);
      }
    }

    // Trust cloudList as the absolute source of truth
    localStorage.setItem('portal_professors_list', JSON.stringify(cloudList));
    return cloudList;
  } catch (error) {
    console.error('Error syncing professors list with cloud:', error);
    const localStr = localStorage.getItem('portal_professors_list');
    return localStr ? JSON.parse(localStr) : [];
  }
}

// Save a single professor account to the cloud
export async function saveProfessorToCloud(prof: ProfessorAccount) {
  const dbInstance = getFirestoreInstance();
  if (!dbInstance) return;

  try {
    const usernameLower = prof.username.toLowerCase();
    const cleanedProf = cleanDataForFirestore(prof);
    await setDoc(doc(dbInstance, 'professors', usernameLower), cleanedProf);
  } catch (error) {
    console.error('Error saving professor to cloud:', error);
  }
}

// 2. DIARY DATA SYNCHRONIZATION
const TABLES_TO_SYNC = [
  'schools',
  'classes',
  'subjects',
  'students',
  'subjectWorkloads',
  'weeklySchedule',
  'bimonthlyGrades',
  'assignmentDescriptions',
  'lessons',
  'attendance',
  'vistoColumns',
  'studentVistos',
  'vistoRankingScores',
  'extraGrades'
];

// Pull all diary data from cloud for a specific professor and save to Dexie
export async function pullTeacherDataFromCloud(username: string, dexieDb: any): Promise<boolean> {
  if (!username) return false;
  const dbInstance = getFirestoreInstance();
  if (!dbInstance) return false;

  // Disable sync hooks globally so we don't trigger deletion / set actions on Dexie writes
  (window as any).isCloudSyncDisabled = true;
  try {
    const userLower = username.toLowerCase();
    
    for (const tableName of TABLES_TO_SYNC) {
      const colRef = collection(dbInstance, `diaries/${userLower}/${tableName}`);
      const snapshot = await getDocs(colRef);
      
      const records: any[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        const id = isNaN(Number(doc.id)) ? doc.id : Number(doc.id);
        records.push({ ...data, id });
      });

      // Clear local table and write cloud records
      if (dexieDb[tableName]) {
        await dexieDb[tableName].clear();
        if (records.length > 0) {
          await dexieDb[tableName].bulkAdd(records);
        }
      }
    }
    return true;
  } catch (error) {
    console.error(`Error pulling diary data for ${username}:`, error);
    return false;
  } finally {
    (window as any).isCloudSyncDisabled = false;
  }
}

// Push all local diary data to cloud (Full Backup/Override)
export async function pushTeacherDataToCloud(username: string, dexieDb: any): Promise<boolean> {
  if (!username) return false;
  const dbInstance = getFirestoreInstance();
  if (!dbInstance) return false;

  try {
    const userLower = username.toLowerCase();

    for (const tableName of TABLES_TO_SYNC) {
      if (!dexieDb[tableName]) continue;
      
      const localRecords = await dexieDb[tableName].toArray();
      const colPath = `diaries/${userLower}/${tableName}`;

      let batch = writeBatch(dbInstance);
      let opCount = 0;

      for (const record of localRecords) {
        if (!record.id) continue;
        const docRef = doc(dbInstance, colPath, String(record.id));
        const cleanedRecord = cleanDataForFirestore(record);
        batch.set(docRef, cleanedRecord);
        opCount++;

        if (opCount === 400) {
          await batch.commit();
          batch = writeBatch(dbInstance);
          opCount = 0;
        }
      }

      if (opCount > 0) {
        await batch.commit();
      }
    }
    return true;
  } catch (error) {
    console.error(`Error pushing diary data for ${username}:`, error);
    return false;
  }
}

// Push a single record change (used by the Dexie auto-sync hook)
export async function syncSingleRecord(
  username: string,
  tableName: string,
  recordId: string | number,
  recordData: any,
  action: 'set' | 'delete'
) {
  if (!username || !tableName || !recordId) return;
  const dbInstance = getFirestoreInstance();
  if (!dbInstance) return;

  try {
    const userLower = username.toLowerCase();
    const docRef = doc(dbInstance, `diaries/${userLower}/${tableName}`, String(recordId));
    
    if (action === 'delete') {
      await deleteDoc(docRef);
    } else {
      const cleanedData = cleanDataForFirestore(recordData);
      await setDoc(docRef, cleanedData);
    }
  } catch (error) {
    console.error(`Error syncing single record on ${tableName}:`, error);
  }
}

// 3. COORDINATORS SYNC & MANAGEMENT
export interface CoordinatorAccount {
  username: string;
  password:  string;
  name: string;
}

export async function syncCoordinatorsListInCloud(): Promise<CoordinatorAccount[]> {
  const dbInstance = getFirestoreInstance();
  const defaultCoordsList = [
    { username: 'coordenador', password: '123', name: 'Coordenador Geral' },
    { username: 'admin', password: 'admin', name: 'Administrador Geral' },
    { username: 'administrador', password: 'administrador', name: 'Administrador Geral' }
  ];

  if (!dbInstance) {
    const localStr = localStorage.getItem('portal_coordinators_list');
    if (localStr) return JSON.parse(localStr);
    return defaultCoordsList;
  }

  try {
    const coordsCol = collection(dbInstance, 'coordinators');
    const snapshot = await getDocs(coordsCol);
    const cloudList: CoordinatorAccount[] = [];
    
    snapshot.forEach((doc) => {
      cloudList.push(doc.data() as CoordinatorAccount);
    });

    if (cloudList.length === 0) {
      for (const dCoord of defaultCoordsList) {
        await saveCoordinatorToCloud(dCoord);
        cloudList.push(dCoord);
      }
    }

    localStorage.setItem('portal_coordinators_list', JSON.stringify(cloudList));
    return cloudList;
  } catch (error) {
    console.error('Error syncing coordinators list with cloud:', error);
    const localStr = localStorage.getItem('portal_coordinators_list');
    if (localStr) {
      return JSON.parse(localStr);
    }
    return defaultCoordsList;
  }
}

export async function saveCoordinatorToCloud(coord: CoordinatorAccount) {
  const dbInstance = getFirestoreInstance();
  if (!dbInstance) return;

  try {
    const usernameLower = coord.username.toLowerCase();
    const cleanedCoord = cleanDataForFirestore(coord);
    await setDoc(doc(dbInstance, 'coordinators', usernameLower), cleanedCoord);
  } catch (error) {
    console.error('Error saving coordinator to cloud:', error);
  }
}

export async function deleteCoordinatorFromCloud(username: string) {
  const dbInstance = getFirestoreInstance();
  if (!dbInstance) return;

  try {
    const usernameLower = username.toLowerCase();
    await deleteDoc(doc(dbInstance, 'coordinators', usernameLower));
  } catch (error) {
    console.error('Error deleting coordinator from cloud:', error);
  }
}

export async function deleteProfessorFromCloud(username: string) {
  const dbInstance = getFirestoreInstance();
  if (!dbInstance) return;

  try {
    const usernameLower = username.toLowerCase();
    await deleteDoc(doc(dbInstance, 'professors', usernameLower));
  } catch (error) {
    console.error('Error deleting professor from cloud:', error);
  }
}

// 4. GLOBAL SHARED SCHOOLS, CLASSES & STUDENTS (Managed by Coordinator, attached by teachers)

export interface GlobalSchool {
  id: string;
  name: string;
}

export interface GlobalClass {
  id: string;
  name: string;
  schoolId: string;
}

export interface GlobalStudent {
  id: string;
  name: string;
  rollNumber: number;
  classId: string;
}

export async function getGlobalSchools(): Promise<GlobalSchool[]> {
  const dbInstance = getFirestoreInstance();
  if (!dbInstance) return [];
  try {
    const colRef = collection(dbInstance, 'global_schools');
    const snapshot = await getDocs(colRef);
    const schools: GlobalSchool[] = [];
    snapshot.forEach((doc) => {
      schools.push({ ...doc.data() as GlobalSchool, id: doc.id });
    });
    return schools;
  } catch (error) {
    console.error('Error getting global schools:', error);
    return [];
  }
}

export async function saveGlobalSchool(school: GlobalSchool): Promise<void> {
  const dbInstance = getFirestoreInstance();
  if (!dbInstance) return;
  try {
    const docRef = doc(dbInstance, 'global_schools', school.id);
    await setDoc(docRef, cleanDataForFirestore(school));
  } catch (error) {
    console.error('Error saving global school:', error);
  }
}

export async function deleteGlobalSchool(schoolId: string): Promise<void> {
  const dbInstance = getFirestoreInstance();
  if (!dbInstance) return;
  try {
    await deleteDoc(doc(dbInstance, 'global_schools', schoolId));

    const classesCol = collection(dbInstance, 'global_classes');
    const classesSnapshot = await getDocs(classesCol);
    for (const d of classesSnapshot.docs) {
      const clsData = d.data();
      if (clsData.schoolId === schoolId) {
        await deleteGlobalClass(d.id);
      }
    }
  } catch (error) {
    console.error('Error deleting global school:', error);
  }
}

export async function getGlobalClasses(): Promise<GlobalClass[]> {
  const dbInstance = getFirestoreInstance();
  if (!dbInstance) return [];
  try {
    const colRef = collection(dbInstance, 'global_classes');
    const snapshot = await getDocs(colRef);
    const classes: GlobalClass[] = [];
    snapshot.forEach((doc) => {
      classes.push({ ...doc.data() as GlobalClass, id: doc.id });
    });
    return classes;
  } catch (error) {
    console.error('Error getting global classes:', error);
    return [];
  }
}

export async function saveGlobalClass(cls: GlobalClass): Promise<void> {
  const dbInstance = getFirestoreInstance();
  if (!dbInstance) return;
  try {
    const docRef = doc(dbInstance, 'global_classes', cls.id);
    await setDoc(docRef, cleanDataForFirestore(cls));
  } catch (error) {
    console.error('Error saving global class:', error);
  }
}

export async function deleteGlobalClass(classId: string): Promise<void> {
  const dbInstance = getFirestoreInstance();
  if (!dbInstance) return;
  try {
    await deleteDoc(doc(dbInstance, 'global_classes', classId));

    const studentsCol = collection(dbInstance, 'global_students');
    const studentsSnapshot = await getDocs(studentsCol);
    for (const d of studentsSnapshot.docs) {
      const studData = d.data();
      if (studData.classId === classId) {
        await deleteDoc(doc(dbInstance, 'global_students', d.id));
      }
    }
  } catch (error) {
    console.error('Error deleting global class:', error);
  }
}

export async function getGlobalStudents(): Promise<GlobalStudent[]> {
  const dbInstance = getFirestoreInstance();
  if (!dbInstance) return [];
  try {
    const colRef = collection(dbInstance, 'global_students');
    const snapshot = await getDocs(colRef);
    const students: GlobalStudent[] = [];
    snapshot.forEach((doc) => {
      students.push({ ...doc.data() as GlobalStudent, id: doc.id });
    });
    return students.sort((a, b) => a.rollNumber - b.rollNumber || a.name.localeCompare(b.name));
  } catch (error) {
    console.error('Error getting global students:', error);
    return [];
  }
}

export async function saveGlobalStudent(student: GlobalStudent): Promise<void> {
  const dbInstance = getFirestoreInstance();
  if (!dbInstance) return;
  try {
    const docRef = doc(dbInstance, 'global_students', student.id);
    await setDoc(docRef, cleanDataForFirestore(student));
  } catch (error) {
    console.error('Error saving global student:', error);
  }
}

export async function deleteGlobalStudent(studentId: string): Promise<void> {
  const dbInstance = getFirestoreInstance();
  if (!dbInstance) return;
  try {
    await deleteDoc(doc(dbInstance, 'global_students', studentId));
  } catch (error) {
    console.error('Error deleting global student:', error);
  }
}

// 5. GLOBAL SHARED SUBJECTS & WORKLOADS (Managed by Coordinator/Admin, pulled by teachers)

export interface GlobalSubject {
  id: string;
  name: string;
}

export interface GlobalWorkload {
  id: string;
  classId: string;
  subjectId: string;
  totalLessons: number;
  teacherUsername?: string;
}

export async function getGlobalSubjects(): Promise<GlobalSubject[]> {
  const dbInstance = getFirestoreInstance();
  if (!dbInstance) return [];
  try {
    const colRef = collection(dbInstance, 'global_subjects');
    const snapshot = await getDocs(colRef);
    const subjects: GlobalSubject[] = [];
    snapshot.forEach((doc) => {
      subjects.push({ ...doc.data() as GlobalSubject, id: doc.id });
    });
    return subjects.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  } catch (error) {
    console.error('Error getting global subjects:', error);
    return [];
  }
}

export async function saveGlobalSubject(subject: GlobalSubject): Promise<void> {
  const dbInstance = getFirestoreInstance();
  if (!dbInstance) return;
  try {
    const docRef = doc(dbInstance, 'global_subjects', subject.id);
    await setDoc(docRef, cleanDataForFirestore(subject));
  } catch (error) {
    console.error('Error saving global subject:', error);
  }
}

export async function deleteGlobalSubject(subjectId: string): Promise<void> {
  const dbInstance = getFirestoreInstance();
  if (!dbInstance) return;
  try {
    await deleteDoc(doc(dbInstance, 'global_subjects', subjectId));
    
    // Also cascade delete workloads associated with this subject
    const workloadsCol = collection(dbInstance, 'global_workloads');
    const workloadsSnapshot = await getDocs(workloadsCol);
    for (const d of workloadsSnapshot.docs) {
      const wlData = d.data();
      if (wlData.subjectId === subjectId) {
        await deleteDoc(doc(dbInstance, 'global_workloads', d.id));
      }
    }
  } catch (error) {
    console.error('Error deleting global subject:', error);
  }
}

export async function getGlobalWorkloads(): Promise<GlobalWorkload[]> {
  const dbInstance = getFirestoreInstance();
  if (!dbInstance) return [];
  try {
    const colRef = collection(dbInstance, 'global_workloads');
    const snapshot = await getDocs(colRef);
    const workloads: GlobalWorkload[] = [];
    snapshot.forEach((doc) => {
      workloads.push({ ...doc.data() as GlobalWorkload, id: doc.id });
    });
    return workloads;
  } catch (error) {
    console.error('Error getting global workloads:', error);
    return [];
  }
}

export async function saveGlobalWorkload(workload: GlobalWorkload): Promise<void> {
  const dbInstance = getFirestoreInstance();
  if (!dbInstance) return;
  try {
    const docRef = doc(dbInstance, 'global_workloads', workload.id);
    await setDoc(docRef, cleanDataForFirestore(workload));
  } catch (error) {
    console.error('Error saving global workload:', error);
  }
}

export async function deleteGlobalWorkload(workloadId: string): Promise<void> {
  const dbInstance = getFirestoreInstance();
  if (!dbInstance) return;
  try {
    await deleteDoc(doc(dbInstance, 'global_workloads', workloadId));
  } catch (error) {
    console.error('Error deleting global workload:', error);
  }
}
