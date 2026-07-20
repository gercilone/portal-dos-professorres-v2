import React, { useState, useEffect, useMemo } from 'react';
import { 
  getSchoolReportsData,
  GlobalSchool,
  GlobalClass,
  GlobalStudent,
  GlobalSubject,
  GlobalWorkload,
  getActiveCoordinatorSchoolId
} from '../firebase';
import { 
  BarChart2, 
  TrendingUp, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw,
  School
} from 'lucide-react';

interface CoordClassComparativeProps {
  schools: GlobalSchool[];
  classes: GlobalClass[];
  students: GlobalStudent[];
  subjects: GlobalSubject[];
  workloads: GlobalWorkload[];
  selectedSchoolId: string;
  setSelectedSchoolId: (id: string) => void;
  selectedBimonthly: number;
  setSelectedBimonthly: (b: number) => void;
}

export default function CoordClassComparative({
  schools,
  classes,
  students,
  subjects,
  workloads,
  selectedSchoolId,
  setSelectedSchoolId,
  selectedBimonthly,
  setSelectedBimonthly
}: CoordClassComparativeProps) {
  // Comparative dashboard states
  const [isLoadingComparative, setIsLoadingComparative] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [comparativeData, setComparativeData] = useState<{
    bimonthlyGrades: any[];
    extraGrades: any[];
    attendance: any[];
    lessons: any[];
    assignmentDescriptions: any[];
  } | null>(null);
  const [comparativeError, setComparativeError] = useState<string | null>(null);
  const [selectedCompSubjectId, setSelectedCompSubjectId] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'rank' | 'alpha'>('rank');

  // Fetch school-wide comparative data
  const fetchComparativeData = async (silent = false) => {
    if (!selectedSchoolId) return;
    if (silent) setIsRefreshing(true);
    else setIsLoadingComparative(true);
    setComparativeError(null);

    try {
      const schoolStudents = students.filter(s => {
        const cls = classes.find(c => c.id === s.classId);
        return cls && cls.schoolId === selectedSchoolId;
      });

      const schoolClasses = classes.filter(c => c.schoolId === selectedSchoolId);
      const schoolClassIds = schoolClasses.map(c => c.id);
      const schoolWorkloads = workloads.filter(w => schoolClassIds.includes(w.classId));

      const data = await getSchoolReportsData(selectedSchoolId, schoolStudents, schoolWorkloads);
      setComparativeData(data);
    } catch (err) {
      console.error('Error fetching comparative reports:', err);
      setComparativeError('Erro ao consultar notas de todas as turmas na nuvem.');
    } finally {
      setIsLoadingComparative(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (selectedSchoolId && students.length > 0) {
      fetchComparativeData();
    }
  }, [selectedSchoolId, students.length]);

  // School-wide analytics memo
  const comparativeAnalytics = useMemo(() => {
    if (!comparativeData || schools.length === 0 || !selectedSchoolId) return null;

    const schoolClasses = classes.filter(c => c.schoolId === selectedSchoolId);

    const calculatedClasses = schoolClasses.map(clazz => {
      // Find students in this class
      const classStudents = students.filter(s => String(s.classId) === String(clazz.id));
      if (classStudents.length === 0) {
        return {
          id: clazz.id,
          name: clazz.name,
          average: 0,
          presencePct: 100,
          totalStudents: 0,
          hasData: false
        };
      }

      const studentIdsSet = new Set(classStudents.map(s => String(s.id)));

      // Calculate grades
      let gradesSum = 0;
      let gradesCount = 0;

      // Filter grades for these students and the selected subject (if not 'all')
      const relevantGrades = comparativeData.bimonthlyGrades.filter(g => {
        const studentMatch = studentIdsSet.has(String(g.studentId));
        const subjectMatch = selectedCompSubjectId === 'all' || String(g.subjectId) === String(selectedCompSubjectId);
        const bimonthlyMatch = Number(g.bimonthly) === Number(selectedBimonthly);
        return studentMatch && subjectMatch && bimonthlyMatch;
      });

      relevantGrades.forEach(record => {
        const t1 = record.t1;
        const t2 = record.t2;
        const t3 = record.t3;
        const t4 = record.t4;
        const t5 = record.t5;
        const exam = record.exam;

        const hasAnyGrade = t1 !== undefined || t2 !== undefined || t3 !== undefined || t4 !== undefined || t5 !== undefined || exam !== undefined;
        if (hasAnyGrade) {
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

          gradesSum += media;
          gradesCount++;
        }
      });

      const average = gradesCount > 0 ? parseFloat((gradesSum / gradesCount).toFixed(1)) : 0;

      // Calculate attendance
      let totalLessonsSum = 0;

      // Filter lessons for this class and the selected subject (if not 'all')
      const relevantLessons = comparativeData.lessons.filter(l => {
        const classMatch = String(l.classId) === String(clazz.id);
        const subjectMatch = selectedCompSubjectId === 'all' || String(l.subjectId) === String(selectedCompSubjectId);
        const bimonthlyMatch = Number(l.bimonthly) === Number(selectedBimonthly);
        return classMatch && subjectMatch && bimonthlyMatch;
      });

      relevantLessons.forEach(lesson => {
        totalLessonsSum += Number(lesson.lessonCount) || 2;
      });

      // Count absences
      const relevantAttendance = comparativeData.attendance.filter(a => {
        const studentMatch = studentIdsSet.has(String(a.studentId));
        const subjectMatch = selectedCompSubjectId === 'all' || String(a.subjectId) === String(selectedCompSubjectId);
        const bimonthlyMatch = Number(a.bimonthly) === Number(selectedBimonthly);
        return studentMatch && subjectMatch && bimonthlyMatch;
      });

      // Calculate presence percentage for each student in the class, then take the average
      let studentPresencePcts: number[] = [];
      classStudents.forEach(student => {
        let studLessons = 0;
        let studAbsences = 0;

        relevantLessons.forEach(lesson => {
          studLessons += Number(lesson.lessonCount) || 2;
        });

        relevantAttendance.filter(a => String(a.studentId) === String(student.id)).forEach(att => {
          studAbsences += Number(att.absences) || 0;
        });

        if (studLessons > 0) {
          const pct = Math.max(0, Math.min(100, Math.round(((studLessons - studAbsences) / studLessons) * 100)));
          studentPresencePcts.push(pct);
        }
      });

      const presencePct = studentPresencePcts.length > 0
        ? Math.round(studentPresencePcts.reduce((a, b) => a + b, 0) / studentPresencePcts.length)
        : 100;

      return {
        id: clazz.id,
        name: clazz.name,
        average,
        presencePct,
        totalStudents: classStudents.length,
        hasData: gradesCount > 0 || totalLessonsSum > 0
      };
    });

    const activeClasses = calculatedClasses; // Show all classes of the school as requested by the user

    // Filter classes with non-zero average for overall school average
    const classesWithGrades = activeClasses.filter(c => c.average > 0);
    const schoolAverage = classesWithGrades.length > 0
      ? parseFloat((classesWithGrades.reduce((sum, c) => sum + c.average, 0) / classesWithGrades.length).toFixed(2))
      : 0;

    const schoolPresence = activeClasses.length > 0
      ? Math.round(activeClasses.reduce((sum, c) => sum + c.presencePct, 0) / activeClasses.length)
      : 100;

    // Local sorting functions helper
    const getLocalClassSortScore = (className: string) => {
      let normalized = className.toLowerCase();
      // Translate textual numbers to digits for standard ordering (e.g. Sexto -> 6)
      normalized = normalized
        .replace(/\b(primeiro|1º|1o)\b/g, '1')
        .replace(/\b(segundo|2º|2o)\b/g, '2')
        .replace(/\b(terceiro|3º|3o)\b/g, '3')
        .replace(/\b(quarto|4º|4o)\b/g, '4')
        .replace(/\b(quinto|5º|5o)\b/g, '5')
        .replace(/\b(sexto|6º|6o)\b/g, '6')
        .replace(/\b(setimo|sétimo|7º|7o)\b/g, '7')
        .replace(/\b(oitavo|8º|8o)\b/g, '8')
        .replace(/\b(nono|9º|9o)\b/g, '9');

      const numMatch = normalized.match(/\d+/);
      const num = numMatch ? parseInt(numMatch[0]) : 0;
      const isHighSchool = normalized.includes("medio") || normalized.includes("médio") || normalized.includes("e.m");
      const isFundamental = normalized.includes("fundamental") || normalized.includes("fund") || normalized.includes("ano");

      if (isHighSchool) {
        return 100 + num;
      }
      if (isFundamental) {
        return num;
      }
      if (num >= 6 && num <= 9) {
        return num;
      }
      if (num >= 1 && num <= 5) {
        return num;
      }
      return num > 0 ? num : 999;
    };

    const localSortClasses = (a: { name: string }, b: { name: string }): number => {
      const scoreA = getLocalClassSortScore(a.name);
      const scoreB = getLocalClassSortScore(b.name);
      if (scoreA !== scoreB) {
        return scoreA - scoreB;
      }
      return a.name.localeCompare(b.name, 'pt-BR', { numeric: true });
    };

    // Sort active classes
    const sortedClasses = [...activeClasses].sort((a, b) => {
      if (sortBy === 'rank') {
        if (b.average !== a.average) {
          return b.average - a.average;
        }
        return localSortClasses(a, b);
      } else {
        return localSortClasses(a, b);
      }
    });

    return {
      classes: sortedClasses,
      schoolAverage,
      schoolPresence
    };
  }, [comparativeData, schools, classes, students, selectedSchoolId, selectedCompSubjectId, selectedBimonthly, sortBy]);

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-600/10 border border-amber-500/25 text-amber-500 rounded-xl flex items-center justify-center">
              <BarChart2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-white font-bold text-sm">Controle e Comparativo entre Turmas</h3>
              <p className="text-xs text-zinc-500">Compare as médias e frequências de todas as turmas cadastradas na escola.</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => fetchComparativeData(true)}
            disabled={isLoadingComparative || isRefreshing || !selectedSchoolId}
            className="px-4 py-2 bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-300 hover:text-white font-bold text-xs transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-amber-400' : ''}`} />
            Sincronizar Diários
          </button>
        </div>

        {/* Global Selectors */}
        <div className="pt-6 border-t border-zinc-900 mt-6">
          <label className="text-[10px] text-zinc-500 font-bold tracking-wider uppercase block mb-2">Selecione a Unidade Escolar:</label>
          <div className="flex flex-wrap gap-2">
            {schools.map(sch => (
              <button
                key={sch.id}
                onClick={() => setSelectedSchoolId(sch.id)}
                disabled={!!getActiveCoordinatorSchoolId()}
                className={`px-4 py-2.5 rounded-xl border font-bold text-xs transition flex items-center gap-2 cursor-pointer disabled:opacity-60 ${
                  selectedSchoolId === sch.id
                    ? 'border-amber-500 bg-amber-500/10 text-amber-400'
                    : 'border-zinc-800 bg-zinc-950/40 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
                }`}
              >
                <School className="w-4 h-4 shrink-0" />
                <span>{sch.name}</span>
              </button>
            ))}
            {schools.length === 0 && (
              <span className="text-xs text-zinc-600 font-mono">Nenhuma escola cadastrada...</span>
            )}
          </div>
        </div>
      </div>

      {/* Main Comparative View */}
      <div className="space-y-6">
        {/* Active Comparative Header Card */}
        <div className="bg-zinc-900 border border-zinc-850 rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest mb-1">Coordenação • Comparativos de Médias</div>
            <h2 className="text-white text-xl font-black">
              {selectedCompSubjectId === 'all' 
                ? 'Rendimento Geral de Turmas' 
                : `${subjects.find(s => String(s.id) === String(selectedCompSubjectId))?.name || 'Comparativo'}`}
            </h2>
            <p className="text-xs text-zinc-400">Comparativo de rendimento e presença média entre todas as turmas da unidade escolar.</p>
          </div>

          {/* Bimonthly selection */}
          <div className="flex items-center gap-1.5 bg-zinc-950 p-1.5 rounded-xl border border-zinc-850 max-w-fit shrink-0 self-start md:self-auto">
            {[1, 2, 3, 4].map(bim => (
              <button
                key={bim}
                onClick={() => setSelectedBimonthly(bim)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  selectedBimonthly === bim
                    ? 'bg-amber-500 text-zinc-950 shadow'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {bim}º Bimestre
              </button>
            ))}
          </div>
        </div>

        {/* Subject Filter Bar */}
        <div>
          <span className="text-[10px] text-zinc-500 font-bold tracking-wider uppercase block mb-2.5">Filtrar por Disciplina:</span>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedCompSubjectId('all')}
              className={`px-4 py-2 rounded-xl border font-bold text-xs transition cursor-pointer ${
                selectedCompSubjectId === 'all'
                  ? 'border-amber-500 bg-amber-500/10 text-amber-400'
                  : 'border-zinc-850 bg-zinc-900/40 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Todas
            </button>
            {subjects.map(subj => (
              <button
                key={subj.id}
                onClick={() => setSelectedCompSubjectId(subj.id)}
                className={`px-4 py-2 rounded-xl border font-bold text-xs transition cursor-pointer ${
                  selectedCompSubjectId === subj.id
                    ? 'border-amber-500 bg-amber-500/10 text-amber-400'
                    : 'border-zinc-850 bg-zinc-900/40 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {subj.name}
              </button>
            ))}
          </div>
        </div>

        {/* Loading / Error / Data state */}
        {isLoadingComparative ? (
          <div className="bg-zinc-900 border border-zinc-850 rounded-2xl py-20 flex flex-col items-center justify-center text-center">
            <RefreshCw className="w-8 h-8 text-amber-500 animate-spin mb-4" />
            <span className="text-zinc-400 text-sm font-bold">Consultando registros de todas as turmas na nuvem...</span>
            <p className="text-xs text-zinc-500 mt-1 max-w-sm">Esta operação consolida as notas e frequências de todas as turmas registradas na unidade.</p>
          </div>
        ) : comparativeError ? (
          <div className="bg-red-500/5 border border-red-500/20 p-6 rounded-2xl text-center space-y-3">
            <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto" />
            <div className="text-sm font-bold text-rose-400">Falha ao obter dados</div>
            <p className="text-xs text-zinc-400 max-w-md mx-auto">{comparativeError}</p>
            <button
              onClick={() => fetchComparativeData()}
              className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-rose-400 border border-red-500/20 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              Tentar Novamente
            </button>
          </div>
        ) : comparativeAnalytics ? (
          <div className="space-y-6">
            {/* Top Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 1. Média Geral */}
              <div className="bg-zinc-900 border border-zinc-850 p-5 rounded-2xl flex items-center gap-4">
                <div className="w-12 h-12 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl flex items-center justify-center shrink-0">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-wide block">Média Geral da Escola</span>
                  <span className={`text-2xl font-black block ${comparativeAnalytics.schoolAverage >= 7.0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {comparativeAnalytics.schoolAverage ? comparativeAnalytics.schoolAverage.toFixed(2).replace('.', ',') : '-'}
                  </span>
                  <span className="text-[9px] text-zinc-500 block">Média ponderada de todas as turmas</span>
                </div>
              </div>

              {/* 2. Presença Média */}
              <div className="bg-zinc-900 border border-zinc-850 p-5 rounded-2xl flex items-center gap-4">
                <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-wide block">Presença Média</span>
                  <span className={`text-2xl font-black block ${comparativeAnalytics.schoolPresence >= 75 ? 'text-emerald-400' : 'text-rose-400 font-extrabold'}`}>
                    {comparativeAnalytics.schoolPresence}%
                  </span>
                  <span className="text-[9px] text-zinc-500 block">Frequência escolar consolidada</span>
                </div>
              </div>
            </div>

            {/* Média de Notas por Turma (Bar Chart) */}
            <div className="bg-zinc-900 border border-zinc-850 p-6 rounded-2xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h3 className="text-white font-bold text-sm">Média de Notas por Turma</h3>
                
                {/* Sorting Selector */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-zinc-500 font-bold tracking-wider uppercase">Ordenar por:</span>
                  <div className="flex bg-zinc-950 p-1 rounded-xl border border-zinc-850 shrink-0">
                    <button
                      onClick={() => setSortBy('rank')}
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                        sortBy === 'rank'
                          ? 'bg-zinc-800 text-amber-400 border border-zinc-700 shadow-md'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      Melhores Notas (Rank)
                    </button>
                    <button
                      onClick={() => setSortBy('alpha')}
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                        sortBy === 'alpha'
                          ? 'bg-zinc-800 text-amber-400 border border-zinc-700 shadow-md'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      Ordem Alfabética
                    </button>
                  </div>
                </div>
              </div>

              <div className="border-b border-zinc-800/60 my-4" />

              {comparativeAnalytics.classes.length === 0 ? (
                <div className="py-12 text-center text-xs text-zinc-500">Nenhuma turma com dados de notas encontrados para esta seleção.</div>
              ) : (
                <div className="relative w-full border-b border-zinc-800 pb-2 pt-6">
                  {/* Grid lines */}
                  <div className="absolute top-[30%] left-0 right-0 border-t border-dashed border-zinc-800/40 pointer-events-none" />
                  <div className="absolute top-[50%] left-0 right-0 border-t border-dashed border-zinc-800/30 pointer-events-none" />
                  <div className="absolute top-[70%] left-0 right-0 border-t border-dashed border-zinc-800/20 pointer-events-none" />
                  
                  <div className="h-[220px] flex items-end justify-start sm:justify-center gap-6 sm:gap-10 overflow-x-auto scrollbar-thin scrollbar-thumb-zinc-800 px-4">
                    {comparativeAnalytics.classes.map(item => {
                      const heightPct = Math.max(8, (item.average / 10) * 100);
                      const isBelowPassing = item.average < 7.0;
                      return (
                        <div key={item.id} className="flex flex-col items-center min-w-[55px] group">
                          <div 
                            className={`w-8 sm:w-10 rounded-t-md relative transition-all duration-300 cursor-pointer ${
                              isBelowPassing 
                                ? 'bg-rose-500/80 group-hover:bg-rose-400' 
                                : 'bg-emerald-500/90 group-hover:bg-emerald-400'
                            }`} 
                            style={{ height: `${heightPct}%` }}
                          >
                            {/* Tooltip on hover */}
                            <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-zinc-950 text-white text-[10px] px-2 py-1 rounded border border-zinc-850 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10 font-bold">
                              Média: {item.average.toFixed(1).replace('.', ',')}
                            </div>
                          </div>
                          <span className="text-[10px] font-bold text-zinc-400 mt-3 text-center whitespace-nowrap">{item.name}</span>
                          <span className={`text-xs font-mono font-black mt-1 ${isBelowPassing ? 'text-rose-400' : 'text-emerald-400'}`}>
                            {item.average.toFixed(1).replace('.', ',')}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Desempenho por Turma (Cards List) */}
            <div className="space-y-4">
              <h3 className="text-white font-bold text-sm">Desempenho por Turma</h3>
              
              {comparativeAnalytics.classes.length === 0 ? (
                <div className="bg-zinc-900 border border-zinc-850 rounded-2xl py-12 text-center text-xs text-zinc-500">
                  Nenhuma turma cadastrada ou com alunos ativos.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {comparativeAnalytics.classes.map((item, index) => {
                    const isBelowPassing = item.average < 7.0;
                    return (
                      <div key={item.id} className="bg-zinc-900 border border-zinc-850 hover:border-zinc-800 p-5 rounded-2xl flex items-center justify-between transition-all duration-200">
                        <div className="flex items-center gap-3 truncate pr-2">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-black font-mono text-xs shrink-0 ${
                            sortBy === 'rank'
                              ? index === 0
                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                : index === 1
                                  ? 'bg-zinc-300/10 text-zinc-300 border border-zinc-300/20'
                                  : index === 2
                                    ? 'bg-amber-700/10 text-amber-600 border border-amber-700/20'
                                    : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                              : 'bg-zinc-950 text-zinc-400 border border-zinc-850'
                          }`}>
                            {index + 1}º
                          </div>
                          <div className="space-y-1 truncate">
                            <h4 className="text-white font-bold text-sm truncate">{item.name}</h4>
                            <div className="flex items-center gap-4 text-xs">
                              <span className="text-zinc-500">
                                Média: <span className={`font-mono font-bold ${isBelowPassing ? 'text-rose-400' : 'text-emerald-400'}`}>{item.average.toFixed(1).replace('.', ',')}</span>
                              </span>
                              <span className="text-zinc-500">
                                Presença: <span className="font-mono font-bold text-zinc-300">{item.presencePct}%</span>
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-[10px] text-zinc-600 font-mono">{item.totalStudents} alunos</span>
                          {item.presencePct >= 75 && item.average >= 5.0 ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                          ) : (
                            <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-zinc-900 border border-zinc-850 rounded-2xl py-20 text-center max-w-md mx-auto">
            <div className="w-14 h-14 bg-zinc-950 rounded-2xl border border-zinc-850 flex items-center justify-center mb-4 text-amber-500 mx-auto">
              <BarChart2 className="w-7 h-7" />
            </div>
            <h3 className="text-white font-bold text-base mb-2">Selecione uma Escola</h3>
            <p className="text-zinc-400 text-xs leading-relaxed px-6">
              Selecione a Unidade Escolar para carregar o comparativo de desempenho e média geral de todas as turmas.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
