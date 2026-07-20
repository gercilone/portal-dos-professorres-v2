import React, { useState, useMemo } from 'react';
import { 
  X, 
  FileText, 
  TrendingUp, 
  CheckCircle2, 
  AlertTriangle, 
  BookOpen, 
  Award,
  ChevronDown,
  ChevronUp,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GlobalStudent, GlobalSubject } from '../firebase';

interface StudentReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: GlobalStudent | null;
  className: string;
  rollNumber: number;
  subjects: GlobalSubject[];
  reportData: {
    bimonthlyGrades: any[];
    extraGrades: any[];
    attendance: any[];
    lessons: any[];
    assignmentDescriptions: any[];
  } | null;
}

export default function StudentReportModal({
  isOpen,
  onClose,
  student,
  className,
  rollNumber,
  subjects,
  reportData
}: StudentReportModalProps) {
  const [activeTab, setActiveTab] = useState<'consolidado' | 'detalhado'>('consolidado');
  const [expandedSubjects, setExpandedSubjects] = useState<Record<string, boolean>>({});

  // Helper to toggle subject detail expansion in detailed view
  const toggleSubject = (subjectId: string) => {
    setExpandedSubjects(prev => ({
      ...prev,
      [subjectId]: !prev[subjectId]
    }));
  };

  // Helper to calculate student average from raw grades
  const calculateStudentAverage = (subjectId: string, bimonthly: number) => {
    if (!reportData || !student) return { media: null, hasGrades: false, record: null };
    
    const record = reportData.bimonthlyGrades.find(
      g => String(g.studentId) === String(student.id) && 
           String(g.subjectId) === String(subjectId) && 
           Number(g.bimonthly) === Number(bimonthly)
    );

    if (!record) return { media: null, hasGrades: false, record: null };

    const t1 = record.t1;
    const t2 = record.t2;
    const t3 = record.t3;
    const t4 = record.t4;
    const t5 = record.t5;
    const exam = record.exam;

    const hasAnyGrade = t1 !== undefined || t2 !== undefined || t3 !== undefined || t4 !== undefined || t5 !== undefined || exam !== undefined;
    if (!hasAnyGrade) return { media: null, hasGrades: false, record };

    const v1 = t1 ?? 0;
    const v2 = t2 ?? 0;
    const v3 = t3 ?? 0;
    const v4 = t4 ?? 0;
    const v5 = t5 ?? 0;
    const worksSum = v1 + v2 + v3 + v4 + v5;

    let media = 0;
    if (exam !== undefined) {
      const hasAnyTrab = t1 !== undefined || t2 !== undefined || t3 !== undefined || t4 !== undefined || t5 !== undefined;
      if (!hasAnyTrab) {
        media = exam;
      } else {
        media = (worksSum + exam) / 2;
      }
    } else {
      media = worksSum;
    }

    return { media: parseFloat(media.toFixed(1)), hasGrades: true, record };
  };

  // Helper to calculate absences
  const getAbsences = (subjectId: string, bimonthly: number) => {
    if (!reportData || !student) return 0;
    const record = reportData.attendance.find(
      a => String(a.studentId) === String(student.id) && 
           String(a.subjectId) === String(subjectId) && 
           Number(a.bimonthly) === Number(bimonthly)
    );
    return record ? (Number(record.absences) || 0) : 0;
  };

  // Helper to calculate lessons
  const getLessonsCount = (subjectId: string, bimonthly: number) => {
    if (!reportData) return 0;
    const subjLessons = reportData.lessons.filter(
      l => String(l.subjectId) === String(subjectId) && Number(l.bimonthly) === Number(bimonthly)
    );
    return subjLessons.reduce((acc, curr) => acc + (Number(curr.lessonCount) || 2), 0);
  };

  // Helper to fetch custom assignment labels
  const getAssignmentLabels = (subjectId: string, bimonthly: number) => {
    if (!reportData) return null;
    const desc = reportData.assignmentDescriptions.find(
      d => String(d.subjectId) === String(subjectId) && Number(d.bimonthly) === Number(bimonthly)
    );
    return {
      t1: desc?.t1 || 'Trabalho 1',
      t2: desc?.t2 || 'Trabalho 2',
      t3: desc?.t3 || 'Trabalho 3',
      t4: desc?.t4 || 'Trabalho 4',
      t5: desc?.t5 || 'Trabalho 5',
    };
  };

  // Calculate Overall Stats across all subjects and bimesters
  const stats = useMemo(() => {
    if (!student || !reportData) return { mediaGeral: 0, freqMedia: 100, totalFaltas: 0 };

    let gradesSum = 0;
    let gradesCount = 0;
    let totalLessonsSum = 0;
    let totalAbsencesSum = 0;

    subjects.forEach(subj => {
      [1, 2, 3, 4].forEach(bim => {
        const { media, hasGrades } = calculateStudentAverage(subj.id, bim);
        if (hasGrades && media !== null) {
          gradesSum += media;
          gradesCount++;
        }

        const lessonsCount = getLessonsCount(subj.id, bim);
        const absencesCount = getAbsences(subj.id, bim);

        totalLessonsSum += lessonsCount;
        totalAbsencesSum += absencesCount;
      });
    });

    const mediaGeral = gradesCount > 0 ? gradesSum / gradesCount : 0;
    const freqMedia = totalLessonsSum === 0
      ? 100
      : Math.max(0, Math.min(100, Math.round(((totalLessonsSum - totalAbsencesSum) / totalLessonsSum) * 100)));

    return {
      mediaGeral,
      freqMedia,
      totalFaltas: totalAbsencesSum
    };
  }, [student, reportData, subjects]);

  if (!isOpen || !student) return null;

  const initials = student.name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(n => n[0])
    .join('')
    .toUpperCase();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="bg-zinc-950 border border-zinc-800 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
      >
        {/* Header bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/60">
          <div className="flex items-center gap-3">
            <button 
              onClick={onClose} 
              className="p-1.5 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-xl transition cursor-pointer"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <span className="text-[10px] text-amber-500 font-bold uppercase tracking-widest block">Ficha do Aluno</span>
              <h3 className="text-white font-extrabold text-sm">Histórico curricular e acadêmico bimestral</h3>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Student Profile Card Banner */}
          <div className="bg-gradient-to-r from-zinc-900 to-zinc-950 border border-zinc-800 p-6 rounded-2xl flex flex-col sm:flex-row items-center gap-5">
            <div className="w-16 h-16 rounded-full bg-amber-500/10 border-2 border-amber-500/30 text-amber-400 flex items-center justify-center text-xl font-black shrink-0 font-mono">
              {initials}
            </div>
            <div className="text-center sm:text-left space-y-1 truncate w-full">
              <h2 className="text-white text-xl font-black tracking-tight truncate uppercase">{student.name}</h2>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-4 gap-y-1 text-xs text-zinc-400 font-medium">
                <span>Turma: <span className="font-bold text-zinc-200">{className}</span></span>
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-800 hidden sm:inline" />
                <span>Nº Chamada: <span className="font-mono font-bold text-zinc-200">{rollNumber}</span></span>
              </div>
            </div>
          </div>

          {/* Core Metrics Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* 1. Média Geral */}
            <div className="bg-zinc-900/50 border border-zinc-850 p-5 rounded-2xl flex items-center gap-4">
              <div className="w-12 h-12 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl flex items-center justify-center shrink-0">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-wide block">Média Geral</span>
                <span className={`text-xl font-black block ${stats.mediaGeral >= 7.0 ? 'text-emerald-400' : 'text-rose-400 font-bold'}`}>
                  {stats.mediaGeral > 0 ? stats.mediaGeral.toFixed(2).replace('.', ',') : '-'}
                </span>
                <span className="text-[9px] text-zinc-500 block">Todas as matérias</span>
              </div>
            </div>

            {/* 2. Freq. Média */}
            <div className="bg-zinc-900/50 border border-zinc-850 p-5 rounded-2xl flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-xl flex items-center justify-center shrink-0">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-wide block">Freq. Média</span>
                <span className={`text-xl font-black block ${stats.freqMedia >= 75 ? 'text-emerald-400' : 'text-rose-400 font-extrabold'}`}>
                  {stats.freqMedia}%
                </span>
                <span className="text-[9px] text-zinc-500 block">Frequência acumulada</span>
              </div>
            </div>

            {/* 3. Total Faltas */}
            <div className="bg-zinc-900/50 border border-zinc-850 p-5 rounded-2xl flex items-center gap-4">
              <div className="w-12 h-12 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-wide block">Total Faltas</span>
                <span className="text-white text-xl font-black block text-rose-400">{stats.totalFaltas}</span>
                <span className="text-[9px] text-zinc-500 block">Absências no ano</span>
              </div>
            </div>
          </div>

          {/* Tab buttons */}
          <div className="flex bg-zinc-900/80 p-1.5 border border-zinc-850 rounded-2xl">
            <button
              onClick={() => setActiveTab('consolidado')}
              className={`flex-1 py-3 text-center rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'consolidado'
                  ? 'bg-amber-500 text-zinc-950 shadow-md font-extrabold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <FileText className="w-4 h-4" />
              Boletim Consolidado
            </button>
            <button
              onClick={() => setActiveTab('detalhado')}
              className={`flex-1 py-3 text-center rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'detalhado'
                  ? 'bg-amber-500 text-zinc-950 shadow-md font-extrabold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              Histórico Detalhado (Atividades)
            </button>
          </div>

          {/* TAB 1: BOLETIM CONSOLIDADO */}
          {activeTab === 'consolidado' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-850 pb-2">
                <h4 className="text-white font-bold text-sm">Boletim Escolar de Rendimento</h4>
                <span className="text-[10px] text-zinc-500 font-mono">Médias e Faltas (f)</span>
              </div>

              <div className="overflow-x-auto border border-zinc-850 rounded-2xl bg-zinc-950/20">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-zinc-950/60 border-b border-zinc-850 text-zinc-500 text-[10px] font-bold tracking-wider uppercase">
                      <th className="py-3 px-5">Disciplina</th>
                      <th className="py-3 px-4 text-center w-24">1º Bim</th>
                      <th className="py-3 px-4 text-center w-24">2º Bim</th>
                      <th className="py-3 px-4 text-center w-24">3º Bim</th>
                      <th className="py-3 px-4 text-center w-24">4º Bim</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-900 text-xs">
                    {subjects.map(subj => {
                      return (
                        <tr key={subj.id} className="hover:bg-zinc-900/30 text-zinc-300">
                          <td className="py-3 px-5 font-bold text-zinc-200">{subj.name}</td>
                          {[1, 2, 3, 4].map(bim => {
                            const { media, hasGrades } = calculateStudentAverage(subj.id, bim);
                            const absences = getAbsences(subj.id, bim);
                            const isBelowPassing = media !== null && media < 7.0;

                            return (
                              <td key={bim} className="py-3 px-4 text-center">
                                {hasGrades && media !== null ? (
                                  <div className="space-y-0.5">
                                    <span className={`font-mono font-black block text-sm ${
                                      isBelowPassing ? 'text-rose-400' : 'text-emerald-400'
                                    }`}>
                                      {media.toFixed(1).replace('.', ',')}
                                    </span>
                                    {absences > 0 ? (
                                      <span className="text-[10px] text-zinc-500 font-mono block">{absences}f</span>
                                    ) : (
                                      <span className="text-[10px] text-zinc-650 font-mono block">0f</span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-zinc-650 font-mono block py-1">-</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                    {subjects.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-zinc-500 text-xs font-semibold">
                          Nenhuma disciplina vinculada a esta turma.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: HISTÓRICO DETALHADO (ATIVIDADES) */}
          {activeTab === 'detalhado' && (
            <div className="space-y-4">
              <div className="border-b border-zinc-850 pb-2">
                <h4 className="text-white font-bold text-sm">Quadro Detalhado de Atividades Bimestrais</h4>
                <p className="text-xs text-zinc-500 mt-0.5">Clique em cada disciplina para expandir e verificar o detalhamento de trabalhos (T1 a T5) e provas lançadas.</p>
              </div>

              <div className="space-y-3">
                {subjects.map(subj => {
                  const isExpanded = !!expandedSubjects[subj.id];

                  // Check if any grades exist for this subject in any bimester
                  const hasAnyGradesSubject = [1, 2, 3, 4].some(bim => {
                    const { hasGrades } = calculateStudentAverage(subj.id, bim);
                    return hasGrades;
                  });

                  return (
                    <div 
                      key={subj.id} 
                      className={`bg-zinc-900/30 border rounded-2xl overflow-hidden transition-all duration-200 ${
                        isExpanded ? 'border-amber-500/40 bg-zinc-900/60' : 'border-zinc-850 hover:border-zinc-800'
                      }`}
                    >
                      {/* Accordion Trigger Header */}
                      <button
                        onClick={() => toggleSubject(subj.id)}
                        className="w-full flex items-center justify-between p-4 text-left font-bold text-xs cursor-pointer select-none"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${hasAnyGradesSubject ? 'bg-emerald-500' : 'bg-zinc-700'}`} />
                          <span className="text-zinc-100 text-sm font-extrabold">{subj.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-zinc-500 font-mono">
                            {hasAnyGradesSubject ? 'Com Lançamentos' : 'Sem Lançamentos'}
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-zinc-400" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-zinc-400" />
                          )}
                        </div>
                      </button>

                      {/* Accordion Content */}
                      {isExpanded && (
                        <div className="border-t border-zinc-850/60 p-4 space-y-4 bg-zinc-950/40">
                          {!hasAnyGradesSubject ? (
                            <div className="text-center py-4 text-zinc-600 text-xs font-semibold flex items-center justify-center gap-2">
                              <Info className="w-4 h-4 text-zinc-650" />
                              Nenhuma atividade ou nota lançada pelos professores nesta disciplina.
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {[1, 2, 3, 4].map(bim => {
                                const { media, hasGrades, record } = calculateStudentAverage(subj.id, bim);
                                if (!hasGrades) return null;

                                const labels = getAssignmentLabels(subj.id, bim);
                                const absences = getAbsences(subj.id, bim);
                                const isBelowPassing = media !== null && media < 7.0;

                                const renderValue = (val: number | undefined) => {
                                  if (val === undefined) return <span className="text-zinc-700 font-mono font-medium">-</span>;
                                  if (val === 0) return <span className="text-rose-500 font-mono font-black">0,0</span>;
                                  return <span className="text-emerald-500 font-mono font-bold">{val.toFixed(1).replace('.', ',')}</span>;
                                };

                                return (
                                  <div key={bim} className="bg-zinc-900/60 border border-zinc-850/80 rounded-xl p-4 space-y-3.5">
                                    <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                                      <span className="text-xs font-extrabold text-amber-400 font-mono">{bim}º Bimestre</span>
                                      <div className="flex items-center gap-3">
                                        <span className="text-[10px] text-zinc-500 font-mono">{absences} Faltas</span>
                                        {media !== null && (
                                          <span className={`text-xs font-mono font-black px-2 py-0.5 rounded ${
                                            isBelowPassing ? 'bg-red-500/10 text-rose-400' : 'bg-emerald-500/10 text-emerald-400'
                                          }`}>
                                            Média: {media.toFixed(1).replace('.', ',')}
                                          </span>
                                        )}
                                      </div>
                                    </div>

                                    {/* Activities details */}
                                    <div className="space-y-2 text-xs">
                                      <div className="flex justify-between items-center bg-zinc-950/40 px-2.5 py-1.5 rounded-lg border border-zinc-900">
                                        <span className="text-zinc-400 truncate pr-2 font-medium" title={labels?.t1}>
                                          T1: <span className="text-zinc-500 font-normal">{labels?.t1}</span>
                                        </span>
                                        <span>{renderValue(record?.t1)}</span>
                                      </div>
                                      <div className="flex justify-between items-center bg-zinc-950/40 px-2.5 py-1.5 rounded-lg border border-zinc-900">
                                        <span className="text-zinc-400 truncate pr-2 font-medium" title={labels?.t2}>
                                          T2: <span className="text-zinc-500 font-normal">{labels?.t2}</span>
                                        </span>
                                        <span>{renderValue(record?.t2)}</span>
                                      </div>
                                      <div className="flex justify-between items-center bg-zinc-950/40 px-2.5 py-1.5 rounded-lg border border-zinc-900">
                                        <span className="text-zinc-400 truncate pr-2 font-medium" title={labels?.t3}>
                                          T3: <span className="text-zinc-500 font-normal">{labels?.t3}</span>
                                        </span>
                                        <span>{renderValue(record?.t3)}</span>
                                      </div>
                                      <div className="flex justify-between items-center bg-zinc-950/40 px-2.5 py-1.5 rounded-lg border border-zinc-900">
                                        <span className="text-zinc-400 truncate pr-2 font-medium" title={labels?.t4}>
                                          T4: <span className="text-zinc-500 font-normal">{labels?.t4}</span>
                                        </span>
                                        <span>{renderValue(record?.t4)}</span>
                                      </div>
                                      <div className="flex justify-between items-center bg-zinc-950/40 px-2.5 py-1.5 rounded-lg border border-zinc-900">
                                        <span className="text-zinc-400 truncate pr-2 font-medium" title={labels?.t5}>
                                          T5: <span className="text-zinc-500 font-normal">{labels?.t5}</span>
                                        </span>
                                        <span>{renderValue(record?.t5)}</span>
                                      </div>
                                      <div className="flex justify-between items-center bg-zinc-900/80 px-2.5 py-1.5 rounded-lg border border-zinc-800/60">
                                        <span className="text-zinc-300 font-bold">Prova Bimestral</span>
                                        <span>{renderValue(record?.exam)}</span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-800 bg-zinc-950/80 flex justify-end">
          <button 
            onClick={onClose} 
            className="px-5 py-2 bg-zinc-850 hover:bg-zinc-800 text-zinc-300 hover:text-white text-xs font-bold rounded-xl transition cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </motion.div>
    </div>
  );
}
