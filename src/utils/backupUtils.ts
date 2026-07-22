import { db } from '../db';

export async function exportLocalBackup(overrideTeacherName?: string): Promise<string> {
  const data = {
    type: 'full_portal_backup_v2',
    meta: {
      activeUser: localStorage.getItem('portal_active_user'),
      activeUserDb: localStorage.getItem('portal_active_user_db'),
      teacherName: localStorage.getItem('portal_teacher_name'),
      username: localStorage.getItem('portal_username'),
      authEnabled: localStorage.getItem('portal_auth_enabled'),
      professorsList: localStorage.getItem('portal_professors_list'),
      coordinatorsList: localStorage.getItem('portal_coordinators_list'),
    },
    schools: await db.schools.toArray(),
    classes: await db.classes.toArray(),
    subjects: await db.subjects.toArray(),
    students: await db.students.toArray(),
    subjectWorkloads: await db.subjectWorkloads.toArray(),
    weeklySchedule: await db.weeklySchedule.toArray(),
    bimonthlyGrades: await db.bimonthlyGrades.toArray(),
    assignmentDescriptions: await db.assignmentDescriptions.toArray(),
    lessons: await db.lessons.toArray(),
    attendance: await db.attendance.toArray(),
    vistoColumns: await db.vistoColumns.toArray(),
    studentVistos: await db.studentVistos.toArray(),
    vistoRankingScores: await db.vistoRankingScores.toArray(),
    extraGrades: await db.extraGrades.toArray()
  };

  const now = new Date();
  const pad = (num: number) => String(num).padStart(2, '0');
  const day = pad(now.getDate());
  const month = pad(now.getMonth() + 1);
  const year = now.getFullYear();
  const hours = pad(now.getHours());
  const minutes = pad(now.getMinutes());

  const rawTeacherName = overrideTeacherName || localStorage.getItem('portal_teacher_name') || localStorage.getItem('portal_active_user') || 'Professor';
  const sanitizedTeacher = rawTeacherName
    .trim()
    .replace(/[^a-zA-Z0-9áàâãéèêíïóôõöúçñÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇÑ_\- ]/g, '')
    .replace(/\s+/g, '_');

  const fileName = `backup_${sanitizedTeacher}_${day}-${month}-${year}_${hours}h${minutes}.json`;

  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);

  return fileName;
}
