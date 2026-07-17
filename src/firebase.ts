import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  initializeFirestore,
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
    
    // Use initializeFirestore with experimentalForceLongPolling for robust connections inside iframes and sandboxes
    try {
      firestoreInstance = initializeFirestore(app, {
        experimentalForceLongPolling: true
      }, firebaseConfig.firestoreDatabaseId || '(default)');
    } catch (e) {
      // Fallback to standard getFirestore if initializeFirestore fails
      firestoreInstance = getFirestore(app, firebaseConfig.firestoreDatabaseId || '(default)');
    }
    
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

// Timeout utility to ensure network calls do not block forever in sandboxed/offline-prone environments
function withTimeout<T>(promise: Promise<T>, timeoutMs: number = 8000): Promise<T> {
  const actualTimeout = Math.max(timeoutMs, 6000); // Snappy feedback threshold: at least 6 seconds, but no long freezes
  let timeoutId: any;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error('Timeout reached'));
    }, actualTimeout);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutId);
  });
}

// Helper to check if we are in local fallback mode
export function isCloudFallback(): boolean {
  return localStorage.getItem('portal_cloud_fallback') === 'true';
}

// 1. PROFESSORS PROFILES SYNC (Cloud Database Shared Registry)
export async function syncProfessorsListInCloud() {
  if (isCloudFallback()) {
    const localStr = localStorage.getItem('portal_professors_list');
    return localStr ? JSON.parse(localStr) : [];
  }

  const dbInstance = getFirestoreInstance();
  if (!dbInstance) {
    const localStr = localStorage.getItem('portal_professors_list');
    return localStr ? JSON.parse(localStr) : [];
  }

  try {
    // A. Pull latest professors list from cloud with a 4-second timeout
    const professorsCol = collection(dbInstance, 'professors');
    const snapshot = await withTimeout(getDocs(professorsCol), 4000);
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

      // Seed all professors atomically using writeBatch to avoid slow sequential setDoc calls
      const batch = writeBatch(dbInstance);
      for (const prof of localList) {
        const usernameLower = prof.username.toLowerCase();
        const cleanedProf = cleanDataForFirestore(prof);
        batch.set(doc(dbInstance, 'professors', usernameLower), cleanedProf);
        cloudList.push(prof);
      }
      await withTimeout(batch.commit(), 6000);
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
  // Update local storage first to be robust
  const localStr = localStorage.getItem('portal_professors_list');
  let list: ProfessorAccount[] = localStr ? JSON.parse(localStr) : [];
  const index = list.findIndex(p => p.username.toLowerCase() === prof.username.toLowerCase());
  if (index !== -1) {
    list[index] = prof;
  } else {
    list.push(prof);
  }
  localStorage.setItem('portal_professors_list', JSON.stringify(list));

  if (isCloudFallback()) return;

  const dbInstance = getFirestoreInstance();
  if (!dbInstance) return;

  try {
    const usernameLower = prof.username.toLowerCase();
    const cleanedProf = cleanDataForFirestore(prof);
    await withTimeout(setDoc(doc(dbInstance, 'professors', usernameLower), cleanedProf), 4000);
    localStorage.setItem('portal_cloud_fallback', 'false');
    window.dispatchEvent(new Event('storage'));
  } catch (error) {
    console.error('Error saving professor to cloud:', error);
    localStorage.setItem('portal_cloud_fallback', 'true');
    window.dispatchEvent(new Event('storage'));
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
  if (isCloudFallback()) return false;

  const dbInstance = getFirestoreInstance();
  if (!dbInstance) return false;

  // Disable sync hooks globally so we don't trigger deletion / set actions on Dexie writes
  (window as any).isCloudSyncDisabled = true;
  try {
    const userLower = username.toLowerCase();
    
    // Fetch all tables in parallel to make it extremely fast, wrapped in a 5-second timeout!
    const fetchAllPromise = Promise.all(
      TABLES_TO_SYNC.map(async (tableName) => {
        try {
          const colRef = collection(dbInstance, `diaries/${userLower}/${tableName}`);
          const snapshot = await getDocs(colRef);
          const records: any[] = [];
          snapshot.forEach((doc) => {
            const data = doc.data();
            const id = isNaN(Number(doc.id)) ? doc.id : Number(doc.id);
            records.push({ ...data, id });
          });
          return { tableName, records };
        } catch (err) {
          console.warn(`Could not pull table ${tableName}:`, err);
          return { tableName, records: [] };
        }
      })
    );

    const results = await withTimeout(fetchAllPromise, 5000);

    for (const { tableName, records } of results) {
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
  if (isCloudFallback()) return false;

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
  if (isCloudFallback()) return;

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
    const snapshot = await withTimeout(getDocs(coordsCol), 4000);
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

// Helper to set cloud fallback status
function setCloudFallbackStatus(isFallback: boolean) {
  localStorage.setItem('portal_cloud_fallback', isFallback ? 'true' : 'false');
  window.dispatchEvent(new Event('storage'));
}

export async function saveCoordinatorToCloud(coord: CoordinatorAccount) {
  // Update local storage first to be robust
  const localStr = localStorage.getItem('portal_coordinators_list');
  let list: CoordinatorAccount[] = localStr ? JSON.parse(localStr) : [];
  const index = list.findIndex(c => c.username.toLowerCase() === coord.username.toLowerCase());
  if (index !== -1) {
    list[index] = coord;
  } else {
    list.push(coord);
  }
  localStorage.setItem('portal_coordinators_list', JSON.stringify(list));

  const dbInstance = getFirestoreInstance();
  if (!dbInstance) return;

  try {
    const usernameLower = coord.username.toLowerCase();
    const cleanedCoord = cleanDataForFirestore(coord);
    await withTimeout(setDoc(doc(dbInstance, 'coordinators', usernameLower), cleanedCoord), 4000);
    setCloudFallbackStatus(false);
  } catch (error) {
    console.error('Error saving coordinator to cloud:', error);
    setCloudFallbackStatus(true);
  }
}

export async function deleteCoordinatorFromCloud(username: string) {
  const localStr = localStorage.getItem('portal_coordinators_list');
  if (localStr) {
    let list: CoordinatorAccount[] = JSON.parse(localStr);
    list = list.filter(c => c.username.toLowerCase() !== username.toLowerCase());
    localStorage.setItem('portal_coordinators_list', JSON.stringify(list));
  }

  const dbInstance = getFirestoreInstance();
  if (!dbInstance) return;

  try {
    const usernameLower = username.toLowerCase();
    await withTimeout(deleteDoc(doc(dbInstance, 'coordinators', usernameLower)), 4000);
    setCloudFallbackStatus(false);
  } catch (error) {
    console.error('Error deleting coordinator from cloud:', error);
    setCloudFallbackStatus(true);
  }
}

export async function deleteProfessorFromCloud(username: string) {
  const localStr = localStorage.getItem('portal_professors_list');
  if (localStr) {
    let list: ProfessorAccount[] = JSON.parse(localStr);
    list = list.filter(p => p.username.toLowerCase() !== username.toLowerCase());
    localStorage.setItem('portal_professors_list', JSON.stringify(list));
  }

  const dbInstance = getFirestoreInstance();
  if (!dbInstance) return;

  try {
    const usernameLower = username.toLowerCase();
    await withTimeout(deleteDoc(doc(dbInstance, 'professors', usernameLower)), 4000);
    setCloudFallbackStatus(false);
  } catch (error) {
    console.error('Error deleting professor from cloud:', error);
    setCloudFallbackStatus(true);
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
  if (!dbInstance) {
    const localStr = localStorage.getItem('portal_global_schools');
    return localStr ? JSON.parse(localStr) : [];
  }
  try {
    const colRef = collection(dbInstance, 'global_schools');
    const snapshot = await withTimeout(getDocs(colRef), 4000);
    const schools: GlobalSchool[] = [];
    snapshot.forEach((doc) => {
      schools.push({ ...doc.data() as GlobalSchool, id: doc.id });
    });
    localStorage.setItem('portal_global_schools', JSON.stringify(schools));
    return schools;
  } catch (error) {
    console.error('Error getting global schools:', error);
    const localStr = localStorage.getItem('portal_global_schools');
    return localStr ? JSON.parse(localStr) : [];
  }
}

export async function saveGlobalSchool(school: GlobalSchool): Promise<void> {
  // Update local storage first
  const localStr = localStorage.getItem('portal_global_schools');
  let schools: GlobalSchool[] = localStr ? JSON.parse(localStr) : [];
  const index = schools.findIndex(s => s.id === school.id);
  if (index !== -1) {
    schools[index] = school;
  } else {
    schools.push(school);
  }
  localStorage.setItem('portal_global_schools', JSON.stringify(schools));

  const dbInstance = getFirestoreInstance();
  if (!dbInstance) return;
  try {
    const docRef = doc(dbInstance, 'global_schools', school.id);
    await withTimeout(setDoc(docRef, cleanDataForFirestore(school)), 4000);
    setCloudFallbackStatus(false);
  } catch (error) {
    console.error('Error saving global school:', error);
    setCloudFallbackStatus(true);
  }
}

export async function deleteGlobalSchool(schoolId: string): Promise<void> {
  // Update local storage first
  const localStr = localStorage.getItem('portal_global_schools');
  if (localStr) {
    let schools: GlobalSchool[] = JSON.parse(localStr);
    schools = schools.filter(s => s.id !== schoolId);
    localStorage.setItem('portal_global_schools', JSON.stringify(schools));
  }

  const dbInstance = getFirestoreInstance();
  if (!dbInstance) return;
  try {
    await withTimeout(deleteDoc(doc(dbInstance, 'global_schools', schoolId)), 4000);
    setCloudFallbackStatus(false);

    const classesCol = collection(dbInstance, 'global_classes');
    const classesSnapshot = await withTimeout(getDocs(classesCol), 4000);
    for (const d of classesSnapshot.docs) {
      const clsData = d.data();
      if (clsData.schoolId === schoolId) {
        await deleteGlobalClass(d.id);
      }
    }
  } catch (error) {
    console.error('Error deleting global school:', error);
    setCloudFallbackStatus(true);
  }
}

export async function getGlobalClasses(): Promise<GlobalClass[]> {
  const dbInstance = getFirestoreInstance();
  if (!dbInstance) {
    const localStr = localStorage.getItem('portal_global_classes');
    return localStr ? JSON.parse(localStr) : [];
  }
  try {
    const colRef = collection(dbInstance, 'global_classes');
    const snapshot = await withTimeout(getDocs(colRef), 4000);
    const classes: GlobalClass[] = [];
    snapshot.forEach((doc) => {
      classes.push({ ...doc.data() as GlobalClass, id: doc.id });
    });
    localStorage.setItem('portal_global_classes', JSON.stringify(classes));
    return classes;
  } catch (error) {
    console.error('Error getting global classes:', error);
    const localStr = localStorage.getItem('portal_global_classes');
    return localStr ? JSON.parse(localStr) : [];
  }
}

export async function saveGlobalClass(cls: GlobalClass): Promise<void> {
  // Update local storage first
  const localStr = localStorage.getItem('portal_global_classes');
  let classes: GlobalClass[] = localStr ? JSON.parse(localStr) : [];
  const index = classes.findIndex(c => c.id === cls.id);
  if (index !== -1) {
    classes[index] = cls;
  } else {
    classes.push(cls);
  }
  localStorage.setItem('portal_global_classes', JSON.stringify(classes));

  const dbInstance = getFirestoreInstance();
  if (!dbInstance) return;
  try {
    const docRef = doc(dbInstance, 'global_classes', cls.id);
    await withTimeout(setDoc(docRef, cleanDataForFirestore(cls)), 4000);
    setCloudFallbackStatus(false);
  } catch (error) {
    console.error('Error saving global class:', error);
    setCloudFallbackStatus(true);
  }
}

export async function deleteGlobalClass(classId: string): Promise<void> {
  // Update local storage first
  const localStr = localStorage.getItem('portal_global_classes');
  if (localStr) {
    let classes: GlobalClass[] = JSON.parse(localStr);
    classes = classes.filter(c => c.id !== classId);
    localStorage.setItem('portal_global_classes', JSON.stringify(classes));
  }

  // Also update local students list
  const localStudStr = localStorage.getItem('portal_global_students');
  if (localStudStr) {
    let students: GlobalStudent[] = JSON.parse(localStudStr);
    students = students.filter(s => s.classId !== classId);
    localStorage.setItem('portal_global_students', JSON.stringify(students));
  }

  const dbInstance = getFirestoreInstance();
  if (!dbInstance) return;
  try {
    await withTimeout(deleteDoc(doc(dbInstance, 'global_classes', classId)), 4000);
    setCloudFallbackStatus(false);

    const studentsCol = collection(dbInstance, 'global_students');
    const studentsSnapshot = await withTimeout(getDocs(studentsCol), 4000);
    for (const d of studentsSnapshot.docs) {
      const studData = d.data();
      if (studData.classId === classId) {
        await withTimeout(deleteDoc(doc(dbInstance, 'global_students', d.id)), 4000);
      }
    }
  } catch (error) {
    console.error('Error deleting global class:', error);
    setCloudFallbackStatus(true);
  }
}

export async function getGlobalStudents(): Promise<GlobalStudent[]> {
  const dbInstance = getFirestoreInstance();
  if (!dbInstance) {
    const localStr = localStorage.getItem('portal_global_students');
    return localStr ? JSON.parse(localStr) : [];
  }
  try {
    const colRef = collection(dbInstance, 'global_students');
    const snapshot = await withTimeout(getDocs(colRef), 4000);
    const students: GlobalStudent[] = [];
    snapshot.forEach((doc) => {
      students.push({ ...doc.data() as GlobalStudent, id: doc.id });
    });
    localStorage.setItem('portal_global_students', JSON.stringify(students));
    return students.sort((a, b) => a.rollNumber - b.rollNumber || a.name.localeCompare(b.name));
  } catch (error) {
    console.error('Error getting global students:', error);
    const localStr = localStorage.getItem('portal_global_students');
    return localStr ? JSON.parse(localStr) : [];
  }
}

export async function saveGlobalStudent(student: GlobalStudent): Promise<void> {
  // Update local storage first
  const localStr = localStorage.getItem('portal_global_students');
  let students: GlobalStudent[] = localStr ? JSON.parse(localStr) : [];
  const index = students.findIndex(s => s.id === student.id);
  if (index !== -1) {
    students[index] = student;
  } else {
    students.push(student);
  }
  localStorage.setItem('portal_global_students', JSON.stringify(students));

  const dbInstance = getFirestoreInstance();
  if (!dbInstance) return;
  try {
    const docRef = doc(dbInstance, 'global_students', student.id);
    await withTimeout(setDoc(docRef, cleanDataForFirestore(student)), 4000);
    setCloudFallbackStatus(false);
  } catch (error) {
    console.error('Error saving global student:', error);
    setCloudFallbackStatus(true);
  }
}

export async function deleteGlobalStudent(studentId: string): Promise<void> {
  // Update local storage first
  const localStr = localStorage.getItem('portal_global_students');
  if (localStr) {
    let students: GlobalStudent[] = JSON.parse(localStr);
    students = students.filter(s => s.id !== studentId);
    localStorage.setItem('portal_global_students', JSON.stringify(students));
  }

  const dbInstance = getFirestoreInstance();
  if (!dbInstance) return;
  try {
    await withTimeout(deleteDoc(doc(dbInstance, 'global_students', studentId)), 4000);
    setCloudFallbackStatus(false);
  } catch (error) {
    console.error('Error deleting global student:', error);
    setCloudFallbackStatus(true);
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
  if (!dbInstance) {
    const localStr = localStorage.getItem('portal_global_subjects');
    return localStr ? JSON.parse(localStr) : [];
  }
  try {
    const colRef = collection(dbInstance, 'global_subjects');
    const snapshot = await withTimeout(getDocs(colRef), 4000);
    const subjects: GlobalSubject[] = [];
    snapshot.forEach((doc) => {
      subjects.push({ ...doc.data() as GlobalSubject, id: doc.id });
    });
    localStorage.setItem('portal_global_subjects', JSON.stringify(subjects));
    return subjects.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  } catch (error) {
    console.error('Error getting global subjects:', error);
    const localStr = localStorage.getItem('portal_global_subjects');
    return localStr ? JSON.parse(localStr) : [];
  }
}

export async function saveGlobalSubject(subject: GlobalSubject): Promise<void> {
  // Update local storage first
  const localStr = localStorage.getItem('portal_global_subjects');
  let subjects: GlobalSubject[] = localStr ? JSON.parse(localStr) : [];
  const index = subjects.findIndex(s => s.id === subject.id);
  if (index !== -1) {
    subjects[index] = subject;
  } else {
    subjects.push(subject);
  }
  localStorage.setItem('portal_global_subjects', JSON.stringify(subjects));

  const dbInstance = getFirestoreInstance();
  if (!dbInstance) return;
  try {
    const docRef = doc(dbInstance, 'global_subjects', subject.id);
    await withTimeout(setDoc(docRef, cleanDataForFirestore(subject)), 4000);
    setCloudFallbackStatus(false);
  } catch (error) {
    console.error('Error saving global subject:', error);
    setCloudFallbackStatus(true);
  }
}

export async function deleteGlobalSubject(subjectId: string): Promise<void> {
  // Update local storage first
  const localStr = localStorage.getItem('portal_global_subjects');
  if (localStr) {
    let subjects: GlobalSubject[] = JSON.parse(localStr);
    subjects = subjects.filter(s => s.id !== subjectId);
    localStorage.setItem('portal_global_subjects', JSON.stringify(subjects));
  }

  // Also cascade delete in local workloads list
  const localWlStr = localStorage.getItem('portal_global_workloads');
  if (localWlStr) {
    let workloads: GlobalWorkload[] = JSON.parse(localWlStr);
    workloads = workloads.filter(w => w.subjectId !== subjectId);
    localStorage.setItem('portal_global_workloads', JSON.stringify(workloads));
  }

  const dbInstance = getFirestoreInstance();
  if (!dbInstance) return;
  try {
    await withTimeout(deleteDoc(doc(dbInstance, 'global_subjects', subjectId)), 4000);
    setCloudFallbackStatus(false);
    
    // Also cascade delete workloads associated with this subject
    const workloadsCol = collection(dbInstance, 'global_workloads');
    const workloadsSnapshot = await withTimeout(getDocs(workloadsCol), 4000);
    for (const d of workloadsSnapshot.docs) {
      const wlData = d.data();
      if (wlData.subjectId === subjectId) {
        await withTimeout(deleteDoc(doc(dbInstance, 'global_workloads', d.id)), 4000);
      }
    }
  } catch (error) {
    console.error('Error deleting global subject:', error);
    setCloudFallbackStatus(true);
  }
}

export async function getGlobalWorkloads(): Promise<GlobalWorkload[]> {
  const dbInstance = getFirestoreInstance();
  if (!dbInstance) {
    const localStr = localStorage.getItem('portal_global_workloads');
    return localStr ? JSON.parse(localStr) : [];
  }
  try {
    const colRef = collection(dbInstance, 'global_workloads');
    const snapshot = await withTimeout(getDocs(colRef), 4000);
    const workloads: GlobalWorkload[] = [];
    snapshot.forEach((doc) => {
      workloads.push({ ...doc.data() as GlobalWorkload, id: doc.id });
    });
    localStorage.setItem('portal_global_workloads', JSON.stringify(workloads));
    return workloads;
  } catch (error) {
    console.error('Error getting global workloads:', error);
    const localStr = localStorage.getItem('portal_global_workloads');
    return localStr ? JSON.parse(localStr) : [];
  }
}

export async function saveGlobalWorkload(workload: GlobalWorkload): Promise<void> {
  // Update local storage first
  const localStr = localStorage.getItem('portal_global_workloads');
  let workloads: GlobalWorkload[] = localStr ? JSON.parse(localStr) : [];
  const index = workloads.findIndex(w => w.id === workload.id);
  if (index !== -1) {
    workloads[index] = workload;
  } else {
    workloads.push(workload);
  }
  localStorage.setItem('portal_global_workloads', JSON.stringify(workloads));

  const dbInstance = getFirestoreInstance();
  if (!dbInstance) return;
  try {
    const docRef = doc(dbInstance, 'global_workloads', workload.id);
    await withTimeout(setDoc(docRef, cleanDataForFirestore(workload)), 4000);
    setCloudFallbackStatus(false);
  } catch (error) {
    console.error('Error saving global workload:', error);
    setCloudFallbackStatus(true);
  }
}

export async function saveGlobalWorkloadsBatch(workloadsList: GlobalWorkload[]): Promise<void> {
  // Update local storage first
  const localStr = localStorage.getItem('portal_global_workloads');
  let workloads: GlobalWorkload[] = localStr ? JSON.parse(localStr) : [];
  for (const wl of workloadsList) {
    const index = workloads.findIndex(w => w.id === wl.id);
    if (index !== -1) {
      workloads[index] = wl;
    } else {
      workloads.push(wl);
    }
  }
  localStorage.setItem('portal_global_workloads', JSON.stringify(workloads));

  const dbInstance = getFirestoreInstance();
  if (!dbInstance) return;
  try {
    const batch = writeBatch(dbInstance);
    for (const wl of workloadsList) {
      const docRef = doc(dbInstance, 'global_workloads', wl.id);
      batch.set(docRef, cleanDataForFirestore(wl));
    }
    await withTimeout(batch.commit(), 6000);
    setCloudFallbackStatus(false);
  } catch (error) {
    console.error('Error saving global workloads batch:', error);
    setCloudFallbackStatus(true);
  }
}

export async function deleteGlobalWorkload(workloadId: string): Promise<void> {
  // Update local storage first
  const localStr = localStorage.getItem('portal_global_workloads');
  if (localStr) {
    let workloads: GlobalWorkload[] = JSON.parse(localStr);
    workloads = workloads.filter(w => w.id !== workloadId);
    localStorage.setItem('portal_global_workloads', JSON.stringify(workloads));
  }

  const dbInstance = getFirestoreInstance();
  if (!dbInstance) return;
  try {
    await withTimeout(deleteDoc(doc(dbInstance, 'global_workloads', workloadId)), 4000);
    setCloudFallbackStatus(false);
  } catch (error) {
    console.error('Error deleting global workload:', error);
    setCloudFallbackStatus(true);
  }
}

// 6. AD-HOC SYSTEM BACKUP FETCHERS
export async function getGradesBackup(professors: { username: string; teacherName: string }[]): Promise<any[]> {
  const dbInstance = getFirestoreInstance();
  if (!dbInstance) return [];

  const allGrades: any[] = [];
  
  for (const prof of professors) {
    try {
      const userLower = prof.username.toLowerCase();
      // Fetch bimonthly grades
      const bimonthlyRef = collection(dbInstance, `diaries/${userLower}/bimonthlyGrades`);
      const bimonthlySnapshot = await withTimeout(getDocs(bimonthlyRef), 4000);
      bimonthlySnapshot.forEach((doc) => {
        allGrades.push({
          professor: prof.username,
          professorName: prof.teacherName,
          type: 'bimonthly',
          id: doc.id,
          ...doc.data()
        });
      });

      // Fetch extra grades
      const extraRef = collection(dbInstance, `diaries/${userLower}/extraGrades`);
      const extraSnapshot = await withTimeout(getDocs(extraRef), 4000);
      extraSnapshot.forEach((doc) => {
        allGrades.push({
          professor: prof.username,
          professorName: prof.teacherName,
          type: 'extra',
          id: doc.id,
          ...doc.data()
        });
      });
    } catch (err) {
      console.error(`Error fetching grades backup for ${prof.username}:`, err);
    }
  }

  return allGrades;
}

