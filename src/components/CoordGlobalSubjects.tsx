import React, { useState, useEffect } from 'react';
import {
  GlobalSchool,
  GlobalClass,
  GlobalSubject,
  GlobalWorkload,
  getGlobalSchools,
  getGlobalClasses,
  getGlobalSubjects,
  saveGlobalSubject,
  deleteGlobalSubject,
  getGlobalWorkloads,
  saveGlobalWorkload,
  deleteGlobalWorkload,
  syncProfessorsListInCloud,
  ProfessorAccount
} from '../firebase';
import {
  Plus,
  Trash2,
  Edit2,
  X,
  BookOpen,
  Calendar,
  Sparkles,
  Check,
  AlertTriangle,
  School as SchoolIcon,
  ChevronRight,
  Clock
} from 'lucide-react';
import { sortClasses } from '../types';

export default function CoordGlobalSubjects() {
  // Lists from cloud
  const [schools, setSchools] = useState<GlobalSchool[]>([]);
  const [classes, setClasses] = useState<GlobalClass[]>([]);
  const [subjects, setSubjects] = useState<GlobalSubject[]>([]);
  const [workloads, setWorkloads] = useState<GlobalWorkload[]>([]);
  const [professors, setProfessors] = useState<ProfessorAccount[]>([]);

  // Selection states
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>('');
  const [selectedClassId, setSelectedClassId] = useState<string>('');

  // Loading states
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Form states - Subject
  const [newSubjectName, setNewSubjectName] = useState('');
  const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null);
  const [editingSubjectName, setEditingSubjectName] = useState('');

  // Form states - Workload
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [workloadLessons, setWorkloadLessons] = useState<number>(80);
  const [editingWorkloadId, setEditingWorkloadId] = useState<string | null>(null);
  const [editingWorkloadLessons, setEditingWorkloadLessons] = useState<number | ''>('');
  const [selectedTeacherUsername, setSelectedTeacherUsername] = useState<string>('');
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [searchWorkloadQuery, setSearchWorkloadQuery] = useState('');

  // Auto-clear selection when school changes
  useEffect(() => {
    setSelectedClassIds([]);
  }, [selectedSchoolId]);

  // Load data on mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const schs = await getGlobalSchools();
      const cls = await getGlobalClasses();
      const subs = await getGlobalSubjects();
      const wls = await getGlobalWorkloads();
      const profs = await syncProfessorsListInCloud();

      setSchools(schs);
      setClasses(cls);
      setSubjects(subs);
      setWorkloads(wls);
      setProfessors(profs);

      // Auto-select first school if none selected
      if (schs.length > 0 && !selectedSchoolId) {
        setSelectedSchoolId(schs[0].id);
      }
    } catch (error) {
      console.error(error);
      showMsg('Erro ao carregar dados de disciplinas/cargas da nuvem.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const showMsg = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  };

  // SUBJECT ACTIONS
  const handleAddSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubjectName.trim()) return;

    // Check if duplicate name
    const exists = subjects.some(s => s.name.toLowerCase() === newSubjectName.trim().toLowerCase());
    if (exists) {
      showMsg('Já existe uma disciplina com esse nome.', 'error');
      return;
    }

    setIsLoading(true);
    try {
      const id = 'sub_' + Date.now();
      const newSub: GlobalSubject = {
        id,
        name: newSubjectName.trim()
      };
      await saveGlobalSubject(newSub);
      setSubjects(prev => [...prev, newSub].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')));
      setNewSubjectName('');
      showMsg(`Disciplina "${newSub.name}" cadastrada com sucesso!`, 'success');
    } catch (err) {
      console.error(err);
      showMsg('Erro ao salvar disciplina.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSubjectId || !editingSubjectName.trim()) return;

    // Check duplicate
    const exists = subjects.some(s => s.id !== editingSubjectId && s.name.toLowerCase() === editingSubjectName.trim().toLowerCase());
    if (exists) {
      showMsg('Já existe outra disciplina com esse nome.', 'error');
      return;
    }

    setIsLoading(true);
    try {
      const updatedSub: GlobalSubject = {
        id: editingSubjectId,
        name: editingSubjectName.trim()
      };
      await saveGlobalSubject(updatedSub);
      setSubjects(prev => prev.map(s => s.id === editingSubjectId ? updatedSub : s).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')));
      setEditingSubjectId(null);
      showMsg('Disciplina atualizada com sucesso!', 'success');
    } catch (err) {
      console.error(err);
      showMsg('Erro ao atualizar disciplina.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteSubjectClick = async (id: string, name: string) => {
    if (!window.confirm(`Tem certeza que deseja excluir a disciplina "${name}"? Isso também removerá todas as cargas horárias globais vinculadas a ela.`)) {
      return;
    }

    setIsLoading(true);
    try {
      await deleteGlobalSubject(id);
      setSubjects(prev => prev.filter(s => s.id !== id));
      setWorkloads(prev => prev.filter(w => w.subjectId !== id));
      showMsg('Disciplina excluída da nuvem!', 'success');
    } catch (err) {
      console.error(err);
      showMsg('Erro ao excluir disciplina.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // WORKLOAD ACTIONS
  const handleAddWorkload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedClassIds.length === 0) {
      showMsg('Por favor, selecione pelo menos uma série/turma.', 'error');
      return;
    }
    if (!selectedSubjectId || !workloadLessons) {
      showMsg('Por favor, preencha todos os campos obrigatórios.', 'error');
      return;
    }

    setIsLoading(true);
    try {
      const updatedWorkloadsList = [...workloads];

      for (const classId of selectedClassIds) {
        // Find if workload already exists for this class and subject
        const existingIndex = updatedWorkloadsList.findIndex(w => w.classId === classId && w.subjectId === selectedSubjectId);
        
        const id = existingIndex !== -1 ? updatedWorkloadsList[existingIndex].id : 'wl_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
        const newWl: GlobalWorkload = {
          id,
          classId,
          subjectId: selectedSubjectId,
          totalLessons: Number(workloadLessons),
          teacherUsername: selectedTeacherUsername || ''
        };

        await saveGlobalWorkload(newWl);

        if (existingIndex !== -1) {
          updatedWorkloadsList[existingIndex] = newWl;
        } else {
          updatedWorkloadsList.push(newWl);
        }
      }

      setWorkloads(updatedWorkloadsList);
      setSelectedClassIds([]); // Reset selected classes
      showMsg('Cargas horárias e atribuições salvas com sucesso!', 'success');
    } catch (err) {
      console.error(err);
      showMsg('Erro ao salvar carga horária.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateWorkloadInline = async (wl: GlobalWorkload, newLessons: number) => {
    if (!newLessons || isNaN(newLessons)) return;
    setIsLoading(true);
    try {
      const updatedWl = { ...wl, totalLessons: newLessons };
      await saveGlobalWorkload(updatedWl);
      setWorkloads(prev => prev.map(w => w.id === wl.id ? updatedWl : w));
      setEditingWorkloadId(null);
      showMsg('Carga horária atualizada!', 'success');
    } catch (err) {
      console.error(err);
      showMsg('Erro ao salvar alteração.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteWorkloadClick = async (id: string) => {
    if (!window.confirm('Excluir esta configuração de carga horária para esta turma?')) {
      return;
    }

    setIsLoading(true);
    try {
      await deleteGlobalWorkload(id);
      setWorkloads(prev => prev.filter(w => w.id !== id));
      showMsg('Carga horária excluída com sucesso!', 'success');
    } catch (err) {
      console.error(err);
      showMsg('Erro ao excluir carga horária.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Filter lists
  const schoolClasses = [...classes].filter(c => c.schoolId === selectedSchoolId).sort(sortClasses);
  const schoolClassIds = schoolClasses.map(c => c.id);
  const schoolWorkloads = workloads.filter(w => schoolClassIds.includes(w.classId));

  const filteredSchoolWorkloads = schoolWorkloads.filter(wl => {
    const cls = classes.find(c => c.id === wl.classId);
    const sub = subjects.find(s => s.id === wl.subjectId);
    const prof = professors.find(p => p.username.toLowerCase() === wl.teacherUsername?.toLowerCase());
    
    const query = searchWorkloadQuery.toLowerCase();
    return (
      (cls?.name.toLowerCase() || '').includes(query) ||
      (sub?.name.toLowerCase() || '').includes(query) ||
      (prof?.teacherName.toLowerCase() || '').includes(query) ||
      (wl.teacherUsername?.toLowerCase() || '').includes(query)
    );
  });

  return (
    <div className="space-y-6">
      {/* Toast Messages */}
      {message && (
        <div className={`p-4 rounded-xl text-xs font-bold flex items-center gap-2 border shadow-lg animate-in fade-in slide-in-from-top-4 duration-300 ${
          message.type === 'success' 
            ? 'bg-emerald-950/80 border-emerald-800 text-emerald-400' 
            : 'bg-rose-950/80 border-rose-800 text-rose-400'
        }`}>
          {message.type === 'success' ? <Check className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <h3 className="text-white font-bold text-base flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-amber-500" /> Cadastro de Disciplinas & Cargas Horárias
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed max-w-2xl">
              Gerencie a lista mestre oficial de disciplinas (matérias) e as cargas horárias correspondentes de cada série/turma. 
              Os professores poderão importar essa base mestre diretamente em seus diários para preenchimento de notas, frequências e planejamentos.
            </p>
          </div>
          {isLoading && (
            <div className="flex items-center justify-center gap-2 text-xs text-amber-500 font-mono bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-full animate-pulse">
              <span>Sincronizando Nuvem...</span>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* COL 1: GLOBAL SUBJECTS LIST & CRUD (LHS, Span 4) */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl space-y-5">
            <h4 className="text-white font-bold text-xs flex items-center gap-2 uppercase tracking-wider text-zinc-350">
              <BookOpen className="w-4 h-4 text-amber-500" /> 1. Disciplinas Oficiais ({subjects.length})
            </h4>

            {/* Subject Add/Edit Form */}
            {editingSubjectId ? (
              <form onSubmit={handleUpdateSubject} className="space-y-3 bg-zinc-950/40 p-3 rounded-xl border border-zinc-800/80">
                <p className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">Editar Disciplina</p>
                <input
                  type="text"
                  required
                  value={editingSubjectName}
                  onChange={(e) => setEditingSubjectName(e.target.value)}
                  className="bg-zinc-950 border border-zinc-800 text-zinc-200 text-xs rounded-xl px-3 py-2 w-full focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
                <div className="flex gap-2">
                  <button type="submit" className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg transition cursor-pointer">
                    Salvar
                  </button>
                  <button type="button" onClick={() => setEditingSubjectId(null)} className="py-1.5 px-2 bg-zinc-850 hover:bg-zinc-800 text-zinc-400 rounded-lg text-xs transition cursor-pointer">
                    Cancelar
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleAddSubject} className="flex gap-2">
                <input
                  type="text"
                  required
                  placeholder="Ex: Geografia, Ciências..."
                  value={newSubjectName}
                  onChange={(e) => setNewSubjectName(e.target.value)}
                  className="bg-zinc-950 border border-zinc-800 text-zinc-300 text-xs rounded-xl px-3 py-2 w-full focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
                <button type="submit" className="p-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl transition cursor-pointer shrink-0" title="Cadastrar Disciplina">
                  <Plus className="w-4 h-4" />
                </button>
              </form>
            )}

            {/* Subjects List */}
            <div className="space-y-1.5 max-h-[400px] overflow-y-auto pr-1">
              {subjects.map((sub) => (
                <div key={sub.id} className="flex items-center justify-between bg-zinc-950/30 border border-zinc-850 rounded-xl px-3 py-2 text-xs hover:border-zinc-800 transition">
                  <span className="text-zinc-200 font-medium truncate">{sub.name}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => {
                        setEditingSubjectId(sub.id);
                        setEditingSubjectName(sub.name);
                      }}
                      className="p-1 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded transition cursor-pointer"
                      title="Editar Disciplina"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => handleDeleteSubjectClick(sub.id, sub.name)}
                      className="p-1 hover:bg-zinc-800 text-zinc-500 hover:text-rose-450 rounded transition cursor-pointer"
                      title="Excluir Disciplina"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
              {subjects.length === 0 && (
                <p className="text-zinc-500 text-xs text-center py-6 italic">Nenhuma disciplina cadastrada.</p>
              )}
            </div>
          </div>
        </div>

        {/* COL 2: GLOBAL WORKLOADS MANAGEMENT (RHS, Span 8) */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-850 pb-3">
              <h4 className="text-white font-bold text-xs flex items-center gap-2 uppercase tracking-wider text-zinc-350">
                <Clock className="w-4 h-4 text-amber-500" /> 2. Carga Horária & Atribuição de Professores
              </h4>
              
              {/* School Selector */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-zinc-500 font-bold uppercase">Escola:</span>
                <select
                  value={selectedSchoolId}
                  onChange={(e) => setSelectedSchoolId(e.target.value)}
                  className="bg-zinc-950 border border-zinc-800 text-zinc-300 text-xs rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-500 font-medium"
                >
                  {schools.map((sch) => (
                    <option key={sch.id} value={sch.id}>{sch.name}</option>
                  ))}
                  {schools.length === 0 && <option value="">Sem escolas cadastradas</option>}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
              
              {/* Left inner column: Creation Form (Span 5) */}
              <div className="xl:col-span-5 space-y-4">
                <form onSubmit={handleAddWorkload} className="bg-zinc-950/40 border border-zinc-850 p-4 rounded-xl space-y-4">
                  <p className="text-xs font-bold text-zinc-200 flex items-center gap-1.5 border-b border-zinc-850 pb-2">
                    <Plus className="w-4 h-4 text-amber-500" /> Cadastrar Nova Carga
                  </p>
                  
                  {/* Professor Select */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-zinc-400 font-bold uppercase block">Professor Responsável</label>
                    <select
                      value={selectedTeacherUsername}
                      onChange={(e) => setSelectedTeacherUsername(e.target.value)}
                      className="bg-zinc-950 border border-zinc-800 text-zinc-300 text-xs rounded-xl px-3 py-2 w-full focus:outline-none focus:ring-1 focus:ring-amber-500"
                    >
                      <option value="">Selecione...</option>
                      {professors.map((prof) => (
                        <option key={prof.username} value={prof.username}>
                          {prof.teacherName} ({prof.username})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Subject Select */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-zinc-400 font-bold uppercase block">Disciplina/Matéria</label>
                    <select
                      required
                      value={selectedSubjectId}
                      onChange={(e) => setSelectedSubjectId(e.target.value)}
                      className="bg-zinc-950 border border-zinc-800 text-zinc-300 text-xs rounded-xl px-3 py-2 w-full focus:outline-none focus:ring-1 focus:ring-amber-500"
                    >
                      <option value="">Selecione...</option>
                      {subjects.map((sub) => (
                        <option key={sub.id} value={sub.id}>{sub.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Lessons Count */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-zinc-400 font-bold uppercase block">Carga Horária (Total de Aulas)</label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={workloadLessons}
                      onChange={(e) => setWorkloadLessons(Number(e.target.value))}
                      className="bg-zinc-950 border border-zinc-800 text-zinc-350 text-xs rounded-xl px-3 py-2 w-full focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono font-bold"
                    />
                  </div>

                  {/* Classes Selection Checklist */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] text-zinc-400 font-bold uppercase block">Séries/Turmas ({selectedClassIds.length} sel.)</label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedClassIds(schoolClasses.map(c => c.id))}
                          className="text-[9px] text-amber-500 hover:underline font-bold cursor-pointer"
                        >
                          Todas
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedClassIds([])}
                          className="text-[9px] text-zinc-500 hover:underline font-bold cursor-pointer"
                        >
                          Limpar
                        </button>
                      </div>
                    </div>
                    
                    <div className="space-y-1.5 max-h-[180px] overflow-y-auto pr-1 border border-zinc-850 p-2 rounded-xl bg-zinc-950/20">
                      {schoolClasses.map((cls) => {
                        const isChecked = selectedClassIds.includes(cls.id);
                        return (
                          <label
                            key={cls.id}
                            className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs cursor-pointer transition select-none ${
                              isChecked
                                ? 'bg-amber-500/5 border-amber-500/25 text-amber-300 font-medium'
                                : 'bg-zinc-950/20 border-zinc-900/40 text-zinc-400 hover:text-zinc-300'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                setSelectedClassIds(prev =>
                                  prev.includes(cls.id) ? prev.filter(id => id !== cls.id) : [...prev, cls.id]
                                );
                              }}
                              className="accent-amber-500"
                            />
                            <span className="truncate">{cls.name}</span>
                          </label>
                        );
                      })}
                      {schoolClasses.length === 0 && (
                        <p className="text-zinc-650 text-xs italic py-4 text-center">Nenhuma turma nesta escola.</p>
                      )}
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1"
                  >
                    <Plus className="w-4 h-4" /> Salvar Atribuições
                  </button>
                </form>
              </div>

              {/* Right inner column: List of registered workloads in the school (Span 7) */}
              <div className="xl:col-span-7 space-y-4">
                <div className="flex items-center gap-2 bg-zinc-950 border border-zinc-850 px-3 py-1.5 rounded-xl">
                  <input
                    type="text"
                    placeholder="Filtrar por turma, disciplina ou professor..."
                    value={searchWorkloadQuery}
                    onChange={(e) => setSearchWorkloadQuery(e.target.value)}
                    className="bg-transparent text-zinc-200 text-xs focus:outline-none w-full"
                  />
                  {searchWorkloadQuery && (
                    <button onClick={() => setSearchWorkloadQuery('')} className="text-zinc-500 hover:text-zinc-300">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                    Cargas e Atribuições Ativas ({filteredSchoolWorkloads.length}):
                  </p>
                  
                  <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
                    {filteredSchoolWorkloads.map((wl) => {
                      const associatedSubject = subjects.find(s => s.id === wl.subjectId);
                      const associatedClass = classes.find(c => c.id === wl.classId);
                      const associatedTeacher = professors.find(p => p.username.toLowerCase() === wl.teacherUsername?.toLowerCase());
                      const isEditingThis = editingWorkloadId === wl.id;
                      
                      return (
                        <div key={wl.id} className="bg-zinc-950/35 border border-zinc-850/80 rounded-xl p-3 text-xs hover:border-zinc-800 transition space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="space-y-0.5 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="px-1.5 py-0.5 bg-zinc-800 text-zinc-300 rounded font-bold text-[10px]">
                                  {associatedClass ? associatedClass.name : 'Turma Excluída'}
                                </span>
                                <span className="text-zinc-400 font-semibold truncate">
                                  {associatedSubject ? associatedSubject.name : 'Disciplina Excluída'}
                                </span>
                              </div>
                              <p className="text-zinc-500 text-[11px] flex items-center gap-1">
                                <span className="font-medium text-zinc-400">Prof:</span> 
                                <span className="text-zinc-300 font-medium">
                                  {associatedTeacher ? associatedTeacher.teacherName : (wl.teacherUsername ? `@${wl.teacherUsername}` : 'Nenhum Professor Atribuído')}
                                </span>
                              </p>
                            </div>
                            
                            <div className="flex items-center gap-1.5 shrink-0">
                              {isEditingThis ? (
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    className="w-16 bg-zinc-950 border border-zinc-800 text-zinc-200 text-xs font-mono font-bold rounded px-1.5 py-0.5"
                                    value={editingWorkloadLessons}
                                    onChange={(e) => setEditingWorkloadLessons(e.target.value === '' ? '' : Number(e.target.value))}
                                  />
                                  <button
                                    onClick={() => handleUpdateWorkloadInline(wl, Number(editingWorkloadLessons))}
                                    className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] rounded cursor-pointer"
                                  >
                                    Ok
                                  </button>
                                  <button
                                    onClick={() => setEditingWorkloadId(null)}
                                    className="p-0.5 bg-zinc-800 text-zinc-400 rounded hover:text-white cursor-pointer"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              ) : (
                                <>
                                  <span className="text-amber-400 font-mono font-bold bg-amber-500/5 px-2 py-0.5 rounded border border-amber-500/10 text-[10px]">
                                    {wl.totalLessons} aulas
                                  </span>
                                  <button
                                    onClick={() => {
                                      setEditingWorkloadId(wl.id);
                                      setEditingWorkloadLessons(wl.totalLessons);
                                    }}
                                    className="p-1 hover:bg-zinc-850 text-zinc-400 hover:text-white rounded transition cursor-pointer"
                                    title="Editar Carga"
                                  >
                                    <Edit2 className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteWorkloadClick(wl.id)}
                                    className="p-1 hover:bg-zinc-850 text-zinc-500 hover:text-rose-450 rounded transition cursor-pointer"
                                    title="Excluir Carga"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    
                    {filteredSchoolWorkloads.length === 0 && (
                      <div className="text-center py-12 text-zinc-500 bg-zinc-950/10 border border-dashed border-zinc-850 rounded-xl">
                        <Clock className="w-6 h-6 mx-auto mb-1.5 opacity-20" />
                        <p className="text-xs">Nenhuma carga horária correspondente encontrada.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
