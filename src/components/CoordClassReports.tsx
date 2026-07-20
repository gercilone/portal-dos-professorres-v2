import React, { useState, useEffect, useMemo } from 'react';
import { 
  getGlobalSchools, 
  getGlobalClasses, 
  getGlobalStudents, 
  getGlobalSubjects, 
  getGlobalWorkloads,
  getClassReportData,
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
  ArrowLeft, 
  School, 
  BookOpen, 
  Users, 
  TrendingUp, 
  Calendar, 
  AlertTriangle, 
  RefreshCw,
  Eye,
  CheckCircle2,
  FileText,
  Info,
  CheckSquare
} from 'lucide-react';
import CoordClassComparative from './CoordClassComparative';

export default function CoordClassReports() {
  const [schools, setSchools] = useState<GlobalSchool[]>([]);
  const [classes, setClasses] = useState<GlobalClass[]>([]);
  const [students, setStudents] = useState<GlobalStudent[]>([]);
  const [subjects, setSubjects] = useState<GlobalSubject[]>([]);
  const [workloads, setWorkloads] = useState<GlobalWorkload[]>([]);

  // Selection states
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>('');
  const [selectedAno, setSelectedAno] = useState<string>('');
  const [selectedTurma, setSelectedTurma] = useState<string>('');

  // Report filters
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>('all');
  const [selectedBimonthly, setSelectedBimonthly] = useState<number>(1);
  const [viewMode, setViewMode] = useState<'geral' | 'trabalhos'>('geral');

  // Loading and feedback states
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(false);
  const [isLoadingReport, setIsLoadingReport] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  // Live report data from cloud diaries
  const [reportData, setReportData] = useState<{
    bimonthlyGrades: any[];
    extraGrades: any[];
    attendance: any[];
    lessons: any[];
    assignmentDescriptions: any[];
  } | null>(null);

  // Sub-tabs
  const [activeSubTab, setActiveSubTab] = useState<'individual' | 'comparative'>('individual');

  useEffect(() => {
    loadMetadata();
  }, []);

  const loadMetadata = async () => {
    setIsLoadingMetadata(true);
    setReportError(null);
    try {
      const [schs, cls, stds, subs, wls] = await Promise.all([
        getGlobalSchools(),
        getGlobalClasses(),
        getGlobalStudents(),
        getGlobalSubjects(),
        getGlobalWorkloads()
      ]);
      setSchools(schs);
      setClasses(cls);
      setStudents(stds);
      setSubjects(subs);
      setWorkloads(wls);

      // Auto-select first school if none selected or if restricted
      const restrictedSchoolId = getActiveCoordinatorSchoolId();
      if (restrictedSchoolId) {
        setSelectedSchoolId(restrictedSchoolId);
      } else if (schs.length > 0 && !selectedSchoolId) {
        setSelectedSchoolId(schs[0].id);
      }
    } catch (err) {
      console.error('Error loading report metadata:', err);
      setReportError('Erro ao carregar lista de escolas e turmas da nuvem.');
    } finally {
      setIsLoadingMetadata(false);
    }
  };

  // Helper to parse class name into "Ano" and "Turma"
  const parseClass = (className: string) => {
    const normalized = className.trim();
    const anoMatch = normalized.match(/(\d+º?\s*(?:Ano|ano|série|serie))/i) || normalized.match(/(\d+\s*º?\s*(?:Ano|ano))/i);
    let ano = '';
    if (anoMatch) {
      ano = anoMatch[0];
    } else {
      const firstPart = normalized.split('-')[0].trim();
      const words = firstPart.split(' ');
      ano = words.slice(0, 2).join(' ');
    }

    const letterMatch = normalized.match(/\b([A-E])\b/);
    let letter = '';
    if (letterMatch) {
      letter = `Turma ${letterMatch[1]}`;
    } else {
      const anySingleLetter = normalized.match(/\b([A-Z])\b/);
      letter = anySingleLetter ? `Turma ${anySingleLetter[1]}` : 'Turma Única';
    }

    return { ano, letter };
  };

  // Filter classes by selected school
  const schoolClasses = useMemo(() => {
    return classes.filter(c => c.schoolId === selectedSchoolId);
  }, [classes, selectedSchoolId]);

  // Extract unique Anos for selection
  const uniqueAnos = useMemo(() => {
    const set = new Set<string>();
    schoolClasses.forEach(c => {
      const { ano } = parseClass(c.name);
      if (ano) set.add(ano);
    });
    return Array.from(set).sort((a, b) => {
      const numA = parseInt(a) || 0;
      const numB = parseInt(b) || 0;
      return numA - numB;
    });
  }, [schoolClasses]);

  // Extract unique Turmas for the selected Ano only (Bug Fix: only show active registered letters)
  const uniqueTurmas = useMemo(() => {
    const set = new Set<string>();
    schoolClasses.forEach(c => {
      const { ano, letter } = parseClass(c.name);
      if (ano === selectedAno && letter) {
        set.add(letter);
      }
    });
    return Array.from(set).sort();
  }, [schoolClasses, selectedAno]);

  // Auto select default Ano and Turma
  useEffect(() => {
    if (uniqueAnos.length > 0) {
      if (!selectedAno || !uniqueAnos.includes(selectedAno)) {
        setSelectedAno(uniqueAnos[0]);
      }
    } else {
      setSelectedAno('');
    }
  }, [uniqueAnos, selectedAno]);

  useEffect(() => {
    if (uniqueTurmas.length > 0) {
      if (!selectedTurma || !uniqueTurmas.includes(selectedTurma)) {
        setSelectedTurma(uniqueTurmas[0]);
      }
    } else {
      setSelectedTurma('');
    }
  }, [uniqueTurmas, selectedTurma]);

  // Find active selected class ID
  const activeClass = useMemo(() => {
    return schoolClasses.find(c => {
      const { ano, letter } = parseClass(c.name);
      return ano === selectedAno && letter === selectedTurma;
    });
  }, [schoolClasses, selectedAno, selectedTurma]);

  // Find students in the selected class
  const studentsInClass = useMemo(() => {
    if (!activeClass) return [];
    return students
      .filter(s => String(s.classId) === String(activeClass.id))
      .sort((a, b) => (a.rollNumber || 0) - (b.rollNumber || 0));
  }, [students, activeClass]);

  // Find workloads for selected class
  const workloadsInClass = useMemo(() => {
    if (!activeClass) return [];
    return workloads.filter(w => String(w.classId) === String(activeClass.id));
  }, [workloads, activeClass]);

  // Filter subjects that actually have workloads in this class
  const subjectsInClass = useMemo(() => {
    const classSubjIds = workloadsInClass.map(w => String(w.subjectId));
    return subjects.filter(s => classSubjIds.includes(String(s.id)));
  }, [subjects, workloadsInClass]);

  // Fetch report data from Firestore whenever active class or workloads change
  const fetchReport = async (silent = false) => {
    if (!activeClass) return;
    if (silent) setIsRefreshing(true);
    else setIsLoadingReport(true);
    setReportError(null);

    try {
      const data = await getClassReportData(activeClass.id, studentsInClass, workloadsInClass);
      setReportData(data);
    } catch (err) {
      console.error('Error fetching class reports:', err);
      setReportError('Erro ao consultar notas e faltas dos diários da nuvem.');
    } finally {
      setIsLoadingReport(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (activeClass && studentsInClass.length > 0) {
      fetchReport();
    } else {
      setReportData(null);
    }
  }, [activeClass, studentsInClass.length]);

  // Calculate student average from raw grades
  const calculateStudentAverage = (studentId: string, subjectId: string, bimonthly: number) => {
    if (!reportData) return { media: null, hasGrades: false };
    
    const record = reportData.bimonthlyGrades.find(
      g => String(g.studentId) === String(studentId) && 
           String(g.subjectId) === String(subjectId) && 
           Number(g.bimonthly) === Number(bimonthly)
    );

    if (!record) return { media: null, hasGrades: false };

    const t1 = record.t1;
    const t2 = record.t2;
    const t3 = record.t3;
    const t4 = record.t4;
    const t5 = record.t5;
    const exam = record.exam;

    const hasAnyGrade = t1 !== undefined || t2 !== undefined || t3 !== undefined || t4 !== undefined || t5 !== undefined || exam !== undefined;
    if (!hasAnyGrade) return { media: null, hasGrades: false };

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

    return { media: parseFloat(media.toFixed(1)), hasGrades: true };
  };

  // Student list with calculated overall/individual averages and attendance metrics
  const classAnalytics = useMemo(() => {
    if (!reportData || studentsInClass.length === 0) return null;

    const studentRows = studentsInClass.map(student => {
      let totalLessonsSum = 0;
      let totalAbsencesSum = 0;
      let gradesSum = 0;
      let subjectsWithGradesCount = 0;

      // Filter active subjects to analyze
      const targetSubjects = selectedSubjectFilter === 'all' 
        ? subjectsInClass 
        : subjectsInClass.filter(s => String(s.id) === String(selectedSubjectFilter));

      const subjectDetails = targetSubjects.map(subj => {
        // Average
        const { media, hasGrades } = calculateStudentAverage(student.id, subj.id, selectedBimonthly);
        if (hasGrades && media !== null) {
          gradesSum += media;
          subjectsWithGradesCount++;
        }

        // Attendance / Lessons
        const subjLessons = reportData.lessons.filter(
          l => String(l.subjectId) === String(subj.id) && Number(l.bimonthly) === Number(selectedBimonthly)
        );
        const subjLessonsCount = subjLessons.reduce((acc, curr) => acc + (Number(curr.lessonCount) || 2), 0);

        const subjAttendance = reportData.attendance.filter(
          a => String(a.studentId) === String(student.id) && 
               String(a.subjectId) === String(subj.id) && 
               Number(a.bimonthly) === Number(selectedBimonthly)
        );
        const subjAbsencesCount = subjAttendance.reduce((acc, curr) => acc + (Number(curr.absences) || 0), 0);

        totalLessonsSum += subjLessonsCount;
        totalAbsencesSum += subjAbsencesCount;

        return {
          subjectId: subj.id,
          subjectName: subj.name,
          media,
          hasGrades,
          lessonsCount: subjLessonsCount,
          absencesCount: subjAbsencesCount
        };
      });

      const overallAverage = subjectsWithGradesCount > 0 ? parseFloat((gradesSum / subjectsWithGradesCount).toFixed(1)) : null;
      const presencePct = totalLessonsSum === 0 
        ? 100 
        : Math.max(0, Math.min(100, Math.round(((totalLessonsSum - totalAbsencesSum) / totalLessonsSum) * 100)));

      return {
        studentId: student.id,
        studentName: student.name,
        rollNumber: student.rollNumber,
        subjectDetails,
        overallAverage,
        totalLessons: totalLessonsSum,
        totalAbsences: totalAbsencesSum,
        presencePct
      };
    });

    // Class aggregate metrics
    const activeAverages = studentRows.map(r => r.overallAverage).filter((v): v is number => v !== null);
    const classAverage = activeAverages.length > 0 
      ? parseFloat((activeAverages.reduce((a, b) => a + b, 0) / activeAverages.length).toFixed(1)) 
      : 0;

    const totalFaltas = studentRows.reduce((sum, r) => sum + r.totalAbsences, 0);
    const avgPresence = studentRows.length > 0 
      ? Math.round(studentRows.reduce((sum, r) => sum + r.presencePct, 0) / studentRows.length)
      : 100;

    // Níveis de Aprendizagem Distribution
    let belowBasic = 0;  // < 5.0
    let basic = 0;      // 5.0 to 6.9
    let adequate = 0;   // 7.0 to 8.9
    let advanced = 0;   // >= 9.0
    let evaluatedCount = 0;

    studentRows.forEach(r => {
      if (r.overallAverage !== null) {
        evaluatedCount++;
        const avg = r.overallAverage;
        if (avg < 5.0) belowBasic++;
        else if (avg < 7.0) basic++;
        else if (avg < 9.0) adequate++;
        else advanced++;
      }
    });

    const getPct = (count: number) => {
      if (evaluatedCount === 0) return 0;
      return Math.round((count / evaluatedCount) * 100);
    };

    return {
      students: studentRows,
      classAverage,
      totalFaltas,
      avgPresence,
      distribution: {
        belowBasic,
        belowBasicPct: getPct(belowBasic),
        basic,
        basicPct: getPct(basic),
        adequate,
        adequatePct: getPct(adequate),
        advanced,
        advancedPct: getPct(advanced),
        evaluatedCount
      }
    };
  }, [reportData, studentsInClass, selectedSubjectFilter, selectedBimonthly, subjectsInClass]);

  // Find assignment labels for bimonthly work detail view
  const activeAssignmentLabel = useMemo(() => {
    if (!reportData || selectedSubjectFilter === 'all') return null;
    
    const desc = reportData.assignmentDescriptions.find(
      d => String(d.subjectId) === String(selectedSubjectFilter) && Number(d.bimonthly) === Number(selectedBimonthly)
    );

    return {
      t1: desc?.t1 || 'Trabalho 1',
      t2: desc?.t2 || 'Trabalho 2',
      t3: desc?.t3 || 'Trabalho 3',
      t4: desc?.t4 || 'Trabalho 4',
      t5: desc?.t5 || 'Trabalho 5',
    };
  }, [reportData, selectedSubjectFilter, selectedBimonthly]);

  // Detailed assignments deliverable list
  const workComparativeList = useMemo(() => {
    if (!reportData || selectedSubjectFilter === 'all' || studentsInClass.length === 0) return [];

    return studentsInClass.map(student => {
      const record = reportData.bimonthlyGrades.find(
        g => String(g.studentId) === String(student.id) && 
             String(g.subjectId) === String(selectedSubjectFilter) && 
             Number(g.bimonthly) === Number(selectedBimonthly)
      );

      const t1 = record?.t1;
      const t2 = record?.t2;
      const t3 = record?.t3;
      const t4 = record?.t4;
      const t5 = record?.t5;
      const exam = record?.exam;

      const v1 = t1 ?? 0;
      const v2 = t2 ?? 0;
      const v3 = t3 ?? 0;
      const v4 = t4 ?? 0;
      const v5 = t5 ?? 0;
      const worksSum = v1 + v2 + v3 + v4 + v5;

      const { media } = calculateStudentAverage(student.id, selectedSubjectFilter, selectedBimonthly);

      return {
        studentId: student.id,
        studentName: student.name,
        rollNumber: student.rollNumber,
        t1,
        t2,
        t3,
        t4,
        t5,
        worksSum,
        exam,
        media
      };
    });
  }, [reportData, selectedSubjectFilter, selectedBimonthly, studentsInClass]);

  return (
    <div className="space-y-6">
      {/* Sub-tab Navigation */}
      <div className="flex border-b border-zinc-800">
        <button
          onClick={() => setActiveSubTab('individual')}
          className={`px-5 py-3 font-bold text-sm border-b-2 transition flex items-center gap-2 cursor-pointer ${
            activeSubTab === 'individual'
              ? 'border-amber-500 text-amber-500'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Users className="w-4 h-4" />
          Rendimento por Turma
        </button>
        <button
          onClick={() => setActiveSubTab('comparative')}
          className={`px-5 py-3 font-bold text-sm border-b-2 transition flex items-center gap-2 cursor-pointer ${
            activeSubTab === 'comparative'
              ? 'border-amber-500 text-amber-500'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <BarChart2 className="w-4 h-4" />
          Comparativo entre Turmas
        </button>
      </div>

      {activeSubTab === 'comparative' ? (
        <CoordClassComparative
          schools={schools}
          classes={classes}
          students={students}
          subjects={subjects}
          workloads={workloads}
          selectedSchoolId={selectedSchoolId}
          setSelectedSchoolId={setSelectedSchoolId}
          selectedBimonthly={selectedBimonthly}
          setSelectedBimonthly={setSelectedBimonthly}
        />
      ) : (
        <>
          {/* Header Panel */}
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-600/10 border border-amber-500/25 text-amber-500 rounded-xl flex items-center justify-center">
              <BarChart2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-white font-bold text-sm">Controle e Análise de Turmas</h3>
              <p className="text-xs text-zinc-500">Consulte de forma detalhada o rendimento acadêmico, frequências e entregas de trabalhos de cada turma na nuvem.</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => fetchReport(true)}
            disabled={isLoadingReport || isRefreshing || !activeClass}
            className="px-4 py-2 bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-300 hover:text-white font-bold text-xs transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-amber-400' : ''}`} />
            Sincronizar Diários
          </button>
        </div>

        {/* Global Selectors */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t border-zinc-900 mt-6">
          <div>
            <label className="text-[10px] text-zinc-500 font-bold tracking-wider uppercase block mb-2">Selecione a Unidade Escolar:</label>
            <div className="flex flex-wrap gap-2">
              {schools.map(sch => (
                <button
                  key={sch.id}
                  onClick={() => setSelectedSchoolId(sch.id)}
                  className={`px-4 py-2.5 rounded-xl border font-bold text-xs transition flex items-center gap-2 cursor-pointer ${
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

          <div>
            <label className="text-[10px] text-zinc-500 font-bold tracking-wider uppercase block mb-2">Selecione o Ano / Série:</label>
            <div className="flex flex-wrap gap-2">
              {uniqueAnos.map(ano => (
                <button
                  key={ano}
                  onClick={() => setSelectedAno(ano)}
                  className={`px-4 py-2.5 rounded-xl border font-bold text-xs transition cursor-pointer ${
                    selectedAno === ano
                      ? 'border-amber-500 bg-amber-500/10 text-amber-400'
                      : 'border-zinc-800 bg-zinc-950/40 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
                  }`}
                >
                  {ano}
                </button>
              ))}
              {uniqueAnos.length === 0 && (
                <span className="text-xs text-zinc-600 font-mono">Sem anos disponíveis nesta escola...</span>
              )}
            </div>
          </div>

          <div>
            <label className="text-[10px] text-zinc-500 font-bold tracking-wider uppercase block mb-2">Selecione a Turma:</label>
            <div className="flex flex-wrap gap-2">
              {uniqueTurmas.map(turma => (
                <button
                  key={turma}
                  onClick={() => setSelectedTurma(turma)}
                  className={`px-4 py-2.5 rounded-xl border font-bold text-xs transition cursor-pointer ${
                    selectedTurma === turma
                      ? 'border-amber-500 bg-amber-500/10 text-amber-400'
                      : 'border-zinc-800 bg-zinc-950/40 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
                  }`}
                >
                  {turma}
                </button>
              ))}
              {uniqueTurmas.length === 0 && (
                <span className="text-xs text-zinc-600 font-mono">Nenhuma turma cadastrada neste ano...</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Report Dashboard */}
      {activeClass ? (
        <div className="space-y-6">
          {/* Active Class Header Card */}
          <div className="bg-zinc-900 border border-zinc-850 rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest mb-1">Coordenação • Relatórios de Turma</div>
              <h2 className="text-white text-xl font-black">Turma: {selectedAno} {selectedTurma}</h2>
              <p className="text-xs text-zinc-400">Relatório detalhado consolidando as notas e faltas dos diários do professor.</p>
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
                onClick={() => setSelectedSubjectFilter('all')}
                className={`px-4 py-2 rounded-xl border font-bold text-xs transition cursor-pointer ${
                  selectedSubjectFilter === 'all'
                    ? 'border-amber-500 bg-amber-500/10 text-amber-400'
                    : 'border-zinc-850 bg-zinc-900/40 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Todas
              </button>
              {subjectsInClass.map(subj => (
                <button
                  key={subj.id}
                  onClick={() => setSelectedSubjectFilter(subj.id)}
                  className={`px-4 py-2 rounded-xl border font-bold text-xs transition cursor-pointer ${
                    selectedSubjectFilter === subj.id
                      ? 'border-amber-500 bg-amber-500/10 text-amber-400'
                      : 'border-zinc-850 bg-zinc-900/40 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {subj.name}
                </button>
              ))}
            </div>
          </div>

          {/* Load Indicators */}
          {isLoadingReport ? (
            <div className="bg-zinc-900 border border-zinc-850 rounded-2xl py-20 flex flex-col items-center justify-center text-center">
              <RefreshCw className="w-8 h-8 text-amber-500 animate-spin mb-4" />
              <span className="text-zinc-400 text-sm font-bold">Consultando registros acadêmicos na nuvem...</span>
              <p className="text-xs text-zinc-500 mt-1 max-w-sm">Esta operação cruza os diários de todos os professores vinculados a esta turma.</p>
            </div>
          ) : reportError ? (
            <div className="bg-red-500/5 border border-red-500/20 p-6 rounded-2xl text-center space-y-3">
              <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto" />
              <div className="text-sm font-bold text-rose-400">Falha ao obter dados</div>
              <p className="text-xs text-zinc-400 max-w-md mx-auto">Não foi possível recuperar os dados de notas e frequências da nuvem para os diários desta turma. Verifique sua conexão com a internet e tente novamente.</p>
              <button
                onClick={() => fetchReport()}
                className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-rose-400 border border-red-500/20 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Tentar Novamente
              </button>
            </div>
          ) : classAnalytics ? (
            <div className="space-y-6">
              {/* Metric Cards Row */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. Students Count */}
                <div className="bg-zinc-900 border border-zinc-850 p-5 rounded-2xl flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-xl flex items-center justify-center shrink-0">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-wide block">Alunos</span>
                    <span className="text-white text-xl font-black block">{classAnalytics.students.length}</span>
                    <span className="text-[9px] text-zinc-500 block">Matriculados</span>
                  </div>
                </div>

                {/* 2. Mean average grade */}
                <div className="bg-zinc-900 border border-zinc-850 p-5 rounded-2xl flex items-center gap-4">
                  <div className="w-12 h-12 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl flex items-center justify-center shrink-0">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-wide block">Média Notas</span>
                    <span className={`text-xl font-black block ${classAnalytics.classAverage >= 7.0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {classAnalytics.classAverage || '-'}
                    </span>
                    <span className="text-[9px] text-zinc-500 block">Geral da Classe</span>
                  </div>
                </div>

                {/* 3. Presence Percent */}
                <div className="bg-zinc-900 border border-zinc-850 p-5 rounded-2xl flex items-center gap-4">
                  <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-wide block">Presença</span>
                    <span className={`text-xl font-black block ${classAnalytics.avgPresence >= 75 ? 'text-emerald-400' : 'text-rose-400 font-extrabold'}`}>
                      {classAnalytics.avgPresence}%
                    </span>
                    <span className="text-[9px] text-zinc-500 block">Frequência Média</span>
                  </div>
                </div>

                {/* 4. Absences Count */}
                <div className="bg-zinc-900 border border-zinc-850 p-5 rounded-2xl flex items-center gap-4">
                  <div className="w-12 h-12 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-wide block">Faltas</span>
                    <span className="text-white text-xl font-black block text-rose-400">{classAnalytics.totalFaltas}</span>
                    <span className="text-[9px] text-zinc-500 block">Absenteísmo Total</span>
                  </div>
                </div>
              </div>

              {/* Toggle view controls */}
              <div className="bg-zinc-900 border border-zinc-850 rounded-2xl p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <span className="text-white text-xs font-bold pl-2.5">Opções de Visualização</span>
                <div className="flex bg-zinc-950 p-1 rounded-xl border border-zinc-850 self-start sm:self-auto shrink-0">
                  <button
                    onClick={() => setViewMode('geral')}
                    className={`px-5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                      viewMode === 'geral'
                        ? 'bg-amber-500 text-zinc-950 shadow'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <BarChart2 className="w-3.5 h-3.5 animate-pulse" />
                    Visão Geral
                  </button>
                  <button
                    onClick={() => setViewMode('trabalhos')}
                    className={`px-5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                      viewMode === 'trabalhos'
                        ? 'bg-amber-500 text-zinc-950 shadow'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <CheckSquare className="w-3.5 h-3.5" />
                    Comparativo Trabalhos
                  </button>
                </div>
              </div>

              {/* View 1: Visão Geral */}
              {viewMode === 'geral' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left Column: Learning Levels (Níveis de Aprendizagem) */}
                  <div className="bg-zinc-900 border border-zinc-850 p-6 rounded-2xl space-y-6 lg:col-span-1">
                    <div>
                      <h4 className="text-white font-bold text-sm flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-amber-500" />
                        Níveis de Aprendizagem
                      </h4>
                      <p className="text-xs text-zinc-500 mt-1">Desempenho Geral de todas as matérias</p>
                    </div>

                    <div className="space-y-4">
                      {/* 1. Abaixo do Básico */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs text-zinc-300">
                          <span className="flex items-center gap-1.5 font-bold">
                            <span className="w-2 h-2 rounded-full bg-rose-500" />
                            Abaixo do Básico <span className="text-[10px] text-zinc-500 font-normal">(&lt; 5,0)</span>
                          </span>
                          <span className="font-mono text-zinc-400">{classAnalytics.distribution.belowBasic} alunos ({classAnalytics.distribution.belowBasicPct}%)</span>
                        </div>
                        <div className="h-2 w-full bg-zinc-950 rounded-full overflow-hidden">
                          <div className="h-full bg-rose-500 transition-all duration-500" style={{ width: `${classAnalytics.distribution.belowBasicPct}%` }} />
                        </div>
                      </div>

                      {/* 2. Básico */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs text-zinc-300">
                          <span className="flex items-center gap-1.5 font-bold">
                            <span className="w-2 h-2 rounded-full bg-amber-500" />
                            Básico <span className="text-[10px] text-zinc-500 font-normal">(5,0 a 6,9)</span>
                          </span>
                          <span className="font-mono text-zinc-400">{classAnalytics.distribution.basic} alunos ({classAnalytics.distribution.basicPct}%)</span>
                        </div>
                        <div className="h-2 w-full bg-zinc-950 rounded-full overflow-hidden">
                          <div className="h-full bg-amber-500 transition-all duration-500" style={{ width: `${classAnalytics.distribution.basicPct}%` }} />
                        </div>
                      </div>

                      {/* 3. Adequado */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs text-zinc-300">
                          <span className="flex items-center gap-1.5 font-bold">
                            <span className="w-2 h-2 rounded-full bg-blue-500" />
                            Adequado <span className="text-[10px] text-zinc-500 font-normal">(7,0 a 8,9)</span>
                          </span>
                          <span className="font-mono text-zinc-400">{classAnalytics.distribution.adequate} alunos ({classAnalytics.distribution.adequatePct}%)</span>
                        </div>
                        <div className="h-2 w-full bg-zinc-950 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${classAnalytics.distribution.adequatePct}%` }} />
                        </div>
                      </div>

                      {/* 4. Avançado */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs text-zinc-300">
                          <span className="flex items-center gap-1.5 font-bold">
                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                            Avançado <span className="text-[10px] text-zinc-500 font-normal">(&gt;= 9,0)</span>
                          </span>
                          <span className="font-mono text-zinc-400">{classAnalytics.distribution.advanced} alunos ({classAnalytics.distribution.advancedPct}%)</span>
                        </div>
                        <div className="h-2 w-full bg-zinc-950 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${classAnalytics.distribution.advancedPct}%` }} />
                        </div>
                      </div>
                    </div>

                    {/* Unified Class Bar (Visão Unificada da Turma) */}
                    <div className="pt-4 border-t border-zinc-850 space-y-2">
                      <span className="text-[10px] text-zinc-500 font-bold tracking-wider uppercase block">Visão Unificada da Turma</span>
                      <div className="h-4 w-full bg-zinc-950 rounded-xl overflow-hidden flex">
                        {classAnalytics.distribution.belowBasicPct > 0 && (
                          <div className="h-full bg-rose-500 transition-all duration-500" style={{ width: `${classAnalytics.distribution.belowBasicPct}%` }} />
                        )}
                        {classAnalytics.distribution.basicPct > 0 && (
                          <div className="h-full bg-amber-500 transition-all duration-500" style={{ width: `${classAnalytics.distribution.basicPct}%` }} />
                        )}
                        {classAnalytics.distribution.adequatePct > 0 && (
                          <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${classAnalytics.distribution.adequatePct}%` }} />
                        )}
                        {classAnalytics.distribution.advancedPct > 0 && (
                          <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${classAnalytics.distribution.advancedPct}%` }} />
                        )}
                        {classAnalytics.distribution.evaluatedCount === 0 && (
                          <div className="h-full w-full bg-zinc-950 text-center text-[10px] text-zinc-600 font-bold self-center">Nenhum dado lançado</div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Student Performance Table (Quadro de Rendimento por Aluno) */}
                  <div className="bg-zinc-900 border border-zinc-850 p-6 rounded-2xl lg:col-span-2 space-y-4">
                    <div>
                      <h4 className="text-white font-bold text-sm">Quadro de Rendimento por Aluno</h4>
                      <p className="text-xs text-zinc-500 mt-1">
                        {selectedSubjectFilter === 'all' 
                          ? 'Lista completa com as médias gerais e frequências consolidadas de todas as disciplinas.' 
                          : `Rendimento individual na disciplina de ${subjectsInClass.find(s => String(s.id) === String(selectedSubjectFilter))?.name}.`
                        }
                      </p>
                    </div>

                    <div className="overflow-x-auto border border-zinc-850 rounded-2xl bg-zinc-950/20 max-h-[400px] overflow-y-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-zinc-950/60 border-b border-zinc-850 text-zinc-500 text-[10px] font-bold tracking-wider uppercase">
                            <th className="py-3 px-4 text-center w-12">Nº</th>
                            <th className="py-3 px-4">Aluno</th>
                            <th className="py-3 px-4 text-center w-24">Média</th>
                            <th className="py-3 px-4 text-center w-24">Presença</th>
                            <th className="py-3 px-4 text-center w-20">Faltas</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-900 text-xs">
                          {classAnalytics.students.map(row => {
                            const isBelowPassing = row.overallAverage !== null && row.overallAverage < 7.0;
                            const isAbsentRisk = row.presencePct < 75;

                            return (
                              <tr key={row.studentId} className="hover:bg-zinc-900/40 text-zinc-300">
                                <td className="py-2.5 px-4 text-center font-mono text-zinc-500">{row.rollNumber}</td>
                                <td className="py-2.5 px-4 font-semibold text-zinc-200">{row.studentName}</td>
                                <td className="py-2.5 px-4 text-center">
                                  {row.overallAverage !== null ? (
                                    <span className={`font-mono font-black px-2 py-1 rounded ${
                                      isBelowPassing ? 'bg-red-500/10 text-rose-400' : 'bg-emerald-500/10 text-emerald-400'
                                    }`}>
                                      {row.overallAverage.toFixed(1)}
                                    </span>
                                  ) : (
                                    <span className="text-zinc-600 font-mono">-</span>
                                  )}
                                </td>
                                <td className="py-2.5 px-4 text-center">
                                  <span className={`font-mono font-bold flex items-center justify-center gap-1 ${
                                    isAbsentRisk ? 'text-rose-400 font-black' : 'text-zinc-400'
                                  }`}>
                                    {row.presencePct}% {isAbsentRisk && <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0" />}
                                  </span>
                                </td>
                                <td className="py-2.5 px-4 text-center font-mono text-rose-400 font-bold">{row.totalAbsences}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* View 2: Comparativo Trabalhos (T1 a T5) */}
              {viewMode === 'trabalhos' && (
                <div className="bg-zinc-900 border border-zinc-850 p-6 rounded-2xl space-y-6">
                  {selectedSubjectFilter === 'all' ? (
                    <div className="bg-zinc-950 border border-zinc-850 p-8 rounded-2xl text-center max-w-lg mx-auto flex flex-col items-center justify-center space-y-3">
                      <Info className="w-8 h-8 text-amber-500" />
                      <div className="text-sm font-bold text-zinc-200">Seleção de Disciplina Requerida</div>
                      <p className="text-xs text-zinc-400 leading-relaxed">
                        Para visualizar o quadro detalhado de entrega de trabalhos bimestrais (T1 a T5), você precisa selecionar uma disciplina específica no filtro acima.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Card Header for Assignment list */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-850 pb-4">
                        <div>
                          <h4 className="text-white font-bold text-sm flex items-center gap-2">
                            <CheckSquare className="w-4 h-4 text-amber-500" />
                            Comparativo de Entregas
                          </h4>
                          <p className="text-xs text-zinc-500 mt-1">
                            {subjectsInClass.find(s => String(s.id) === String(selectedSubjectFilter))?.name} — {selectedBimonthly}º Bimestre
                          </p>
                        </div>
                        <span className="px-3 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 font-mono text-[10px] font-bold rounded-xl tracking-wider shrink-0 self-start sm:self-auto">T1 - T5</span>
                      </div>

                      {/* Display legend of assignment descriptions */}
                      {activeAssignmentLabel && (
                        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 bg-zinc-950/40 p-4 rounded-xl border border-zinc-850/60 text-[10px] text-zinc-500">
                          <div><span className="font-bold text-zinc-400 block mb-0.5">T1:</span> {activeAssignmentLabel.t1}</div>
                          <div><span className="font-bold text-zinc-400 block mb-0.5">T2:</span> {activeAssignmentLabel.t2}</div>
                          <div><span className="font-bold text-zinc-400 block mb-0.5">T3:</span> {activeAssignmentLabel.t3}</div>
                          <div><span className="font-bold text-zinc-400 block mb-0.5">T4:</span> {activeAssignmentLabel.t4}</div>
                          <div><span className="font-bold text-zinc-400 block mb-0.5">T5:</span> {activeAssignmentLabel.t5}</div>
                        </div>
                      )}

                      {/* Deliverables Table */}
                      <div className="overflow-x-auto border border-zinc-850 rounded-2xl bg-zinc-950/20 max-h-[450px] overflow-y-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-zinc-950/60 border-b border-zinc-850 text-zinc-500 text-[10px] font-bold tracking-wider uppercase">
                              <th className="py-3.5 px-4 text-center w-12">Nº</th>
                              <th className="py-3.5 px-4">Aluno</th>
                              <th className="py-3.5 px-3 text-center w-16">T1</th>
                              <th className="py-3.5 px-3 text-center w-16">T2</th>
                              <th className="py-3.5 px-3 text-center w-16">T3</th>
                              <th className="py-3.5 px-3 text-center w-16">T4</th>
                              <th className="py-3.5 px-3 text-center w-16">T5</th>
                              <th className="py-3.5 px-3 text-center w-20 bg-zinc-900/40">Soma</th>
                              <th className="py-3.5 px-3 text-center w-20">Prova</th>
                              <th className="py-3.5 px-4 text-center w-24 border-l border-zinc-850">Média</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-900 text-xs">
                            {workComparativeList.map(row => {
                              const isBelowPassing = row.media !== null && row.media < 7.0;

                              const formatWork = (val: number | undefined) => {
                                if (val === undefined) return <span className="text-zinc-700">-</span>;
                                if (val === 0) return <span className="text-rose-500 font-bold">0,0</span>;
                                return <span className="text-emerald-500 font-semibold">{val.toFixed(1).replace('.', ',')}</span>;
                              };

                              return (
                                <tr key={row.studentId} className="hover:bg-zinc-900/40 text-zinc-300">
                                  <td className="py-2.5 px-4 text-center font-mono text-zinc-500">{row.rollNumber}</td>
                                  <td className="py-2.5 px-4 font-semibold text-zinc-200">{row.studentName}</td>
                                  <td className="py-2.5 px-3 text-center font-mono">{formatWork(row.t1)}</td>
                                  <td className="py-2.5 px-3 text-center font-mono">{formatWork(row.t2)}</td>
                                  <td className="py-2.5 px-3 text-center font-mono">{formatWork(row.t3)}</td>
                                  <td className="py-2.5 px-3 text-center font-mono">{formatWork(row.t4)}</td>
                                  <td className="py-2.5 px-3 text-center font-mono">{formatWork(row.t5)}</td>
                                  <td className="py-2.5 px-3 text-center font-mono bg-zinc-900/40 text-zinc-400">{row.worksSum.toFixed(1).replace('.', ',')}</td>
                                  <td className="py-2.5 px-3 text-center font-mono">
                                    {row.exam !== undefined ? (
                                      <span className="text-zinc-300">{row.exam.toFixed(1).replace('.', ',')}</span>
                                    ) : (
                                      <span className="text-zinc-700">-</span>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-4 text-center border-l border-zinc-850">
                                    {row.media !== null ? (
                                      <span className={`font-mono font-black px-2 py-1 rounded ${
                                        isBelowPassing ? 'bg-red-500/10 text-rose-400' : 'bg-emerald-500/10 text-emerald-400'
                                      }`}>
                                        {row.media.toFixed(1).replace('.', ',')}
                                      </span>
                                    ) : (
                                      <span className="text-zinc-600 font-mono">-</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-zinc-900 border border-zinc-850 rounded-2xl py-20 flex flex-col items-center justify-center text-center max-w-md mx-auto">
              <div className="w-14 h-14 bg-zinc-950 rounded-2xl border border-zinc-850 flex items-center justify-center mb-4 text-amber-500">
                <BarChart2 className="w-7 h-7" />
              </div>
              <h3 className="text-white font-bold text-base mb-2">Carregar Dados de Controle</h3>
              <p className="text-zinc-400 text-xs leading-relaxed">
                Clique no botão de sincronização no topo ou selecione outra turma para baixar as notas e faltas sincronizadas na nuvem para os diários.
              </p>
              <button
                onClick={() => fetchReport()}
                className="mt-6 px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-xl transition flex items-center gap-2 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                Buscar Notas da Nuvem
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-zinc-900 border border-zinc-850 rounded-2xl py-20 text-center max-w-md mx-auto">
          <div className="w-14 h-14 bg-zinc-950 rounded-2xl border border-zinc-850 flex items-center justify-center mb-4 text-amber-500 mx-auto">
            <School className="w-7 h-7" />
          </div>
          <h3 className="text-white font-bold text-base mb-2">Seleção de Turma Pendente</h3>
          <p className="text-zinc-400 text-xs leading-relaxed px-6">
            Por favor, selecione a **Unidade Escolar**, o **Ano / Série** e a **Turma** nos filtros superiores para carregar os relatórios unificados de rendimento e presença da classe.
          </p>
        </div>
      )}
        </>
      )}
    </div>
  );
}
