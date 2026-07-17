import { useState, useEffect, FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { Student, Lesson, Attendance } from '../types';
import { BookOpen, Calendar, Save, CheckCircle2, UserX, Info, AlertTriangle, ShieldAlert, Sparkles, Clock, ArrowRight, CalendarDays, Trash2, Pencil } from 'lucide-react';

interface TabDAttendanceProps {
  schoolId: number | undefined;
  classId: number | undefined;
  subjectId: number | undefined;
  bimonthly: number;
  onSelectSchool?: (id: number) => void;
  onSelectClass?: (id: number) => void;
  onSelectSubject?: (id: number) => void;
  isReadOnly?: boolean;
}

export default function TabDAttendance({
  schoolId,
  classId,
  subjectId,
  bimonthly,
  onSelectSchool,
  onSelectClass,
  onSelectSubject,
  isReadOnly = false
}: TabDAttendanceProps) {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [lessonCount, setLessonCount] = useState(2);
  const [content, setContent] = useState('');
  const [isSaved, setIsSaved] = useState(false);
  const [editingLessonId, setEditingLessonId] = useState<number | undefined>(undefined);

  // Load current workload for expected lessons progress
  const currentWorkload = useLiveQuery(async () => {
    if (!classId || !subjectId) return undefined;
    const targetClassId = Number(classId);
    const targetSubjectId = Number(subjectId);
    return db.subjectWorkloads
      .filter(w => Number(w.classId) === targetClassId && Number(w.subjectId) === targetSubjectId)
      .first();
  }, [classId, subjectId]);

  // Query schedules, schools, classes, and subjects to match names
  const weeklySchedules = useLiveQuery(() => db.weeklySchedule.toArray()) || [];
  const schools = useLiveQuery(() => db.schools.toArray()) || [];
  const classesList = useLiveQuery(() => db.classes.toArray()) || [];
  const subjectsList = useLiveQuery(() => db.subjects.toArray()) || [];

  const getTodayDayOfWeek = () => {
    const day = new Date().getDay();
    return day;
  };

  const getDayLabel = (dayNum: number) => {
    const days = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
    return days[dayNum] || `Dia ${dayNum}`;
  };

  const handleSelectSchedule = (sched: any) => {
    if (onSelectSchool) onSelectSchool(sched.schoolId);
    if (onSelectClass) onSelectClass(sched.classId);
    if (onSelectSubject) onSelectSubject(sched.subjectId);
  };

  // Query students
  const students = useLiveQuery(async () => {
    if (!classId) return [];
    return db.students.where({ classId }).sortBy('rollNumber');
  }, [classId]) || [];

  // Query lessons for this bimonthly, class, subject to calculate total workload given
  const allLessons = useLiveQuery(async () => {
    if (!classId || !subjectId) return [];
    const targetClassId = Number(classId);
    const targetSubjectId = Number(subjectId);
    const targetBimonthly = Number(bimonthly);
    const list = await db.lessons.toArray();
    return list.filter(l => Number(l.classId) === targetClassId && Number(l.subjectId) === targetSubjectId && Number(l.bimonthly) === targetBimonthly);
  }, [classId, subjectId, bimonthly]) || [];

  // Query lesson on selected date
  const currentLesson = useLiveQuery(async () => {
    if (!classId || !subjectId || !selectedDate) return undefined;
    const targetClassId = Number(classId);
    const targetSubjectId = Number(subjectId);
    const targetBimonthly = Number(bimonthly);
    const list = await db.lessons.toArray();
    return list.find(l => Number(l.classId) === targetClassId && Number(l.subjectId) === targetSubjectId && l.date === selectedDate && Number(l.bimonthly) === targetBimonthly);
  }, [classId, subjectId, selectedDate, bimonthly]);

  // Query all attendance for this subject and bimonthly to compute cumulative statistics
  const bimonthlyAttendance = useLiveQuery(async () => {
    if (!subjectId) return [];
    const targetSubjectId = Number(subjectId);
    const targetBimonthly = Number(bimonthly);
    const list = await db.attendance.toArray();
    return list.filter(a => Number(a.subjectId) === targetSubjectId && Number(a.bimonthly) === targetBimonthly);
  }, [subjectId, bimonthly]) || [];

  // Query attendance records for current selected date
  const dailyAttendance = useLiveQuery(async () => {
    if (!subjectId || !selectedDate) return [];
    const targetSubjectId = Number(subjectId);
    const list = await db.attendance.toArray();
    return list.filter(a => Number(a.subjectId) === targetSubjectId && a.date === selectedDate);
  }, [subjectId, selectedDate]) || [];

  // Sync state with current lesson when selected date or loaded lesson changes
  useEffect(() => {
    if (editingLessonId !== undefined) {
      // In edit mode, don't overwrite user's edits with automatic date-sync
      return;
    }
    if (currentLesson) {
      const count = Number(currentLesson.lessonCount);
      setLessonCount(isNaN(count) || count <= 0 ? 2 : count);
      setContent(currentLesson.content || '');
      setIsSaved(true);
    } else {
      setLessonCount(2);
      setContent('');
      setIsSaved(false);
    }
  }, [currentLesson, selectedDate, editingLessonId]);

  if (!schoolId || !classId || !subjectId) {
    const todayDayNum = getTodayDayOfWeek();
    const todayScheds = weeklySchedules.filter(s => s.dayOfWeek === todayDayNum);
    const otherScheds = weeklySchedules.filter(s => s.dayOfWeek !== todayDayNum);

    return (
      <div id="attendance-no-selection" className="space-y-8 max-w-5xl mx-auto py-4">
        
        {/* Warning card */}
        <div className="bg-zinc-900/40 border border-zinc-800/85 p-6 rounded-2xl flex flex-col md:flex-row items-center gap-5 text-center md:text-left shadow-lg">
          <div className="w-14 h-14 bg-amber-500/10 rounded-2xl flex items-center justify-center text-amber-500 border border-amber-500/20 shrink-0">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-white font-bold text-lg">Lançar Chamada / Seleção Pendente</h3>
            <p className="text-zinc-400 text-xs sm:text-sm">
              Selecione uma <strong>Escola</strong>, <strong>Turma</strong> e <strong>Disciplina</strong> no cabeçalho superior ou clique em um dos lembretes da sua <strong>Grade de Horários</strong> abaixo para selecionar tudo automaticamente.
            </p>
          </div>
        </div>

        {/* Schedule panel */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-800/60 pb-2">
            <h4 className="text-xs font-bold text-zinc-400 flex items-center gap-2 uppercase tracking-wider">
              <CalendarDays className="w-4 h-4 text-blue-400" />
              Lembretes da Grade Semanal
            </h4>
            <span className="text-[10px] font-semibold font-mono bg-zinc-900 text-zinc-400 px-2.5 py-1 rounded-full border border-zinc-800">
              Hoje: {getDayLabel(todayDayNum)}
            </span>
          </div>

          {weeklySchedules.length === 0 ? (
            <div className="bg-zinc-950/40 border border-dashed border-zinc-800/80 rounded-2xl p-8 text-center max-w-lg mx-auto space-y-3">
              <Clock className="w-8 h-8 text-zinc-600 mx-auto" />
              <div className="space-y-1">
                <p className="text-zinc-300 font-bold text-xs">Nenhum Horário Cadastrado</p>
                <p className="text-zinc-500 text-[11px] leading-relaxed">
                  Cadastre sua grade de aulas semanal nas <strong>Configurações &gt; Grade Semanal &amp; Cargas</strong> para gerar lembretes de chamada e preencher tudo com um clique.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* TODAY'S SCHEDULES */}
              <div className="space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                  <span>Aulas Agendadas para Hoje ({getDayLabel(todayDayNum)})</span>
                </div>

                <div className="space-y-2.5">
                  {todayScheds.length === 0 ? (
                    <div className="bg-zinc-900/20 border border-zinc-850/50 rounded-xl p-4 text-center text-zinc-500 text-xs">
                      Nenhuma aula agendada para hoje na sua grade de horários.
                    </div>
                  ) : (
                    todayScheds.map((sched) => {
                      const sch = schools.find(s => s.id === sched.schoolId);
                      const cls = classesList.find(c => c.id === sched.classId);
                      const sub = subjectsList.find(s => s.id === sched.subjectId);
                      return (
                        <button
                          key={sched.id}
                          type="button"
                          onClick={() => handleSelectSchedule(sched)}
                          className="w-full text-left bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 hover:border-emerald-500/40 p-3.5 rounded-xl transition duration-200 cursor-pointer flex items-center justify-between gap-3 group relative overflow-hidden shadow-sm"
                        >
                          <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
                          <div className="space-y-1 w-full min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5 text-zinc-500 text-[10px]">
                              <Clock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                              <span className="font-mono font-bold text-zinc-200">{sched.timeSlot}</span>
                              <span className="bg-zinc-950 px-1.5 py-0.5 rounded text-zinc-400 truncate max-w-[150px]">{sch?.name}</span>
                            </div>
                            <h5 className="font-bold text-zinc-100 text-xs truncate group-hover:text-emerald-300 transition-colors">{sub?.name || 'Sem Disciplina'}</h5>
                            <span className="text-[10px] text-zinc-400 block font-semibold">Turma: {cls?.name || 'Sem Turma'}</span>
                          </div>
                          <div className="bg-zinc-950 p-2 rounded-lg border border-zinc-800/80 group-hover:bg-emerald-500/10 group-hover:border-emerald-500/20 transition-all shrink-0">
                            <ArrowRight className="w-4 h-4 text-zinc-400 group-hover:text-emerald-400 transition-colors" />
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* OTHER DAYS OF THE WEEK */}
              <div className="space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-400">
                  <Calendar className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                  <span>Demais Aulas da Semana</span>
                </div>

                <div className="max-h-[350px] overflow-y-auto pr-1 space-y-2.5 scrollbar-thin scrollbar-thumb-zinc-800">
                  {otherScheds.length === 0 ? (
                    <div className="bg-zinc-900/20 border border-zinc-850/50 rounded-xl p-4 text-center text-zinc-500 text-xs">
                      Nenhum outro horário semanal cadastrado.
                    </div>
                  ) : (
                    [...otherScheds]
                      .sort((a, b) => {
                        if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
                        return a.timeSlot.localeCompare(b.timeSlot);
                      })
                      .map((sched) => {
                        const sch = schools.find(s => s.id === sched.schoolId);
                        const cls = classesList.find(c => c.id === sched.classId);
                        const sub = subjectsList.find(s => s.id === sched.subjectId);
                        return (
                          <button
                            key={sched.id}
                            type="button"
                            onClick={() => handleSelectSchedule(sched)}
                            className="w-full text-left bg-zinc-950 hover:bg-zinc-900 border border-zinc-850/60 hover:border-blue-500/30 p-3 rounded-xl transition duration-150 cursor-pointer flex items-center justify-between gap-3 group"
                          >
                            <div className="space-y-1 w-full min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5 text-zinc-500 text-[10px]">
                                <span className="font-bold text-blue-400 bg-blue-950/40 px-1.5 py-0.5 rounded border border-blue-900/30">
                                  {getDayLabel(sched.dayOfWeek).split('-')[0]}
                                </span>
                                <span className="font-mono font-bold text-zinc-400">{sched.timeSlot}</span>
                                <span className="text-zinc-500 truncate max-w-[120px]">{sch?.name}</span>
                              </div>
                              <h5 className="font-bold text-zinc-300 text-xs truncate group-hover:text-blue-300 transition-colors">{sub?.name || 'Sem Disciplina'}</h5>
                              <span className="text-[10px] text-zinc-500 block font-medium">Turma: {cls?.name || 'Sem Turma'}</span>
                            </div>
                            <div className="bg-zinc-900 p-1.5 rounded-lg border border-zinc-800/40 group-hover:bg-blue-500/5 group-hover:border-blue-500/10 shrink-0">
                              <ArrowRight className="w-3.5 h-3.5 text-zinc-500 group-hover:text-blue-400 transition-colors" />
                            </div>
                          </button>
                        );
                      })
                  )}
                </div>
              </div>

            </div>
          )}
        </div>
      </div>
    );
  }

  // Calculate cumulative stats per student
  const totalLessonsGiven = allLessons.reduce((acc, curr) => {
    const count = Number(curr.lessonCount);
    return acc + (isNaN(count) || count <= 0 ? 2 : count);
  }, 0);

  const getStudentCumulativeAttendance = (studentId: number) => {
    if (totalLessonsGiven === 0) return { absences: 0, pct: 100 };
    
    // Sum absences for this student in this bimonthly
    const absences = bimonthlyAttendance
      .filter((a) => a.studentId === studentId)
      .reduce((acc, curr) => acc + curr.absences, 0);

    const pct = Math.max(0, Math.min(100, Math.round(((totalLessonsGiven - absences) / totalLessonsGiven) * 100)));
    return { absences, pct };
  };

  // Save or update lesson log
  const handleSaveLesson = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const safeCount = Number(lessonCount) || 2;
      const safeContent = content ? content.trim() : '';
      const safeBimonthly = Number(bimonthly) || 1;

      if (editingLessonId !== undefined) {
        await db.lessons.update(editingLessonId, {
          date: selectedDate,
          lessonCount: safeCount,
          content: safeContent,
          bimonthly: safeBimonthly,
        });
        setEditingLessonId(undefined);
      } else if (currentLesson) {
        await db.lessons.update(currentLesson.id!, {
          lessonCount: safeCount,
          content: safeContent,
          bimonthly: safeBimonthly,
        });
      } else {
        await db.lessons.add({
          classId: Number(classId),
          subjectId: Number(subjectId),
          date: selectedDate,
          bimonthly: safeBimonthly,
          lessonCount: safeCount,
          content: safeContent,
        });
      }
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
    } catch (err) {
      console.error('Error saving lesson:', err);
    }
  };

  const handleEditLesson = (lesson: Lesson) => {
    const count = Number(lesson.lessonCount);
    setEditingLessonId(lesson.id);
    setSelectedDate(lesson.date);
    setLessonCount(isNaN(count) || count <= 0 ? 2 : count);
    setContent(lesson.content || '');
    setIsSaved(false);
  };

  const handleDeleteLesson = async (lessonId: number, lessonDate: string) => {
    if (!window.confirm(`Tem certeza que deseja excluir a aula ministrada do dia ${lessonDate.split('-').reverse().join('/')}?`)) {
      return;
    }
    try {
      await db.lessons.delete(lessonId);
      
      // Delete associated attendance records for this subject and date to keep data clean
      const associatedAttendance = await db.attendance
        .filter(a => Number(a.subjectId) === Number(subjectId) && a.date === lessonDate)
        .toArray();
      for (const att of associatedAttendance) {
        await db.attendance.delete(att.id!);
      }

      if (editingLessonId === lessonId) {
        setEditingLessonId(undefined);
        setLessonCount(2);
        setContent('');
      }
    } catch (err) {
      console.error('Error deleting lesson:', err);
    }
  };

  // Update absences for a student
  const handleSetAbsences = async (studentId: number, count: number) => {
    try {
      const existing = dailyAttendance.find((a) => a.studentId === studentId);
      if (existing) {
        await db.attendance.update(existing.id!, { absences: count });
      } else {
        await db.attendance.add({
          studentId,
          date: selectedDate,
          subjectId: Number(subjectId),
          bimonthly: Number(bimonthly),
          absences: count,
        });
      }
    } catch (err) {
      console.error('Error updating attendance:', err);
    }
  };

  const getAbsencesForStudent = (studentId: number): number => {
    const record = dailyAttendance.find((a) => a.studentId === studentId);
    return record ? record.absences : 0;
  };

  return (
    <div id="attendance-tab-content" className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      
      {/* 1. Weekly Schedule Shortcuts card / Agenda do Dia */}
      <div className="col-span-12 lg:col-span-5 order-1 lg:order-1 bg-zinc-900 border border-zinc-800 p-4 rounded-2xl space-y-3 shadow-md">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
            <h4 className="text-xs font-bold text-zinc-300 flex items-center gap-1.5 uppercase tracking-wider">
              <CalendarDays className="w-3.5 h-3.5 text-blue-400" />
              Agenda do Dia
            </h4>
            <span className="text-[9px] font-bold text-zinc-500 font-mono">
              Hoje ({getDayLabel(getTodayDayOfWeek()).split('-')[0]})
            </span>
          </div>

          {weeklySchedules.length === 0 ? (
            <p className="text-[11px] text-zinc-500 text-center py-2">
              Nenhum horário cadastrado nas configurações.
            </p>
          ) : (
            <div className="space-y-1.5 pr-1">
              {weeklySchedules
                .filter(s => s.dayOfWeek === getTodayDayOfWeek())
                .map((sched) => {
                  const sch = schools.find(s => s.id === sched.schoolId);
                  const cls = classesList.find(c => c.id === sched.classId);
                  const sub = subjectsList.find(s => s.id === sched.subjectId);
                  const isCurrent = sched.schoolId === schoolId && sched.classId === classId && sched.subjectId === subjectId;

                  return (
                    <button
                      key={sched.id}
                      type="button"
                      onClick={() => handleSelectSchedule(sched)}
                      disabled={isCurrent}
                      className={`w-full text-left p-2.5 rounded-xl text-xs flex items-center justify-between gap-2 border transition cursor-pointer ${
                        isCurrent
                          ? 'bg-emerald-950/20 border-emerald-500/25 text-emerald-400 font-semibold'
                          : 'bg-zinc-950 hover:bg-zinc-900 border-zinc-850 text-zinc-300 hover:text-white'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1 text-[9px] text-zinc-500">
                          <Clock className="w-3 h-3 text-zinc-400 shrink-0" />
                          <span className="font-mono font-bold">{sched.timeSlot}</span>
                          {isCurrent && <span className="bg-emerald-500/10 px-1 py-0.2 rounded text-[8px] text-emerald-400 font-bold shrink-0">Ativo</span>}
                        </div>
                        <p className="font-bold text-xs truncate">{sub?.name || 'Sem Disciplina'}</p>
                        <p className="text-[10px] text-zinc-400 truncate">{cls?.name || 'Sem Turma'}</p>
                      </div>
                      {!isCurrent && (
                        <ArrowRight className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                      )}
                    </button>
                  );
                })}
              
              {weeklySchedules.filter(s => s.dayOfWeek === getTodayDayOfWeek()).length === 0 && (
                <div className="text-center py-3">
                  <p className="text-[10px] text-zinc-500">Nenhuma aula agendada para hoje.</p>
                  <p className="text-[9px] text-zinc-600 mt-0.5">Veja a grade completa ou mude abaixo.</p>
                </div>
              )}
            </div>
          )}

          {/* Quick link to see all schedules if today has none */}
          {weeklySchedules.length > 0 && (
            <div className="pt-2 border-t border-zinc-800/50 flex items-center justify-between gap-2">
              <span className="text-[9px] text-zinc-500 uppercase font-semibold">Toda a Grade</span>
              <select
                id="quick-schedule-select"
                onChange={(e) => {
                  const val = e.target.value;
                  if (val) {
                    const sched = weeklySchedules.find(s => s.id === parseInt(val));
                    if (sched) handleSelectSchedule(sched);
                  }
                  e.target.value = '';
                }}
                className="bg-zinc-950 border border-zinc-800 text-zinc-300 text-[10px] rounded px-2 py-1 max-w-[160px] focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
              >
                <option value="">Outros dias...</option>
                {[...weeklySchedules]
                  .sort((a, b) => {
                    if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
                    return a.timeSlot.localeCompare(b.timeSlot);
                  })
                  .map(sched => {
                    const dayName = getDayLabel(sched.dayOfWeek).split('-')[0];
                    const cls = classesList.find(c => c.id === sched.classId);
                    const sub = subjectsList.find(s => s.id === sched.subjectId);
                    return (
                      <option key={sched.id} value={sched.id}>
                        {dayName} - {sched.timeSlot} - {sub?.name} ({cls?.name})
                      </option>
                    );
                  })}
              </select>
            </div>
          )}
        </div>

        {/* 2. Chamada Inteligente */}
        <div className="col-span-12 lg:col-span-7 lg:row-span-3 order-2 lg:order-2 bg-zinc-900 border border-zinc-800 p-5 rounded-2xl space-y-4 shadow-xl h-fit">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-zinc-800 pb-3 gap-2">
            <div>
              <h3 className="text-white font-bold text-base flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" /> Chamada Inteligente
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Atribua faltas clicando no número correspondente para a aula de hoje
              </p>
            </div>

            <div className="text-xs text-zinc-500 bg-zinc-950 px-2.5 py-1.5 rounded-lg font-mono">
              Data: {selectedDate.split('-').reverse().join('/')}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table id="attendance-students-table" className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-400 text-[11px] uppercase font-bold tracking-wider select-none">
                  <th className="py-2 px-2 w-10 text-center">Nº</th>
                  <th className="py-2 px-3">Nome do Aluno</th>
                  <th className="py-2 px-2 text-center w-28 bg-zinc-950/30">Lançar Falta</th>
                  <th className="py-2 px-3 text-right w-28">Presença Geral</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 text-xs">
                {students.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-zinc-500">
                      Nenhum aluno cadastrado nesta turma.
                    </td>
                  </tr>
                ) : (
                  students.map((student) => {
                    const dailyAbsences = getAbsencesForStudent(student.id!);
                    const stats = getStudentCumulativeAttendance(student.id!);
                    
                    const isBelowAttendanceRequirement = stats.pct < 75;

                    return (
                      <tr key={student.id} className="hover:bg-white/5 transition-colors group">
                        <td className="py-3 px-2 text-center text-zinc-500 font-mono">{student.rollNumber}</td>
                        <td className="py-3 px-3 font-medium text-zinc-200">
                          {student.name}
                        </td>
                        
                        {/* Attendance Buttons Selection */}
                        <td className="py-1.5 px-1 text-center bg-zinc-950/20">
                          <div className="inline-flex rounded-lg bg-zinc-950 p-1 border border-zinc-800">
                            {Array.from({ length: lessonCount + 1 }).map((_, absIdx) => {
                              const isActive = dailyAbsences === absIdx;
                              let btnStyle = 'text-zinc-500 hover:text-zinc-300';
                              
                              if (isActive) {
                                btnStyle = absIdx === 0 
                                  ? 'bg-emerald-600 text-white font-extrabold shadow-sm shadow-emerald-600/10' 
                                  : 'bg-rose-600 text-white font-extrabold shadow-sm shadow-rose-600/10';
                              }

                              return (
                                <button
                                  id={`set-absences-btn-${student.id}-${absIdx}`}
                                  key={absIdx}
                                  type="button"
                                  disabled={isReadOnly}
                                  onClick={() => !isReadOnly && handleSetAbsences(student.id!, absIdx)}
                                  className={`px-2 py-1 rounded text-[10px] font-mono cursor-pointer transition disabled:pointer-events-none ${btnStyle}`}
                                  title={`${absIdx === 0 ? 'Presença Completa' : `${absIdx} Falta(s)`}`}
                                >
                                  {absIdx === 0 ? 'P' : `${absIdx}F`}
                                </button>
                              );
                            })}
                          </div>
                        </td>

                        {/* Presença Acumulada % */}
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <div className="text-right">
                              <span className={`font-mono font-bold text-xs ${
                                isBelowAttendanceRequirement ? 'text-rose-400 font-extrabold' : 'text-zinc-300'
                              }`}>
                                {stats.pct}%
                              </span>
                              <span className="block text-[9px] text-zinc-500">
                                {stats.absences} faltas
                              </span>
                            </div>
                            
                            {isBelowAttendanceRequirement && (
                              <ShieldAlert className="w-3.5 h-3.5 text-rose-400 shrink-0 animate-pulse" title="Risco de reprovação por falta (< 75%)" />
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 3. Lesson Registration Form */}
        <form
          id="lesson-log-form"
          onSubmit={handleSaveLesson}
          className="col-span-12 lg:col-span-5 order-3 lg:order-3 bg-zinc-900 border border-zinc-800 p-5 rounded-2xl space-y-4 shadow-xl"
        >
          <div className="flex items-center gap-2 border-b border-zinc-800 pb-3">
            <BookOpen className="w-5 h-5 text-blue-400" />
            <h3 className="text-white font-bold text-base">
              {editingLessonId !== undefined ? 'Editar Aula Ministrada' : 'Registro de Aula Ministrada'}
            </h3>
          </div>

          <div className="space-y-3">
            {/* Date Selection */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-400 block">Data da Aula</label>
              <div className="relative">
                <input
                  id="attendance-date-select"
                  type="date"
                  required
                  disabled={isReadOnly}
                  value={selectedDate}
                  onChange={(e) => {
                    setSelectedDate(e.target.value);
                    setIsSaved(false);
                  }}
                  className="bg-zinc-950 border border-zinc-800 text-zinc-200 text-xs rounded-xl px-3 py-2.5 w-full focus:ring-1 focus:ring-blue-500 focus:outline-none disabled:opacity-60"
                />
              </div>
            </div>

            {/* Lesson Count */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-400 block">Quantidade de Aulas / Horas</label>
              <select
                id="attendance-lesson-count-select"
                value={lessonCount}
                disabled={isReadOnly}
                onChange={(e) => {
                  setLessonCount(parseInt(e.target.value));
                  setIsSaved(false);
                }}
                className="bg-zinc-950 border border-zinc-800 text-zinc-200 text-xs rounded-xl px-3 py-2.5 w-full focus:ring-1 focus:ring-blue-500 focus:outline-none cursor-pointer disabled:opacity-60 disabled:pointer-events-none"
              >
                <option value={1}>1 Aula / Hora de Aula</option>
                <option value={2}>2 Aulas / Horas de Aula (Bloco Comum)</option>
                <option value={3}>3 Aulas / Horas de Aula</option>
                <option value={4}>4 Aulas / Horas de Aula</option>
              </select>
            </div>

            {/* Lesson Content Description */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-400 block">Conteúdo Ministrado</label>
              <textarea
                id="attendance-content-textarea"
                rows={4}
                required
                disabled={isReadOnly}
                placeholder="Ex: Introdução à citologia, organelas citoplasmáticas e suas funções. Exercícios do livro didático pág 34-36."
                value={content}
                onChange={(e) => {
                  setContent(e.target.value);
                  setIsSaved(false);
                }}
                className="bg-zinc-950 border border-zinc-800 text-zinc-200 text-xs rounded-xl p-3 w-full focus:ring-1 focus:ring-blue-500 focus:outline-none disabled:opacity-60"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-zinc-800 gap-2">
            <span className="text-[10px] text-zinc-500">
              {isReadOnly 
                ? 'Visualizando Diário de Aula' 
                : editingLessonId !== undefined
                  ? '✏️ Editando registro selecionado'
                  : currentLesson 
                    ? '✓ Registro existente carregado' 
                    : '* Registre a aula antes de fechar'}
            </span>
            <div className="flex items-center gap-1.5">
              {editingLessonId !== undefined && (
                <button
                  id="cancel-edit-lesson-btn"
                  type="button"
                  onClick={() => {
                    setEditingLessonId(undefined);
                    setLessonCount(2);
                    setContent('');
                    setSelectedDate(new Date().toISOString().split('T')[0]);
                  }}
                  className="px-3 py-2 bg-zinc-800 hover:bg-zinc-750 text-zinc-300 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Cancelar
                </button>
              )}
              {!isReadOnly && (
                <button
                  id="save-lesson-btn"
                  type="submit"
                  className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                    isSaved 
                      ? 'bg-emerald-600 text-white' 
                      : 'bg-blue-600 hover:bg-blue-500 text-white shadow shadow-blue-500/10'
                  }`}
                >
                  <Save className="w-4 h-4" />
                  {isSaved ? 'Salvo com Sucesso!' : editingLessonId !== undefined ? 'Atualizar Aula' : 'Salvar Diário de Aula'}
                </button>
              )}
            </div>
          </div>
        </form>

        {/* 4. Statistics & Launched Contents Report (Last) */}
        <div className="col-span-12 lg:col-span-5 order-4 lg:order-4 bg-zinc-900 border border-zinc-800 p-5 rounded-2xl space-y-4 shadow-xl">
          <div className="flex items-center gap-2 border-b border-zinc-800 pb-3">
            <Info className="w-4 h-4 text-blue-400" />
            <h3 className="text-white font-bold text-sm uppercase tracking-wider">Estatísticas do Bimestre</h3>
          </div>

          {/* Progress Card */}
          {(() => {
            const targetBimonthlyLessons = currentWorkload ? currentWorkload.totalLessons : 40;
            const sortedLessons = [...allLessons].sort((a, b) => b.date.localeCompare(a.date));
            const formatLessonDate = (dateStr: string) => {
              if (!dateStr) return '';
              const parts = dateStr.split('-');
              if (parts.length === 3) {
                return `${parts[2]}/${parts[1]}`;
              }
              return dateStr;
            };

            const safeTotalLessonsGiven = typeof totalLessonsGiven === 'number' && !isNaN(totalLessonsGiven) ? totalLessonsGiven : 0;
            const safeTargetBimonthlyLessons = typeof targetBimonthlyLessons === 'number' && !isNaN(targetBimonthlyLessons) && targetBimonthlyLessons > 0 ? targetBimonthlyLessons : 40;
            const progressPercentage = Math.min(100, Math.max(0, (safeTotalLessonsGiven / safeTargetBimonthlyLessons) * 100));

            return (
              <div className="space-y-4">
                <div className="bg-zinc-950/40 border border-zinc-850 p-4 rounded-xl space-y-2">
                  <div className="text-zinc-400 text-xs font-semibold flex items-center justify-between">
                    <span>Progresso no Bimestre:</span>
                    <span className="font-mono font-bold bg-zinc-900 text-blue-400 px-2.5 py-0.5 rounded-full border border-zinc-800 text-[10px]">
                      {safeTotalLessonsGiven}/{safeTargetBimonthlyLessons} Aulas (Faltam {Math.max(0, safeTargetBimonthlyLessons - safeTotalLessonsGiven)})
                    </span>
                  </div>
                  {/* Progress bar */}
                  <div className="w-full bg-zinc-950 h-2 rounded-full overflow-hidden border border-zinc-900">
                    <div 
                      className="bg-blue-500 h-full rounded-full transition-all duration-300" 
                      style={{ width: `${progressPercentage}%` }}
                    ></div>
                  </div>
                  <p className="text-[10px] text-zinc-500 mt-1">
                    Cada falta atribuída deduz presença proporcional no cálculo da frequência acumulada.
                  </p>
                </div>

                {/* Launched Contents list */}
                <div className="space-y-2.5">
                  <div className="flex items-center gap-1.5 text-zinc-350 text-xs font-bold uppercase tracking-wider">
                    <BookOpen className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Conteúdos Lançados ({bimonthly}º Bim)</span>
                  </div>

                  <div className="space-y-2 pr-1">
                    {sortedLessons.length === 0 ? (
                      <div className="bg-zinc-950/20 border border-dashed border-zinc-850 p-6 text-center text-zinc-500 text-xs rounded-xl">
                        Nenhum conteúdo lançado para este bimestre ainda.
                      </div>
                    ) : (
                      sortedLessons.map((lesson) => (
                        <div key={lesson.id} className="bg-zinc-950/50 border border-zinc-850/60 hover:border-zinc-800 p-3 rounded-xl flex items-center justify-between gap-3 group transition">
                          {/* Date box badge */}
                          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-1.5 text-center min-w-[55px] shrink-0">
                            <span className="block font-black text-xs text-zinc-100">{formatLessonDate(lesson.date)}</span>
                            <span className="block text-[8px] text-zinc-500 font-mono mt-0.5">{lesson.lessonCount || 2} {(lesson.lessonCount || 2) === 1 ? 'aula' : 'aulas'}</span>
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <p className="text-zinc-300 text-xs font-semibold leading-relaxed line-clamp-3">
                              {lesson.content}
                            </p>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleEditLesson(lesson)}
                              disabled={isReadOnly}
                              className="p-1.5 text-zinc-500 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition disabled:opacity-20 disabled:pointer-events-none cursor-pointer"
                              title="Editar Registro"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteLesson(lesson.id!, lesson.date)}
                              disabled={isReadOnly}
                              className="p-1.5 text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition disabled:opacity-20 disabled:pointer-events-none cursor-pointer"
                              title="Excluir Registro"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

    </div>
  );
}
