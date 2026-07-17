import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { Student, VistoRankingScore, QUICK_SCORE_OPTIONS, QuickScoreOption } from '../types';
import { Award, Trash2, ShieldAlert, TrendingUp, Clock, AlertTriangle, User, PlusCircle, Star } from 'lucide-react';

interface TabCGamificationProps {
  schoolId: number | undefined;
  classId: number | undefined;
  subjectId: number | undefined;
  bimonthly: number;
  isReadOnly?: boolean;
}

export default function TabCGamification({ schoolId, classId, subjectId, bimonthly, isReadOnly = false }: TabCGamificationProps) {
  const [selectedStudentIds, setSelectedStudentIds] = useState<number[]>([]);
  const [hasInitializedSelection, setHasInitializedSelection] = useState(false);

  // Reset initialization when class changes
  useEffect(() => {
    setHasInitializedSelection(false);
    setSelectedStudentIds([]);
  }, [classId]);

  // Query students
  const students = useLiveQuery(async () => {
    if (!classId) return [];
    return db.students.where({ classId }).sortBy('rollNumber');
  }, [classId]) || [];

  // Query scores for this subject and bimonthly
  const scores = useLiveQuery(async () => {
    if (!subjectId) return [];
    return db.vistoRankingScores.where('subjectId').equals(subjectId).filter(s => s.bimonthly === bimonthly).toArray();
  }, [subjectId, bimonthly]) || [];

  // Automatically select first student if none selected yet
  if (!hasInitializedSelection && students.length > 0) {
    setSelectedStudentIds([students[0].id!]);
    setHasInitializedSelection(true);
  }

  if (!schoolId || !classId || !subjectId) {
    return (
      <div id="gamification-no-selection" className="flex flex-col items-center justify-center py-16 px-4 text-center max-w-md mx-auto">
        <div className="w-16 h-16 bg-zinc-900 rounded-2xl flex items-center justify-center mb-4 text-amber-500 border border-zinc-800">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h3 className="text-white font-bold text-lg mb-2">Seleção Pendente</h3>
        <p className="text-zinc-400 text-sm">
          Por favor, selecione uma <strong>Escola</strong>, <strong>Turma</strong> e <strong>Disciplina</strong> no cabeçalho superior para acessar o Rank de Vistos.
        </p>
      </div>
    );
  }

  const selectedStudent = selectedStudentIds.length === 1
    ? students.find((s) => s.id === selectedStudentIds[0])
    : undefined;

  // Toggle single student selection
  const toggleStudentSelection = (stId: number) => {
    if (selectedStudentIds.includes(stId)) {
      setSelectedStudentIds(selectedStudentIds.filter((id) => id !== stId));
    } else {
      setSelectedStudentIds([...selectedStudentIds, stId]);
    }
  };

  const handleSelectAll = () => {
    setSelectedStudentIds(students.map((st) => st.id!));
  };

  const handleClearSelection = () => {
    setSelectedStudentIds([]);
  };

  // Calculate scores per student
  const leaderboardSorted = students.map((student) => {
    const studentScores = scores.filter((s) => s.studentId === student.id);
    const totalPoints = studentScores.reduce((acc, curr) => acc + curr.points, 0);
    return {
      student,
      totalPoints,
      scoresCount: studentScores.length,
    };
  }).sort((a, b) => b.totalPoints - a.totalPoints || a.student.rollNumber - b.student.rollNumber);

  const leaderboard = leaderboardSorted.map((item) => {
    const rank = leaderboardSorted.filter(other => other.totalPoints > item.totalPoints).length + 1;
    return {
      ...item,
      rank,
    };
  });

  // Add points to all selected students
  const handleAddScore = async (option: QuickScoreOption) => {
    if (selectedStudentIds.length === 0) return;

    try {
      const promises = selectedStudentIds.map((id) =>
        db.vistoRankingScores.add({
          studentId: id,
          subjectId,
          bimonthly,
          type: option.key,
          points: option.points,
          reason: `${option.icon} ${option.label}`,
          timestamp: Date.now(),
        })
      );
      await Promise.all(promises);
    } catch (err) {
      console.error('Error adding ranking score:', err);
    }
  };

  // Delete score from timeline
  const handleDeleteScore = async (scoreId: number) => {
    try {
      await db.vistoRankingScores.delete(scoreId);
    } catch (err) {
      console.error('Error deleting score action:', err);
    }
  };

  // Student specific score timeline (combined for all selected)
  const studentTimeline = selectedStudentIds.length > 0
    ? scores
        .filter((s) => selectedStudentIds.includes(s.studentId))
        .sort((a, b) => b.timestamp - a.timestamp)
    : [];

  return (
    <div id="gamification-tab-content" className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      
      {/* LEFT COLUMN: Assign Points & Student details (7 cols) */}
      <div className="lg:col-span-7 space-y-6">
        
        {/* Student Selector Row */}
        <div className="bg-zinc-900/60 p-4 rounded-xl border border-zinc-800 space-y-3">
          <div className="flex justify-between items-center pb-1">
            <label className="text-xs font-bold uppercase text-zinc-400 tracking-wider flex items-center gap-1.5">
              <User className="w-4 h-4 text-blue-400" /> Alunos da Turma ({selectedStudentIds.length} selecionados)
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-[10px] text-blue-400 hover:text-blue-300 font-bold transition uppercase cursor-pointer"
              >
                Selecionar Todos
              </button>
              <span className="text-zinc-600 text-[10px]">•</span>
              <button
                type="button"
                onClick={handleClearSelection}
                className="text-[10px] text-zinc-400 hover:text-zinc-300 font-bold transition uppercase cursor-pointer"
              >
                Desmarcar Todos
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 p-1.5 bg-zinc-950/40 rounded-lg">
            {students.map((st) => {
              const totalPoints = scores
                .filter((s) => s.studentId === st.id)
                .reduce((acc, curr) => acc + curr.points, 0);

              const isSelected = selectedStudentIds.includes(st.id!);

              return (
                <button
                  id={`student-btn-${st.id}`}
                  key={st.id}
                  type="button"
                  onClick={() => toggleStudentSelection(st.id!)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition cursor-pointer select-none ${
                    isSelected
                      ? 'bg-blue-600 border-blue-500 text-white shadow-md shadow-blue-500/10'
                      : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-zinc-300'
                  }`}
                >
                  <span className="opacity-60">#{st.rollNumber}</span>
                  <span>{st.name.split(' ')[0]}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                    totalPoints > 0 
                      ? 'bg-emerald-500/10 text-emerald-400' 
                      : totalPoints < 0 
                        ? 'bg-rose-500/10 text-rose-400' 
                        : 'bg-zinc-800 text-zinc-500'
                  }`}>
                    {totalPoints > 0 ? `+${totalPoints}` : totalPoints}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Action Panel for Selected Student */}
        {selectedStudentIds.length > 0 ? (
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl space-y-6 shadow-xl">
            {/* Header info */}
            {selectedStudentIds.length === 1 ? (
              <div className="flex justify-between items-center bg-zinc-950/60 p-4 rounded-xl border border-zinc-850">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-600/15 text-blue-400 border border-blue-500/10 rounded-full flex items-center justify-center font-bold text-sm">
                    #{selectedStudent?.rollNumber}
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-base tracking-tight">{selectedStudent?.name}</h3>
                    <p className="text-xs text-zinc-400">Atribua pontuações instantâneas de comportamento</p>
                  </div>
                </div>
                
                <div className="text-right">
                  <div className="text-xs text-zinc-500">Aproveitamento</div>
                  <div className="text-lg font-mono font-extrabold text-blue-400">
                    {scores.filter((s) => s.studentId === selectedStudentIds[0]).reduce((acc, curr) => acc + curr.points, 0)} pts
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3 bg-zinc-950/60 p-4 rounded-xl border border-zinc-850">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-amber-500/15 text-amber-400 border border-amber-500/10 rounded-full flex items-center justify-center font-bold text-sm font-mono">
                      {selectedStudentIds.length}
                    </div>
                    <div>
                      <h3 className="text-white font-bold text-base tracking-tight">Múltiplos Alunos Selecionados</h3>
                      <p className="text-xs text-zinc-400">Atribua pontos de comportamento em massa para todos os selecionados</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Quick Score Options Grid */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                {isReadOnly 
                  ? 'Histórico de Comportamento (Somente Leitura):' 
                  : selectedStudentIds.length === 1 ? 'Toque para Atribuir Pontos:' : `Toque para Atribuir Pontos aos ${selectedStudentIds.length} Alunos:`}
              </h4>
              {!isReadOnly && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {QUICK_SCORE_OPTIONS.map((opt) => (
                    <button
                      id={`assign-score-${opt.key}`}
                      key={opt.key}
                      type="button"
                      onClick={() => handleAddScore(opt)}
                      className={`flex items-center justify-between p-3 rounded-xl border text-left cursor-pointer transition transform active:scale-98 hover:-translate-y-0.5 select-none ${opt.color}`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-lg">{opt.icon}</span>
                        <span className="text-xs font-semibold tracking-tight">{opt.label}</span>
                      </div>
                      <span className="text-xs font-mono font-extrabold px-2 py-1 bg-zinc-950/40 rounded-lg shrink-0">
                        {opt.points > 0 ? `+${opt.points}` : opt.points}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Timeline for Selected Student */}
            <div className="space-y-3 pt-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-zinc-500" /> {selectedStudentIds.length === 1 ? 'Histórico do Bimestre' : 'Histórico Recente dos Alunos Selecionados'}
              </h4>
              
              {studentTimeline.length === 0 ? (
                <div className="text-center py-6 text-zinc-500 border border-dashed border-zinc-800 rounded-xl text-xs">
                  Nenhuma ocorrência registrada para este(s) estudante(s).
                </div>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {studentTimeline.map((item) => {
                    const dateFormatted = new Date(item.timestamp).toLocaleString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit'
                    });

                    const itemStudent = students.find((s) => s.id === item.studentId);

                    return (
                      <div
                        key={item.id}
                        className="flex items-center justify-between bg-zinc-950/40 px-3 py-2 rounded-lg border border-zinc-800/60 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${item.points > 0 ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                          {selectedStudentIds.length > 1 && itemStudent && (
                            <span className="text-zinc-400 font-semibold text-[10px] bg-zinc-900 border border-zinc-800 px-1 py-0.5 rounded font-mono">
                              #{itemStudent.rollNumber} {itemStudent.name.split(' ')[0]}
                            </span>
                          )}
                          <span className="text-zinc-200 font-medium">{item.reason}</span>
                          <span className="text-zinc-500 font-mono text-[10px]">{dateFormatted}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`font-mono font-bold ${item.points > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {item.points > 0 ? `+${item.points}` : item.points}
                          </span>
                          {!isReadOnly && (
                            <button
                              id={`delete-score-${item.id}`}
                              type="button"
                              onClick={() => handleDeleteScore(item.id!)}
                              className="text-zinc-500 hover:text-rose-400 transition p-1 cursor-pointer"
                              title="Remover ocorrência incorreta"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
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
          <div className="bg-zinc-900 border border-zinc-800 p-12 rounded-2xl text-center text-zinc-500 text-sm">
            Nenhum aluno selecionado. Selecione alunos acima para aplicar pontuação.
          </div>
        )}

      </div>

      {/* RIGHT COLUMN: Leaderboard Ranking (5 cols) */}
      <div className="lg:col-span-5 space-y-4">
        
        <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <h3 className="text-white font-bold text-base flex items-center gap-2">
              <Award className="w-5 h-5 text-yellow-400" /> Leaderboard de Vistos
            </h3>
            <span className="text-[10px] font-bold bg-zinc-950 px-2 py-1 text-zinc-400 rounded-lg uppercase tracking-wider">
              {bimonthly}º Bimestre
            </span>
          </div>
 
          <p className="text-xs text-zinc-400">Classificação com base na pontuação de comportamento acumulada (clique para selecionar):</p>
 
          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
            {leaderboard.length === 0 ? (
              <div className="text-center py-8 text-zinc-500 text-xs">
                Nenhum aluno disponível.
              </div>
            ) : (
              leaderboard.map((item) => {
                let badgeColor = 'bg-zinc-950 text-zinc-400';
                let medalEmoji = '';
 
                if (item.rank === 1) {
                  badgeColor = 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/20';
                  medalEmoji = '🏆';
                } else if (item.rank === 2) {
                  badgeColor = 'bg-zinc-300/25 text-zinc-300 border border-zinc-300/10';
                  medalEmoji = '🥈';
                } else if (item.rank === 3) {
                  badgeColor = 'bg-amber-600/25 text-amber-500 border border-amber-600/10';
                  medalEmoji = '🥉';
                }
 
                const totalPoints = item.totalPoints;
 
                return (
                  <div
                    key={item.student.id}
                    onClick={() => toggleStudentSelection(item.student.id!)}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-xl border transition cursor-pointer select-none ${
                      selectedStudentIds.includes(item.student.id!) 
                        ? 'bg-blue-600/10 border-blue-500/40 shadow shadow-blue-500/5' 
                        : 'bg-zinc-950/40 border-zinc-800/60 hover:bg-zinc-800/40'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {/* Place index */}
                      <span className={`w-6 h-6 flex items-center justify-center rounded-lg text-xs font-bold font-mono ${badgeColor}`}>
                        {medalEmoji ? medalEmoji : `${item.rank}º`}
                      </span>
                      <div>
                        <span className="text-zinc-200 font-semibold text-xs block">{item.student.name}</span>
                        <span className="text-[10px] text-zinc-500 font-mono">Chamada #{item.student.rollNumber}</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className={`text-xs font-mono font-bold px-2 py-1 rounded-lg ${
                        totalPoints > 0 
                          ? 'bg-emerald-500/10 text-emerald-400' 
                          : totalPoints < 0 
                            ? 'bg-rose-500/10 text-rose-400' 
                            : 'bg-zinc-800 text-zinc-500'
                      }`}>
                        {totalPoints > 0 ? `+${totalPoints}` : totalPoints} pts
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
