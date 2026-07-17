import Dexie, { type Table } from 'dexie';
import {
  School,
  Class,
  Subject,
  Student,
  SubjectWorkload,
  WeeklySchedule,
  BimonthlyGrade,
  AssignmentDescription,
  Lesson,
  Attendance,
  VistoColumn,
  StudentVisto,
  VistoRankingScore,
  ExtraGrade
} from './types';
import { syncSingleRecord, pushTeacherDataToCloud } from './firebase';

export let isCloudSyncDisabled = false;
export function setCloudSyncDisabled(val: boolean) {
  isCloudSyncDisabled = val;
}

export class TeacherDatabase extends Dexie {
  schools!: Table<School>;
  classes!: Table<Class>;
  subjects!: Table<Subject>;
  students!: Table<Student>;
  subjectWorkloads!: Table<SubjectWorkload>;
  weeklySchedule!: Table<WeeklySchedule>;
  bimonthlyGrades!: Table<BimonthlyGrade>;
  assignmentDescriptions!: Table<AssignmentDescription>;
  lessons!: Table<Lesson>;
  attendance!: Table<Attendance>;
  vistoColumns!: Table<VistoColumn>;
  studentVistos!: Table<StudentVisto>;
  vistoRankingScores!: Table<VistoRankingScore>;
  extraGrades!: Table<ExtraGrade>;

  constructor(databaseName: string = 'TeacherDatabase') {
    super(databaseName);
    this.version(1).stores({
      schools: '++id, name',
      classes: '++id, name, schoolId',
      subjects: '++id, name',
      students: '++id, classId, name, rollNumber',
      subjectWorkloads: '++id, classId, subjectId',
      weeklySchedule: '++id, dayOfWeek, timeSlot, schoolId, classId, subjectId',
      bimonthlyGrades: '++id, studentId, bimonthly, subjectId, [studentId+bimonthly+subjectId]',
      assignmentDescriptions: '++id, classId, subjectId, bimonthly, [classId+subjectId+bimonthly]',
      lessons: '++id, classId, subjectId, date, bimonthly',
      attendance: '++id, studentId, date, subjectId, bimonthly, [studentId+date+subjectId]',
      vistoColumns: '++id, classId, subjectId, bimonthly, date',
      studentVistos: '++id, studentId, vistoColumnId, [studentId+vistoColumnId]',
      vistoRankingScores: '++id, studentId, subjectId, bimonthly, type, timestamp',
      extraGrades: '++id, studentId, subjectId, [studentId+subjectId]'
    });

    // Automatically synchronize additions, modifications, and deletions with Firestore
    const tablesToSync = [
      'schools', 'classes', 'subjects', 'students', 'subjectWorkloads',
      'weeklySchedule', 'bimonthlyGrades', 'assignmentDescriptions',
      'lessons', 'attendance', 'vistoColumns', 'studentVistos',
      'vistoRankingScores', 'extraGrades'
    ];

    tablesToSync.forEach(tableName => {
      const table = this.table(tableName);

      table.hook('creating', function(primKey, obj) {
        const activeUser = localStorage.getItem('portal_active_user');
        if (activeUser && !isCloudSyncDisabled && !(window as any).isCloudSyncDisabled) {
          this.onsuccess = function(actualKey) {
            syncSingleRecord(activeUser, tableName, actualKey as any, obj, 'set');
          };
        }
      });

      table.hook('updating', (mods, primKey, obj) => {
        const activeUser = localStorage.getItem('portal_active_user');
        if (activeUser && !isCloudSyncDisabled && !(window as any).isCloudSyncDisabled) {
          const updatedObj = { ...obj, ...mods };
          setTimeout(() => {
            syncSingleRecord(activeUser, tableName, primKey as any, updatedObj, 'set');
          }, 50);
        }
      });

      table.hook('deleting', (primKey) => {
        const activeUser = localStorage.getItem('portal_active_user');
        if (activeUser && !isCloudSyncDisabled && !(window as any).isCloudSyncDisabled) {
          setTimeout(() => {
            syncSingleRecord(activeUser, tableName, primKey as any, null, 'delete');
          }, 50);
        }
      });
    });
  }
}

let currentDbName = localStorage.getItem('portal_active_user_db') || 'TeacherDatabase';
let activeDb = new TeacherDatabase(currentDbName);

export const db = new Proxy({}, {
  get(target, prop) {
    const latestDbName = localStorage.getItem('portal_active_user_db') || 'TeacherDatabase';
    if (latestDbName !== currentDbName) {
      currentDbName = latestDbName;
      activeDb = new TeacherDatabase(currentDbName);
    }
    const value = Reflect.get(activeDb, prop);
    if (typeof value === 'function') {
      return value.bind(activeDb);
    }
    return value;
  }
}) as TeacherDatabase;

// Seed function to initialize dummy data if db is empty
export async function seedDatabase() {
  const schoolCount = await db.schools.count();
  if (schoolCount > 0) return;

  setCloudSyncDisabled(true);
  try {
    // Insert School
    const schoolId = await db.schools.add({ name: 'Escola Estadual Cora Coralina' });
    const schoolId2 = await db.schools.add({ name: 'Colégio Integral Anglo' });

    // Insert Classes
    const classId1 = await db.classes.add({ name: '1º Ano A - Ensino Médio', schoolId });
    const classId2 = await db.classes.add({ name: '2º Ano B - Ensino Médio', schoolId });
    const classId3 = await db.classes.add({ name: '9º Ano C - Fundamental II', schoolId: schoolId2 });

    // Insert Subjects
    const subj1 = await db.subjects.add({ name: 'Matemática' });
    const subj2 = await db.subjects.add({ name: 'Biologia' });
    const subj3 = await db.subjects.add({ name: 'História' });

    // Insert Students
    const studentsClass1 = [
      { name: 'Ana Beatriz Souza', rollNumber: 1 },
      { name: 'Bruno Henrique Lima', rollNumber: 2 },
      { name: 'Carlos Eduardo Oliveira', rollNumber: 3 },
      { name: 'Daniela Martins Santos', rollNumber: 4 },
      { name: 'Eduardo Pereira Costa', rollNumber: 5 },
      { name: 'Fernanda Rocha Silva', rollNumber: 6 },
      { name: 'Gabriel Alencar Santos', rollNumber: 7 },
      { name: 'Helena Carvalho Cruz', rollNumber: 8 },
      { name: 'Igor Moreira Dias', rollNumber: 9 },
      { name: 'Julia Castro Alves', rollNumber: 10 },
    ];

    for (const s of studentsClass1) {
      await db.students.add({ ...s, classId: classId1 });
    }

    const studentsClass2 = [
      { name: 'Alexandre Neves', rollNumber: 1 },
      { name: 'Beatriz Vasconcelos', rollNumber: 2 },
      { name: 'Caio de Souza', rollNumber: 3 },
      { name: 'Diana Albuquerque', rollNumber: 4 },
      { name: 'Enzo Rodrigues', rollNumber: 5 },
    ];

    for (const s of studentsClass2) {
      await db.students.add({ ...s, classId: classId2 });
    }

    // Set default Workloads
    await db.subjectWorkloads.add({ classId: classId1, subjectId: subj1, totalLessons: 80 });
    await db.subjectWorkloads.add({ classId: classId1, subjectId: subj2, totalLessons: 40 });
    await db.subjectWorkloads.add({ classId: classId2, subjectId: subj2, totalLessons: 40 });

    // Add Default Assignment Description
    await db.assignmentDescriptions.add({
      classId: classId1,
      subjectId: subj1,
      bimonthly: 1,
      t1: 'Lição de Casa 1',
      t2: 'Trabalho em Grupo',
      t3: 'Atividade de Classe',
      t4: 'Simulado',
      t5: 'Participação'
    });

    // Add some weekly schedule
    await db.weeklySchedule.add({ dayOfWeek: 1, timeSlot: '07:00 - 07:50', schoolId, classId: classId1, subjectId: subj1 });
    await db.weeklySchedule.add({ dayOfWeek: 1, timeSlot: '07:50 - 08:40', schoolId, classId: classId1, subjectId: subj1 });
    await db.weeklySchedule.add({ dayOfWeek: 2, timeSlot: '08:40 - 09:30', schoolId, classId: classId1, subjectId: subj2 });
    await db.weeklySchedule.add({ dayOfWeek: 3, timeSlot: '09:50 - 10:40', schoolId, classId: classId2, subjectId: subj2 });

    // Add some initial grades
    const students = await db.students.where({ classId: classId1 }).toArray();
    for (const stud of students) {
      // Random grades summing to 10 max
      const t1 = parseFloat((Math.random() * 0.4 + 1.6).toFixed(1)); // ~1.8
      const t2 = parseFloat((Math.random() * 0.4 + 1.6).toFixed(1)); // ~1.8
      const t3 = parseFloat((Math.random() * 0.4 + 1.6).toFixed(1)); // ~1.8
      const t4 = parseFloat((Math.random() * 0.4 + 1.6).toFixed(1)); // ~1.8
      const t5 = parseFloat((Math.random() * 0.4 + 1.6).toFixed(1)); // ~1.8
      const exam = parseFloat((Math.random() * 4 + 6).toFixed(1));
      const sumTrabalhos = t1 + t2 + t3 + t4 + t5;
      const currentMedia = (sumTrabalhos + exam) / 2;
      const recovery = currentMedia < 6.0 ? parseFloat((Math.random() * 3 + 6.5).toFixed(1)) : undefined;

      await db.bimonthlyGrades.add({
        studentId: stud.id!,
        bimonthly: 1,
        subjectId: subj1,
        t1, t2, t3, t4, t5,
        exam,
        recovery
      });
    }

    // Create one visto column
    const columnId = await db.vistoColumns.add({
      classId: classId1,
      subjectId: subj1,
      bimonthly: 1,
      date: '2026-07-10',
      title: 'Exercício Pág 45'
    });

    const columnId2 = await db.vistoColumns.add({
      classId: classId1,
      subjectId: subj1,
      bimonthly: 1,
      date: '2026-07-13',
      title: 'Resumo Biomas'
    });

    for (const stud of students) {
      await db.studentVistos.add({ studentId: stud.id!, vistoColumnId: columnId, checked: Math.random() > 0.3 });
      await db.studentVistos.add({ studentId: stud.id!, vistoColumnId: columnId2, checked: Math.random() > 0.4 });
    }

    // Some default lessons
    await db.lessons.add({
      classId: classId1,
      subjectId: subj1,
      date: '2026-07-10',
      bimonthly: 1,
      lessonCount: 2,
      content: 'Introdução às funções afins e quadráticas. Resolução de exercícios pág 45.'
    });

    await db.lessons.add({
      classId: classId1,
      subjectId: subj1,
      date: '2026-07-13',
      bimonthly: 1,
      lessonCount: 2,
      content: 'Análise de gráficos de funções. Discussão em grupo.'
    });

    // Some initial attendance
    for (const stud of students) {
      await db.attendance.add({
        studentId: stud.id!,
        date: '2026-07-10',
        subjectId: subj1,
        bimonthly: 1,
        absences: Math.random() > 0.9 ? 2 : 0
      });
      await db.attendance.add({
        studentId: stud.id!,
        date: '2026-07-13',
        subjectId: subj1,
        bimonthly: 1,
        absences: Math.random() > 0.85 ? 1 : 0
      });
    }

    // Add some gamification score actions
    const now = Date.now();
    for (const stud of students) {
      if (Math.random() > 0.5) {
        await db.vistoRankingScores.add({
          studentId: stud.id!,
          subjectId: subj1,
          bimonthly: 1,
          type: 'copiou',
          points: 1,
          reason: 'Copiou o conteúdo quadro',
          timestamp: now - 3600000 * 24
        });
      }
      if (Math.random() > 0.7) {
        await db.vistoRankingScores.add({
          studentId: stud.id!,
          subjectId: subj1,
          bimonthly: 1,
          type: 'resposta_correta',
          points: 1,
          reason: 'Respondeu pergunta complexa',
          timestamp: now - 3600000 * 12
        });
      }
      if (Math.random() > 0.85) {
        await db.vistoRankingScores.add({
          studentId: stud.id!,
          subjectId: subj1,
          bimonthly: 1,
          type: 'atrapalhando',
          points: -2,
          reason: 'Celular durante explicação',
          timestamp: now - 3600000 * 2
        });
      }
    }
  } finally {
    setCloudSyncDisabled(false);
  }

  // After seeding, push the seeded database to Firestore
  const activeUser = localStorage.getItem('portal_active_user');
  if (activeUser) {
    try {
      await pushTeacherDataToCloud(activeUser, db);
    } catch (e) {
      console.error('Error during initial cloud database upload after seed:', e);
    }
  }
}
