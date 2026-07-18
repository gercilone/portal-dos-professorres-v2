import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { School, Class, Subject, sortClasses } from '../types';
import { School as SchoolIcon, Layers, BookOpen, CalendarDays, LogOut, Sun, Moon, Save, Cloud, RefreshCw, Check, AlertCircle } from 'lucide-react';
import { pushTeacherDataToCloud, getGlobalStudents, getGlobalClasses } from '../firebase';

interface HeaderFiltersProps {
  selectedSchoolId: number | undefined;
  setSelectedSchoolId: (id: number | undefined) => void;
  selectedClassId: number | undefined;
  setSelectedClassId: (id: number | undefined) => void;
  selectedSubjectId: number | undefined;
  setSelectedSubjectId: (id: number | undefined) => void;
  selectedBimonthly: number;
  setSelectedBimonthly: (bim: number) => void;
  teacherName: string;
  isAuthEnabled: boolean;
  onLogout: () => void;
  theme?: 'light' | 'dark';
  setTheme?: (t: 'light' | 'dark') => void;
  fontSize?: 'normal' | 'large' | 'xl';
  setFontSize?: (sz: 'normal' | 'large' | 'xl') => void;
}

export default function HeaderFilters({
  selectedSchoolId,
  setSelectedSchoolId,
  selectedClassId,
  setSelectedClassId,
  selectedSubjectId,
  setSelectedSubjectId,
  selectedBimonthly,
  setSelectedBimonthly,
  teacherName,
  isAuthEnabled,
  onLogout,
  theme = 'dark',
  setTheme,
  fontSize = 'normal',
  setFontSize,
}: HeaderFiltersProps) {
  const schools = useLiveQuery(() => db.schools.toArray()) || [];
  const classes = useLiveQuery(async () => {
    let list;
    if (selectedSchoolId) {
      list = await db.classes.where({ schoolId: selectedSchoolId }).toArray();
    } else {
      list = await db.classes.toArray();
    }
    return list.sort(sortClasses);
  }, [selectedSchoolId]) || [];
  
  const subjects = useLiveQuery(() => db.subjects.toArray()) || [];

  const [isSavingCloud, setIsSavingCloud] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean | null>(null);
  const [syncFeedbackMessage, setSyncFeedbackMessage] = useState<string>('');

  const handleManualSave = async () => {
    const activeUser = localStorage.getItem('portal_active_user');
    if (!activeUser) return;

    setIsSavingCloud(true);
    setSaveSuccess(null);
    setSyncFeedbackMessage('Sincronizando dados com a nuvem...');

    try {
      // 1. Fetch fresh global students and classes to pull any new student added by coordinator
      setSyncFeedbackMessage('Buscando novos alunos da coordenação...');
      const [freshGlobalStudents, freshGlobalClasses] = await Promise.all([
        getGlobalStudents(),
        getGlobalClasses()
      ]);

      const localClasses = await db.classes.toArray();
      let addedCount = 0;

      for (const lc of localClasses) {
        // Find matching global class by name
        const matchingGlobalClass = freshGlobalClasses.find(
          gc => gc.name.toLowerCase() === lc.name.toLowerCase()
        );

        if (matchingGlobalClass) {
          const classStudents = freshGlobalStudents.filter(st => st.classId === matchingGlobalClass.id);
          const currentLocalStudents = await db.students.where({ classId: lc.id! }).toArray();

          for (const st of classStudents) {
            const studentExists = currentLocalStudents.some(
              localSt => localSt.name.toLowerCase() === st.name.toLowerCase()
            );

            if (!studentExists) {
              await db.students.add({
                classId: lc.id!,
                name: st.name,
                rollNumber: st.rollNumber
              });
              addedCount++;
            }
          }
        }
      }

      // 2. Push all local data to cloud Firestore
      setSyncFeedbackMessage('Gravando dados no servidor...');
      const success = await pushTeacherDataToCloud(activeUser, db, true);
      
      if (success) {
        setSaveSuccess(true);
        if (addedCount > 0) {
          setSyncFeedbackMessage(`Salvo! ${addedCount} novo(s) aluno(s) importado(s) da coordenação.`);
        } else {
          setSyncFeedbackMessage('Dados salvos e sincronizados com sucesso!');
        }
      } else {
        setSaveSuccess(false);
        setSyncFeedbackMessage('Ocorreu um erro ao gravar dados na nuvem.');
      }

      setTimeout(() => {
        setSaveSuccess(null);
        setSyncFeedbackMessage('');
      }, 4000);

    } catch (err) {
      console.error('Error during manual save/sync:', err);
      setSaveSuccess(false);
      setSyncFeedbackMessage('Erro de conexão ou limite de cota atingido.');
      setTimeout(() => {
        setSaveSuccess(null);
        setSyncFeedbackMessage('');
      }, 4000);
    } finally {
      setIsSavingCloud(false);
    }
  };

  const handleSchoolClick = (schoolId: number) => {
    setSelectedSchoolId(schoolId);
    setSelectedClassId(undefined); // Reset class selection
  };

  // Dynamic school visual themes to prevent confusion:
  // - First school (or odd id): Blue Theme
  // - Second school (or even id): Emerald Theme
  // - Third/other: Amber/Purple
  const getSchoolColors = (schoolId?: number) => {
    if (!schoolId) {
      return {
        bgActive: 'bg-blue-600 border-blue-500 text-white shadow-md shadow-blue-500/20',
        bgInactive: 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700',
        textActive: 'text-blue-400',
        borderActive: 'border-blue-500/50',
        subtleBg: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
      };
    }
    const idx = schools.findIndex(s => s.id === schoolId);
    if (idx === 1) { // Second school (e.g. ECIM 15 DE JUNHO)
      return {
        bgActive: 'bg-emerald-600 border-emerald-500 text-white shadow-md shadow-emerald-500/25',
        bgInactive: 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-100 hover:border-zinc-700',
        textActive: 'text-emerald-400',
        borderActive: 'border-emerald-500/40',
        subtleBg: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
      };
    }
    if (idx === 2) { // Third school
      return {
        bgActive: 'bg-amber-600 border-amber-500 text-white shadow-md shadow-amber-500/25',
        bgInactive: 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-100 hover:border-zinc-700',
        textActive: 'text-amber-405',
        borderActive: 'border-amber-500/40',
        subtleBg: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
      };
    }
    // Default / First school
    return {
      bgActive: 'bg-blue-600 border-blue-500 text-white shadow-md shadow-blue-500/25',
      bgInactive: 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-100 hover:border-zinc-700',
      textActive: 'text-blue-400',
      borderActive: 'border-blue-500/40',
      subtleBg: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
    };
  };

  const schoolTheme = getSchoolColors(selectedSchoolId);

  return (
    <div id="header-filters-container" className="bg-[#09090b] border-b border-zinc-800 p-4 relative z-30 shadow-md">
      <div className="max-w-7xl mx-auto flex flex-col gap-4">
        
        {/* Top Bar: Logo, Teacher info, Logout */}
        <div className="flex items-center justify-between w-full gap-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-lg shrink-0 transition-colors ${
              selectedSchoolId ? (schools.findIndex(s => s.id === selectedSchoolId) === 1 ? 'bg-emerald-600 shadow-emerald-500/10' : 'bg-blue-600 shadow-blue-500/10') : 'bg-blue-600'
            }`}>
              <span className="text-white font-bold text-lg">P</span>
            </div>
            <div>
              <h1 className="text-white font-bold text-base tracking-tight leading-snug">
                {teacherName ? `Prof. ${teacherName}` : 'Portal do Professor'}
              </h1>
              <p className="text-xs text-zinc-500 font-medium">
                Portal do Professor — Diário de Classe
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Direct Save Button */}
            <button
              id="header-manual-save-btn"
              onClick={handleManualSave}
              disabled={isSavingCloud}
              className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-bold rounded-xl transition duration-200 select-none cursor-pointer border ${
                saveSuccess === true
                  ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-400'
                  : saveSuccess === false
                  ? 'bg-rose-600/20 border-rose-500/40 text-rose-400'
                  : 'bg-blue-600 hover:bg-blue-500 border-blue-500/30 text-white shadow shadow-blue-500/10'
              }`}
              title="Salvar todas as alterações na Nuvem (Notas, Chamadas, Vistos, etc.) e buscar novos alunos da coordenação"
            >
              {isSavingCloud ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : saveSuccess === true ? (
                <Check className="w-3.5 h-3.5" />
              ) : saveSuccess === false ? (
                <AlertCircle className="w-3.5 h-3.5" />
              ) : (
                <Cloud className="w-3.5 h-3.5" />
              )}
              <span>
                {isSavingCloud
                  ? 'Salvando...'
                  : saveSuccess === true
                  ? 'Salvo!'
                  : saveSuccess === false
                  ? 'Erro ao Salvar'
                  : 'Salvar Diário'}
              </span>
            </button>

            {setFontSize && (
              <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 rounded-xl px-2 py-1">
                <span className="text-[10px] text-zinc-500 font-extrabold uppercase select-none">Tamanho da Fonte:</span>
                <select
                  value={fontSize}
                  onChange={(e) => setFontSize(e.target.value as 'normal' | 'large' | 'xl')}
                  className="bg-transparent border-none text-zinc-300 font-bold text-xs focus:outline-none cursor-pointer focus:ring-0 p-0 text-center pr-2"
                  style={{ colorScheme: 'dark' }}
                >
                  <option value="normal" className="bg-zinc-950 text-zinc-300">Padrão</option>
                  <option value="large" className="bg-zinc-950 text-zinc-300">Grande</option>
                  <option value="xl" className="bg-zinc-950 text-zinc-300">Gigante</option>
                </select>
              </div>
            )}

            {setTheme && (
              <button
                type="button"
                onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                className="flex items-center justify-center p-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-amber-400 rounded-xl transition cursor-pointer select-none"
                title={theme === 'light' ? 'Mudar para Tema Escuro' : 'Mudar para Tema Claro'}
              >
                {theme === 'light' ? <Moon className="w-4 h-4 text-indigo-400" /> : <Sun className="w-4 h-4 text-yellow-400" />}
              </button>
            )}

            {onLogout && (
              <button
                id="header-logout-btn"
                onClick={onLogout}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-rose-400 rounded-xl text-xs font-semibold transition cursor-pointer select-none"
                title="Sair do aplicativo"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sair</span>
              </button>
            )}
          </div>
        </div>

        {syncFeedbackMessage && (
          <div className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 border animate-in fade-in slide-in-from-top-1 duration-200 ${
            saveSuccess === true
              ? 'bg-emerald-950/40 border-emerald-500/20 text-emerald-400'
              : saveSuccess === false
              ? 'bg-rose-950/40 border-rose-500/20 text-rose-400'
              : 'bg-zinc-900 border-zinc-800 text-blue-400'
          }`}>
            {isSavingCloud ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-400" />
            ) : saveSuccess === true ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : saveSuccess === false ? (
              <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
            ) : (
              <Cloud className="w-3.5 h-3.5 text-blue-400" />
            )}
            <span>{syncFeedbackMessage}</span>
          </div>
        )}

        {/* Dashboard-Style Button Control Panel */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 bg-zinc-950/60 p-3 rounded-2xl border border-zinc-800/85">
          
          {/* 1. School Selector Buttons */}
          <div className="flex flex-col gap-2 p-2.5 rounded-xl bg-zinc-900/35 border border-zinc-850/40">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5 select-none">
              <SchoolIcon className="w-3.5 h-3.5 text-zinc-500" /> Escola
            </span>
            <div className="flex flex-wrap gap-1.5">
              {schools.map((s) => {
                const isSelected = selectedSchoolId === s.id;
                const schoolTheme = getSchoolColors(s.id);
                return (
                  <button
                    key={s.id}
                    onClick={() => handleSchoolClick(s.id!)}
                    className={`flex-1 min-w-[120px] text-left px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer select-none ${
                      isSelected 
                        ? schoolTheme.bgActive
                        : 'bg-zinc-900/50 border-zinc-800 text-zinc-400 hover:text-zinc-250 hover:bg-zinc-800/60'
                    }`}
                  >
                    <div className="truncate" title={s.name}>{s.name}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Class Selector Buttons */}
          <div className="flex flex-col gap-2 p-2.5 rounded-xl bg-zinc-900/35 border border-zinc-850/40">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5 select-none">
              <Layers className="w-3.5 h-3.5 text-zinc-500" /> Série / Turma
            </span>
            <div className="flex flex-wrap gap-1.5 max-h-[140px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-zinc-800">
              {!selectedSchoolId ? (
                <div className="text-zinc-500 text-[11px] italic py-2 px-1">Selecione uma escola primeiro</div>
              ) : classes.length === 0 ? (
                <div className="text-zinc-500 text-[11px] italic py-2 px-1">Nenhuma turma cadastrada</div>
              ) : (
                classes.map((c) => {
                  const isSelected = selectedClassId === c.id;
                  return (
                    <button
                      key={c.id}
                      onClick={() => setSelectedClassId(c.id)}
                      className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer select-none ${
                        isSelected 
                          ? schoolTheme.bgActive
                          : 'bg-zinc-900/50 border-zinc-800 text-zinc-400 hover:text-zinc-250 hover:bg-zinc-800/60'
                      }`}
                    >
                      {c.name}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* 3. Subject Selector Buttons */}
          <div className="flex flex-col gap-2 p-2.5 rounded-xl bg-zinc-900/35 border border-zinc-850/40">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5 select-none">
              <BookOpen className="w-3.5 h-3.5 text-zinc-500" /> Disciplina
            </span>
            <div className="flex flex-wrap gap-1.5 max-h-[140px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-zinc-800">
              {subjects.length === 0 ? (
                <div className="text-zinc-500 text-[11px] italic py-2 px-1">Nenhuma disciplina</div>
              ) : (
                subjects.map((sub) => {
                  const isSelected = selectedSubjectId === sub.id;
                  return (
                    <button
                      key={sub.id}
                      onClick={() => setSelectedSubjectId(sub.id)}
                      className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer select-none ${
                        isSelected 
                          ? schoolTheme.bgActive
                          : 'bg-zinc-900/50 border-zinc-800 text-zinc-400 hover:text-zinc-250 hover:bg-zinc-800/60'
                      }`}
                    >
                      {sub.name}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* 4. Bimonthly Selector Buttons */}
          <div className="flex flex-col gap-2 p-2.5 rounded-xl bg-zinc-900/35 border border-zinc-850/40">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5 select-none">
              <CalendarDays className="w-3.5 h-3.5 text-zinc-500" /> Bimestre
            </span>
            <div className="grid grid-cols-2 gap-1.5">
              {[1, 2, 3, 4].map((bimNum) => {
                const isSelected = selectedBimonthly === bimNum;
                return (
                  <button
                    key={bimNum}
                    onClick={() => setSelectedBimonthly(bimNum)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold border text-center transition-all cursor-pointer select-none ${
                      isSelected 
                        ? schoolTheme.bgActive
                        : 'bg-zinc-900/50 border-zinc-800 text-zinc-400 hover:text-zinc-250 hover:bg-zinc-800/60'
                    }`}
                  >
                    {bimNum}º Bim
                  </button>
                );
              })}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
