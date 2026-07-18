import { db, setCloudSyncDisabled } from '../db';
import {
  pushTeacherDataToCloud,
  getGlobalSchools, deleteGlobalSchool,
  getGlobalClasses, deleteGlobalClass, saveGlobalClass,
  getGlobalStudents, deleteGlobalStudent, saveGlobalStudent,
  getGlobalSubjects, deleteGlobalSubject,
  getGlobalWorkloads, deleteGlobalWorkload, saveGlobalWorkload,
  GlobalSchool, GlobalClass, GlobalStudent, GlobalSubject, GlobalWorkload
} from '../firebase';
import { School, Class, Student, Subject } from '../types';

/**
 * Automatically merges any duplicate schools, classes, subjects, and students
 * inside the local Dexie database, updating all relationship pointers to the
 * single consolidated records, and then pushes the clean state to the cloud.
 */
export async function deduplicateLocalDatabase(username: string): Promise<{
  schoolsMerged: number;
  classesMerged: number;
  subjectsMerged: number;
  studentsMerged: number;
}> {
  let schoolsMerged = 0;
  let classesMerged = 0;
  let subjectsMerged = 0;
  let studentsMerged = 0;

  // Set cloud sync disabled to prevent hooks from firing incremental writes during the merge process
  setCloudSyncDisabled(true);
  (window as any).isCloudSyncDisabled = true;

  try {
    // We execute inside a Dexie write transaction to ensure atomic operations
    await db.transaction('rw', [
      db.schools, db.classes, db.students, db.bimonthlyGrades,
      db.attendance, db.studentVistos, db.vistoRankingScores, db.extraGrades,
      db.weeklySchedule, db.subjectWorkloads, db.assignmentDescriptions,
      db.lessons, db.vistoColumns, db.subjects
    ], async () => {

      // ==========================================
      // 1. DEDUPLICATE SUBJECTS
      // ==========================================
      const allSubjects = await db.subjects.toArray();
      const groupedSubjects: { [name: string]: Subject[] } = {};
      for (const subj of allSubjects) {
        const normName = subj.name.trim().toLowerCase();
        if (!groupedSubjects[normName]) {
          groupedSubjects[normName] = [];
        }
        groupedSubjects[normName].push(subj);
      }

      for (const normName of Object.keys(groupedSubjects)) {
        const list = groupedSubjects[normName];
        if (list.length > 1) {
          list.sort((a, b) => (a.id || 0) - (b.id || 0));
          const keptSubject = list[0];
          const keptSubjId = keptSubject.id!;

          for (let i = 1; i < list.length; i++) {
            const dupSubj = list[i];
            const dupSubjId = dupSubj.id!;

            // Merge workloads
            const workloads = await db.subjectWorkloads.where({ subjectId: dupSubjId }).toArray();
            for (const wl of workloads) {
              const existing = await db.subjectWorkloads.where({ classId: wl.classId, subjectId: keptSubjId }).first();
              if (existing) {
                await db.subjectWorkloads.delete(wl.id!);
              } else {
                await db.subjectWorkloads.update(wl.id!, { subjectId: keptSubjId });
              }
            }

            // Merge weekly schedule
            const weekly = await db.weeklySchedule.where({ subjectId: dupSubjId }).toArray();
            for (const ws of weekly) {
              await db.weeklySchedule.update(ws.id!, { subjectId: keptSubjId });
            }

            // Merge bimonthly grades
            const grades = await db.bimonthlyGrades.where({ subjectId: dupSubjId }).toArray();
            for (const g of grades) {
              const existing = await db.bimonthlyGrades.where({
                studentId: g.studentId,
                bimonthly: g.bimonthly,
                subjectId: keptSubjId
              }).first();
              if (existing) {
                await db.bimonthlyGrades.delete(g.id!);
              } else {
                await db.bimonthlyGrades.update(g.id!, { subjectId: keptSubjId });
              }
            }

            // Merge assignment descriptions
            const assDesc = await db.assignmentDescriptions.where({ subjectId: dupSubjId }).toArray();
            for (const ad of assDesc) {
              const existing = await db.assignmentDescriptions.where({
                classId: ad.classId,
                subjectId: keptSubjId,
                bimonthly: ad.bimonthly
              }).first();
              if (existing) {
                await db.assignmentDescriptions.delete(ad.id!);
              } else {
                await db.assignmentDescriptions.update(ad.id!, { subjectId: keptSubjId });
              }
            }

            // Merge lessons
            const lessons = await db.lessons.where({ subjectId: dupSubjId }).toArray();
            for (const les of lessons) {
              await db.lessons.update(les.id!, { subjectId: keptSubjId });
            }

            // Merge attendance
            const att = await db.attendance.where({ subjectId: dupSubjId }).toArray();
            for (const a of att) {
              const existing = await db.attendance.where({
                studentId: a.studentId,
                date: a.date,
                subjectId: keptSubjId
              }).first();
              if (existing) {
                await db.attendance.delete(a.id!);
              } else {
                await db.attendance.update(a.id!, { subjectId: keptSubjId });
              }
            }

            // Merge visto columns
            const vCols = await db.vistoColumns.where({ subjectId: dupSubjId }).toArray();
            for (const vc of vCols) {
              await db.vistoColumns.update(vc.id!, { subjectId: keptSubjId });
            }

            // Merge visto ranking scores
            const vRanks = await db.vistoRankingScores.where({ subjectId: dupSubjId }).toArray();
            for (const vr of vRanks) {
              await db.vistoRankingScores.update(vr.id!, { subjectId: keptSubjId });
            }

            // Merge extra grades
            const extra = await db.extraGrades.where({ subjectId: dupSubjId }).toArray();
            for (const ex of extra) {
              const existing = await db.extraGrades.where({
                studentId: ex.studentId,
                subjectId: keptSubjId
              }).first();
              if (existing) {
                await db.extraGrades.delete(ex.id!);
              } else {
                await db.extraGrades.update(ex.id!, { subjectId: keptSubjId });
              }
            }

            // Delete the duplicate subject
            await db.subjects.delete(dupSubjId);
            subjectsMerged++;
          }
        }
      }

      // ==========================================
      // 2. DEDUPLICATE SCHOOLS
      // ==========================================
      const allSchools = await db.schools.toArray();
      const groupedSchools: { [name: string]: School[] } = {};
      for (const sch of allSchools) {
        const normName = sch.name.trim().toLowerCase();
        if (!groupedSchools[normName]) {
          groupedSchools[normName] = [];
        }
        groupedSchools[normName].push(sch);
      }

      for (const normName of Object.keys(groupedSchools)) {
        const list = groupedSchools[normName];
        if (list.length > 1) {
          list.sort((a, b) => (a.id || 0) - (b.id || 0));
          const keptSchool = list[0];
          const keptSchoolId = keptSchool.id!;

          for (let i = 1; i < list.length; i++) {
            const dupSchool = list[i];
            const dupSchoolId = dupSchool.id!;

            // Re-point classes
            const classesInDup = await db.classes.where({ schoolId: dupSchoolId }).toArray();
            for (const cls of classesInDup) {
              await db.classes.update(cls.id!, { schoolId: keptSchoolId });
            }

            // Re-point weekly schedule
            const scheduleInDup = await db.weeklySchedule.where({ schoolId: dupSchoolId }).toArray();
            for (const ws of scheduleInDup) {
              await db.weeklySchedule.update(ws.id!, { schoolId: keptSchoolId });
            }

            // Delete duplicate school
            await db.schools.delete(dupSchoolId);
            schoolsMerged++;
          }
        }
      }

      // ==========================================
      // 3. DEDUPLICATE CLASSES (per school)
      // ==========================================
      const allClasses = await db.classes.toArray();
      const groupedClasses: { [key: string]: Class[] } = {};
      for (const cls of allClasses) {
        const key = `${cls.schoolId}_${cls.name.trim().toLowerCase()}`;
        if (!groupedClasses[key]) {
          groupedClasses[key] = [];
        }
        groupedClasses[key].push(cls);
      }

      for (const key of Object.keys(groupedClasses)) {
        const list = groupedClasses[key];
        if (list.length > 1) {
          list.sort((a, b) => (a.id || 0) - (b.id || 0));
          const keptClass = list[0];
          const keptClassId = keptClass.id!;

          for (let i = 1; i < list.length; i++) {
            const dupClass = list[i];
            const dupClassId = dupClass.id!;

            // Re-point students
            const studentsToMove = await db.students.where({ classId: dupClassId }).toArray();
            for (const s of studentsToMove) {
              await db.students.update(s.id!, { classId: keptClassId });
            }

            // Re-point workloads
            const workloadsToMove = await db.subjectWorkloads.where({ classId: dupClassId }).toArray();
            for (const wl of workloadsToMove) {
              const existingWl = await db.subjectWorkloads.where({ classId: keptClassId, subjectId: wl.subjectId }).first();
              if (existingWl) {
                await db.subjectWorkloads.delete(wl.id!);
              } else {
                await db.subjectWorkloads.update(wl.id!, { classId: keptClassId });
              }
            }

            // Re-point weekly schedule
            const scheduleToMove = await db.weeklySchedule.where({ classId: dupClassId }).toArray();
            for (const ws of scheduleToMove) {
              await db.weeklySchedule.update(ws.id!, { classId: keptClassId });
            }

            // Re-point assignment descriptions
            const assignmentsToMove = await db.assignmentDescriptions.where({ classId: dupClassId }).toArray();
            for (const ass of assignmentsToMove) {
              const existingAss = await db.assignmentDescriptions.where({ classId: keptClassId, subjectId: ass.subjectId, bimonthly: ass.bimonthly }).first();
              if (existingAss) {
                await db.assignmentDescriptions.delete(ass.id!);
              } else {
                await db.assignmentDescriptions.update(ass.id!, { classId: keptClassId });
              }
            }

            // Re-point lessons
            const lessonsToMove = await db.lessons.where({ classId: dupClassId }).toArray();
            for (const les of lessonsToMove) {
              await db.lessons.update(les.id!, { classId: keptClassId });
            }

            // Re-point visto columns
            const vistoColsToMove = await db.vistoColumns.where({ classId: dupClassId }).toArray();
            for (const vc of vistoColsToMove) {
              await db.vistoColumns.update(vc.id!, { classId: keptClassId });
            }

            // Delete duplicate class
            await db.classes.delete(dupClassId);
            classesMerged++;
          }
        }
      }

      // ==========================================
      // 4. DEDUPLICATE STUDENTS (per class)
      // ==========================================
      const allStudents = await db.students.toArray();
      const groupedStudents: { [key: string]: Student[] } = {};
      for (const st of allStudents) {
        const key = `${st.classId}_${st.name.trim().toLowerCase()}`;
        if (!groupedStudents[key]) {
          groupedStudents[key] = [];
        }
        groupedStudents[key].push(st);
      }

      for (const key of Object.keys(groupedStudents)) {
        const list = groupedStudents[key];
        if (list.length > 1) {
          list.sort((a, b) => (a.id || 0) - (b.id || 0));
          const keptStudent = list[0];
          const keptStudentId = keptStudent.id!;

          for (let i = 1; i < list.length; i++) {
            const dupStudent = list[i];
            const dupStudentId = dupStudent.id!;

            // Merge grades
            const gradesToMove = await db.bimonthlyGrades.where({ studentId: dupStudentId }).toArray();
            for (const g of gradesToMove) {
              const existingG = await db.bimonthlyGrades.where({ studentId: keptStudentId, bimonthly: g.bimonthly, subjectId: g.subjectId }).first();
              if (existingG) {
                // Keep the better grade of the two
                const mergedT1 = Math.max(g.t1 || 0, existingG.t1 || 0) || undefined;
                const mergedT2 = Math.max(g.t2 || 0, existingG.t2 || 0) || undefined;
                const mergedT3 = Math.max(g.t3 || 0, existingG.t3 || 0) || undefined;
                const mergedT4 = Math.max(g.t4 || 0, existingG.t4 || 0) || undefined;
                const mergedT5 = Math.max(g.t5 || 0, existingG.t5 || 0) || undefined;
                const mergedExam = Math.max(g.exam || 0, existingG.exam || 0) || undefined;
                const mergedRecovery = Math.max(g.recovery || 0, existingG.recovery || 0) || undefined;

                await db.bimonthlyGrades.update(existingG.id!, {
                  t1: mergedT1, t2: mergedT2, t3: mergedT3, t4: mergedT4, t5: mergedT5,
                  exam: mergedExam, recovery: mergedRecovery
                });
                await db.bimonthlyGrades.delete(g.id!);
              } else {
                await db.bimonthlyGrades.update(g.id!, { studentId: keptStudentId });
              }
            }

            // Merge attendance
            const attToMove = await db.attendance.where({ studentId: dupStudentId }).toArray();
            for (const att of attToMove) {
              const existingAtt = await db.attendance.where({ studentId: keptStudentId, date: att.date, subjectId: att.subjectId }).first();
              if (existingAtt) {
                // Keep maximum absences (safer)
                await db.attendance.update(existingAtt.id!, { absences: Math.max(att.absences, existingAtt.absences) });
                await db.attendance.delete(att.id!);
              } else {
                await db.attendance.update(att.id!, { studentId: keptStudentId });
              }
            }

            // Merge student vistos
            const vistosToMove = await db.studentVistos.where({ studentId: dupStudentId }).toArray();
            for (const vis of vistosToMove) {
              const existingVis = await db.studentVistos.where({ studentId: keptStudentId, vistoColumnId: vis.vistoColumnId }).first();
              if (existingVis) {
                await db.studentVistos.update(existingVis.id!, { checked: vis.checked || existingVis.checked });
                await db.studentVistos.delete(vis.id!);
              } else {
                await db.studentVistos.update(vis.id!, { studentId: keptStudentId });
              }
            }

            // Merge visto ranking scores
            const ranksToMove = await db.vistoRankingScores.where({ studentId: dupStudentId }).toArray();
            for (const rank of ranksToMove) {
              await db.vistoRankingScores.update(rank.id!, { studentId: keptStudentId });
            }

            // Merge extra grades
            const extrasToMove = await db.extraGrades.where({ studentId: dupStudentId }).toArray();
            for (const ex of extrasToMove) {
              const existingEx = await db.extraGrades.where({ studentId: keptStudentId, subjectId: ex.subjectId }).first();
              if (existingEx) {
                const mergedRec1 = Math.max(ex.recSem1 || 0, existingEx.recSem1 || 0) || undefined;
                const mergedRec2 = Math.max(ex.recSem2 || 0, existingEx.recSem2 || 0) || undefined;
                const mergedExam = Math.max(ex.finalExam || 0, existingEx.finalExam || 0) || undefined;
                await db.extraGrades.update(existingEx.id!, { recSem1: mergedRec1, recSem2: mergedRec2, finalExam: mergedExam });
                await db.extraGrades.delete(ex.id!);
              } else {
                await db.extraGrades.update(ex.id!, { studentId: keptStudentId });
              }
            }

            // Delete duplicate student
            await db.students.delete(dupStudentId);
            studentsMerged++;
          }
        }
      }

    });

    // PUSH Consolidated clean local state back to the cloud immediately to resolve duplication on server
    if (username) {
      await pushTeacherDataToCloud(username, db);
    }

  } catch (error) {
    console.error('Error during automatic database deduplication:', error);
  } finally {
    setCloudSyncDisabled(false);
    (window as any).isCloudSyncDisabled = false;
  }

  return { schoolsMerged, classesMerged, subjectsMerged, studentsMerged };
}

/**
 * Automatically merges duplicate entries in the Coordinator's Global database
 * stored in Firebase Firestore (schools, classes, students, subjects, workloads).
 */
export async function deduplicateGlobalDatabase(): Promise<{
  schoolsMerged: number;
  classesMerged: number;
  subjectsMerged: number;
  studentsMerged: number;
}> {
  let schoolsMerged = 0;
  let classesMerged = 0;
  let subjectsMerged = 0;
  let studentsMerged = 0;

  try {
    // 1. Fetch all global records
    const [schools, classes, students, subjects, workloads] = await Promise.all([
      getGlobalSchools(),
      getGlobalClasses(),
      getGlobalStudents(),
      getGlobalSubjects(),
      getGlobalWorkloads()
    ]);

    // --- A. DEDUPLICATE GLOBAL SUBJECTS ---
    const groupedSubjects: { [name: string]: GlobalSubject[] } = {};
    for (const sub of subjects) {
      const normName = sub.name.trim().toLowerCase();
      if (!groupedSubjects[normName]) {
        groupedSubjects[normName] = [];
      }
      groupedSubjects[normName].push(sub);
    }

    for (const normName of Object.keys(groupedSubjects)) {
      const list = groupedSubjects[normName];
      if (list.length > 1) {
        list.sort((a, b) => a.id.localeCompare(b.id));
        const keptSubject = list[0];

        for (let i = 1; i < list.length; i++) {
          const dupSubject = list[i];

          // Re-point workloads
          const relatedWls = workloads.filter(w => w.subjectId === dupSubject.id);
          for (const wl of relatedWls) {
            wl.subjectId = keptSubject.id;
            await saveGlobalWorkload(wl);
          }

          // Delete duplicate
          await deleteGlobalSubject(dupSubject.id);
          subjectsMerged++;
        }
      }
    }

    // --- B. DEDUPLICATE GLOBAL SCHOOLS ---
    const groupedSchools: { [name: string]: GlobalSchool[] } = {};
    for (const sch of schools) {
      const normName = sch.name.trim().toLowerCase();
      if (!groupedSchools[normName]) {
        groupedSchools[normName] = [];
      }
      groupedSchools[normName].push(sch);
    }

    for (const normName of Object.keys(groupedSchools)) {
      const list = groupedSchools[normName];
      if (list.length > 1) {
        list.sort((a, b) => a.id.localeCompare(b.id));
        const keptSchool = list[0];

        for (let i = 1; i < list.length; i++) {
          const dupSchool = list[i];

          // Re-point classes
          const relatedCls = classes.filter(c => c.schoolId === dupSchool.id);
          for (const cls of relatedCls) {
            cls.schoolId = keptSchool.id;
            await saveGlobalClass(cls);
          }

          // Delete duplicate school
          await deleteGlobalSchool(dupSchool.id);
          schoolsMerged++;
        }
      }
    }

    // --- C. DEDUPLICATE GLOBAL CLASSES ---
    // Refetch classes since some may have had schoolId re-pointed
    const freshClasses = await getGlobalClasses();
    const groupedClasses: { [key: string]: GlobalClass[] } = {};
    for (const cls of freshClasses) {
      const key = `${cls.schoolId}_${cls.name.trim().toLowerCase()}`;
      if (!groupedClasses[key]) {
        groupedClasses[key] = [];
      }
      groupedClasses[key].push(cls);
    }

    for (const key of Object.keys(groupedClasses)) {
      const list = groupedClasses[key];
      if (list.length > 1) {
        list.sort((a, b) => a.id.localeCompare(b.id));
        const keptClass = list[0];

        for (let i = 1; i < list.length; i++) {
          const dupClass = list[i];

          // Re-point students
          const relatedSts = students.filter(s => s.classId === dupClass.id);
          for (const st of relatedSts) {
            st.classId = keptClass.id;
            await saveGlobalStudent(st);
          }

          // Re-point workloads
          const relatedWls = workloads.filter(w => w.classId === dupClass.id);
          for (const wl of relatedWls) {
            wl.classId = keptClass.id;
            // Check if there's already a workload for keptClass and same subject
            const exists = workloads.some(w => w.classId === keptClass.id && w.subjectId === wl.subjectId && w.id !== wl.id);
            if (exists) {
              await deleteGlobalWorkload(wl.id);
            } else {
              await saveGlobalWorkload(wl);
            }
          }

          // Delete duplicate class
          await deleteGlobalClass(dupClass.id);
          classesMerged++;
        }
      }
    }

    // --- D. DEDUPLICATE GLOBAL STUDENTS ---
    // Refetch students since some may have had classId re-pointed
    const freshStudents = await getGlobalStudents();
    const groupedStudents: { [key: string]: GlobalStudent[] } = {};
    for (const st of freshStudents) {
      const key = `${st.classId}_${st.name.trim().toLowerCase()}`;
      if (!groupedStudents[key]) {
        groupedStudents[key] = [];
      }
      groupedStudents[key].push(st);
    }

    for (const key of Object.keys(groupedStudents)) {
      const list = groupedStudents[key];
      if (list.length > 1) {
        list.sort((a, b) => (a.rollNumber - b.rollNumber) || a.id.localeCompare(b.id));
        const keptStudent = list[0];

        for (let i = 1; i < list.length; i++) {
          const dupStudent = list[i];
          // Keep oldest record, delete duplicate
          await deleteGlobalStudent(dupStudent.id);
          studentsMerged++;
        }
      }
    }

    // Reload cache locally
    localStorage.setItem('portal_global_schools_dirty', 'true');
    localStorage.setItem('portal_global_classes_dirty', 'true');
    localStorage.setItem('portal_global_students_dirty', 'true');

  } catch (error) {
    console.error('Error during global coordinator deduplication:', error);
  }

  return { schoolsMerged, classesMerged, subjectsMerged, studentsMerged };
}

