import { useState, FormEvent, ChangeEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, seedDatabase, setCloudSyncDisabled } from '../db';
import { School, Class, Subject, Student, SubjectWorkload, WeeklySchedule, sortClasses } from '../types';
import { Plus, Trash2, Edit2, X, Import, Download, Upload, Calendar, Clock, BookOpen, School as SchoolIcon, Users, Settings, Database, Check, AlertTriangle, Sparkles, Save, User, Lock, Shield, Eye, EyeOff, Cloud, CloudUpload, CloudDownload, Sun, Moon } from 'lucide-react';
import { pushTeacherDataToCloud, pullTeacherDataFromCloud, getGlobalSchools, getGlobalClasses, getGlobalStudents, getGlobalSubjects, getGlobalWorkloads } from '../firebase';

export function getSchoolColorClasses(schoolId: number | undefined) {
  if (!schoolId) {
    return {
      bg: 'bg-zinc-800/30',
      border: 'border-zinc-700/30',
      text: 'text-zinc-400',
      badgeBg: 'bg-zinc-950',
      badgeText: 'text-zinc-400',
      badgeBorder: 'border-zinc-800',
      buttonSelected: 'bg-zinc-700 text-white border-zinc-600',
      buttonNormal: 'bg-zinc-950/50 border-zinc-800 text-zinc-400 hover:text-zinc-250 hover:bg-zinc-900',
      accentColor: 'bg-zinc-500'
    };
  }
  
  const themes = [
    {
      // Theme 1: Indigo/Blue (Professional, Morning feel)
      bg: 'bg-indigo-500/10',
      border: 'border-indigo-500/25',
      text: 'text-indigo-300',
      badgeBg: 'bg-indigo-950/40',
      badgeText: 'text-indigo-400',
      badgeBorder: 'border-indigo-500/30',
      buttonSelected: 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-500/10',
      buttonNormal: 'bg-zinc-950/40 border-zinc-800 text-zinc-400 hover:text-indigo-300 hover:border-indigo-500/30 hover:bg-indigo-500/5',
      accentColor: 'bg-indigo-500'
    },
    {
      // Theme 2: Amber/Teal/Teal (Warm/Afternoon feel)
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/25',
      text: 'text-amber-300',
      badgeBg: 'bg-amber-950/40',
      badgeText: 'text-amber-400',
      badgeBorder: 'border-amber-500/30',
      buttonSelected: 'bg-amber-600 text-white border-amber-500 shadow-md shadow-amber-500/10',
      buttonNormal: 'bg-zinc-950/40 border-zinc-800 text-zinc-400 hover:text-amber-300 hover:border-amber-500/30 hover:bg-amber-500/5',
      accentColor: 'bg-amber-500'
    },
    {
      // Theme 3: Emerald (Cool, elegant)
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/25',
      text: 'text-emerald-300',
      badgeBg: 'bg-emerald-950/40',
      badgeText: 'text-emerald-400',
      badgeBorder: 'border-emerald-500/30',
      buttonSelected: 'bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-500/10',
      buttonNormal: 'bg-zinc-950/40 border-zinc-800 text-zinc-400 hover:text-emerald-300 hover:border-emerald-500/30 hover:bg-emerald-500/5',
      accentColor: 'bg-emerald-500'
    },
    {
      // Theme 4: Pink/Rose
      bg: 'bg-pink-500/10',
      border: 'border-pink-500/25',
      text: 'text-pink-300',
      badgeBg: 'bg-pink-950/40',
      badgeText: 'text-pink-400',
      badgeBorder: 'border-pink-500/30',
      buttonSelected: 'bg-pink-600 text-white border-pink-500 shadow-md shadow-pink-500/10',
      buttonNormal: 'bg-zinc-950/40 border-zinc-800 text-zinc-400 hover:text-pink-300 hover:border-pink-500/30 hover:bg-pink-500/5',
      accentColor: 'bg-pink-500'
    },
    {
      // Theme 5: Violet/Purple
      bg: 'bg-violet-500/10',
      border: 'border-violet-500/25',
      text: 'text-violet-300',
      badgeBg: 'bg-violet-950/40',
      badgeText: 'text-violet-400',
      badgeBorder: 'border-violet-500/30',
      buttonSelected: 'bg-violet-600 text-white border-violet-500 shadow-md shadow-violet-500/10',
      buttonNormal: 'bg-zinc-950/40 border-zinc-800 text-zinc-400 hover:text-violet-300 hover:border-violet-500/30 hover:bg-violet-500/5',
      accentColor: 'bg-violet-500'
    },
    {
      // Theme 6: Cyan/Sky
      bg: 'bg-cyan-500/10',
      border: 'border-cyan-500/25',
      text: 'text-cyan-300',
      badgeBg: 'bg-cyan-950/40',
      badgeText: 'text-cyan-400',
      badgeBorder: 'border-cyan-500/30',
      buttonSelected: 'bg-cyan-600 text-white border-cyan-500 shadow-md shadow-cyan-500/10',
      buttonNormal: 'bg-zinc-950/40 border-zinc-800 text-zinc-400 hover:text-cyan-300 hover:border-cyan-500/30 hover:bg-cyan-500/5',
      accentColor: 'bg-cyan-500'
    }
  ];

  return themes[schoolId % themes.length];
}

interface TabFSettingsProps {
  teacherName: string;
  setTeacherName: (name: string) => void;
  onSecuritySaved?: () => void;
  isReadOnly?: boolean;
  theme?: 'light' | 'dark';
  setTheme?: (theme: 'light' | 'dark') => void;
}

export default function TabFSettings({
  teacherName,
  setTeacherName,
  onSecuritySaved,
  isReadOnly = false,
  theme = 'dark',
  setTheme
}: TabFSettingsProps) {
  const [activeSubTab, setActiveSubTab] = useState<'perfil' | 'cadastros' | 'grade' | 'backup' | 'turmas-globais'>('perfil');

  // PROFILE & SECURITY STATES
  const [profileName, setProfileName] = useState(teacherName);
  const [portalUsername, setPortalUsername] = useState(() => localStorage.getItem('portal_username') || 'professor');
  const [portalPassword, setPortalPassword] = useState(() => localStorage.getItem('portal_password') || '123456');
  const [portalAuthEnabled, setPortalAuthEnabled] = useState(() => localStorage.getItem('portal_auth_enabled') === 'true');
  const [portalPasswordHint, setPortalPasswordHint] = useState(() => localStorage.getItem('portal_password_hint') || '');
  const [portalSecurityQuestion, setPortalSecurityQuestion] = useState(() => localStorage.getItem('portal_security_question') || '');
  const [portalSecurityAnswer, setPortalSecurityAnswer] = useState(() => localStorage.getItem('portal_security_answer') || '');
  const [showPassword, setShowPassword] = useState(false);

  // FORM STATES
  const [newSchoolName, setNewSchoolName] = useState('');
  const [selectedSchoolIdForClass, setSelectedSchoolIdForClass] = useState<number | undefined>(undefined);
  const [newClassName, setNewClassName] = useState('');
  const [newSubjectName, setNewSubjectName] = useState('');

  // STUDENT MANAGEMENT STATES
  const [selectedSchoolIdForStudent, setSelectedSchoolIdForStudent] = useState<number | undefined>(undefined);
  const [selectedClassIdForStudent, setSelectedClassIdForStudent] = useState<number | undefined>(undefined);
  const [selectedClassIdForExport, setSelectedClassIdForExport] = useState<number | undefined>(undefined);
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentRoll, setNewStudentRoll] = useState<number | undefined>(undefined);
  const [bulkStudentText, setBulkStudentText] = useState('');

  // GRADE / WORKLOAD STATES
  const [selectedClassIdForWorkload, setSelectedClassIdForWorkload] = useState<number | undefined>(undefined);
  const [selectedSubjectIdForWorkload, setSelectedSubjectIdForWorkload] = useState<number | undefined>(undefined);
  const [workloadLessons, setWorkloadLessons] = useState(40);

  // WEEKLY SCHEDULE FORM STATES
  const [schedDay, setSchedDay] = useState(1); // 1 = Segunda
  const [schedStartTime, setSchedStartTime] = useState('07:00');
  const [schedEndTime, setSchedEndTime] = useState('09:00');
  const [schedSchool, setSchedSchool] = useState<number | undefined>(undefined);
  const [schedClass, setSchedClass] = useState<number | undefined>(undefined);
  const [schedSubject, setSchedSubject] = useState<number | undefined>(undefined);

  const applyTimeSuggestion = (start: string, end: string) => {
    setSchedStartTime(start);
    setSchedEndTime(end);
  };

  // EDITING STATES
  const [editingSchoolId, setEditingSchoolId] = useState<number | undefined>(undefined);
  const [editingSchoolName, setEditingSchoolName] = useState('');

  const [editingClassId, setEditingClassId] = useState<number | undefined>(undefined);
  const [editingClassName, setEditingClassName] = useState('');
  const [editingClassSchoolId, setEditingClassSchoolId] = useState<number | undefined>(undefined);

  const [editingSubjectId, setEditingSubjectId] = useState<number | undefined>(undefined);
  const [editingSubjectName, setEditingSubjectName] = useState('');

  const [editingStudentId, setEditingStudentId] = useState<number | undefined>(undefined);
  const [editingStudentName, setEditingStudentName] = useState('');
  const [editingStudentRoll, setEditingStudentRoll] = useState<number | undefined>(undefined);

  const [editingWorkloadId, setEditingWorkloadId] = useState<number | undefined>(undefined);
  const [editingWorkloadLessons, setEditingWorkloadLessons] = useState<number>(40);

  // DIALOG / MODAL STATES
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
  } | null>(null);

  const [alertDialog, setAlertDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onClose?: () => void;
  } | null>(null);

  // GLOBAL SHARED CLASSES STATES (FOR TEACHERS)
  const [globalSchools, setGlobalSchools] = useState<any[]>([]);
  const [globalClasses, setGlobalClasses] = useState<any[]>([]);
  const [globalStudents, setGlobalStudents] = useState<any[]>([]);
  const [loadingGlobals, setLoadingGlobals] = useState(false);
  const [selectedGlobalSchoolId, setSelectedGlobalSchoolId] = useState('');
  const [attachingClassId, setAttachingClassId] = useState<string | null>(null);

  const [syncingSubjectsAndWorkloads, setSyncingSubjectsAndWorkloads] = useState(false);

  const handleImportGlobalSubjectsAndWorkloads = async () => {
    setSyncingSubjectsAndWorkloads(true);
    try {
      // 1. Fetch global subjects, workloads, classes, and schools
      const globalSubs = await getGlobalSubjects();
      const globalWls = await getGlobalWorkloads();
      const globalCls = await getGlobalClasses();
      const globalSchs = await getGlobalSchools();

      if (globalSubs.length === 0) {
        setAlertDialog({
          isOpen: true,
          title: 'Nenhuma Disciplina Encontrada',
          message: 'Não há disciplinas cadastradas pela coordenação na nuvem ainda.'
        });
        return;
      }

      // 2. Fetch current local state of schools, classes, subjects
      const localSchools = await db.schools.toArray();
      const localClasses = await db.classes.toArray();
      const localSubjects = await db.subjects.toArray();

      // 3. Map global subjects to local subjects, creating missing ones
      const subMapping: { [globalId: string]: number } = {}; // Maps globalSubjectId to localSubjectId

      for (const gs of globalSubs) {
        let localSub = localSubjects.find(s => s.name.toLowerCase() === gs.name.toLowerCase());
        let localSubId: number;
        if (localSub) {
          localSubId = localSub.id!;
        } else {
          localSubId = await db.subjects.add({ name: gs.name });
        }
        subMapping[gs.id] = localSubId;
      }

      // 4. Map global workloads to local workloads
      let importedWorkloadsCount = 0;
      const activeUser = localStorage.getItem('portal_active_user');

      for (const gwl of globalWls) {
        // Filter workloads by assigned teacher if defined
        if (gwl.teacherUsername && activeUser && gwl.teacherUsername.toLowerCase() !== activeUser.toLowerCase()) {
          continue;
        }

        const gClass = globalCls.find(c => c.id === gwl.classId);
        if (!gClass) continue;

        const gSchool = globalSchs.find(s => s.id === gClass.schoolId);
        if (!gSchool) continue;

        // Find local school
        const lSchool = localSchools.find(s => s.name.toLowerCase() === gSchool.name.toLowerCase());
        if (!lSchool) continue;

        // Find local class
        const lClass = localClasses.find(c => c.name.toLowerCase() === gClass.name.toLowerCase() && c.schoolId === lSchool.id);
        if (!lClass) continue;

        // Find local subject ID
        const lSubId = subMapping[gwl.subjectId];
        if (!lSubId) continue;

        // Check if workload already exists locally
        const existingLocalWl = await db.subjectWorkloads
          .where('classId')
          .equals(lClass.id!)
          .filter(w => w.subjectId === lSubId)
          .first();

        if (existingLocalWl) {
          await db.subjectWorkloads.update(existingLocalWl.id!, { totalLessons: gwl.totalLessons });
        } else {
          await db.subjectWorkloads.add({
            classId: lClass.id!,
            subjectId: lSubId,
            totalLessons: gwl.totalLessons
          });
        }
        importedWorkloadsCount++;
      }

      // Force push teacher data to cloud to sync everything up
      if (activeUser) {
        await pushTeacherDataToCloud(activeUser, db);
      }

      setAlertDialog({
        isOpen: true,
        title: 'Sincronização Concluída',
        message: `As disciplinas e cargas horárias oficiais da coordenação foram importadas e atualizadas com sucesso! (${globalSubs.length} disciplinas mapeadas/atualizadas, ${importedWorkloadsCount} cargas horárias associadas às suas turmas locais).`
      });
    } catch (err) {
      console.error('Error importing global subjects and workloads:', err);
      setAlertDialog({
        isOpen: true,
        title: 'Erro na Importação',
        message: 'Ocorreu um erro ao importar as disciplinas e cargas horárias globais.'
      });
    } finally {
      setSyncingSubjectsAndWorkloads(false);
    }
  };

  const loadGlobalData = async () => {
    setLoadingGlobals(true);
    try {
      const schs = await getGlobalSchools();
      const cls = await getGlobalClasses();
      const stds = await getGlobalStudents();
      setGlobalSchools(schs);
      setGlobalClasses(cls);
      setGlobalStudents(stds);

      if (schs.length > 0 && !selectedGlobalSchoolId) {
        setSelectedGlobalSchoolId(schs[0].id);
      }
    } catch (err) {
      console.error('Error loading global data for teachers:', err);
    } finally {
      setLoadingGlobals(false);
    }
  };

  const handleAttachGlobalClass = async (cls: any) => {
    setAttachingClassId(cls.id);
    try {
      // 1. Get corresponding global school name
      const globalSchool = globalSchools.find(s => s.id === cls.schoolId);
      if (!globalSchool) {
        setAlertDialog({
          isOpen: true,
          title: 'Erro de Vínculo',
          message: 'Não foi possível encontrar a escola associada a esta turma na nuvem.'
        });
        return;
      }

      // 2. Find or create local school in Dexie DB
      let localSchool = schools.find(s => s.name.toLowerCase() === globalSchool.name.toLowerCase());
      let localSchoolId: number;
      if (localSchool) {
        localSchoolId = localSchool.id!;
      } else {
        localSchoolId = await db.schools.add({ name: globalSchool.name });
      }

      // 3. Find or create local class
      let localClass = classes.find(c => c.name.toLowerCase() === cls.name.toLowerCase() && c.schoolId === localSchoolId);
      let localClassId: number;
      if (localClass) {
        localClassId = localClass.id!;
      } else {
        localClassId = await db.classes.add({ name: cls.name, schoolId: localSchoolId });
      }

      // 4. Get global students of this global class
      const classStudents = globalStudents.filter(st => st.classId === cls.id);

      // 5. Add them to the local database, preventing duplicates by name
      let addedCount = 0;
      let skippedCount = 0;

      const currentLocalStudents = await db.students.where({ classId: localClassId }).toArray();

      for (const st of classStudents) {
        const studentExists = currentLocalStudents.some(
          localSt => localSt.name.toLowerCase() === st.name.toLowerCase()
        );

        if (!studentExists) {
          await db.students.add({
            classId: localClassId,
            name: st.name,
            rollNumber: st.rollNumber
          });
          addedCount++;
        } else {
          skippedCount++;
        }
      }

      // Force push teacher data to cloud
      const activeUser = localStorage.getItem('portal_active_user');
      if (activeUser) {
        await pushTeacherDataToCloud(activeUser, db);
      }

      setAlertDialog({
        isOpen: true,
        title: 'Turma Anexada!',
        message: `A turma "${cls.name}" da escola "${globalSchool.name}" foi integrada com sucesso! ${addedCount} alunos cadastrados. ${skippedCount > 0 ? `(${skippedCount} alunos já existiam e foram mesclados no seu diário)` : ''}`
      });

    } catch (err) {
      console.error('Error attaching global class:', err);
      setAlertDialog({
        isOpen: true,
        title: 'Erro ao Anexar',
        message: 'Ocorreu um erro ao processar a importação da turma global.'
      });
    } finally {
      setAttachingClassId(null);
    }
  };

  // Trigger loading when tab is selected
  const handleSetSubTabAndLoad = (tab: any) => {
    setActiveSubTab(tab);
    if (tab === 'turmas-globais') {
      loadGlobalData();
    }
  };

  // DATABASE STATES FOR RENDERING
  const schools = useLiveQuery(() => db.schools.toArray()) || [];
  const classes = useLiveQuery(() => db.classes.toArray()) || [];
  const subjects = useLiveQuery(() => db.subjects.toArray()) || [];
  
  const studentsFiltered = useLiveQuery(async () => {
    if (!selectedClassIdForStudent) return [];
    return db.students.where({ classId: selectedClassIdForStudent }).sortBy('rollNumber');
  }, [selectedClassIdForStudent]) || [];

  const workloads = useLiveQuery(() => db.subjectWorkloads.toArray()) || [];
  const weeklySchedules = useLiveQuery(() => db.weeklySchedule.toArray()) || [];

  const classesBySchool = selectedSchoolIdForStudent 
    ? [...classes].filter(c => c.schoolId === selectedSchoolIdForStudent).sort(sortClasses)
    : [];

  // ACTIONS: CRUD Schools
  const handleAddSchool = async (e: FormEvent) => {
    e.preventDefault();
    if (!newSchoolName.trim()) return;
    try {
      await db.schools.add({ name: newSchoolName.trim() });
      setNewSchoolName('');
    } catch (err) {
      console.error(err);
    }
  };

  const handleStartEditSchool = (sch: School) => {
    setEditingSchoolId(sch.id);
    setEditingSchoolName(sch.name);
  };

  const handleSaveEditSchool = async () => {
    if (!editingSchoolId || !editingSchoolName.trim()) return;
    try {
      await db.schools.update(editingSchoolId, { name: editingSchoolName.trim() });
      setEditingSchoolId(undefined);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteSchool = (id: number) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Excluir Escola',
      message: 'Excluir esta escola apagará permanentemente todas as suas turmas, alunos e notas associadas. Deseja realmente continuar?',
      confirmText: 'Excluir',
      cancelText: 'Cancelar',
      onConfirm: async () => {
        try {
          await db.transaction('rw', [
            db.schools, db.classes, db.students, db.bimonthlyGrades,
            db.attendance, db.studentVistos, db.vistoRankingScores, db.extraGrades, db.weeklySchedule, db.subjectWorkloads
          ], async () => {
            // Delete school
            await db.schools.delete(id);
            
            // Find and delete classes
            const relatedClasses = await db.classes.where({ schoolId: id }).toArray();
            for (const c of relatedClasses) {
              await db.classes.delete(c.id!);
              
              // Find and delete students
              const relatedStudents = await db.students.where({ classId: c.id! }).toArray();
              for (const s of relatedStudents) {
                await db.students.delete(s.id!);
                await db.bimonthlyGrades.where({ studentId: s.id! }).delete();
                await db.attendance.where({ studentId: s.id! }).delete();
                await db.studentVistos.where({ studentId: s.id! }).delete();
                await db.vistoRankingScores.where({ studentId: s.id! }).delete();
                await db.extraGrades.where({ studentId: s.id! }).delete();
              }
            }
            
            // Delete schedule/workloads for school
            await db.weeklySchedule.where({ schoolId: id }).delete();
            // Also clean up workloads for the classes we just deleted
            for (const c of relatedClasses) {
              await db.subjectWorkloads.where({ classId: c.id! }).delete();
            }
          });
          setConfirmDialog(null);
        } catch (err) {
          console.error(err);
          setConfirmDialog(null);
        }
      }
    });
  };

  // ACTIONS: CRUD Classes
  const handleAddClass = async (e: FormEvent) => {
    e.preventDefault();
    if (!newClassName.trim() || !selectedSchoolIdForClass) return;
    try {
      await db.classes.add({ name: newClassName.trim(), schoolId: selectedSchoolIdForClass });
      setNewClassName('');
    } catch (err) {
      console.error(err);
    }
  };

  const handleStartEditClass = (cls: Class) => {
    setEditingClassId(cls.id);
    setEditingClassName(cls.name);
    setEditingClassSchoolId(cls.schoolId);
  };

  const handleSaveEditClass = async () => {
    if (!editingClassId || !editingClassName.trim() || !editingClassSchoolId) return;
    try {
      await db.classes.update(editingClassId, {
        name: editingClassName.trim(),
        schoolId: editingClassSchoolId
      });
      setEditingClassId(undefined);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteClass = (id: number) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Excluir Turma',
      message: 'Excluir esta turma removerá permanentemente todos os alunos cadastrados e os registros de notas/chamada. Deseja continuar?',
      confirmText: 'Excluir',
      cancelText: 'Cancelar',
      onConfirm: async () => {
        try {
          await db.transaction('rw', [
            db.classes, db.students, db.bimonthlyGrades, db.attendance,
            db.studentVistos, db.vistoRankingScores, db.extraGrades, db.weeklySchedule, db.subjectWorkloads
          ], async () => {
            await db.classes.delete(id);
            
            const relatedStudents = await db.students.where({ classId: id }).toArray();
            for (const s of relatedStudents) {
              await db.students.delete(s.id!);
              await db.bimonthlyGrades.where({ studentId: s.id! }).delete();
              await db.attendance.where({ studentId: s.id! }).delete();
              await db.studentVistos.where({ studentId: s.id! }).delete();
              await db.vistoRankingScores.where({ studentId: s.id! }).delete();
              await db.extraGrades.where({ studentId: s.id! }).delete();
            }
            
            await db.weeklySchedule.where({ classId: id }).delete();
            await db.subjectWorkloads.where({ classId: id }).delete();
          });
          setConfirmDialog(null);
        } catch (err) {
          console.error(err);
          setConfirmDialog(null);
        }
      }
    });
  };

  // ACTIONS: CRUD Subjects
  const handleAddSubject = async (e: FormEvent) => {
    e.preventDefault();
    if (!newSubjectName.trim()) return;
    try {
      await db.subjects.add({ name: newSubjectName.trim() });
      setNewSubjectName('');
    } catch (err) {
      console.error(err);
    }
  };

  const handleStartEditSubject = (sub: Subject) => {
    setEditingSubjectId(sub.id);
    setEditingSubjectName(sub.name);
  };

  const handleSaveEditSubject = async () => {
    if (!editingSubjectId || !editingSubjectName.trim()) return;
    try {
      await db.subjects.update(editingSubjectId, { name: editingSubjectName.trim() });
      setEditingSubjectId(undefined);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteSubject = (id: number) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Excluir Disciplina',
      message: 'Excluir esta disciplina apagará todas as notas, vistos e cargas horárias vinculadas a ela. Deseja continuar?',
      confirmText: 'Excluir',
      cancelText: 'Cancelar',
      onConfirm: async () => {
        try {
          await db.transaction('rw', [
            db.subjects, db.bimonthlyGrades, db.attendance, db.vistoColumns, db.studentVistos, db.vistoRankingScores, db.extraGrades, db.weeklySchedule, db.subjectWorkloads
          ], async () => {
            await db.subjects.delete(id);
            await db.bimonthlyGrades.where({ subjectId: id }).delete();
            await db.attendance.where({ subjectId: id }).delete();
            
            const relatedVistoCols = await db.vistoColumns.where({ subjectId: id }).toArray();
            for (const col of relatedVistoCols) {
              await db.vistoColumns.delete(col.id!);
              await db.studentVistos.where({ vistoColumnId: col.id! }).delete();
            }
            
            await db.vistoRankingScores.where({ subjectId: id }).delete();
            await db.extraGrades.where({ subjectId: id }).delete();
            await db.weeklySchedule.where({ subjectId: id }).delete();
            await db.subjectWorkloads.where({ subjectId: id }).delete();
          });
          setConfirmDialog(null);
        } catch (err) {
          console.error(err);
          setConfirmDialog(null);
        }
      }
    });
  };

  // ACTIONS: CRUD Students
  const handleAddStudent = async (e: FormEvent) => {
    e.preventDefault();
    if (!newStudentName.trim() || !selectedClassIdForStudent) return;
    try {
      const nextRoll = newStudentRoll || (studentsFiltered.length > 0 
        ? Math.max(...studentsFiltered.map(s => s.rollNumber)) + 1 
        : 1);

      await db.students.add({
        name: newStudentName.trim(),
        classId: selectedClassIdForStudent,
        rollNumber: nextRoll
      });

      setNewStudentName('');
      setNewStudentRoll(undefined);
    } catch (err) {
      console.error(err);
    }
  };

  const handleStartEditStudent = (st: Student) => {
    setEditingStudentId(st.id);
    setEditingStudentName(st.name);
    setEditingStudentRoll(st.rollNumber);
  };

  const handleSaveEditStudent = async () => {
    if (!editingStudentId || !editingStudentName.trim() || editingStudentRoll === undefined) return;
    try {
      await db.students.update(editingStudentId, {
        name: editingStudentName.trim(),
        rollNumber: editingStudentRoll
      });
      setEditingStudentId(undefined);
    } catch (err) {
      console.error(err);
    }
  };

  const handleBulkImportStudents = async () => {
    if (!bulkStudentText.trim() || !selectedClassIdForStudent) return;
    try {
      const lines = bulkStudentText.split('\n').map(l => l.trim()).filter(Boolean);
      let currentMax = studentsFiltered.length > 0 
        ? Math.max(...studentsFiltered.map(s => s.rollNumber)) 
        : 0;

      for (const name of lines) {
        currentMax++;
        await db.students.add({
          classId: selectedClassIdForStudent,
          name,
          rollNumber: currentMax
        });
      }

      setBulkStudentText('');
      setAlertDialog({
        isOpen: true,
        title: 'Sucesso',
        message: `${lines.length} alunos importados com sucesso!`
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteStudent = (id: number) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Excluir Aluno',
      message: 'Deseja remover este aluno? Todos os seus registros serão perdidos.',
      confirmText: 'Excluir',
      cancelText: 'Cancelar',
      onConfirm: async () => {
        try {
          await db.students.delete(id);
          await db.bimonthlyGrades.where({ studentId: id }).delete();
          await db.attendance.where({ studentId: id }).delete();
          await db.studentVistos.where({ studentId: id }).delete();
          await db.vistoRankingScores.where({ studentId: id }).delete();
          await db.extraGrades.where({ studentId: id }).delete();
          setConfirmDialog(null);
        } catch (err) {
          console.error(err);
          setConfirmDialog(null);
        }
      }
    });
  };

  // ACTIONS: Cargas Horárias
  const handleAddWorkload = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedClassIdForWorkload || !selectedSubjectIdForWorkload) return;
    try {
      const existing = await db.subjectWorkloads
        .where('classId')
        .equals(selectedClassIdForWorkload)
        .filter(w => w.subjectId === selectedSubjectIdForWorkload)
        .first();

      if (existing) {
        await db.subjectWorkloads.update(existing.id!, { totalLessons: workloadLessons });
      } else {
        await db.subjectWorkloads.add({
          classId: selectedClassIdForWorkload,
          subjectId: selectedSubjectIdForWorkload,
          totalLessons: workloadLessons
        });
      }
      setAlertDialog({
        isOpen: true,
        title: 'Sucesso',
        message: 'Carga horária configurada com sucesso!'
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleStartEditWorkload = (wl: SubjectWorkload) => {
    setEditingWorkloadId(wl.id);
    setEditingWorkloadLessons(wl.totalLessons);
  };

  const handleSaveEditWorkload = async () => {
    if (!editingWorkloadId) return;
    try {
      await db.subjectWorkloads.update(editingWorkloadId, {
        totalLessons: editingWorkloadLessons
      });
      setEditingWorkloadId(undefined);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteWorkload = async (id: number) => {
    try {
      await db.subjectWorkloads.delete(id);
    } catch (err) {
      console.error(err);
    }
  };

  // ACTIONS: Horário Semanal
  const handleAddSchedule = async (e: FormEvent) => {
    e.preventDefault();
    if (!schedSchool || !schedClass || !schedSubject) {
      setAlertDialog({
        isOpen: true,
        title: 'Atenção',
        message: 'Por favor, selecione a Escola, a Turma e a Disciplina.'
      });
      return;
    }
    const timeSlot = `${schedStartTime} - ${schedEndTime}`;
    try {
      await db.weeklySchedule.add({
        dayOfWeek: schedDay,
        timeSlot: timeSlot,
        schoolId: schedSchool,
        classId: schedClass,
        subjectId: schedSubject
      });
      setAlertDialog({
        isOpen: true,
        title: 'Sucesso',
        message: 'Horário de aula adicionado!'
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteSchedule = async (id: number) => {
    try {
      await db.weeklySchedule.delete(id);
    } catch (err) {
      console.error(err);
    }
  };

  // CLOUD BACKUP PUSH/PULL
  const [isSyncingCloud, setIsSyncingCloud] = useState(false);

  const handleCloudPush = async () => {
    const activeUser = localStorage.getItem('portal_active_user');
    if (!activeUser) return;

    setIsSyncingCloud(true);
    try {
      const success = await pushTeacherDataToCloud(activeUser, db);
      if (success) {
        setAlertDialog({
          isOpen: true,
          title: 'Nuvem Atualizada',
          message: 'Seus dados locais foram enviados com sucesso para a nuvem! Todas as suas turmas, alunos e notas estão guardadas com segurança no Firebase.'
        });
      } else {
        throw new Error('Push failed');
      }
    } catch (err) {
      console.error(err);
      setAlertDialog({
        isOpen: true,
        title: 'Erro de Sincronização',
        message: 'Não foi possível enviar os dados para a nuvem. Verifique sua conexão com a internet e tente novamente.'
      });
    } finally {
      setIsSyncingCloud(false);
    }
  };

  const handleCloudPull = async () => {
    const activeUser = localStorage.getItem('portal_active_user');
    if (!activeUser) return;

    setConfirmDialog({
      isOpen: true,
      title: 'Restaurar da Nuvem',
      message: 'AVISO: Baixar os dados da nuvem substituirá todos os dados atuais cadastrados neste navegador pelo que está salvo no servidor. Deseja realmente continuar?',
      confirmText: 'Baixar da Nuvem',
      cancelText: 'Cancelar',
      onConfirm: async () => {
        setConfirmDialog(null);
        setIsSyncingCloud(true);
        try {
          const success = await pullTeacherDataFromCloud(activeUser, db);
          if (success) {
            setAlertDialog({
              isOpen: true,
              title: 'Restauração Concluída',
              message: 'Seus diários de classe foram restaurados com sucesso a partir da nuvem!',
              onClose: () => {
                window.location.reload();
              }
            });
          } else {
            throw new Error('Pull failed');
          }
        } catch (err) {
          console.error(err);
          setAlertDialog({
            isOpen: true,
            title: 'Erro de Sincronização',
            message: 'Não foi possível baixar os dados da nuvem. Verifique sua conexão com a internet.'
          });
        } finally {
          setIsSyncingCloud(false);
        }
      }
    });
  };

  // BACKUP EXPORT
  const handleExportBackup = async () => {
    try {
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

      const jsonStr = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `backup_portal_professor_${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Backup export failed:', err);
      setAlertDialog({
        isOpen: true,
        title: 'Erro',
        message: 'Erro ao exportar backup local.'
      });
    }
  };

  // EXPORTAR DADOS POR TURMA (Trabalhos por Turma)
  const handleExportClassBackup = async (classId: number) => {
    try {
      const classObj = await db.classes.get(classId);
      if (!classObj) {
        setAlertDialog({
          isOpen: true,
          title: 'Erro',
          message: 'Turma não encontrada para exportação.'
        });
        return;
      }

      const schoolObj = classObj.schoolId ? await db.schools.get(classObj.schoolId) : null;
      const students = await db.students.where({ classId }).toArray();
      const studentIds = students.map(s => s.id).filter((id): id is number => id !== undefined);

      const workloads = await db.subjectWorkloads.where({ classId }).toArray();
      const weeklySchedule = await db.weeklySchedule.where({ classId }).toArray();
      
      // bimonthlyGrades para estes alunos
      const bimonthlyGrades = studentIds.length > 0 
        ? await db.bimonthlyGrades.where('studentId').anyOf(studentIds).toArray()
        : [];
      
      const assignmentDescriptions = await db.assignmentDescriptions.where({ classId }).toArray();
      const lessons = await db.lessons.where({ classId }).toArray();
      
      // attendance para estes alunos
      const attendance = studentIds.length > 0
        ? await db.attendance.where('studentId').anyOf(studentIds).toArray()
        : [];
      
      const vistoColumns = await db.vistoColumns.where({ classId }).toArray();
      const vistoColumnIds = vistoColumns.map(vc => vc.id).filter((id): id is number => id !== undefined);
      
      const studentVistos = studentIds.length > 0
        ? await db.studentVistos.where('studentId').anyOf(studentIds).toArray()
        : [];
      
      const vistoRankingScores = studentIds.length > 0
        ? await db.vistoRankingScores.where('studentId').anyOf(studentIds).toArray()
        : [];
      
      const extraGrades = studentIds.length > 0
        ? await db.extraGrades.where('studentId').anyOf(studentIds).toArray()
        : [];

      const subjects = await db.subjects.toArray();

      const data = {
        type: 'class_backup',
        version: 1,
        class: classObj,
        school: schoolObj,
        subjects,
        students,
        subjectWorkloads: workloads,
        weeklySchedule,
        bimonthlyGrades,
        assignmentDescriptions,
        lessons,
        attendance,
        vistoColumns,
        studentVistos,
        vistoRankingScores,
        extraGrades
      };

      const jsonStr = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      const sanitizedClassName = classObj.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      link.download = `backup_turma_${sanitizedClassName}_${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Class backup export failed:', err);
      setAlertDialog({
        isOpen: true,
        title: 'Erro',
        message: 'Erro ao exportar os diários e trabalhos da turma.'
      });
    }
  };

  // RESTAURAR/IMPORTAR DADOS POR TURMA
  const handleImportClassBackup = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const data = JSON.parse(text);

        if (!data || data.type !== 'class_backup' || !data.class) {
          setAlertDialog({
            isOpen: true,
            title: 'Erro',
            message: 'O arquivo enviado não é um backup de turma válido ou está corrompido.'
          });
          return;
        }

        const className = data.class.name;
        const schoolName = data.school?.name || 'Escola Importada';

        setConfirmDialog({
          isOpen: true,
          title: 'Confirmar Restauração de Turma',
          message: `AVISO: Importar os dados da turma "${className}" irá excluir e substituir qualquer dado existente de mesmo nome nesta escola ("${schoolName}"). Outras turmas NÃO serão afetadas. Deseja continuar?`,
          confirmText: 'Importar Turma',
          cancelText: 'Cancelar',
          onConfirm: async () => {
            setConfirmDialog(null);
            setCloudSyncDisabled(true);

            try {
              // 1. Resolver Escola
              let targetSchool = await db.schools.where({ name: schoolName }).first();
              let targetSchoolId: number;
              if (targetSchool && targetSchool.id) {
                targetSchoolId = targetSchool.id;
              } else {
                targetSchoolId = await db.schools.add({ name: schoolName });
              }

              // 2. Mapear disciplinas (subjects)
              const subjectIdMap = new Map<number, number>();
              if (data.subjects && Array.isArray(data.subjects)) {
                for (const sub of data.subjects) {
                  if (!sub.name) continue;
                  const existingSub = await db.subjects.where({ name: sub.name }).first();
                  if (existingSub && existingSub.id) {
                    subjectIdMap.set(Number(sub.id), existingSub.id);
                  } else {
                    const newId = await db.subjects.add({ name: sub.name });
                    subjectIdMap.set(Number(sub.id), newId);
                  }
                }
              }
              const mapSubjectId = (oldId: any) => subjectIdMap.get(Number(oldId)) || Number(oldId);

              // 3. Excluir dados da turma de mesmo nome se já existir nesta escola
              const existingClass = await db.classes.where({ name: className, schoolId: targetSchoolId }).first();
              if (existingClass && existingClass.id) {
                const classIdToClear = existingClass.id;
                const oldStudents = await db.students.where({ classId: classIdToClear }).toArray();
                const oldStudentIds = oldStudents.map(s => s.id).filter((id): id is number => id !== undefined);

                await db.transaction('rw', [
                  db.students, db.subjectWorkloads, db.weeklySchedule, db.bimonthlyGrades,
                  db.assignmentDescriptions, db.lessons, db.attendance, db.vistoColumns,
                  db.studentVistos, db.vistoRankingScores, db.extraGrades, db.classes
                ], async () => {
                  if (oldStudentIds.length > 0) {
                    await db.students.where('classId').equals(classIdToClear).delete();
                    await db.bimonthlyGrades.where('studentId').anyOf(oldStudentIds).delete();
                    await db.attendance.where('studentId').anyOf(oldStudentIds).delete();
                    await db.studentVistos.where('studentId').anyOf(oldStudentIds).delete();
                    await db.vistoRankingScores.where('studentId').anyOf(oldStudentIds).delete();
                    await db.extraGrades.where('studentId').anyOf(oldStudentIds).delete();
                  }
                  await db.subjectWorkloads.where('classId').equals(classIdToClear).delete();
                  await db.weeklySchedule.where('classId').equals(classIdToClear).delete();
                  await db.assignmentDescriptions.where('classId').equals(classIdToClear).delete();
                  await db.lessons.where('classId').equals(classIdToClear).delete();
                  
                  const vCols = await db.vistoColumns.where('classId').equals(classIdToClear).toArray();
                  const vColIds = vCols.map(vc => vc.id).filter((id): id is number => id !== undefined);
                  if (vColIds.length > 0) {
                    await db.studentVistos.where('vistoColumnId').anyOf(vColIds).delete();
                  }
                  await db.vistoColumns.where('classId').equals(classIdToClear).delete();
                  await db.classes.delete(classIdToClear);
                });
              }

              // 4. Inserir nova turma
              const newClassId = await db.classes.add({ name: className, schoolId: targetSchoolId });

              // 5. Inserir alunos e mapear IDs antigos para os novos
              const studentIdMap = new Map<number, number>();
              if (data.students && Array.isArray(data.students)) {
                for (const stud of data.students) {
                  const newId = await db.students.add({
                    name: stud.name,
                    rollNumber: Number(stud.rollNumber),
                    classId: newClassId
                  });
                  if (stud.id) {
                    studentIdMap.set(Number(stud.id), newId);
                  }
                }
              }
              const mapStudentId = (oldId: any) => studentIdMap.get(Number(oldId));

              // 6. Inserir colunas de vistos e mapear seus IDs
              const vistoColIdMap = new Map<number, number>();
              if (data.vistoColumns && Array.isArray(data.vistoColumns)) {
                for (const vc of data.vistoColumns) {
                  const newId = await db.vistoColumns.add({
                    classId: newClassId,
                    subjectId: mapSubjectId(vc.subjectId),
                    bimonthly: Number(vc.bimonthly || 1),
                    date: vc.date,
                    title: vc.title || 'Visto'
                  });
                  if (vc.id) {
                    vistoColIdMap.set(Number(vc.id), newId);
                  }
                }
              }
              const mapVistoColId = (oldId: any) => vistoColIdMap.get(Number(oldId));

              // 7. Inserir cargas horárias (subjectWorkloads)
              if (data.subjectWorkloads && Array.isArray(data.subjectWorkloads)) {
                const workloadsToInsert = data.subjectWorkloads.map((sw: any) => ({
                  classId: newClassId,
                  subjectId: mapSubjectId(sw.subjectId),
                  totalLessons: Number(sw.totalLessons || 40)
                }));
                if (workloadsToInsert.length > 0) await db.subjectWorkloads.bulkAdd(workloadsToInsert);
              }

              // 8. Inserir quadro de horários (weeklySchedule)
              if (data.weeklySchedule && Array.isArray(data.weeklySchedule)) {
                const schedulesToInsert = data.weeklySchedule.map((ws: any) => ({
                  dayOfWeek: Number(ws.dayOfWeek),
                  timeSlot: ws.timeSlot,
                  schoolId: targetSchoolId,
                  classId: newClassId,
                  subjectId: mapSubjectId(ws.subjectId)
                }));
                if (schedulesToInsert.length > 0) await db.weeklySchedule.bulkAdd(schedulesToInsert);
              }

              // 9. Inserir notas bimestrais (bimonthlyGrades)
              if (data.bimonthlyGrades && Array.isArray(data.bimonthlyGrades)) {
                const gradesToInsert = data.bimonthlyGrades
                  .map((bg: any) => {
                    const newStudId = mapStudentId(bg.studentId);
                    if (!newStudId) return null;
                    return {
                      studentId: newStudId,
                      bimonthly: Number(bg.bimonthly || bg.bimonth || 1),
                      subjectId: mapSubjectId(bg.subjectId),
                      t1: bg.t1 !== undefined && bg.t1 !== null ? Number(bg.t1) : undefined,
                      t2: bg.t2 !== undefined && bg.t2 !== null ? Number(bg.t2) : undefined,
                      t3: bg.t3 !== undefined && bg.t3 !== null ? Number(bg.t3) : undefined,
                      t4: bg.t4 !== undefined && bg.t4 !== null ? Number(bg.t4) : undefined,
                      t5: bg.t5 !== undefined && bg.t5 !== null ? Number(bg.t5) : undefined,
                      exam: bg.exam !== undefined && bg.exam !== null ? Number(bg.exam) : undefined,
                      recovery: bg.recovery !== undefined && bg.recovery !== null ? Number(bg.recovery) : undefined
                    };
                  })
                  .filter(Boolean) as any[];
                if (gradesToInsert.length > 0) await db.bimonthlyGrades.bulkAdd(gradesToInsert);
              }

              // 10. Inserir descrições de trabalhos (assignmentDescriptions)
              if (data.assignmentDescriptions && Array.isArray(data.assignmentDescriptions)) {
                const descsToInsert = data.assignmentDescriptions.map((ad: any) => ({
                  classId: newClassId,
                  subjectId: mapSubjectId(ad.subjectId),
                  bimonthly: Number(ad.bimonthly || ad.bimonth || 1),
                  t1: ad.t1,
                  t2: ad.t2,
                  t3: ad.t3,
                  t4: ad.t4,
                  t5: ad.t5
                }));
                if (descsToInsert.length > 0) await db.assignmentDescriptions.bulkAdd(descsToInsert);
              }

              // 11. Inserir diários de aulas (lessons)
              if (data.lessons && Array.isArray(data.lessons)) {
                const lessonsToInsert = data.lessons.map((ls: any) => ({
                  classId: newClassId,
                  subjectId: mapSubjectId(ls.subjectId),
                  date: ls.date,
                  bimonthly: Number(ls.bimonthly || 1),
                  lessonCount: Number(ls.lessonCount || 1),
                  content: ls.content || ''
                }));
                if (lessonsToInsert.length > 0) await db.lessons.bulkAdd(lessonsToInsert);
              }

              // 12. Inserir frequências/presenças (attendance)
              if (data.attendance && Array.isArray(data.attendance)) {
                const attToInsert = data.attendance
                  .map((at: any) => {
                    const newStudId = mapStudentId(at.studentId);
                    if (!newStudId) return null;
                    return {
                      studentId: newStudId,
                      date: at.date,
                      subjectId: mapSubjectId(at.subjectId),
                      bimonthly: Number(at.bimonthly || 1),
                      absences: Number(at.absences || 0)
                    };
                  })
                  .filter(Boolean) as any[];
                if (attToInsert.length > 0) await db.attendance.bulkAdd(attToInsert);
              }

              // 13. Inserir vistos individuais (studentVistos)
              if (data.studentVistos && Array.isArray(data.studentVistos)) {
                const vistosToInsert = data.studentVistos
                  .map((sv: any) => {
                    const newStudId = mapStudentId(sv.studentId);
                    const newVColId = mapVistoColId(sv.vistoColumnId);
                    if (!newStudId || !newVColId) return null;
                    return {
                      studentId: newStudId,
                      vistoColumnId: newVColId,
                      checked: Boolean(sv.checked)
                    };
                  })
                  .filter(Boolean) as any[];
                if (vistosToInsert.length > 0) await db.studentVistos.bulkAdd(vistosToInsert);
              }

              // 14. Inserir pontuações do ranking (vistoRankingScores)
              if (data.vistoRankingScores && Array.isArray(data.vistoRankingScores)) {
                const scoresToInsert = data.vistoRankingScores
                  .map((vrs: any) => {
                    const newStudId = mapStudentId(vrs.studentId);
                    if (!newStudId) return null;
                    return {
                      studentId: newStudId,
                      subjectId: mapSubjectId(vrs.subjectId),
                      bimonthly: Number(vrs.bimonthly || 1),
                      type: vrs.type || 'visto',
                      points: Number(vrs.points || 0),
                      reason: vrs.reason || '',
                      timestamp: Number(vrs.timestamp || Date.now())
                    };
                  })
                  .filter(Boolean) as any[];
                if (scoresToInsert.length > 0) await db.vistoRankingScores.bulkAdd(scoresToInsert);
              }

              // 15. Inserir notas extras / recuperações semestrais (extraGrades)
              if (data.extraGrades && Array.isArray(data.extraGrades)) {
                const extraToInsert = data.extraGrades
                  .map((eg: any) => {
                    const newStudId = mapStudentId(eg.studentId);
                    if (!newStudId) return null;
                    return {
                      studentId: newStudId,
                      subjectId: mapSubjectId(eg.subjectId),
                      recSem1: eg.recSem1 !== undefined && eg.recSem1 !== null ? Number(eg.recSem1) : undefined,
                      recSem2: eg.recSem2 !== undefined && eg.recSem2 !== null ? Number(eg.recSem2) : undefined,
                      finalExam: eg.finalExam !== undefined && eg.finalExam !== null ? Number(eg.finalExam) : undefined
                    };
                  })
                  .filter(Boolean) as any[];
                if (extraToInsert.length > 0) await db.extraGrades.bulkAdd(extraToInsert);
              }

              // Sincronizar as alterações locais com a nuvem (Firestore)
              const activeUser = localStorage.getItem('portal_active_user');
              if (activeUser) {
                try {
                  await pushTeacherDataToCloud(activeUser, db);
                } catch (cloudErr) {
                  console.error('Failed to auto-sync imported class data to Cloud Firestore:', cloudErr);
                }
              }

              setAlertDialog({
                isOpen: true,
                title: 'Sucesso',
                message: `Turma "${className}" importada, normalizada e sincronizada com sucesso tanto localmente quanto na nuvem!`,
                onClose: () => {
                  window.location.reload();
                }
              });
            } catch (err) {
              console.error('Class Import error:', err);
              setAlertDialog({
                isOpen: true,
                title: 'Erro',
                message: 'Erro ao processar e salvar a turma selecionada.'
              });
            } finally {
              setCloudSyncDisabled(false);
            }
          }
        });
      } catch (err) {
        console.error('Class Import parse error:', err);
        setAlertDialog({
          isOpen: true,
          title: 'Erro',
          message: 'Erro ao analisar o arquivo de backup de turma. Verifique se é um JSON válido.'
        });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // BACKUP IMPORT
  const handleImportBackup = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const data = JSON.parse(text);

        setConfirmDialog({
          isOpen: true,
          title: 'AVISO DE SEGURANÇA',
          message: 'AVISO: Importar um backup substituirá TODOS os dados atuais no seu navegador de forma irreversível. Deseja continuar?',
          confirmText: 'Importar Backup',
          cancelText: 'Cancelar',
          onConfirm: async () => {
            setConfirmDialog(null);
            setCloudSyncDisabled(true);

            try {
              // Restore session and user metadata from backup if available (Device Migration support)
              if (data.meta) {
                if (data.meta.professorsList) {
                  try {
                    const backupProfs = JSON.parse(data.meta.professorsList);
                    const currentProfsStr = localStorage.getItem('portal_professors_list');
                    let mergedProfs = backupProfs;
                    if (currentProfsStr) {
                      const currentProfs = JSON.parse(currentProfsStr);
                      const map = new Map();
                      currentProfs.forEach((p: any) => {
                        if (p && p.username) map.set(p.username.toLowerCase(), p);
                      });
                      backupProfs.forEach((p: any) => {
                        if (p && p.username) map.set(p.username.toLowerCase(), p);
                      });
                      mergedProfs = Array.from(map.values());
                    }
                    localStorage.setItem('portal_professors_list', JSON.stringify(mergedProfs));
                  } catch (e) {
                    console.error('Error merging professors list:', e);
                  }
                }

                if (data.meta.coordinatorsList) {
                  try {
                    const backupCoords = JSON.parse(data.meta.coordinatorsList);
                    const currentCoordsStr = localStorage.getItem('portal_coordinators_list');
                    let mergedCoords = backupCoords;
                    if (currentCoordsStr) {
                      const currentCoords = JSON.parse(currentCoordsStr);
                      const map = new Map();
                      currentCoords.forEach((c: any) => {
                        if (c && c.username) map.set(c.username.toLowerCase(), c);
                      });
                      backupCoords.forEach((c: any) => {
                        if (c && c.username) map.set(c.username.toLowerCase(), c);
                      });
                      mergedCoords = Array.from(map.values());
                    }
                    localStorage.setItem('portal_coordinators_list', JSON.stringify(mergedCoords));
                  } catch (e) {
                    console.error('Error merging coordinators list:', e);
                  }
                }

                if (data.meta.activeUser) {
                  localStorage.setItem('portal_active_user', data.meta.activeUser);
                }
                if (data.meta.activeUserDb) {
                  localStorage.setItem('portal_active_user_db', data.meta.activeUserDb);
                }
                if (data.meta.teacherName) {
                  localStorage.setItem('portal_teacher_name', data.meta.teacherName);
                }
                if (data.meta.username) {
                  localStorage.setItem('portal_username', data.meta.username);
                }
                if (data.meta.authEnabled) {
                  localStorage.setItem('portal_auth_enabled', data.meta.authEnabled);
                }
                
                // Let the UI system know storage has changed
                window.dispatchEvent(new Event('storage'));
              }

              // 1. NORMALIZE AND MIGRATE DATA STRUCTURES (older backups compatibility)
              
              // Normalize bimonth -> bimonthly for bimonthlyGrades
              if (data.bimonthlyGrades && Array.isArray(data.bimonthlyGrades)) {
                data.bimonthlyGrades = data.bimonthlyGrades.map((bg: any) => {
                  if (bg.bimonth !== undefined && bg.bimonthly === undefined) {
                    bg.bimonthly = Number(bg.bimonth);
                  }
                  if (bg.bimonthly === undefined) {
                    bg.bimonthly = 1;
                  }
                  // Resolve subjectId if missing
                  if (bg.subjectId === undefined) {
                    bg.subjectId = 10; // default to Mathematics
                  }
                  return bg;
                });
              }

              // Extract mid-term recovery grades (recSemestral1, recSemestral2, provaFinal / recSem1, recSem2, finalExam)
              // from either 'students' or 'bimonthlyGrades' and merge them into 'extraGrades'
              const extraGradesMap = new Map<string, { studentId: number; subjectId: number; recSem1?: number; recSem2?: number; finalExam?: number }>();

              // Load any existing extraGrades from the backup if they are already structured as a dedicated list
              if (data.extraGrades && Array.isArray(data.extraGrades)) {
                data.extraGrades.forEach((eg: any) => {
                  const key = `${eg.studentId}_${eg.subjectId}`;
                  extraGradesMap.set(key, {
                    studentId: Number(eg.studentId),
                    subjectId: Number(eg.subjectId),
                    recSem1: eg.recSem1 !== undefined && eg.recSem1 !== null ? Number(eg.recSem1) : undefined,
                    recSem2: eg.recSem2 !== undefined && eg.recSem2 !== null ? Number(eg.recSem2) : undefined,
                    finalExam: eg.finalExam !== undefined && eg.finalExam !== null ? Number(eg.finalExam) : undefined,
                  });
                });
              }

              // Try to extract from 'students' records (legacy backups where recovery grades were placed on the student object)
              if (data.students && Array.isArray(data.students)) {
                let defaultSubjectId = 10; // default main subject ID
                if (data.subjects && Array.isArray(data.subjects) && data.subjects.length > 0) {
                  const firstSub = data.subjects[0];
                  if (firstSub && firstSub.id) defaultSubjectId = Number(firstSub.id);
                }

                data.students.forEach((student: any) => {
                  const recSem1 = student.recSem1 ?? student.recSemestral1;
                  const recSem2 = student.recSem2 ?? student.recSemestral2;
                  const finalExam = student.finalExam ?? student.provaFinal;

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
              }

              // Try to extract from 'bimonthlyGrades' records (legacy backups where recovery was on grade entries)
              if (data.bimonthlyGrades && Array.isArray(data.bimonthlyGrades)) {
                data.bimonthlyGrades.forEach((bg: any) => {
                  const recSem1 = bg.recSem1 ?? bg.recSemestral1;
                  const recSem2 = bg.recSem2 ?? bg.recSemestral2;
                  const finalExam = bg.finalExam ?? bg.provaFinal;
                  const bgSubjectId = Number(bg.subjectId || 10);
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
              }

              // Format extraGrades for Dexie bulk insertion
              if (extraGradesMap.size > 0) {
                data.extraGrades = Array.from(extraGradesMap.values()).map((eg, idx) => ({
                  id: idx + 1,
                  ...eg
                }));
              }

              // Transactional overwrite
              await db.transaction('rw', [
                db.schools, db.classes, db.subjects, db.students, db.subjectWorkloads,
                db.weeklySchedule, db.bimonthlyGrades, db.assignmentDescriptions,
                db.lessons, db.attendance, db.vistoColumns, db.studentVistos,
                db.vistoRankingScores, db.extraGrades
              ], async () => {
                await db.schools.clear();
                await db.classes.clear();
                await db.subjects.clear();
                await db.students.clear();
                await db.subjectWorkloads.clear();
                await db.weeklySchedule.clear();
                await db.bimonthlyGrades.clear();
                await db.assignmentDescriptions.clear();
                await db.lessons.clear();
                await db.attendance.clear();
                await db.vistoColumns.clear();
                await db.studentVistos.clear();
                await db.vistoRankingScores.clear();
                await db.extraGrades.clear();

                if (data.schools) await db.schools.bulkAdd(data.schools);
                if (data.classes) await db.classes.bulkAdd(data.classes);
                if (data.subjects) await db.subjects.bulkAdd(data.subjects);
                if (data.students) await db.students.bulkAdd(data.students);
                if (data.subjectWorkloads) await db.subjectWorkloads.bulkAdd(data.subjectWorkloads);
                if (data.weeklySchedule) await db.weeklySchedule.bulkAdd(data.weeklySchedule);
                if (data.bimonthlyGrades) await db.bimonthlyGrades.bulkAdd(data.bimonthlyGrades);
                if (data.assignmentDescriptions) await db.assignmentDescriptions.bulkAdd(data.assignmentDescriptions);
                if (data.lessons) await db.lessons.bulkAdd(data.lessons);
                if (data.attendance) await db.attendance.bulkAdd(data.attendance);
                if (data.vistoColumns) await db.vistoColumns.bulkAdd(data.vistoColumns);
                if (data.studentVistos) await db.studentVistos.bulkAdd(data.studentVistos);
                if (data.vistoRankingScores) await db.vistoRankingScores.bulkAdd(data.vistoRankingScores);
                if (data.extraGrades) await db.extraGrades.bulkAdd(data.extraGrades);
              });

              // Automatically sync/push the imported and normalized data to the Cloud (Firestore)
              const activeUser = localStorage.getItem('portal_active_user');
              if (activeUser) {
                try {
                  await pushTeacherDataToCloud(activeUser, db);
                } catch (cloudErr) {
                  console.error('Failed to auto-sync imported data to Cloud Firestore:', cloudErr);
                }
              }

              setAlertDialog({
                isOpen: true,
                title: 'Sucesso',
                message: 'Backup importado, normalizado e restaurado com sucesso tanto localmente quanto na nuvem!',
                onClose: () => {
                  window.location.reload();
                }
              });
            } catch (innerErr) {
              console.error('DB restoration error:', innerErr);
              setAlertDialog({
                isOpen: true,
                title: 'Erro',
                message: 'Erro ao gravar os dados restaurados no banco de dados local.'
              });
            } finally {
              setCloudSyncDisabled(false);
            }
          }
        });
      } catch (err) {
        console.error('Import parse error:', err);
        setAlertDialog({
          isOpen: true,
          title: 'Erro',
          message: 'Erro ao processar o arquivo JSON de backup. Certifique-se de que é um backup válido.'
        });
      }
    };

    reader.readAsText(file);
    e.target.value = '';
  };

  // Demo seed trigger
  const handleLoadDemoData = () => {
    setConfirmDialog({
      isOpen: true,
      title: 'Carregar Dados de Demonstração',
      message: 'Carregar dados de demonstração preencherá a base de dados com escolas, turmas, alunos e notas de teste. Continuar?',
      confirmText: 'Carregar',
      cancelText: 'Cancelar',
      onConfirm: async () => {
        try {
          await seedDatabase();
          setConfirmDialog(null);
          setAlertDialog({
            isOpen: true,
            title: 'Dados Carregados',
            message: 'Dados de demonstração carregados com sucesso!',
            onClose: () => {
              window.location.reload();
            }
          });
        } catch (err) {
          console.error(err);
          setConfirmDialog(null);
        }
      }
    });
  };

  const handleSaveProfile = (e: FormEvent) => {
    e.preventDefault();
    const updatedName = profileName.trim();
    localStorage.setItem('portal_teacher_name', updatedName);
    setTeacherName(updatedName);

    // Sync to professors list
    const activeUser = localStorage.getItem('portal_active_user') || 'professor';
    const listStr = localStorage.getItem('portal_professors_list');
    if (listStr) {
      try {
        const list = JSON.parse(listStr);
        const index = list.findIndex((p: any) => p.username === activeUser);
        if (index !== -1) {
          list[index].teacherName = updatedName;
          localStorage.setItem('portal_professors_list', JSON.stringify(list));
        }
      } catch (err) {
        console.error(err);
      }
    }

    setAlertDialog({
      isOpen: true,
      title: 'Sucesso',
      message: 'Nome do professor atualizado com sucesso!'
    });
  };

  const handleResetDatabase = () => {
    setConfirmDialog({
      isOpen: true,
      title: '⚠️ ZERAR BANCO DE DADOS LOCAL',
      message: 'ATENÇÃO: Esta ação apagará permanentemente todas as suas escolas, turmas, alunos, notas, frequências e vistos salvos neste dispositivo. Seus dados na nuvem NÃO serão alterados automaticamente por segurança. Deseja realmente continuar e apagar tudo?',
      confirmText: 'Sim, Apagar Tudo',
      cancelText: 'Cancelar',
      onConfirm: async () => {
        try {
          setConfirmDialog(null);
          
          // Clear all dexie tables
          const tables = [
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
          
          for (const table of tables) {
            if (db[table]) {
              await db[table].clear();
            }
          }

          // Reset teacher profile name to default
          localStorage.removeItem('portal_teacher_name');
          localStorage.setItem('portal_skip_seed', 'true');
          
          setAlertDialog({
            isOpen: true,
            title: 'Dados Zerados',
            message: 'O banco de dados local foi limpo com sucesso! O aplicativo será reiniciado para criar uma nova conta ou baixar os dados da nuvem.',
            onClose: () => {
              window.location.reload();
            }
          });
        } catch (err) {
          console.error('Erro ao limpar banco de dados:', err);
          setAlertDialog({
            isOpen: true,
            title: 'Erro',
            message: 'Ocorreu um erro ao limpar o banco de dados. Tente novamente.'
          });
        }
      }
    });
  };

  const handleSaveSecurity = (e: FormEvent) => {
    e.preventDefault();
    if (!portalUsername.trim()) {
      setAlertDialog({
        isOpen: true,
        title: 'Aviso',
        message: 'O nome de usuário não pode ficar vazio.'
      });
      return;
    }
    if (portalPassword.length < 4) {
      setAlertDialog({
        isOpen: true,
        title: 'Senha muito curta',
        message: 'A senha de acesso deve ter pelo menos 4 caracteres.'
      });
      return;
    }

    const activeUser = localStorage.getItem('portal_active_user') || 'professor';
    const newUsername = portalUsername.trim().toLowerCase();

    // Sync to list
    const listStr = localStorage.getItem('portal_professors_list');
    if (listStr) {
      try {
        const list = JSON.parse(listStr);
        const index = list.findIndex((p: any) => p.username === activeUser);
        if (index !== -1) {
          list[index].username = newUsername;
          list[index].password = portalPassword;
          list[index].authEnabled = portalAuthEnabled;
          list[index].passwordHint = portalPasswordHint.trim();
          list[index].securityQuestion = portalSecurityQuestion.trim();
          list[index].securityAnswer = portalSecurityAnswer.trim();
          localStorage.setItem('portal_professors_list', JSON.stringify(list));
        }
      } catch (err) {
        console.error(err);
      }
    }

    localStorage.setItem('portal_active_user', newUsername);
    localStorage.setItem('portal_username', newUsername);
    localStorage.setItem('portal_password', portalPassword);
    localStorage.setItem('portal_auth_enabled', portalAuthEnabled ? 'true' : 'false');
    localStorage.setItem('portal_password_hint', portalPasswordHint.trim());
    localStorage.setItem('portal_security_question', portalSecurityQuestion.trim());
    localStorage.setItem('portal_security_answer', portalSecurityAnswer.trim());
    
    if (onSecuritySaved) {
      onSecuritySaved();
    }
    
    setAlertDialog({
      isOpen: true,
      title: 'Configurações Salvas',
      message: portalAuthEnabled 
        ? 'Proteção por senha ATIVADA! Na próxima vez que o aplicativo for aberto, o acesso exigirá login.'
        : 'Configurações de segurança atualizadas com sucesso! A proteção por senha está DESATIVADA.'
    });
  };

  const getDayName = (dayNum: number) => {
    const days = ['', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado', 'Domingo'];
    return days[dayNum] || '';
  };

  if (isReadOnly) {
    return (
      <div id="settings-tab-content" className="bg-zinc-900 border border-zinc-800 p-8 rounded-2xl text-center space-y-4 max-w-xl mx-auto my-12 shadow-xl">
        <div className="w-12 h-12 bg-zinc-950 rounded-xl flex items-center justify-center mx-auto text-amber-500 border border-zinc-800">
          <Shield className="w-6 h-6" />
        </div>
        <div className="space-y-2">
          <h3 className="text-white font-bold text-base">Configurações Desabilitadas</h3>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Você está atualmente no <strong>Modo de Inspeção (Somente Leitura)</strong> do diário de <strong>{teacherName}</strong>. 
            Como coordenador, você não possui permissão para modificar as turmas, calendários, alunos, senhas ou configurações de outros professores.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div id="settings-tab-content" className="space-y-6">
      
      {/* Sub tabs nav */}
      <div className="flex flex-col sm:flex-row flex-wrap gap-2 pb-4 border-b border-zinc-800">
        <button
          id="subtab-perfil-btn"
          onClick={() => handleSetSubTabAndLoad('perfil')}
          className={`px-4 py-2.5 font-bold text-xs sm:text-sm rounded-xl border transition-all flex items-center gap-2.5 cursor-pointer w-full sm:w-auto ${
            activeSubTab === 'perfil'
              ? 'bg-zinc-800 border-zinc-700 text-white shadow shadow-black/20'
              : 'text-zinc-400 border-zinc-850 hover:text-zinc-300 hover:bg-zinc-900/50 bg-zinc-950/30'
          }`}
        >
          <User className="w-4 h-4 text-blue-400 shrink-0" />
          <span>Perfil & Segurança</span>
        </button>
        <button
          id="subtab-cadastros-btn"
          onClick={() => handleSetSubTabAndLoad('cadastros')}
          className={`px-4 py-2.5 font-bold text-xs sm:text-sm rounded-xl border transition-all flex items-center gap-2.5 cursor-pointer w-full sm:w-auto ${
            activeSubTab === 'cadastros'
              ? 'bg-zinc-800 border-zinc-700 text-white shadow shadow-black/20'
              : 'text-zinc-400 border-zinc-850 hover:text-zinc-300 hover:bg-zinc-900/50 bg-zinc-950/30'
          }`}
        >
          <Users className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Gerenciamento de Cadastros</span>
        </button>
        <button
          id="subtab-grade-btn"
          onClick={() => handleSetSubTabAndLoad('grade')}
          className={`px-4 py-2.5 font-bold text-xs sm:text-sm rounded-xl border transition-all flex items-center gap-2.5 cursor-pointer w-full sm:w-auto ${
            activeSubTab === 'grade'
              ? 'bg-zinc-800 border-zinc-700 text-white shadow shadow-black/20'
              : 'text-zinc-400 border-zinc-850 hover:text-zinc-300 hover:bg-zinc-900/50 bg-zinc-950/30'
          }`}
        >
          <Calendar className="w-4 h-4 text-amber-400 shrink-0" />
          <span>Grade Semanal & Cargas</span>
        </button>
        <button
          id="subtab-backup-btn"
          onClick={() => handleSetSubTabAndLoad('backup')}
          className={`px-4 py-2.5 font-bold text-xs sm:text-sm rounded-xl border transition-all flex items-center gap-2.5 cursor-pointer w-full sm:w-auto ${
            activeSubTab === 'backup'
              ? 'bg-zinc-800 border-zinc-700 text-white shadow shadow-black/20'
              : 'text-zinc-400 border-zinc-850 hover:text-zinc-300 hover:bg-zinc-900/50 bg-zinc-950/30'
          }`}
        >
          <Database className="w-4 h-4 text-violet-400 shrink-0" />
          <span>Backup & Importação</span>
        </button>
        <button
          id="subtab-turmas-globais-btn"
          onClick={() => handleSetSubTabAndLoad('turmas-globais')}
          className={`px-4 py-2.5 font-bold text-xs sm:text-sm rounded-xl border transition-all flex items-center gap-2.5 cursor-pointer w-full sm:w-auto ${
            activeSubTab === 'turmas-globais'
              ? 'bg-zinc-800 border-zinc-700 text-white shadow shadow-black/20'
              : 'text-zinc-400 border-zinc-850 hover:text-zinc-300 hover:bg-zinc-900/50 bg-zinc-950/30'
          }`}
        >
          <SchoolIcon className="w-4 h-4 text-rose-400 shrink-0" />
          <span>Anexar Turmas Globais</span>
        </button>
      </div>

      {/* Perfil & Segurança Sub-Tab */}
      {activeSubTab === 'perfil' && (
        <div id="settings-perfil-section" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-150">
          
          {/* Card 1: Perfil do Professor */}
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-zinc-800">
              <User className="w-5 h-5 text-blue-400" />
              <div>
                <h3 className="text-white font-bold text-sm">Identificação do Professor</h3>
                <p className="text-[11px] text-zinc-500">Configure como seu nome aparecerá no cabeçalho do diário</p>
              </div>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-400 block">Nome do(a) Professor(a)</label>
                <input
                  id="profile-teacher-name-input"
                  type="text"
                  placeholder="Ex: Prof. Dr. Carlos Silva"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  className="bg-zinc-950 border border-zinc-800 text-zinc-200 text-xs rounded-xl px-3 py-2.5 w-full focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <button
                id="save-profile-btn"
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-lg shadow-blue-500/10"
              >
                <Save className="w-4 h-4" /> Salvar Nome
              </button>
            </form>
          </div>

          {/* Card 2: Segurança e Controle de Acesso */}
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-zinc-800">
              <Shield className="w-5 h-5 text-amber-400" />
              <div>
                <h3 className="text-white font-bold text-sm">Segurança & Controle de Acesso</h3>
                <p className="text-[11px] text-zinc-500">Adicione uma camada de senha para proteger seus diários</p>
              </div>
            </div>

            <form onSubmit={handleSaveSecurity} className="space-y-4">
              
              {/* Toggle Protection */}
              <div className="flex items-center justify-between p-3 bg-zinc-950/40 rounded-xl border border-zinc-850">
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-zinc-300 block">Ativar Proteção por Senha</span>
                  <span className="text-[10px] text-zinc-500">Exige login ao abrir o aplicativo</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer select-none">
                  <input
                    id="toggle-auth-enabled-checkbox"
                    type="checkbox"
                    checked={portalAuthEnabled}
                    onChange={(e) => setPortalAuthEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-zinc-800 rounded-full peer peer-focus:ring-1 peer-focus:ring-blue-500/30 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-zinc-400 after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 peer-checked:after:bg-white peer-checked:after:border-blue-500"></div>
                </label>
              </div>

              {/* Username/Password Fields */}
              <div className="space-y-3 pt-1">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-400 block">Usuário de Acesso</label>
                  <input
                    id="profile-username-input"
                    type="text"
                    required
                    placeholder="Ex: professor"
                    value={portalUsername}
                    onChange={(e) => setPortalUsername(e.target.value)}
                    className="bg-zinc-950 border border-zinc-800 text-zinc-200 text-xs rounded-xl px-3 py-2.5 w-full focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-400 block">Senha de Acesso</label>
                  <div className="relative">
                    <input
                      id="profile-password-input"
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="Sua senha secreta"
                      value={portalPassword}
                      onChange={(e) => setPortalPassword(e.target.value)}
                      className="bg-zinc-950 border border-zinc-800 text-zinc-200 text-xs rounded-xl pl-3 pr-10 py-2.5 w-full focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Password Hint */}
                <div className="space-y-1.5 pt-1">
                  <label className="text-xs font-semibold text-zinc-400 block">Dica de Senha (Opcional)</label>
                  <input
                    id="profile-password-hint-input"
                    type="text"
                    placeholder="Ex: Nome do meu primeiro pet ou Ano de formatura"
                    value={portalPasswordHint}
                    onChange={(e) => setPortalPasswordHint(e.target.value)}
                    className="bg-zinc-950 border border-zinc-800 text-zinc-200 text-xs rounded-xl px-3 py-2.5 w-full focus:ring-1 focus:ring-blue-500 focus:outline-none placeholder-zinc-700"
                  />
                </div>

                {/* Security Question */}
                <div className="space-y-1.5 pt-1">
                  <label className="text-xs font-semibold text-zinc-400 block">Pergunta de Segurança para Recuperação</label>
                  <select
                    id="profile-security-question-select"
                    value={portalSecurityQuestion}
                    onChange={(e) => setPortalSecurityQuestion(e.target.value)}
                    className="bg-zinc-950 border border-zinc-800 text-zinc-200 text-xs rounded-xl px-3 py-2.5 w-full focus:ring-1 focus:ring-blue-500 focus:outline-none cursor-pointer"
                  >
                    <option value="">-- Selecione uma pergunta de segurança --</option>
                    <option value="Qual o nome da sua primeira escola?">Qual o nome da sua primeira escola?</option>
                    <option value="Qual o nome da cidade onde você nasceu?">Qual o nome da cidade onde você nasceu?</option>
                    <option value="Qual o nome do seu primeiro animal de estimação?">Qual o nome do seu primeiro animal de estimação?</option>
                    <option value="Qual o nome do seu livro ou filme favorito?">Qual o nome do seu livro ou filme favorito?</option>
                    <option value="Qual era o seu apelido de infância?">Qual era o seu apelido de infância?</option>
                  </select>
                </div>

                {/* Security Answer */}
                <div className="space-y-1.5 pt-1">
                  <label className="text-xs font-semibold text-zinc-400 block">Resposta de Segurança</label>
                  <input
                    id="profile-security-answer-input"
                    type="text"
                    placeholder="Ex: Dom Bosco (não diferencia maiúsculas de minúsculas)"
                    value={portalSecurityAnswer}
                    onChange={(e) => setPortalSecurityAnswer(e.target.value)}
                    className="bg-zinc-950 border border-zinc-800 text-zinc-200 text-xs rounded-xl px-3 py-2.5 w-full focus:ring-1 focus:ring-blue-500 focus:outline-none placeholder-zinc-700"
                  />
                </div>
              </div>

              {/* Security Warning */}
              <div className="flex gap-2.5 p-3 rounded-xl bg-amber-500/5 border border-amber-500/10 text-amber-400/85">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <p className="text-[10px] leading-relaxed">
                  <strong>Importante:</strong> Esta proteção é executada localmente no seu navegador para manter a privacidade dos seus dados. Lembre-se da senha escolhida, pois não há recuperação de e-mail por ser uma aplicação offline.
                </p>
              </div>

              <button
                id="save-security-btn"
                type="submit"
                className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-750 text-zinc-200 hover:text-white border border-zinc-700/80 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Save className="w-4 h-4 text-amber-400" /> Salvar Configurações de Segurança
              </button>
            </form>
          </div>

          {/* Card 3: Aparência e Banco de Dados */}
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl space-y-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 pb-2 border-b border-zinc-800 mb-4">
                <Database className="w-5 h-5 text-rose-400" />
                <div>
                  <h3 className="text-white font-bold text-sm">Aparência & Sistema</h3>
                  <p className="text-[11px] text-zinc-500">Ajuste o visual ou zere os dados locais</p>
                </div>
              </div>

              {/* THEME SELECTION SECTION */}
              <div className="space-y-2.5">
                <span className="text-xs font-semibold text-zinc-400 block">Tema do Aplicativo</span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTheme && setTheme('light')}
                    className={`py-3 px-4 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-2 cursor-pointer ${
                      theme === 'light'
                        ? 'bg-zinc-100 text-zinc-900 border-zinc-300 shadow-md shadow-zinc-200/50 font-extrabold'
                        : 'bg-zinc-950/40 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-950'
                    }`}
                  >
                    <Sun className="w-4 h-4 text-amber-500 shrink-0" />
                    Claro
                  </button>
                  <button
                    type="button"
                    onClick={() => setTheme && setTheme('dark')}
                    className={`py-3 px-4 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-2 cursor-pointer ${
                      theme === 'dark'
                        ? 'bg-zinc-850 text-white border-zinc-700 shadow-md font-extrabold'
                        : 'bg-zinc-950/40 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-950'
                    }`}
                  >
                    <Moon className="w-4 h-4 text-indigo-400 shrink-0" />
                    Escuro
                  </button>
                </div>
              </div>

              {/* RESET DATABASE SECTION */}
              <div className="space-y-2.5 pt-4 border-t border-zinc-800/60 mt-4">
                <div className="space-y-1">
                  <span className="text-xs font-bold text-rose-400 block flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> Zerar Banco de Dados
                  </span>
                  <p className="text-[10px] text-zinc-500 leading-relaxed">
                    Apaga todas as escolas, turmas, alunos, notas e chamadas deste dispositivo. Seus backups na nuvem não serão alterados automaticamente.
                  </p>
                </div>
              </div>
            </div>

            <button
              id="reset-local-database-btn"
              type="button"
              onClick={handleResetDatabase}
              className="w-full py-2.5 bg-rose-500/10 hover:bg-rose-600 hover:text-white border border-rose-500/20 text-rose-400 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer mt-4"
            >
              <Trash2 className="w-4 h-4 shrink-0" /> Zerar Todos os Dados Locais
            </button>
          </div>

        </div>
      )}

      {/* 1. GERENCIAMENTO DE CADASTROS */}
      {activeSubTab === 'cadastros' && (
        <div id="settings-cadastros-section" className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Box left: Schools & Subjects & Classes */}
          <div className="space-y-6">
            
            {/* School Form */}
            <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl space-y-4">
              <h3 className="text-white font-bold text-sm flex items-center gap-2">
                <SchoolIcon className="w-4 h-4 text-blue-400" /> Cadastrar Escola
              </h3>
              
              <form onSubmit={handleAddSchool} className="flex gap-2">
                <input
                  id="add-school-input"
                  type="text"
                  required
                  placeholder="Nome da Escola (Ex: E.E. Cora Coralina)"
                  value={newSchoolName}
                  onChange={(e) => setNewSchoolName(e.target.value)}
                  className="bg-zinc-950 border border-zinc-800 text-zinc-200 text-xs rounded-xl px-3 py-2 w-full focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
                <button
                  id="submit-school-btn"
                  type="submit"
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 shrink-0 cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Cadastrar
                </button>
              </form>

              {/* Schools List */}
              <div className="divide-y divide-zinc-800/60 bg-zinc-950/40 p-2.5 rounded-xl border border-zinc-800">
                {schools.length === 0 ? (
                  <p className="text-[11px] text-zinc-500 text-center py-2">Nenhuma escola cadastrada.</p>
                ) : (
                  schools.map((sch) => (
                    <div key={sch.id} className="flex items-center justify-between py-1.5 text-xs text-zinc-300 gap-2">
                      {editingSchoolId === sch.id ? (
                        <div className="flex items-center gap-1.5 w-full">
                          <input
                            type="text"
                            value={editingSchoolName}
                            onChange={(e) => setEditingSchoolName(e.target.value)}
                            className="bg-zinc-900 border border-zinc-750 text-zinc-200 text-[11px] rounded px-2 py-0.5 w-full focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                          <button
                            type="button"
                            onClick={handleSaveEditSchool}
                            className="text-emerald-400 hover:text-emerald-300 p-1 cursor-pointer shrink-0"
                            title="Salvar"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingSchoolId(undefined)}
                            className="text-zinc-400 hover:text-zinc-300 p-1 cursor-pointer shrink-0"
                            title="Cancelar"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <span className="truncate font-medium">{sch.name}</span>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleStartEditSchool(sch)}
                              className="text-zinc-500 hover:text-blue-400 p-1 cursor-pointer"
                              title="Editar"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              id={`delete-school-btn-${sch.id}`}
                              type="button"
                              onClick={() => handleDeleteSchool(sch.id!)}
                              className="text-zinc-500 hover:text-rose-400 p-1 cursor-pointer"
                              title="Excluir"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Classes Form */}
            <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl space-y-4">
              <h3 className="text-white font-bold text-sm flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-400" /> Cadastrar Turma
              </h3>
              
              <form onSubmit={handleAddClass} className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <select
                    id="add-class-school-select"
                    required
                    value={selectedSchoolIdForClass || ''}
                    onChange={(e) => setSelectedSchoolIdForClass(e.target.value ? parseInt(e.target.value) : undefined)}
                    className="bg-zinc-950 border border-zinc-800 text-zinc-200 text-xs rounded-xl px-2.5 py-2 w-full focus:ring-1 focus:ring-blue-500 focus:outline-none cursor-pointer"
                  >
                    <option value="" className="bg-zinc-950">Escola Associada</option>
                    {schools.map((s) => (
                      <option key={s.id} value={s.id} className="bg-zinc-950">{s.name}</option>
                    ))}
                  </select>

                  <input
                    id="add-class-name-input"
                    type="text"
                    required
                    placeholder="Nome (Ex: 1º Ano A)"
                    value={newClassName}
                    onChange={(e) => setNewClassName(e.target.value)}
                    className="bg-zinc-950 border border-zinc-800 text-zinc-200 text-xs rounded-xl px-2.5 py-2 w-full focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <button
                  id="submit-class-btn"
                  type="submit"
                  className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Cadastrar Turma
                </button>
              </form>

              {/* Classes List grouped by School */}
              <div className="space-y-4 bg-zinc-950/40 p-3 rounded-xl border border-zinc-800">
                {classes.length === 0 ? (
                  <p className="text-[11px] text-zinc-500 text-center py-2">Nenhuma turma cadastrada.</p>
                ) : (
                  (() => {
                    const schoolGroups = schools.map(sch => {
                      const schoolClasses = classes.filter(c => c.schoolId === sch.id).sort(sortClasses);
                      return { school: sch, classes: schoolClasses };
                    });

                    const unassociatedClasses = classes.filter(c => !c.schoolId || !schools.some(s => s.id === c.schoolId)).sort(sortClasses);

                    return (
                      <div className="space-y-4">
                        {schoolGroups.map(({ school, classes: schoolClasses }) => {
                          const schoolColors = getSchoolColorClasses(school.id);
                          return (
                            <div key={school.id} className="space-y-1.5 pb-2">
                              {/* School Group Header */}
                              <div className="flex items-center justify-between border-b border-zinc-800 pb-1 pt-1">
                                <span className={`text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1.5 ${schoolColors.text}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${schoolColors.accentColor}`} />
                                  {school.name}
                                </span>
                                <span className="bg-zinc-900 border border-zinc-800 text-zinc-400 text-[9px] font-bold px-1.5 py-0.2 rounded-full">
                                  {schoolClasses.length} {schoolClasses.length === 1 ? 'turma' : 'turmas'}
                                </span>
                              </div>

                              {/* School Group Classes */}
                              {schoolClasses.length === 0 ? (
                                <p className="text-[10px] text-zinc-600 italic pl-3 py-1">Nenhuma turma cadastrada para esta escola.</p>
                              ) : (
                                <div className="divide-y divide-zinc-900/60 pl-2">
                                  {schoolClasses.map((cls) => (
                                    <div key={cls.id} className="flex items-center justify-between py-1.5 text-xs text-zinc-300 gap-2">
                                      {editingClassId === cls.id ? (
                                        <div className="flex flex-col gap-1 w-full p-1 bg-zinc-900/50 rounded-lg">
                                          <input
                                            type="text"
                                            value={editingClassName}
                                            onChange={(e) => setEditingClassName(e.target.value)}
                                            className="bg-zinc-950 border border-zinc-800 text-zinc-200 text-[11px] rounded px-2 py-0.5 w-full focus:outline-none focus:ring-1 focus:ring-blue-500"
                                            placeholder="Nome da Turma"
                                          />
                                          <div className="flex items-center gap-1.5">
                                            <select
                                              value={editingClassSchoolId || ''}
                                              onChange={(e) => setEditingClassSchoolId(e.target.value ? parseInt(e.target.value) : undefined)}
                                              className="bg-zinc-950 border border-zinc-800 text-zinc-300 text-[10px] rounded px-1.5 py-0.5 w-full focus:outline-none cursor-pointer"
                                            >
                                              <option value="">Escola Associada</option>
                                              {schools.map((s) => (
                                                <option key={s.id} value={s.id} className="bg-zinc-950">{s.name}</option>
                                              ))}
                                            </select>
                                            <button
                                              type="button"
                                              onClick={handleSaveEditClass}
                                              className="text-emerald-400 hover:text-emerald-300 p-1 cursor-pointer shrink-0"
                                              title="Salvar"
                                            >
                                              <Check className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => setEditingClassId(undefined)}
                                              className="text-zinc-400 hover:text-zinc-300 p-1 cursor-pointer shrink-0"
                                              title="Cancelar"
                                            >
                                              <X className="w-3.5 h-3.5" />
                                            </button>
                                          </div>
                                        </div>
                                      ) : (
                                        <>
                                          <span className="font-medium text-zinc-200">{cls.name}</span>
                                          <div className="flex items-center gap-1 shrink-0">
                                            <button
                                              type="button"
                                              onClick={() => handleStartEditClass(cls)}
                                              className="text-zinc-500 hover:text-blue-400 p-1 cursor-pointer"
                                              title="Editar"
                                            >
                                              <Edit2 className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                              id={`delete-class-btn-${cls.id}`}
                                              type="button"
                                              onClick={() => handleDeleteClass(cls.id!)}
                                              className="text-zinc-500 hover:text-rose-400 p-1 cursor-pointer"
                                              title="Excluir"
                                            >
                                              <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                          </div>
                                        </>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {unassociatedClasses.length > 0 && (
                          <div className="space-y-1.5 pb-2">
                            <div className="flex items-center justify-between border-b border-zinc-800 pb-1 pt-1 text-zinc-500">
                              <span className="text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
                                Sem Escola Associada
                              </span>
                              <span className="bg-zinc-900 border border-zinc-800 text-zinc-400 text-[9px] font-bold px-1.5 py-0.2 rounded-full">
                                {unassociatedClasses.length}
                              </span>
                            </div>
                            <div className="divide-y divide-zinc-900/60 pl-2">
                              {unassociatedClasses.map((cls) => (
                                <div key={cls.id} className="flex items-center justify-between py-1.5 text-xs text-zinc-300 gap-2">
                                  {editingClassId === cls.id ? (
                                    <div className="flex flex-col gap-1 w-full p-1 bg-zinc-900/50 rounded-lg">
                                      <input
                                        type="text"
                                        value={editingClassName}
                                        onChange={(e) => setEditingClassName(e.target.value)}
                                        className="bg-zinc-950 border border-zinc-800 text-zinc-200 text-[11px] rounded px-2 py-0.5 w-full focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        placeholder="Nome da Turma"
                                      />
                                      <div className="flex items-center gap-1.5">
                                        <select
                                          value={editingClassSchoolId || ''}
                                          onChange={(e) => setEditingClassSchoolId(e.target.value ? parseInt(e.target.value) : undefined)}
                                          className="bg-zinc-950 border border-zinc-800 text-zinc-300 text-[10px] rounded px-1.5 py-0.5 w-full focus:outline-none cursor-pointer"
                                        >
                                          <option value="">Escola Associada</option>
                                          {schools.map((s) => (
                                            <option key={s.id} value={s.id} className="bg-zinc-950">{s.name}</option>
                                          ))}
                                        </select>
                                        <button
                                          type="button"
                                          onClick={handleSaveEditClass}
                                          className="text-emerald-400 hover:text-emerald-300 p-1 cursor-pointer shrink-0"
                                          title="Salvar"
                                        >
                                          <Check className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setEditingClassId(undefined)}
                                          className="text-zinc-400 hover:text-zinc-300 p-1 cursor-pointer shrink-0"
                                          title="Cancelar"
                                        >
                                          <X className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <>
                                      <span className="font-medium text-zinc-200">{cls.name}</span>
                                      <div className="flex items-center gap-1 shrink-0">
                                        <button
                                          type="button"
                                          onClick={() => handleStartEditClass(cls)}
                                          className="text-zinc-500 hover:text-blue-400 p-1 cursor-pointer"
                                          title="Editar"
                                        >
                                          <Edit2 className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                          id={`delete-class-btn-${cls.id}`}
                                          type="button"
                                          onClick={() => handleDeleteClass(cls.id!)}
                                          className="text-zinc-500 hover:text-rose-400 p-1 cursor-pointer"
                                          title="Excluir"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()
                )}
              </div>
            </div>

            {/* Subjects Form - Coordination-controlled */}
            <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl space-y-4">
              <h3 className="text-white font-bold text-sm flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-blue-400" /> Disciplinas Oficiais (Coordenação)
              </h3>
              
              <div className="bg-blue-950/30 border border-blue-900/50 p-4 rounded-xl space-y-3">
                <p className="text-[11px] text-blue-300 leading-relaxed">
                  As disciplinas e matérias oficiais são cadastradas exclusivamente pela coordenação pedagógica ou administração. 
                  Clique no botão abaixo para puxar a grade curricular e as cargas horárias atualizadas da nuvem.
                </p>
                <button
                  type="button"
                  disabled={syncingSubjectsAndWorkloads}
                  onClick={handleImportGlobalSubjectsAndWorkloads}
                  className={`w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-blue-500/10 ${
                    syncingSubjectsAndWorkloads ? 'opacity-70 cursor-not-allowed animate-pulse' : ''
                  }`}
                >
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>
                    {syncingSubjectsAndWorkloads 
                      ? 'Importando e Sincronizando...' 
                      : 'Sincronizar Disciplinas & Cargas da Coordenação'
                    }
                  </span>
                </button>
              </div>

              {/* Subjects List (Read-Only) */}
              <div className="space-y-1">
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-2">Sua Grade de Disciplinas ({subjects.length})</p>
                <div className="divide-y divide-zinc-800/60 bg-zinc-950/40 p-2.5 rounded-xl border border-zinc-800">
                  {subjects.length === 0 ? (
                    <p className="text-[11px] text-zinc-500 text-center py-4 italic">Nenhuma disciplina importada ainda. Clique em Sincronizar acima.</p>
                  ) : (
                    subjects.map((sub) => (
                      <div key={sub.id} className="flex items-center justify-between py-2 text-xs text-zinc-300 gap-2 group">
                        <div className="flex items-center gap-2 truncate pr-2">
                          <Check className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                          <span className="truncate font-medium">{sub.name}</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[9px] bg-blue-500/10 border border-blue-500/20 text-blue-400 font-bold px-2 py-0.5 rounded-full uppercase">Oficial</span>
                          <button
                            type="button"
                            onClick={() => handleDeleteSubject(sub.id!)}
                            className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-zinc-800 rounded transition cursor-pointer"
                            title="Excluir Disciplina"
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

          </div>

          {/* Box right: Students & Bulk Import (Filtered by school/class selection) */}
          <div className="space-y-6">
            <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl space-y-4">
              <h3 className="text-white font-bold text-sm flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-400" /> Cadastrar Alunos
              </h3>

              {/* Class Filters to add students */}
              <div className="grid grid-cols-2 gap-2 bg-zinc-950/50 p-2 rounded-xl border border-zinc-800/80">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase block">Escola</label>
                  <select
                    id="add-student-school-filter"
                    value={selectedSchoolIdForStudent || ''}
                    onChange={(e) => {
                      setSelectedSchoolIdForStudent(e.target.value ? parseInt(e.target.value) : undefined);
                      setSelectedClassIdForStudent(undefined);
                    }}
                    className="bg-transparent text-zinc-300 text-xs focus:outline-none w-full cursor-pointer"
                  >
                    <option value="" className="bg-zinc-950">Selecione</option>
                    {schools.map((s) => (
                      <option key={s.id} value={s.id} className="bg-zinc-950">{s.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase block">Turma Destino</label>
                  <select
                    id="add-student-class-filter"
                    disabled={!selectedSchoolIdForStudent}
                    value={selectedClassIdForStudent || ''}
                    onChange={(e) => setSelectedClassIdForStudent(e.target.value ? parseInt(e.target.value) : undefined)}
                    className="bg-transparent text-zinc-300 text-xs focus:outline-none w-full cursor-pointer disabled:opacity-40"
                  >
                    <option value="" className="bg-zinc-950">Selecione</option>
                    {classesBySchool.map((c) => (
                      <option key={c.id} value={c.id} className="bg-zinc-950">{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {selectedClassIdForStudent ? (
                <div className="space-y-5 animate-in fade-in duration-150">
                  
                  {/* Single Student Form */}
                  <form onSubmit={handleAddStudent} className="space-y-3 p-3 bg-zinc-950/30 rounded-xl border border-zinc-800">
                    <p className="text-[11px] font-bold text-zinc-400">Adicionar Único Aluno</p>
                    <div className="flex gap-2">
                      <input
                        id="add-student-roll-input"
                        type="number"
                        placeholder="Nº"
                        value={newStudentRoll || ''}
                        onChange={(e) => setNewStudentRoll(e.target.value ? parseInt(e.target.value) : undefined)}
                        className="bg-zinc-950 border border-zinc-800 text-zinc-200 text-xs rounded-xl px-2 py-2 w-16 text-center focus:ring-1 focus:ring-blue-500 focus:outline-none"
                      />
                      <input
                        id="add-student-name-input"
                        type="text"
                        required
                        placeholder="Nome Completo do Aluno"
                        value={newStudentName}
                        onChange={(e) => setNewStudentName(e.target.value)}
                        className="bg-zinc-950 border border-zinc-800 text-zinc-200 text-xs rounded-xl px-3 py-2 w-full focus:ring-1 focus:ring-blue-500 focus:outline-none"
                      />
                      <button
                        id="submit-student-btn"
                        type="submit"
                        className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 shrink-0 cursor-pointer"
                      >
                        <Plus className="w-4 h-4" /> Inserir
                      </button>
                    </div>
                  </form>

                  {/* Bulk Student Textarea Import */}
                  <div className="space-y-2.5 p-3 bg-zinc-950/30 rounded-xl border border-zinc-800">
                    <div className="flex items-center gap-2">
                      <Import className="w-4 h-4 text-emerald-400" />
                      <p className="text-[11px] font-bold text-zinc-400">Importar Lista Completa em Lote</p>
                    </div>
                    <p className="text-[10px] text-zinc-500">Escreva ou cole um nome de aluno por linha. A ordem de chamada consecutiva (1, 2, 3...) será gerada automaticamente:</p>
                    <textarea
                      id="bulk-students-textarea"
                      rows={4}
                      placeholder="Ana Beatriz Souza&#10;Bruno Henrique Lima&#10;Carlos Eduardo de Oliveira"
                      value={bulkStudentText}
                      onChange={(e) => setBulkStudentText(e.target.value)}
                      className="bg-zinc-950 border border-zinc-800 text-zinc-200 text-xs rounded-xl p-3.5 w-full focus:ring-1 focus:ring-blue-500 focus:outline-none font-mono"
                    />
                    <button
                      id="submit-bulk-students-btn"
                      type="button"
                      onClick={handleBulkImportStudents}
                      disabled={!bulkStudentText.trim()}
                      className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Import className="w-4 h-4" /> Carregar Alunos em Lote
                    </button>
                  </div>

                  {/* Students list */}
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Lista de Chamada ({studentsFiltered.length} alunos)</p>
                    <div className="divide-y divide-zinc-800/60 bg-zinc-950/40 p-2.5 rounded-xl border border-zinc-800">
                      {studentsFiltered.length === 0 ? (
                        <p className="text-xs text-zinc-500 text-center py-4">Nenhum aluno nesta sala.</p>
                      ) : (
                        studentsFiltered.map((st) => (
                          <div key={st.id} className="flex items-center justify-between py-2 text-xs text-zinc-300 gap-2">
                            {editingStudentId === st.id ? (
                              <div className="flex items-center gap-1.5 w-full">
                                <input
                                  type="number"
                                  value={editingStudentRoll || ''}
                                  onChange={(e) => setEditingStudentRoll(e.target.value ? parseInt(e.target.value) : undefined)}
                                  className="bg-zinc-900 border border-zinc-750 text-zinc-200 text-xs text-center rounded px-1.5 py-0.5 w-12 focus:outline-none"
                                  placeholder="Nº"
                                />
                                <input
                                  type="text"
                                  value={editingStudentName}
                                  onChange={(e) => setEditingStudentName(e.target.value)}
                                  className="bg-zinc-900 border border-zinc-750 text-zinc-200 text-xs rounded px-2 py-0.5 w-full focus:outline-none focus:ring-1 focus:ring-blue-500"
                                  placeholder="Nome"
                                />
                                <button
                                  type="button"
                                  onClick={handleSaveEditStudent}
                                  className="text-emerald-400 hover:text-emerald-300 p-1 cursor-pointer shrink-0"
                                  title="Salvar"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingStudentId(undefined)}
                                  className="text-zinc-400 hover:text-zinc-300 p-1 cursor-pointer shrink-0"
                                  title="Cancelar"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <>
                                <span className="font-mono text-zinc-500 w-8 shrink-0">#{st.rollNumber}</span>
                                <span className="font-semibold w-full truncate">{st.name}</span>
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => handleStartEditStudent(st)}
                                    className="text-zinc-500 hover:text-blue-400 p-1 cursor-pointer"
                                    title="Editar"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    id={`delete-student-btn-${st.id}`}
                                    type="button"
                                    onClick={() => handleDeleteStudent(st.id!)}
                                    className="text-zinc-500 hover:text-rose-400 p-1 cursor-pointer"
                                    title="Excluir"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                </div>
              ) : (
                <div className="p-8 text-center text-zinc-500 text-xs border border-dashed border-zinc-800 rounded-xl">
                  Selecione uma Escola e Turma acima para cadastrar alunos.
                </div>
              )}
            </div>
          </div>

        </div>
      )}

      {/* 2. HORÁRIO SEMANAL & CARGAS */}
      {activeSubTab === 'grade' && (
        <div id="settings-grade-section" className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Carga Horaria Form - Coordination-controlled */}
          <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl space-y-4">
            <h3 className="text-white font-bold text-sm flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-sky-400" /> Cargas Horárias Oficiais (Coordenação)
            </h3>
            
            <div className="bg-sky-950/30 border border-sky-900/50 p-4 rounded-xl space-y-3">
              <p className="text-[11px] text-sky-300 leading-relaxed">
                O planejamento anual de cargas horárias (total de aulas para cada matéria e série) é definido exclusivamente pela coordenação. 
                Sincronize com a nuvem para vincular automaticamente as cargas horárias corretas às suas turmas locais.
              </p>
              <button
                type="button"
                disabled={syncingSubjectsAndWorkloads}
                onClick={handleImportGlobalSubjectsAndWorkloads}
                className={`w-full py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-sky-500/10 ${
                  syncingSubjectsAndWorkloads ? 'opacity-70 cursor-not-allowed animate-pulse' : ''
                }`}
              >
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>
                  {syncingSubjectsAndWorkloads 
                    ? 'Sincronizando...' 
                    : 'Sincronizar Disciplinas & Cargas Globais'
                  }
                </span>
              </button>
            </div>

            {/* List current workloads (Read-Only) */}
            <div className="space-y-2">
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Cargas Horárias Ativas no Diário ({workloads.length})</p>
              <div className="divide-y divide-zinc-800/60 bg-zinc-950/40 p-2.5 rounded-xl border border-zinc-800">
                {workloads.length === 0 ? (
                  <p className="text-[11px] text-zinc-500 text-center py-4 italic">Nenhuma carga horária registrada ainda. Clique em Sincronizar acima.</p>
                ) : (
                  workloads.map((wl) => {
                    const c = classes.find((cl) => cl.id === wl.classId);
                    const sub = subjects.find((s) => s.id === wl.subjectId);
                    return (
                      <div key={wl.id} className="flex items-center justify-between py-2.5 text-xs text-zinc-300 gap-2">
                        <div>
                          <span className="font-semibold text-zinc-200">{sub?.name || 'Disciplina'}</span>
                          <span className="text-[10px] text-zinc-500 block">Série/Turma: {c?.name || '-'}</span>
                        </div>
                        <span className="font-mono font-bold bg-sky-500/10 border border-sky-500/20 px-2.5 py-1 rounded-full text-sky-400 text-[10px] shrink-0">
                          {wl.totalLessons} aulas/ano
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Horario de Aulas Weekly Schedule */}
          <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl space-y-4">
            <h3 className="text-white font-bold text-sm flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-400" /> Grade Horária Semanal
            </h3>

            <form onSubmit={handleAddSchedule} className="space-y-4 bg-zinc-950/20 p-4 rounded-xl border border-zinc-800 text-zinc-300">
              
              {/* a) Selecione a Escola */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-400 block">
                  a) Selecione a Escola:
                </label>
                {schools.length === 0 ? (
                  <p className="text-xs text-zinc-500 italic">Nenhuma escola cadastrada.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {schools.map((s) => {
                      const isSelected = schedSchool === s.id;
                      const schoolColors = getSchoolColorClasses(s.id);
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => {
                            setSchedSchool(s.id);
                            setSchedClass(undefined);
                          }}
                          className={`px-5 py-3 text-sm font-extrabold tracking-wide uppercase transition duration-200 cursor-pointer rounded-xl border ${
                            isSelected
                              ? schoolColors.buttonSelected
                              : schoolColors.buttonNormal
                          }`}
                        >
                          {s.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* b) Selecione a Turma */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-400 block">
                  b) Selecione a Turma:
                </label>
                {!schedSchool ? (
                  <p className="text-xs text-zinc-500 italic">Selecione uma escola acima para ver as turmas.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {classes
                      .filter((c) => c.schoolId === schedSchool)
                      .sort(sortClasses)
                      .map((c) => {
                        const isSelected = schedClass === c.id;
                        const schoolColors = getSchoolColorClasses(schedSchool);
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => setSchedClass(c.id)}
                            className={`px-5 py-3 text-sm font-extrabold tracking-wide uppercase transition duration-200 cursor-pointer rounded-xl border ${
                              isSelected
                                ? schoolColors.buttonSelected
                                : schoolColors.buttonNormal
                            }`}
                          >
                            {c.name}
                          </button>
                        );
                      })}
                    {classes.filter((c) => c.schoolId === schedSchool).length === 0 && (
                      <p className="text-xs text-zinc-500 italic">Nenhuma turma cadastrada nesta escola.</p>
                    )}
                  </div>
                )}
              </div>

              {/* c) Selecione a Disciplina */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-400 block">
                  c) Selecione a Disciplina:
                </label>
                {subjects.length === 0 ? (
                  <p className="text-xs text-zinc-500 italic">Nenhuma disciplina cadastrada.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {subjects.map((s) => {
                      const isSelected = schedSubject === s.id;
                      const schoolColors = getSchoolColorClasses(schedSchool);
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setSchedSubject(s.id)}
                          className={`px-5 py-3 text-sm font-extrabold tracking-wide uppercase transition duration-200 cursor-pointer rounded-xl border ${
                            isSelected
                              ? schoolColors.buttonSelected
                              : schoolColors.buttonNormal
                          }`}
                        >
                          {s.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* d) Dia da Semana */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-400 block">
                  d) Dia da Semana:
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 1, name: 'Segunda' },
                    { id: 2, name: 'Terça' },
                    { id: 3, name: 'Quarta' },
                    { id: 4, name: 'Quinta' },
                    { id: 5, name: 'Sexta' },
                    { id: 6, name: 'Sábado' },
                    { id: 7, name: 'Domingo' }
                  ].map((day) => {
                    const isSelected = schedDay === day.id;
                    return (
                      <button
                        key={day.id}
                        type="button"
                        onClick={() => setSchedDay(day.id)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition duration-200 cursor-pointer ${
                          isSelected
                            ? 'bg-blue-600 text-white border border-blue-500 shadow-md shadow-blue-500/20'
                            : 'bg-zinc-950 text-zinc-300 border border-zinc-800 hover:bg-zinc-900'
                        }`}
                      >
                        {day.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* e) Horário de Início e Término da Aula */}
              <div className="space-y-3 pt-2 border-t border-zinc-800/60">
                <label className="text-xs font-bold text-zinc-400 block">
                  e) Horário de Início e Término da Aula:
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <span className="text-[10px] text-zinc-500 font-bold block uppercase">Hora Início</span>
                    <input
                      type="text"
                      required
                      placeholder="Ex: 07:00"
                      value={schedStartTime}
                      onChange={(e) => setSchedStartTime(e.target.value)}
                      className="bg-zinc-950 border border-zinc-800 text-zinc-200 text-xs rounded-xl px-3 py-2 w-full focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] text-zinc-500 font-bold block uppercase">Hora Término</span>
                    <input
                      type="text"
                      required
                      placeholder="Ex: 09:00"
                      value={schedEndTime}
                      onChange={(e) => setSchedEndTime(e.target.value)}
                      className="bg-zinc-950 border border-zinc-800 text-zinc-200 text-xs rounded-xl px-3 py-2 w-full focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Sugestões de Horários Rápidos */}
                <div className="space-y-3 p-3 bg-zinc-950/40 rounded-xl border border-zinc-800/80">
                  <span className="text-xs font-bold text-blue-400 block">
                    Sugestões de Horários Rápidos:
                  </span>

                  {/* Period Manhã */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-1 text-[11px] font-bold text-yellow-500">
                      <span>★</span>
                      <span>Manhã</span>
                    </div>
                    
                    <div className="space-y-1.5">
                      <span className="text-[10px] text-zinc-500 font-semibold block">Horários únicos:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          { start: '07:00', end: '08:00' },
                          { start: '08:00', end: '09:00' },
                          { start: '09:15', end: '10:15' },
                          { start: '10:15', end: '11:15' },
                          { start: '11:15', end: '12:15' }
                        ].map((s) => {
                          const isMatch = schedStartTime === s.start && schedEndTime === s.end;
                          return (
                            <button
                              key={`${s.start}-${s.end}`}
                              type="button"
                              onClick={() => applyTimeSuggestion(s.start, s.end)}
                              className={`px-2.5 py-1.5 rounded-lg text-[10px] font-mono font-bold transition cursor-pointer ${
                                isMatch
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-zinc-900 hover:bg-zinc-850 text-zinc-400 border border-zinc-800'
                              }`}
                            >
                              {s.start} - {s.end}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <span className="text-[10px] text-zinc-500 font-semibold block">Horários duplos:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          { start: '07:00', end: '09:00' },
                          { start: '09:15', end: '11:15' }
                        ].map((s) => {
                          const isMatch = schedStartTime === s.start && schedEndTime === s.end;
                          return (
                            <button
                              key={`${s.start}-${s.end}`}
                              type="button"
                              onClick={() => applyTimeSuggestion(s.start, s.end)}
                              className={`px-2.5 py-1.5 rounded-lg text-[10px] font-mono font-bold transition cursor-pointer ${
                                isMatch
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-zinc-900 hover:bg-zinc-850 text-zinc-400 border border-zinc-800'
                              }`}
                            >
                              {s.start} - {s.end}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Period Tarde */}
                  <div className="space-y-2 pt-2 border-t border-zinc-800/40">
                    <div className="flex items-center gap-1 text-[11px] font-bold text-amber-500">
                      <span>★</span>
                      <span>Tarde</span>
                    </div>

                    <div className="space-y-1.5">
                      <span className="text-[10px] text-zinc-500 font-semibold block">Horários únicos:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          { start: '13:00', end: '14:00' },
                          { start: '14:00', end: '15:00' },
                          { start: '15:15', end: '16:15' },
                          { start: '16:15', end: '17:15' },
                          { start: '17:15', end: '18:15' }
                        ].map((s) => {
                          const isMatch = schedStartTime === s.start && schedEndTime === s.end;
                          return (
                            <button
                              key={`${s.start}-${s.end}`}
                              type="button"
                              onClick={() => applyTimeSuggestion(s.start, s.end)}
                              className={`px-2.5 py-1.5 rounded-lg text-[10px] font-mono font-bold transition cursor-pointer ${
                                isMatch
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-zinc-900 hover:bg-zinc-850 text-zinc-400 border border-zinc-800'
                              }`}
                            >
                              {s.start} - {s.end}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <span className="text-[10px] text-zinc-500 font-semibold block">Horários duplos:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          { start: '13:00', end: '15:00' },
                          { start: '15:15', end: '17:15' }
                        ].map((s) => {
                          const isMatch = schedStartTime === s.start && schedEndTime === s.end;
                          return (
                            <button
                              key={`${s.start}-${s.end}`}
                              type="button"
                              onClick={() => applyTimeSuggestion(s.start, s.end)}
                              className={`px-2.5 py-1.5 rounded-lg text-[10px] font-mono font-bold transition cursor-pointer ${
                                isMatch
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-zinc-900 hover:bg-zinc-850 text-zinc-400 border border-zinc-800'
                              }`}
                            >
                              {s.start} - {s.end}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                </div>
              </div>

              <button
                id="submit-sched-btn"
                type="submit"
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-blue-500/10 active:scale-[0.98]"
              >
                Salvar Horário na Grade
              </button>
            </form>

            {/* List scheds */}
            <div className="space-y-4">
              <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Aulas Agendadas</p>
              {weeklySchedules.length === 0 ? (
                <div className="bg-zinc-950/40 p-4 rounded-xl border border-zinc-800 text-center">
                  <p className="text-xs text-zinc-500">Nenhum agendamento na grade semanal.</p>
                </div>
              ) : (
                <div className="space-y-5">
                  {[1, 2, 3, 4, 5, 6, 7].map((dayNum) => {
                    const daySchedules = weeklySchedules.filter((ws) => ws.dayOfWeek === dayNum);
                    if (daySchedules.length === 0) return null;

                    // Sort daySchedules by timeSlot start time
                    const sortedDaySchedules = [...daySchedules].sort((a, b) => a.timeSlot.localeCompare(b.timeSlot));

                    return (
                      <div key={dayNum} className="space-y-2">
                        <div className="text-xs font-bold text-blue-400 bg-blue-500/10 px-2.5 py-1.5 rounded-lg border border-blue-500/20 inline-flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                          {getDayName(dayNum)}
                        </div>
                        <div className="space-y-2">
                          {sortedDaySchedules.map((ws) => {
                            const sch = schools.find((s) => s.id === ws.schoolId);
                            const cl = classes.find((c) => c.id === ws.classId);
                            const sub = subjects.find((s) => s.id === ws.subjectId);
                            const schoolColors = getSchoolColorClasses(ws.schoolId);
                            return (
                              <div 
                                key={ws.id} 
                                className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-2xl border ${schoolColors.bg} ${schoolColors.border} gap-3 transition-all hover:bg-opacity-90`}
                              >
                                <div className="space-y-1.5 flex-1 min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-bold text-zinc-100 text-xs tracking-tight bg-zinc-950/85 px-2.5 py-1 rounded-lg border border-zinc-800">
                                      {ws.timeSlot}
                                    </span>
                                    <span className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-md border ${schoolColors.badgeBg} ${schoolColors.badgeText} ${schoolColors.badgeBorder}`}>
                                      {sch?.name || 'Escola não encontrada'}
                                    </span>
                                  </div>
                                  <div className="flex items-baseline gap-2 flex-wrap pt-0.5">
                                    <span className="text-base font-extrabold text-zinc-200">
                                      {cl?.name || 'Sem turma'}
                                    </span>
                                    <span className="text-zinc-500 text-xs">•</span>
                                    <span className="text-xs text-zinc-400 font-bold">
                                      {sub?.name || 'Sem disciplina'}
                                    </span>
                                  </div>
                                </div>
                                <button
                                  id={`delete-sched-btn-${ws.id}`}
                                  type="button"
                                  onClick={() => handleDeleteSchedule(ws.id!)}
                                  className="text-zinc-400 hover:text-rose-400 cursor-pointer p-2 hover:bg-zinc-900/60 rounded-lg transition shrink-0"
                                  title="Excluir Agendamento"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

        </div>
      )}

      {/* 3. BACKUP & RESTAURAR */}
      {activeSubTab === 'backup' && (
        <div id="settings-backup-section" className="max-w-3xl space-y-6">
          
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl space-y-4">
            <h3 className="text-white font-bold text-sm flex items-center gap-2">
              <Database className="w-5 h-5 text-blue-400" /> Ferramenta de Backup Local Unificado (JSON)
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              O Portal do Professor armazena todos os diários escolares e notas diretamente no seu navegador utilizando IndexedDB de alta performance. Para garantir a segurança dos seus lançamentos contra limpezas involuntárias de cache do navegador ou para migrar seus dados para outro celular ou computador, faça backups regulares!
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-zinc-800/80">
              
              {/* EXPORT PANEL */}
              <div className="p-4 bg-zinc-950/40 rounded-xl border border-zinc-800 space-y-3">
                <div className="flex items-center gap-2 text-blue-400">
                  <Download className="w-4 h-4" />
                  <h4 className="text-xs font-bold uppercase tracking-wider">Exportar Banco</h4>
                </div>
                <p className="text-[11px] text-zinc-500">Gera um arquivo unificado contendo todas as escolas, turmas, alunos, notas, diário de presença, e histórico de vistos.</p>
                <button
                  id="export-backup-btn"
                  type="button"
                  onClick={handleExportBackup}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow cursor-pointer"
                >
                  <Download className="w-4 h-4" /> Baixar Backup (.json)
                </button>
              </div>

              {/* IMPORT PANEL */}
              <div className="p-4 bg-zinc-950/40 rounded-xl border border-zinc-800 space-y-3">
                <div className="flex items-center gap-2 text-amber-500">
                  <Upload className="w-4 h-4" />
                  <h4 className="text-xs font-bold uppercase tracking-wider">Restaurar Backup</h4>
                </div>
                <p className="text-[11px] text-zinc-500">Sobrescreve e restaura com segurança todos os seus diários. Esta ação é imediata e irreversível.</p>
                
                <label className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer text-center">
                  <Upload className="w-4 h-4" />
                  <span>Selecionar Arquivo JSON</span>
                  <input
                    id="import-backup-file-input"
                    type="file"
                    accept=".json"
                    onChange={handleImportBackup}
                    className="hidden"
                  />
                </label>
              </div>

            </div>
          </div>

          {/* EXPORTAR E RESTAURAR POR TURMA */}
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl space-y-4">
            <h3 className="text-white font-bold text-sm flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-400" /> Exportação e Restauração de Diários por Turma
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Deseja exportar ou restaurar apenas uma turma específica? Esta ferramenta permite isolar todo o trabalho (alunos, notas, presenças, diários de aula e vistos) de uma única turma em um arquivo JSON. Excelente para compartilhar com outros professores ou restaurar turmas seletivamente sem afetar as demais.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-zinc-800/80">
              {/* SELETOR E EXPORTADOR */}
              <div className="p-4 bg-zinc-950/40 rounded-xl border border-zinc-800 space-y-3">
                <div className="flex items-center gap-2 text-purple-400">
                  <Download className="w-4 h-4" />
                  <h4 className="text-xs font-bold uppercase tracking-wider">Exportar Turma Selecionada</h4>
                </div>
                <p className="text-[11px] text-zinc-500">Selecione uma turma para gerar o arquivo de diário e notas específico dela.</p>
                
                <div className="space-y-2">
                  <select
                    value={selectedClassIdForExport || ''}
                    onChange={(e) => setSelectedClassIdForExport(e.target.value ? Number(e.target.value) : undefined)}
                    className="w-full bg-zinc-900 border border-zinc-850 text-zinc-200 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  >
                    <option value="">-- Selecione uma Turma --</option>
                    {[...classes].sort(sortClasses).map((cl) => {
                      const sch = schools.find((s) => s.id === cl.schoolId);
                      return (
                        <option key={cl.id} value={cl.id}>
                          {cl.name} {sch ? `(${sch.name})` : ''}
                        </option>
                      );
                    })}
                  </select>

                  <button
                    type="button"
                    disabled={!selectedClassIdForExport}
                    onClick={() => selectedClassIdForExport && handleExportClassBackup(selectedClassIdForExport)}
                    className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow cursor-pointer text-center"
                  >
                    <Download className="w-4 h-4" /> Baixar Dados da Turma (.json)
                  </button>
                </div>
              </div>

              {/* IMPORTADOR SELETIVO */}
              <div className="p-4 bg-zinc-950/40 rounded-xl border border-zinc-800 space-y-3">
                <div className="flex items-center gap-2 text-emerald-400">
                  <Upload className="w-4 h-4" />
                  <h4 className="text-xs font-bold uppercase tracking-wider">Restaurar / Importar Turma</h4>
                </div>
                <p className="text-[11px] text-zinc-500">
                  Importa o backup de uma única turma. Se já existir uma turma de mesmo nome nesta escola, ela será substituída com seus dados. Outras turmas permanecem intactas.
                </p>
                
                <label className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer text-center">
                  <Upload className="w-4 h-4" />
                  <span>Selecionar Arquivo da Turma</span>
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImportClassBackup}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Sincronização em Nuvem (Firebase Firestore) */}
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl space-y-4">
            <h3 className="text-white font-bold text-sm flex items-center gap-2">
              <Cloud className="w-5 h-5 text-emerald-400 animate-pulse" /> Sincronização em Nuvem Online (Firebase)
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              O Portal do Professor está conectado a um banco de dados em nuvem seguro e gratuito da Google (Firebase Firestore). Suas alterações locais (notas, presenças, vistos) são salvas automaticamente em tempo real! Se você trocar de dispositivo, pode recuperar tudo instantaneamente.
            </p>

            <div className="relative flex items-center gap-2 p-3 bg-zinc-950/40 rounded-xl border border-zinc-850 text-xs">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 absolute" />
              <span className="text-zinc-300 font-semibold ml-2">Status da Nuvem:</span>
              <span className="text-emerald-400 font-bold">100% Conectado e Ativo</span>
              <span className="text-[10px] text-zinc-500 font-mono ml-auto">@{localStorage.getItem('portal_active_user') || 'professor'}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-zinc-800/80">
              {/* BACKUP TO CLOUD */}
              <div className="p-4 bg-zinc-950/40 rounded-xl border border-zinc-800 space-y-3">
                <div className="flex items-center gap-2 text-emerald-400">
                  <CloudUpload className="w-4 h-4" />
                  <h4 className="text-xs font-bold uppercase tracking-wider">Fazer Backup para Nuvem</h4>
                </div>
                <p className="text-[11px] text-zinc-500">
                  Envia todos os seus dados locais deste dispositivo para o servidor em nuvem. Use se tiver feito alterações offline que deseja consolidar na nuvem agora.
                </p>
                <button
                  type="button"
                  disabled={isSyncingCloud}
                  onClick={handleCloudPush}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow cursor-pointer"
                >
                  {isSyncingCloud ? 'Sincronizando...' : <><CloudUpload className="w-4 h-4" /> Enviar para Nuvem</>}
                </button>
              </div>

              {/* RESTORE FROM CLOUD */}
              <div className="p-4 bg-zinc-950/40 rounded-xl border border-zinc-800 space-y-3">
                <div className="flex items-center gap-2 text-blue-400">
                  <CloudDownload className="w-4 h-4" />
                  <h4 className="text-xs font-bold uppercase tracking-wider">Restaurar da Nuvem</h4>
                </div>
                <p className="text-[11px] text-zinc-500">
                  Baixa todas as suas turmas, alunos e notas do servidor em nuvem e substitui as informações locais deste navegador.
                </p>
                <button
                  type="button"
                  disabled={isSyncingCloud}
                  onClick={handleCloudPull}
                  className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-blue-400 border border-blue-500/20 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {isSyncingCloud ? 'Sincronizando...' : <><CloudDownload className="w-4 h-4" /> Baixar da Nuvem</>}
                </button>
              </div>
            </div>
          </div>

          {/* Demonstration / Seeds Utilities */}
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl space-y-4">
            <h3 className="text-white font-bold text-sm flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-yellow-400" /> Diários de Demonstração
            </h3>
            <p className="text-xs text-zinc-400">
              Caso esteja testando o aplicativo pela primeira vez ou queira restaurar as turmas de exemplo do professor, clique no botão abaixo para semear dados de teste completos:
            </p>
            <button
              id="load-demo-data-btn"
              type="button"
              onClick={handleLoadDemoData}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-yellow-400 border border-yellow-500/20 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Sparkles className="w-4 h-4" /> Carregar Dados de Demonstração
            </button>
          </div>

        </div>
      )}

      {activeSubTab === 'turmas-globais' && (
        <div id="settings-turmas-globais-section" className="space-y-6 animate-in fade-in duration-150">
          
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl space-y-4">
            <h3 className="text-white font-bold text-sm flex items-center gap-2">
              <SchoolIcon className="w-5 h-5 text-amber-500" /> Vincular Turmas Cadastradas pelo Coordenador
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Aqui você pode anexar ao seu diário de classe local as turmas oficiais registradas pela coordenação. 
              Ao anexar uma turma, ela e todos os seus alunos oficiais serão automaticamente adicionados à sua lista de cadastros locais de forma idêntica e sem erros de digitação!
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* LHS: Select School and Class list */}
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-400">1. Selecione a Escola</label>
                  <select
                    value={selectedGlobalSchoolId}
                    onChange={(e) => setSelectedGlobalSchoolId(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-855 text-zinc-200 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer"
                  >
                    <option value="">-- Selecionar Escola da Nuvem --</option>
                    {globalSchools.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div className="border-t border-zinc-850 pt-4 space-y-2">
                  <label className="text-xs font-bold text-zinc-400 block mb-2">2. Turmas Oficiais Disponíveis</label>
                  
                  {loadingGlobals ? (
                    <div className="text-center py-8 text-zinc-500 font-mono text-xs animate-pulse">
                      Carregando turmas oficiais...
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                      {globalClasses
                        .filter(c => c.schoolId === selectedGlobalSchoolId)
                        .map((cls) => {
                          const studentCount = globalStudents.filter(st => st.classId === cls.id).length;
                          const isAttached = classes.some(localCls => {
                            const localSch = schools.find(s => s.id === localCls.schoolId);
                            const globalSch = globalSchools.find(s => s.id === cls.schoolId);
                            return localCls.name.toLowerCase() === cls.name.toLowerCase() && 
                                   localSch && globalSch && localSch.name.toLowerCase() === globalSch.name.toLowerCase();
                          });

                          return (
                            <div 
                              key={cls.id}
                              onClick={() => setSelectedClassIdForStudent(cls.id as any)}
                              className={`p-3 rounded-xl border flex items-center justify-between gap-4 cursor-pointer transition ${
                                String(selectedClassIdForStudent) === String(cls.id)
                                  ? 'bg-amber-500/10 border-amber-500'
                                  : 'bg-zinc-950/40 border-zinc-850 hover:bg-zinc-900/30'
                              }`}
                            >
                              <div className="min-w-0">
                                <span className="text-xs font-bold text-zinc-200 block truncate">{cls.name}</span>
                                <span className="text-[10px] text-zinc-500 flex items-center gap-1 mt-0.5">
                                  <Users className="w-3 h-3 text-zinc-650" /> {studentCount} alunos cadastrados
                                </span>
                              </div>

                              <div className="shrink-0 flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                                {isAttached ? (
                                  <span className="text-[10px] bg-emerald-950/80 text-emerald-400 border border-emerald-800/50 px-2 py-1 rounded-lg font-bold flex items-center gap-1 shrink-0 select-none">
                                    <Check className="w-3 h-3" /> Vinculada
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    disabled={attachingClassId === cls.id}
                                    onClick={() => handleAttachGlobalClass(cls)}
                                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-[11px] font-bold rounded-lg transition shrink-0 cursor-pointer"
                                  >
                                    {attachingClassId === cls.id ? 'Vinculando...' : 'Vincular'}
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      
                      {selectedGlobalSchoolId && globalClasses.filter(c => c.schoolId === selectedGlobalSchoolId).length === 0 && (
                        <p className="text-center py-6 text-zinc-500 text-xs">Nenhuma turma registrada pelo coordenador para esta escola.</p>
                      )}
                      {!selectedGlobalSchoolId && (
                        <p className="text-center py-6 text-zinc-500 text-xs">Selecione uma escola acima para ver as turmas disponíveis.</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* RHS: Students Preview */}
            <div className="lg:col-span-7">
              <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                  <h4 className="text-white font-bold text-xs uppercase tracking-wider text-zinc-300 flex items-center gap-2">
                    <Users className="w-4 h-4 text-amber-500" /> Lista Oficial de Alunos ({globalStudents.filter(st => String(st.classId) === String(selectedClassIdForStudent)).length})
                  </h4>
                </div>

                <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
                  {globalStudents
                    .filter(st => String(st.classId) === String(selectedClassIdForStudent))
                    .map((st) => (
                      <div key={st.id} className="flex items-center gap-3 bg-zinc-950/30 border border-zinc-850 rounded-xl px-3 py-2 text-xs hover:border-zinc-800 transition">
                        <span className="font-mono text-[10px] font-bold text-amber-500 bg-amber-500/5 border border-amber-500/10 w-5.5 h-5.5 rounded flex items-center justify-center shrink-0">
                          {st.rollNumber}
                        </span>
                        <span className="text-zinc-300 font-medium">{st.name}</span>
                      </div>
                    ))}
                  
                  {(!selectedClassIdForStudent || globalStudents.filter(st => String(st.classId) === String(selectedClassIdForStudent)).length === 0) && (
                    <div className="text-center py-16 text-zinc-500">
                      <Users className="w-12 h-12 mx-auto mb-2 opacity-20" />
                      <p className="text-xs">Selecione uma turma disponível ao lado para visualizar a lista oficial de alunos.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* Diálogo de Confirmação Customizado */}
      {confirmDialog && confirmDialog.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-amber-500">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="text-white font-bold text-base">{confirmDialog.title}</h3>
            </div>
            <p className="text-zinc-300 text-xs leading-relaxed">
              {confirmDialog.message}
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-semibold transition cursor-pointer"
              >
                {confirmDialog.cancelText || 'Cancelar'}
              </button>
              <button
                type="button"
                onClick={confirmDialog.onConfirm}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold transition cursor-pointer shadow-lg shadow-rose-900/20"
              >
                {confirmDialog.confirmText || 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Diálogo de Alerta Customizado */}
      {alertDialog && alertDialog.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-emerald-400">
              <Check className="w-5 h-5 shrink-0 bg-emerald-500/10 p-1 rounded-full" />
              <h3 className="text-white font-bold text-base">{alertDialog.title}</h3>
            </div>
            <p className="text-zinc-300 text-xs leading-relaxed">
              {alertDialog.message}
            </p>
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => {
                  if (alertDialog.onClose) {
                    alertDialog.onClose();
                  }
                  setAlertDialog(null);
                }}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold transition cursor-pointer shadow-lg shadow-blue-900/20"
              >
                Ok
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
