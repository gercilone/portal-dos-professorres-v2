import React, { useState, useEffect } from 'react';
import { 
  getGlobalSchools, 
  getGlobalClasses, 
  getGlobalStudents, 
  getGlobalSubjects, 
  getGlobalWorkloads, 
  syncProfessorsListInCloud,
  getGradesBackup
} from '../firebase';
import { 
  Archive, 
  Download, 
  RefreshCw, 
  CheckCircle2, 
  Database, 
  Users, 
  BookOpen, 
  Clock, 
  FileText,
  School,
  AlertCircle
} from 'lucide-react';

export default function CoordBackups() {
  // Statistics States
  const [stats, setStats] = useState({
    professors: 0,
    subjects: 0,
    workloads: 0,
    students: 0,
    schools: 0,
    classes: 0,
  });

  // Loading & status states
  const [isLoading, setIsLoading] = useState(false);
  const [backupLoading, setBackupLoading] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Cached full list reference to avoid redundant queries during individual backups
  const [professorsList, setProfessorsList] = useState<any[]>([]);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const [profs, subjs, workloads, students, schools, classes] = await Promise.all([
        syncProfessorsListInCloud(),
        getGlobalSubjects(),
        getGlobalWorkloads(),
        getGlobalStudents(),
        getGlobalSchools(),
        getGlobalClasses()
      ]);

      setProfessorsList(profs || []);
      setStats({
        professors: profs?.length || 0,
        subjects: subjs?.length || 0,
        workloads: workloads?.length || 0,
        students: students?.length || 0,
        schools: schools?.length || 0,
        classes: classes?.length || 0
      });
    } catch (err) {
      console.error('Error loading database stats for backup:', err);
      setErrorMsg('Não foi possível carregar as estatísticas do banco de dados na nuvem.');
    } finally {
      setIsLoading(false);
    }
  };

  const downloadJSON = (data: any, filename: string) => {
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
      JSON.stringify(data, null, 2)
    )}`;
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', jsonString);
    downloadAnchor.setAttribute('download', filename);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const getTodayDateString = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // 1. BACKUP PROFESSORES
  const handleBackupProfessors = async () => {
    setBackupLoading('professors');
    setSuccessMsg(null);
    try {
      const profs = await syncProfessorsListInCloud();
      const filename = `backup_professores_${getTodayDateString()}.json`;
      downloadJSON({
        backupType: 'professores',
        exportedAt: new Date().toISOString(),
        totalCount: profs.length,
        data: profs
      }, filename);
      setSuccessMsg('Backup de professores realizado com sucesso!');
    } catch (err) {
      console.error(err);
      setErrorMsg('Erro ao gerar backup de professores.');
    } finally {
      setBackupLoading(null);
    }
  };

  // 2. BACKUP DISCIPLINAS
  const handleBackupSubjects = async () => {
    setBackupLoading('subjects');
    setSuccessMsg(null);
    try {
      const subjs = await getGlobalSubjects();
      const filename = `backup_disciplinas_${getTodayDateString()}.json`;
      downloadJSON({
        backupType: 'disciplinas',
        exportedAt: new Date().toISOString(),
        totalCount: subjs.length,
        data: subjs
      }, filename);
      setSuccessMsg('Backup de disciplinas realizado com sucesso!');
    } catch (err) {
      console.error(err);
      setErrorMsg('Erro ao gerar backup de disciplinas.');
    } finally {
      setBackupLoading(null);
    }
  };

  // 3. BACKUP CARGA HORÁRIA
  const handleBackupWorkloads = async () => {
    setBackupLoading('workloads');
    setSuccessMsg(null);
    try {
      const workloads = await getGlobalWorkloads();
      const filename = `backup_cargas_horarias_${getTodayDateString()}.json`;
      downloadJSON({
        backupType: 'cargas_horarias',
        exportedAt: new Date().toISOString(),
        totalCount: workloads.length,
        data: workloads
      }, filename);
      setSuccessMsg('Backup de carga horária realizado com sucesso!');
    } catch (err) {
      console.error(err);
      setErrorMsg('Erro ao gerar backup de carga horária.');
    } finally {
      setBackupLoading(null);
    }
  };

  // 4. BACKUP ALUNOS DA ESCOLA (Students, Classes and Schools)
  const handleBackupStudents = async () => {
    setBackupLoading('students');
    setSuccessMsg(null);
    try {
      const [students, classes, schools] = await Promise.all([
        getGlobalStudents(),
        getGlobalClasses(),
        getGlobalSchools()
      ]);
      const filename = `backup_alunos_escola_${getTodayDateString()}.json`;
      downloadJSON({
        backupType: 'alunos_da_escola',
        exportedAt: new Date().toISOString(),
        stats: {
          studentsCount: students.length,
          classesCount: classes.length,
          schoolsCount: schools.length
        },
        data: {
          students,
          classes,
          schools
        }
      }, filename);
      setSuccessMsg('Backup de alunos da escola realizado com sucesso!');
    } catch (err) {
      console.error(err);
      setErrorMsg('Erro ao gerar backup de alunos.');
    } finally {
      setBackupLoading(null);
    }
  };

  // 5. BACKUP NOTAS (Aggregates across all teachers from their Firestore diaries)
  const handleBackupGrades = async () => {
    setBackupLoading('grades');
    setSuccessMsg(null);
    try {
      // Get fresh list of professors first
      const profs = professorsList.length > 0 ? professorsList : await syncProfessorsListInCloud();
      if (!profs || profs.length === 0) {
        setErrorMsg('Nenhum professor encontrado para realizar o backup de notas.');
        setBackupLoading(null);
        return;
      }

      const allGrades = await getGradesBackup(profs);
      const filename = `backup_notas_geral_${getTodayDateString()}.json`;
      
      downloadJSON({
        backupType: 'notas_geral',
        exportedAt: new Date().toISOString(),
        totalCount: allGrades.length,
        professorsSearched: profs.map(p => p.username),
        data: allGrades
      }, filename);

      setSuccessMsg(`Backup de notas finalizado! Foram exportados ${allGrades.length} registros de notas.`);
    } catch (err) {
      console.error(err);
      setErrorMsg('Erro ao gerar o backup unificado de todas as notas.');
    } finally {
      setBackupLoading(null);
    }
  };

  return (
    <div id="coordinator-backups-container" className="space-y-6">
      {/* Title Header */}
      <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-white flex items-center gap-2">
            <Archive className="w-5 h-5 text-amber-500" /> Exportação de Backups de Segurança
          </h2>
          <p className="text-xs text-zinc-500 mt-1">
            Gere cópias de segurança instantâneas de toda a base de dados em formato JSON. Guarde esses arquivos localmente para garantir a integridade dos dados escolares.
          </p>
        </div>
        
        <button
          onClick={loadStats}
          disabled={isLoading}
          className="px-3.5 py-2 bg-zinc-850 hover:bg-zinc-800 border border-zinc-750 text-zinc-300 hover:text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition cursor-pointer shrink-0 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Atualizar Dados
        </button>
      </div>

      {/* Database Statistics Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-zinc-900/40 border border-zinc-850 p-4 rounded-xl flex flex-col justify-between">
          <span className="text-[10px] text-zinc-500 uppercase font-black tracking-wider flex items-center gap-1">
            <Users className="w-3.5 h-3.5 text-blue-400" /> Professores
          </span>
          <span className="text-2xl font-black text-white mt-2">
            {isLoading ? '...' : stats.professors}
          </span>
        </div>

        <div className="bg-zinc-900/40 border border-zinc-850 p-4 rounded-xl flex flex-col justify-between">
          <span className="text-[10px] text-zinc-500 uppercase font-black tracking-wider flex items-center gap-1">
            <BookOpen className="w-3.5 h-3.5 text-indigo-400" /> Disciplinas
          </span>
          <span className="text-2xl font-black text-white mt-2">
            {isLoading ? '...' : stats.subjects}
          </span>
        </div>

        <div className="bg-zinc-900/40 border border-zinc-850 p-4 rounded-xl flex flex-col justify-between">
          <span className="text-[10px] text-zinc-500 uppercase font-black tracking-wider flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-amber-400" /> Carga Horária
          </span>
          <span className="text-2xl font-black text-white mt-2">
            {isLoading ? '...' : stats.workloads}
          </span>
        </div>

        <div className="bg-zinc-900/40 border border-zinc-850 p-4 rounded-xl flex flex-col justify-between col-span-2 md:col-span-1">
          <span className="text-[10px] text-zinc-500 uppercase font-black tracking-wider flex items-center gap-1">
            <School className="w-3.5 h-3.5 text-emerald-400" /> Alunos Ativos
          </span>
          <span className="text-2xl font-black text-white mt-2">
            {isLoading ? '...' : stats.students}
          </span>
        </div>

        <div className="bg-zinc-900/40 border border-zinc-850 p-4 rounded-xl flex flex-col justify-between col-span-2 md:col-span-1">
          <span className="text-[10px] text-zinc-500 uppercase font-black tracking-wider flex items-center gap-1">
            <Database className="w-3.5 h-3.5 text-teal-400" /> Escolas / Turmas
          </span>
          <span className="text-sm font-bold text-zinc-300 mt-2">
            {isLoading ? '...' : `${stats.schools} Escolas • ${stats.classes} Turmas`}
          </span>
        </div>
      </div>

      {/* Message alerts */}
      {successMsg && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-xl flex items-center gap-2.5 animate-in zoom-in-95">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl flex items-center gap-2.5 animate-in zoom-in-95">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Backup Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Card 1: Backup de Professores */}
        <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl flex flex-col justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
              <h3 className="text-white font-bold text-sm">Backup de Professores</h3>
            </div>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Exporta todos os perfis de professores ativos no sistema, incluindo nomes, credenciais e configurações de segurança registradas na nuvem.
            </p>
          </div>
          
          <button
            onClick={handleBackupProfessors}
            disabled={backupLoading !== null || isLoading}
            className="w-full py-2.5 bg-zinc-850 hover:bg-zinc-800 hover:text-white text-zinc-200 rounded-xl text-xs font-bold border border-zinc-750 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {backupLoading === 'professors' ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-blue-400" />
                Gerando arquivo...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 text-blue-400" />
                Exportar Professores ({stats.professors})
              </>
            )}
          </button>
        </div>

        {/* Card 2: Backup de Disciplinas */}
        <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl flex flex-col justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
                <BookOpen className="w-4 h-4" />
              </div>
              <h3 className="text-white font-bold text-sm">Backup de Disciplinas</h3>
            </div>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Exporta toda a grade de disciplinas globais cadastradas e homologadas para uso por todos os professores nos diários.
            </p>
          </div>
          
          <button
            onClick={handleBackupSubjects}
            disabled={backupLoading !== null || isLoading}
            className="w-full py-2.5 bg-zinc-850 hover:bg-zinc-800 hover:text-white text-zinc-200 rounded-xl text-xs font-bold border border-zinc-750 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {backupLoading === 'subjects' ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
                Gerando arquivo...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 text-indigo-400" />
                Exportar Disciplinas ({stats.subjects})
              </>
            )}
          </button>
        </div>

        {/* Card 3: Backup de Carga Horária */}
        <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl flex flex-col justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
              <h3 className="text-white font-bold text-sm">Backup de Carga Horária</h3>
            </div>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Exporta as definições globais de cargas horárias (aulas previstas por turma e disciplina) homologadas no sistema da coordenação.
            </p>
          </div>
          
          <button
            onClick={handleBackupWorkloads}
            disabled={backupLoading !== null || isLoading}
            className="w-full py-2.5 bg-zinc-850 hover:bg-zinc-800 hover:text-white text-zinc-200 rounded-xl text-xs font-bold border border-zinc-750 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {backupLoading === 'workloads' ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                Gerando arquivo...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 text-amber-400" />
                Exportar Carga Horária ({stats.workloads})
              </>
            )}
          </button>
        </div>

        {/* Card 4: Backup de Alunos da Escola */}
        <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl flex flex-col justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <School className="w-4 h-4" />
              </div>
              <h3 className="text-white font-bold text-sm">Backup de Alunos da Escola</h3>
            </div>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Exporta todos os alunos matriculados nas respectivas turmas e escolas globais, contendo o nome completo, número de chamada e vínculos institucionais.
            </p>
          </div>
          
          <button
            onClick={handleBackupStudents}
            disabled={backupLoading !== null || isLoading}
            className="w-full py-2.5 bg-zinc-850 hover:bg-zinc-800 hover:text-white text-zinc-200 rounded-xl text-xs font-bold border border-zinc-750 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {backupLoading === 'students' ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
                Gerando arquivo...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 text-emerald-400" />
                Exportar Alunos ({stats.students})
              </>
            )}
          </button>
        </div>

        {/* Card 5: Backup Geral de Notas (All Teachers combined) */}
        <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl md:col-span-2 flex flex-col justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center">
                <FileText className="w-4 h-4" />
              </div>
              <h3 className="text-white font-bold text-sm">Backup Unificado de Notas</h3>
            </div>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Recupera, unifica e exporta todas as notas bimestrais e de recuperação semestral/final registradas por todos os professores em seus respectivos diários de classe da nuvem. Esta operação pode levar alguns segundos dependendo do número de diários ativos.
            </p>
          </div>
          
          <button
            onClick={handleBackupGrades}
            disabled={backupLoading !== null || isLoading}
            className="w-full py-2.5 bg-rose-600/10 hover:bg-rose-600 border border-rose-500/20 text-rose-400 hover:text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {backupLoading === 'grades' ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Consultando diários na nuvem...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Gerar Backup Unificado de Todas as Notas
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
