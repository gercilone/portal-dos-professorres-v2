import React, { useState, useEffect } from 'react';
import { 
  getGlobalSchools, 
  getGlobalClasses, 
  getGlobalSubjects, 
  getGlobalWorkloads,
  getGlobalGradesControl,
  saveGlobalGradesControl,
  getGlobalStudents,
  getClassReportData,
  GlobalSchool,
  GlobalClass,
  GlobalSubject,
  GlobalWorkload,
  GlobalGradesControl,
  GlobalStudent,
  getActiveCoordinatorSchoolId
} from '../firebase';
import { 
  ClipboardCheck, 
  CheckCircle2, 
  Circle, 
  Loader2, 
  School, 
  BookOpen, 
  RefreshCw,
  AlertCircle,
  Check
} from 'lucide-react';

export default function CoordGradesControl() {
  const [schools, setSchools] = useState<GlobalSchool[]>([]);
  const [classes, setClasses] = useState<GlobalClass[]>([]);
  const [subjects, setSubjects] = useState<GlobalSubject[]>([]);
  const [workloads, setWorkloads] = useState<GlobalWorkload[]>([]);
  const [gradesControl, setGradesControl] = useState<GlobalGradesControl[]>([]);
  const [students, setStudents] = useState<GlobalStudent[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>('');
  
  const [selectedAno, setSelectedAno] = useState<string>('');
  const [selectedTurma, setSelectedTurma] = useState<string>('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const [classReport, setClassReport] = useState<{
    bimonthlyGrades: any[];
    extraGrades: any[];
    attendance: any[];
    lessons: any[];
    assignmentDescriptions: any[];
  } | null>(null);
  const [isLoadingReport, setIsLoadingReport] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async (showRefreshIndicator = false) => {
    if (showRefreshIndicator) setIsSaving(true);
    else setIsLoading(true);
    
    try {
      const [schs, cls, subs, wls, gcs, stds] = await Promise.all([
        getGlobalSchools(),
        getGlobalClasses(),
        getGlobalSubjects(),
        getGlobalWorkloads(),
        getGlobalGradesControl(),
        getGlobalStudents()
      ]);
      setSchools(schs);
      setClasses(cls);
      setSubjects(subs);
      setWorkloads(wls);
      setGradesControl(gcs);
      setStudents(stds);
      
      const restrictedSchoolId = getActiveCoordinatorSchoolId();
      if (restrictedSchoolId) {
        setSelectedSchoolId(restrictedSchoolId);
      } else if (schs.length > 0 && !selectedSchoolId) {
        setSelectedSchoolId(schs[0].id);
      }
      
      if (showRefreshIndicator) {
        showMsg('Dados atualizados da nuvem com sucesso!', 'success');
      }
    } catch (err) {
      console.error(err);
      showMsg('Erro ao carregar dados de controle da nuvem.', 'error');
    } finally {
      setIsLoading(false);
      setIsSaving(false);
    }
  };

  const showMsg = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 5000);
  };

  // Helper to parse class name into "Ano" and "Turma"
  const parseClass = (className: string) => {
    const normalized = className.trim();
    
    // Match "Xº Ano" or "Xº ano" or "Xo Ano" or "Xo ano" or "Xº série"
    const anoMatch = normalized.match(/(\d+º?\s*(?:Ano|ano|série|serie))/i) || normalized.match(/(\d+\s*º?\s*(?:Ano|ano))/i);
    let ano = '';
    if (anoMatch) {
      ano = anoMatch[0];
    } else {
      // Fallback
      const firstPart = normalized.split('-')[0].trim();
      const words = firstPart.split(' ');
      ano = words.slice(0, 2).join(' ');
    }

    // Try to find letter e.g., "A", "B", "C", "D", "E"
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
  const schoolClasses = classes.filter(c => c.schoolId === selectedSchoolId);

  // Extract unique Anos
  const uniqueAnosSet = new Set<string>();
  schoolClasses.forEach(c => {
    const { ano } = parseClass(c.name);
    if (ano) uniqueAnosSet.add(ano);
  });

  const uniqueAnos = Array.from(uniqueAnosSet).sort((a, b) => {
    const numA = parseInt(a) || 0;
    const numB = parseInt(b) || 0;
    return numA - numB;
  });

  // Extract unique Turmas for the selected Ano only
  const uniqueTurmasSet = new Set<string>();
  schoolClasses.forEach(c => {
    const { ano, letter } = parseClass(c.name);
    if (ano === selectedAno && letter) {
      uniqueTurmasSet.add(letter);
    }
  });

  const uniqueTurmas = Array.from(uniqueTurmasSet).sort();

  // Set default selections
  useEffect(() => {
    if (uniqueAnos.length > 0 && !selectedAno) {
      setSelectedAno(uniqueAnos[0]);
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

  // Find exact class or fallback
  const activeClass = schoolClasses.find(c => {
    const { ano, letter } = parseClass(c.name);
    return ano === selectedAno && letter === selectedTurma;
  });

  const fallbackClass = schoolClasses.find(c => {
    const { ano } = parseClass(c.name);
    return ano === selectedAno;
  });

  const currentClass = activeClass || fallbackClass;

  // Find subjects for active class workloads
  const classWorkloads = currentClass ? workloads.filter(w => w.classId === currentClass.id) : [];
  const classSubjects = subjects.filter(s => 
    classWorkloads.some(w => w.subjectId === s.id)
  );

  // Fetch class report data from teachers diaries
  useEffect(() => {
    const fetchClassReport = async () => {
      if (!currentClass?.id) {
        setClassReport(null);
        return;
      }
      setIsLoadingReport(true);
      try {
        const classStudents = students.filter(st => st.classId === currentClass.id);
        const classWls = workloads.filter(w => w.classId === currentClass.id);
        const data = await getClassReportData(currentClass.id, classStudents, classWls);
        setClassReport(data);
      } catch (err) {
        console.error('Error fetching class report for grades control:', err);
      } finally {
        setIsLoadingReport(false);
      }
    };
    fetchClassReport();
  }, [currentClass?.id, students, workloads]);

  // Helper to check if grades have been registered in the database
  const hasLaunchedGrades = (subjectId: string, colKey: string) => {
    if (!classReport) return false;

    if (['1b', '2b', '3b', '4b'].includes(colKey)) {
      const bimNum = parseInt(colKey); // 1, 2, 3, 4
      return classReport.bimonthlyGrades.some(
        g => String(g.subjectId) === String(subjectId) && 
             Number(g.bimonthly) === Number(bimNum) &&
             (g.t1 !== undefined || g.t2 !== undefined || g.t3 !== undefined || g.t4 !== undefined || g.t5 !== undefined || g.exam !== undefined)
      );
    } else if (colKey === 'r1') {
      return classReport.extraGrades.some(
        g => String(g.subjectId) === String(subjectId) && g.recSem1 !== undefined && g.recSem1 !== null
      );
    } else if (colKey === 'r2') {
      return classReport.extraGrades.some(
        g => String(g.subjectId) === String(subjectId) && g.recSem2 !== undefined && g.recSem2 !== null
      );
    } else if (colKey === 'pf') {
      return classReport.extraGrades.some(
        g => String(g.subjectId) === String(subjectId) && g.finalExam !== undefined && g.finalExam !== null
      );
    }
    return false;
  };

  // Fallback if no subjects are linked to the class
  const displaySubjects = classSubjects.length > 0 
    ? classSubjects 
    : subjects.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

  const bimonthlyColumns = [
    { key: '1b', label: '1º B' },
    { key: '2b', label: '2º B' },
    { key: 'r1', label: 'R1' },
    { key: '3b', label: '3º B' },
    { key: '4b', label: '4º B' },
    { key: 'r2', label: 'R2' },
    { key: 'pf', label: 'PF' }
  ];

  const handleToggleStatus = async (subjectId: string, columnKey: string) => {
    if (!currentClass || !currentClass.id) return;
    
    const entryId = `${currentClass.id}_${subjectId}_${columnKey}`;
    const existingEntry = gradesControl.find(g => g.id === entryId);
    const isCurrentlyReceived = existingEntry ? existingEntry.received : false;
    const newReceivedState = !isCurrentlyReceived;
    
    const updatedEntry: GlobalGradesControl = {
      id: entryId,
      classId: currentClass.id,
      subjectId,
      bimonthly: columnKey,
      received: newReceivedState,
      updatedAt: Date.now()
    };
    
    // Toggle locally for instant visual response
    setGradesControl(prev => {
      const filtered = prev.filter(g => g.id !== entryId);
      if (newReceivedState) {
        return [...filtered, updatedEntry];
      }
      return filtered;
    });

    try {
      await saveGlobalGradesControl(updatedEntry);
      
      // Mark global changes unsaved
      localStorage.setItem('portal_has_unsaved_changes', 'true');
      window.dispatchEvent(new Event('storage'));
    } catch (err) {
      console.error(err);
      showMsg('Erro ao salvar alteração na nuvem.', 'error');
      // Revert state
      const refreshed = await getGlobalGradesControl();
      setGradesControl(refreshed);
    }
  };

  return (
    <div className="space-y-6" id="grades-control-container">
      {/* Top action header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <ClipboardCheck className="w-6 h-6 text-amber-500" /> Controle de Entrega de Notas
          </h2>
          <p className="text-xs text-zinc-500">Acompanhe e gerencie quais relatórios de notas bimestrais já foram entregues pelos professores.</p>
        </div>

        <button
          type="button"
          onClick={() => loadData(true)}
          disabled={isLoading || isSaving}
          className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs px-3 py-2 rounded-lg border border-zinc-700/50 flex items-center gap-2 transition cursor-pointer disabled:opacity-50"
        >
          {isSaving ? (
            <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
          ) : (
            <RefreshCw className="w-4 h-4 text-zinc-400" />
          )}
          Sincronizar Nuvem
        </button>
      </div>

      {/* Message banners */}
      {message && (
        <div 
          className={`p-3 rounded-xl border text-xs flex items-center gap-2 animate-in fade-in duration-200 ${
            message.type === 'success' 
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
              : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
          }`}
        >
          {message.type === 'success' ? (
            <Check className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
          <p className="text-xs text-zinc-500">Carregando dados de entrega de notas...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Filters Card */}
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl space-y-4">
            {/* School filter (if multiple schools exist) */}
            {schools.length > 1 && (
              <div className="space-y-2">
                <span className="text-[11px] font-bold tracking-wider text-zinc-500 uppercase">Selecione a Unidade Escolar:</span>
                <div className="flex flex-wrap gap-2">
                  {schools.map(sch => (
                    <button
                      key={sch.id}
                      onClick={() => {
                        setSelectedSchoolId(sch.id);
                        setSelectedAno('');
                        setSelectedTurma('');
                      }}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition cursor-pointer ${
                        selectedSchoolId === sch.id
                          ? 'bg-amber-600/10 border-amber-500 text-amber-400'
                          : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-300'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <School className="w-3.5 h-3.5" />
                        {sch.name}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Year selector */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold tracking-wider text-zinc-500 uppercase">Selecione o Ano / Série:</span>
              <div className="flex flex-wrap gap-2">
                {uniqueAnos.length === 0 ? (
                  <p className="text-xs text-zinc-500 italic">Nenhum ano identificado nas turmas do sistema.</p>
                ) : (
                  uniqueAnos.map(ano => (
                    <button
                      key={ano}
                      onClick={() => setSelectedAno(ano)}
                      className={`px-4 py-2 text-xs font-bold rounded-lg border transition cursor-pointer ${
                        selectedAno === ano
                          ? 'bg-amber-600 border-amber-500 text-white shadow-lg shadow-amber-500/10'
                          : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-300'
                      }`}
                    >
                      {ano}
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Turma selector */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold tracking-wider text-zinc-500 uppercase">Selecione a Turma:</span>
              <div className="flex flex-wrap gap-2">
                {uniqueTurmas.length === 0 ? (
                  <p className="text-xs text-zinc-500 italic">Nenhuma turma identificada no sistema.</p>
                ) : (
                  uniqueTurmas.map(turma => (
                    <button
                      key={turma}
                      onClick={() => setSelectedTurma(turma)}
                      className={`px-4 py-2 text-xs font-bold rounded-lg border transition cursor-pointer ${
                        selectedTurma === turma
                          ? 'bg-amber-600/20 border-amber-500 text-amber-400 shadow-lg shadow-amber-500/5'
                          : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-300'
                      }`}
                    >
                      {turma}
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Active Class Info Banner */}
          {currentClass && (
            <div className="bg-zinc-950/60 border border-zinc-800/80 px-4 py-3 rounded-xl text-zinc-400 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>
                  Visualizando diário de: <strong>{currentClass.name}</strong>
                  {isLoadingReport && <span className="ml-2 text-zinc-500 italic">(Verificando notas lançadas na nuvem...)</span>}
                </span>
              </div>
              <span className="text-[10px] text-zinc-600 font-mono">
                ID da Turma: {currentClass.id}
              </span>
            </div>
          )}

          {/* Grid Table Card */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-900/50">
                    <th className="p-4 text-xs font-bold text-zinc-400 tracking-wider">Disciplina</th>
                    {bimonthlyColumns.map(col => (
                      <th key={col.key} className="p-4 text-center text-xs font-bold text-zinc-400 tracking-wider">
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {displaySubjects.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-xs text-zinc-500 italic">
                        Nenhuma disciplina cadastrada para esta turma ou no sistema.
                      </td>
                    </tr>
                  ) : (
                    displaySubjects.map(sub => {
                      // Find if a workload exists and has a teacher assigned
                      const wl = classWorkloads.find(w => w.subjectId === sub.id);
                      const teacherName = wl?.teacherUsername ? `@${wl.teacherUsername}` : '';

                      return (
                        <tr key={sub.id} className="hover:bg-zinc-900/40 transition">
                          <td className="p-4">
                            <div className="flex flex-col">
                              <span className="text-sm font-semibold text-white">{sub.name}</span>
                              {teacherName && (
                                <span className="text-[10px] text-zinc-500">{teacherName}</span>
                              )}
                            </div>
                          </td>
                          {bimonthlyColumns.map(col => {
                            const entryId = currentClass ? `${currentClass.id}_${sub.id}_${col.key}` : '';
                            const entry = gradesControl.find(g => g.id === entryId);
                            const isManualReceived = entry ? entry.received : false;
                            const isAutoDetected = hasLaunchedGrades(sub.id, col.key);
                            const isReceived = isManualReceived || isAutoDetected;

                            return (
                              <td key={col.key} className="p-4 text-center">
                                <div className="flex flex-col items-center justify-center">
                                  <button
                                    type="button"
                                    onClick={() => handleToggleStatus(sub.id, col.key)}
                                    disabled={!currentClass}
                                    title={isAutoDetected 
                                      ? `Notas auto-detectadas no diário do professor para ${col.label} de ${sub.name}. Clique para alternar estado manual.`
                                      : `Marcar ${col.label} de ${sub.name} como ${isReceived ? 'Pendente' : 'Recebido'}`}
                                    className="mx-auto flex items-center justify-center p-1 rounded-full hover:bg-zinc-800 transition cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
                                  >
                                    {isAutoDetected ? (
                                      <div className="flex flex-col items-center justify-center gap-0.5">
                                        <CheckCircle2 className="w-5 h-5 text-emerald-400 animate-in zoom-in-75 duration-200" />
                                        <span className="text-[7px] text-emerald-400 font-bold uppercase tracking-widest leading-none">Lançado</span>
                                      </div>
                                    ) : isManualReceived ? (
                                      <div className="flex flex-col items-center justify-center gap-0.5">
                                        <CheckCircle2 className="w-5 h-5 text-amber-500 animate-in zoom-in-75 duration-200" />
                                        <span className="text-[7px] text-amber-500 font-bold uppercase tracking-widest leading-none">Manual</span>
                                      </div>
                                    ) : (
                                      <Circle className="w-5 h-5 text-zinc-600 hover:text-amber-500/60 transition" />
                                    )}
                                  </button>
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer Legend */}
            <div className="p-4 bg-zinc-950 border-t border-zinc-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-zinc-400">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Sincronizado (Notas Lançadas no Diário)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-amber-500" />
                  <span>Entregue Manual</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Circle className="w-4 h-4 text-zinc-600" />
                  <span>Pendente</span>
                </div>
                <div className="text-zinc-500">
                  <span>• R1/R2: Recuperações Semestrais • PF: Recuperação da Prova Final</span>
                </div>
              </div>
              
              <div className="text-[10px] text-zinc-500 font-mono">
                {gradesControl.filter(g => g.received).length} relatórios recebidos no total
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
