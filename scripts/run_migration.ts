import { getFirestoreInstance, cleanDataForFirestore } from '../src/firebase';
import { collection, doc, writeBatch, getDocs } from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';

// Define the TABLES_TO_SYNC
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

async function runMigration() {
  const db = getFirestoreInstance();
  if (!db) {
    console.error('Failed to initialize Firestore. Exiting.');
    process.exit(1);
  }

  const username = 'gercilone';
  const userLower = username.toLowerCase();
  console.log(`\n======================================================`);
  console.log(`STARTING BACKUP MIGRATION FOR PROFESSOR: ${username}`);
  console.log(`======================================================\n`);

  // 1. CLEANING PREVIOUS DATA UNDER diaries/gercilone/...
  console.log('Step 1: Clearing existing diary collections in cloud...');
  for (const tableName of TABLES_TO_SYNC) {
    const colRef = collection(db, `diaries/${userLower}/${tableName}`);
    try {
      const snapshot = await getDocs(colRef);
      if (snapshot.size > 0) {
        console.log(`Clearing ${snapshot.size} records in '${tableName}'...`);
        let batch = writeBatch(db);
        let opCount = 0;
        for (const docSnap of snapshot.docs) {
          batch.delete(docSnap.ref);
          opCount++;
          if (opCount === 400) {
            await batch.commit();
            batch = writeBatch(db);
            opCount = 0;
          }
        }
        if (opCount > 0) {
          await batch.commit();
        }
      }
    } catch (err) {
      console.warn(`Warning clearing table '${tableName}':`, err);
    }
  }
  console.log('Stale cloud diary collections cleared successfully.\n');

  // 2. LOADING SPLIT DATA FILES
  console.log('Step 2: Loading split data files...');
  
  const metadataRaw = fs.readFileSync(path.join(process.cwd(), 'backup_metadata_schools_classes.json'), 'utf8');
  const metadata = JSON.parse(metadataRaw);

  const students1 = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'backup_students_part1.json'), 'utf8'));
  const students2 = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'backup_students_part2.json'), 'utf8'));
  const students3 = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'backup_students_part3.json'), 'utf8'));
  const students4 = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'backup_students_part4.json'), 'utf8'));
  const allStudents = [...students1, ...students2, ...students3, ...students4];

  const grades1 = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'backup_grades_part1.json'), 'utf8'));
  const grades2 = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'backup_grades_part2.json'), 'utf8'));
  const grades3 = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'backup_grades_part3.json'), 'utf8'));
  const grades4 = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'backup_grades_part4.json'), 'utf8'));
  const grades5 = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'backup_grades_part5.json'), 'utf8'));
  const allGrades = [...grades1, ...grades2, ...grades3, ...grades4, ...grades5];

  console.log(`Loaded:`);
  console.log(`- Schools: ${metadata.schools?.length || 0}`);
  console.log(`- Classes: ${metadata.classes?.length || 0}`);
  console.log(`- Subjects (Raw): ${metadata.subjects?.length || 0}`);
  console.log(`- Subject Workloads: ${metadata.subjectWorkloads?.length || 0}`);
  console.log(`- Weekly Schedules: ${metadata.weeklySchedules?.length || 0}`);
  console.log(`- Total Students: ${allStudents.length}`);
  console.log(`- Total Bimonthly Grades: ${allGrades.length}\n`);

  // 3. MAP AND INTEGRATE SUBJECTS
  console.log('Step 3: Integrating subjects table...');
  // We ensure both "Matemática" (ID 10) and "Geral" (ID 11) exist
  const subjects = [
    { id: 10, name: 'Matemática' },
    { id: 11, name: 'Geral' }
  ];
  const subjectMap = new Map<string, number>();
  subjectMap.set('matemática', 10);
  subjectMap.set('geral', 11);

  // 4. PREPARE ALL MIGRATED RECORD COLLECTIONS
  const migratedData: Record<string, any[]> = {
    schools: metadata.schools || [],
    classes: metadata.classes || [],
    subjects: subjects,
    students: allStudents,
    subjectWorkloads: (metadata.subjectWorkloads || []).map((sw: any) => {
      const subjectNameLower = (sw.subjectName || 'Matemática').toLowerCase();
      const subjectId = subjectMap.get(subjectNameLower) || 10;
      return {
        id: sw.id,
        classId: sw.classId,
        subjectId: subjectId,
        totalLessons: sw.workload || 40
      };
    }),
    weeklySchedule: (metadata.weeklySchedules || []).map((ws: any) => {
      const subjectNameLower = (ws.subjectName || 'Matemática').toLowerCase();
      const subjectId = subjectMap.get(subjectNameLower) || 10;
      return {
        id: ws.id,
        dayOfWeek: ws.dayOfWeek,
        schoolId: ws.schoolId,
        classId: ws.classId,
        subjectId: subjectId,
        timeSlot: ws.hourSlot || '07:00 - 09:00'
      };
    }),
    bimonthlyGrades: allGrades.map((bg: any) => {
      const subjectNameLower = (bg.subjectName || 'Geral').toLowerCase();
      const subjectId = subjectMap.get(subjectNameLower) || 11;
      return {
        id: bg.id,
        studentId: bg.studentId,
        bimonthly: bg.bimonth || 1, // converting bimonth -> bimonthly
        subjectId: subjectId,
        t1: bg.t1 ?? 0,
        t2: bg.t2 ?? 0,
        t3: bg.t3 ?? 0,
        t4: bg.t4 ?? 0,
        t5: bg.t5 ?? 0,
        exam: bg.exam ?? 0,
        recovery: bg.recovery ?? 0,
        recSemestral1: bg.recSemestral1 ?? 0,
        recSemestral2: bg.recSemestral2 ?? 0,
        provaFinal: bg.provaFinal ?? 0
      };
    }),
    extraGrades: (() => {
      const extraGradesList: any[] = [];
      const extraGradesMap = new Map<string, { studentId: number; subjectId: number; recSem1?: number; recSem2?: number; finalExam?: number }>();

      // Try to extract from allStudents
      allStudents.forEach((student: any) => {
        const recSem1 = student.recSem1 ?? student.recSemestral1;
        const recSem2 = student.recSem2 ?? student.recSemestral2;
        const finalExam = student.finalExam ?? student.provaFinal;
        const defaultSubjectId = 10; // default Mathematics

        if (
          (recSem1 !== undefined && recSem1 !== null && Number(recSem1) > 0) ||
          (recSem2 !== undefined && recSem2 !== null && Number(recSem2) > 0) ||
          (finalExam !== undefined && finalExam !== null && Number(finalExam) > 0)
        ) {
          const sId = Number(student.id);
          const key = `${sId}_${defaultSubjectId}`;
          const existing = extraGradesMap.get(key) || { studentId: sId, subjectId: defaultSubjectId };

          if (recSem1 !== undefined && recSem1 !== null && Number(recSem1) > 0) existing.recSem1 = Number(recSem1);
          if (recSem2 !== undefined && recSem2 !== null && Number(recSem2) > 0) existing.recSem2 = Number(recSem2);
          if (finalExam !== undefined && finalExam !== null && Number(finalExam) > 0) existing.finalExam = Number(finalExam);

          extraGradesMap.set(key, existing);
        }
      });

      // Try to extract from allGrades (the raw grades files)
      allGrades.forEach((bg: any) => {
        const recSem1 = bg.recSem1 ?? bg.recSemestral1;
        const recSem2 = bg.recSem2 ?? bg.recSemestral2;
        const finalExam = bg.finalExam ?? bg.provaFinal;
        const subjectNameLower = (bg.subjectName || 'Geral').toLowerCase();
        const bgSubjectId = subjectMap.get(subjectNameLower) || 11;
        const bgStudentId = Number(bg.studentId);

        if (
          (recSem1 !== undefined && recSem1 !== null && Number(recSem1) > 0) ||
          (recSem2 !== undefined && recSem2 !== null && Number(recSem2) > 0) ||
          (finalExam !== undefined && finalExam !== null && Number(finalExam) > 0)
        ) {
          const key = `${bgStudentId}_${bgSubjectId}`;
          const existing = extraGradesMap.get(key) || { studentId: bgStudentId, subjectId: bgSubjectId };

          if (recSem1 !== undefined && recSem1 !== null && Number(recSem1) > 0) existing.recSem1 = Number(recSem1);
          if (recSem2 !== undefined && recSem2 !== null && Number(recSem2) > 0) existing.recSem2 = Number(recSem2);
          if (finalExam !== undefined && finalExam !== null && Number(finalExam) > 0) existing.finalExam = Number(finalExam);

          extraGradesMap.set(key, existing);
        }
      });

      let idx = 1;
      extraGradesMap.forEach((val) => {
        extraGradesList.push({
          id: idx++,
          ...val
        });
      });

      return extraGradesList;
    })()
  };

  // 5. BULK UPLOADING IN BATCHES TO FIRESTORE
  console.log('Step 4: Uploading collections to Firestore...');
  for (const tableName of Object.keys(migratedData)) {
    const records = migratedData[tableName];
    if (records.length === 0) continue;

    console.log(`Uploading ${records.length} records into 'diaries/${userLower}/${tableName}'...`);
    const colPath = `diaries/${userLower}/${tableName}`;
    
    let batch = writeBatch(db);
    let opCount = 0;

    for (const record of records) {
      if (!record.id) continue;
      const docRef = doc(db, colPath, String(record.id));
      const cleaned = cleanDataForFirestore(record);
      batch.set(docRef, cleaned);
      opCount++;

      if (opCount === 400) {
        await batch.commit();
        batch = writeBatch(db);
        opCount = 0;
      }
    }

    if (opCount > 0) {
      await batch.commit();
    }
    console.log(`Successfully completed upload for '${tableName}'!`);
  }

  console.log(`\n======================================================`);
  console.log(`MIGRATION FINISHED SUCCESSFULLY!`);
  console.log(`Professor '${username}' database is now fully populated in Firestore.`);
  console.log(`======================================================\n`);
}

runMigration().catch(err => {
  console.error('Fatal error during migration:', err);
  process.exit(1);
});
