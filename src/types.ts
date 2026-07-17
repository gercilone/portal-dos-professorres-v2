export interface School {
  id?: number;
  name: string;
}

export interface Class {
  id?: number;
  name: string;
  schoolId: number;
}

export interface Subject {
  id?: number;
  name: string;
}

export interface Student {
  id?: number;
  classId: number;
  name: string;
  rollNumber: number;
}

export interface SubjectWorkload {
  id?: number;
  classId: number;
  subjectId: number;
  totalLessons: number;
}

export interface WeeklySchedule {
  id?: number;
  dayOfWeek: number; // 1 = Segunda, 2 = Terça, 3 = Quarta, 4 = Quinta, 5 = Sexta, 6 = Sábado, 0 = Domingo
  timeSlot: string;  // e.g. "07:00 - 07:50"
  schoolId: number;
  classId: number;
  subjectId: number;
}

export interface BimonthlyGrade {
  id?: number;
  studentId: number;
  bimonthly: number; // 1, 2, 3, 4
  subjectId: number;
  t1?: number;
  t2?: number;
  t3?: number;
  t4?: number;
  t5?: number;
  exam?: number;
  recovery?: number;
}

export interface AssignmentDescription {
  id?: number;
  classId: number;
  subjectId: number;
  bimonthly: number;
  t1?: string;
  t2?: string;
  t3?: string;
  t4?: string;
  t5?: string;
}

export interface Lesson {
  id?: number;
  classId: number;
  subjectId: number;
  date: string; // YYYY-MM-DD
  bimonthly: number;
  lessonCount: number;
  content: string;
}

export interface Attendance {
  id?: number;
  studentId: number;
  date: string; // YYYY-MM-DD
  subjectId: number;
  bimonthly: number;
  absences: number; // e.g. 0, 1, 2
}

export interface VistoColumn {
  id?: number;
  classId: number;
  subjectId: number;
  bimonthly: number;
  date: string; // YYYY-MM-DD
  title: string;
}

export interface StudentVisto {
  id?: number;
  studentId: number;
  vistoColumnId: number;
  checked: boolean;
}

export interface VistoRankingScore {
  id?: number;
  studentId: number;
  subjectId: number;
  bimonthly: number;
  type: string; // Action key (e.g. "atrapalhando", "copiou", etc.)
  points: number; // Positive or negative
  reason: string; // Description text
  timestamp: number;
}

export interface ExtraGrade {
  id?: number;
  studentId: number;
  subjectId: number;
  recSem1?: number; // Recuperação Semestral 1
  recSem2?: number; // Recuperação Semestral 2
  finalExam?: number; // Prova Final
}

export interface QuickScoreOption {
  key: string;
  label: string;
  points: number;
  icon: string;
  color: string;
}

export const QUICK_SCORE_OPTIONS: QuickScoreOption[] = [
  { key: "atrapalhando", label: "Atrapalhando a aula", points: -2, icon: "🛑", color: "bg-red-500/10 text-red-400 border-red-500/20" },
  { key: "nao_fez_atividade", label: "Não fez a atividade", points: -1, icon: "❌", color: "bg-orange-500/10 text-orange-400 border-orange-500/20" },
  { key: "nao_copiou", label: "Não copiou o conteúdo", points: -1, icon: "📓", color: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  { key: "conversando", label: "Conversando excessivo", points: -1, icon: "⚠️", color: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" },
  { key: "em_silencio", label: "Em silêncio", points: 1, icon: "🤫", color: "bg-teal-500/10 text-teal-400 border-teal-500/20" },
  { key: "copiou", label: "Copiou o conteúdo", points: 1, icon: "✍️", color: "bg-sky-500/10 text-sky-400 border-sky-500/20" },
  { key: "resposta_correta", label: "Resposta correta", points: 1, icon: "🟢", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  { key: "tarefa_casa", label: "Tarefa de casa", points: 1, icon: "🏠", color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  { key: "explicando_turma", label: "Explicando p/ turma", points: 2, icon: "🏆", color: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20" },
];

export function getClassSortScore(name: string): number {
  const normalized = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // strip accents
  
  // Extract the first number from the name (e.g. 6 from "6º Ano", 1 from "1º Ano")
  const match = normalized.match(/(\d+)/);
  const num = match ? parseInt(match[1], 10) : 0;
  
  // Check if it is "Ensino Médio" or "Medio" or "E.M."
  const isHighSchool = normalized.includes("medio") || normalized.includes("médio") || normalized.includes("e.m");
  
  // Check if it is "Fundamental"
  const isFundamental = normalized.includes("fundamental") || normalized.includes("fund");
  
  if (isHighSchool) {
    return 10 + num;
  }
  
  if (isFundamental) {
    return num;
  }
  
  if (num >= 6 && num <= 9) {
    return num; // 6, 7, 8, 9
  }
  if (num >= 1 && num <= 3) {
    return 10 + num;
  }
  
  return num > 0 ? num : 99;
}

export function sortClasses(a: { name: string }, b: { name: string }): number {
  const scoreA = getClassSortScore(a.name);
  const scoreB = getClassSortScore(b.name);
  if (scoreA !== scoreB) {
    return scoreA - scoreB;
  }
  return a.name.localeCompare(b.name, 'pt-BR', { numeric: true });
}

