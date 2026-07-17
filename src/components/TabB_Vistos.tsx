import { useState, FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { Student, VistoColumn, StudentVisto } from '../types';
import { Plus, Trash2, Calendar, FileSpreadsheet, AlertTriangle, CheckSquare, Square, Info } from 'lucide-react';

interface TabBVistosProps {
  schoolId: number | undefined;
  classId: number | undefined;
  subjectId: number | undefined;
  bimonthly: number;
  isReadOnly?: boolean;
}

export default function TabBVistos({ schoolId, classId, subjectId, bimonthly, isReadOnly = false }: TabBVistosProps) {
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [newColDate, setNewColDate] = useState(new Date().toISOString().split('T')[0]);
  const [newColTitle, setNewColTitle] = useState('');

  // Query students
  const students = useLiveQuery(async () => {
    if (!classId) return [];
    return db.students.where({ classId }).sortBy('rollNumber');
  }, [classId]) || [];

  // Query visto columns
  const columns = useLiveQuery(async () => {
    if (!classId || !subjectId) return [];
    const targetClassId = Number(classId);
    const targetSubjectId = Number(subjectId);
    const targetBimonthly = Number(bimonthly);
    const list = await db.vistoColumns.toArray();
    return list.filter(c => Number(c.classId) === targetClassId && Number(c.subjectId) === targetSubjectId && Number(c.bimonthly) === targetBimonthly);
  }, [classId, subjectId, bimonthly]) || [];

  // Query student vistos
  const studentVistos = useLiveQuery(async () => {
    if (columns.length === 0) return [];
    const colIds = columns.map((c) => c.id!);
    return db.studentVistos.where('vistoColumnId').anyOf(colIds).toArray();
  }, [columns]) || [];

  if (!schoolId || !classId || !subjectId) {
    return (
      <div id="vistos-no-selection" className="flex flex-col items-center justify-center py-16 px-4 text-center max-w-md mx-auto">
        <div className="w-16 h-16 bg-zinc-900 rounded-2xl flex items-center justify-center mb-4 text-amber-500 border border-zinc-800">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h3 className="text-white font-bold text-lg mb-2">Seleção Pendente</h3>
        <p className="text-zinc-400 text-sm">
          Por favor, selecione uma <strong>Escola</strong>, <strong>Turma</strong> e <strong>Disciplina</strong> no cabeçalho superior para acessar as anotações de vistos.
        </p>
      </div>
    );
  }

  // Add new visto column
  const handleAddColumn = async (e: FormEvent) => {
    e.preventDefault();
    if (!newColTitle.trim()) return;

    try {
      const colId = await db.vistoColumns.add({
        classId,
        subjectId,
        bimonthly,
        date: newColDate,
        title: newColTitle.trim(),
      });

      // Pre-seed checked status for each student to false
      for (const student of students) {
        await db.studentVistos.add({
          studentId: student.id!,
          vistoColumnId: colId,
          checked: false,
        });
      }

      setNewColTitle('');
      setShowAddColumn(false);
    } catch (err) {
      console.error('Error adding visto column:', err);
    }
  };

  // Delete visto column
  const handleDeleteColumn = async (columnId: number) => {
    if (!confirm('Deseja realmente excluir esta coluna de vistos e todos os seus registros de alunos?')) {
      return;
    }
    try {
      await db.vistoColumns.delete(columnId);
      // Delete associated student checkmarks
      const associatedVistos = await db.studentVistos.where({ vistoColumnId: columnId }).toArray();
      for (const v of associatedVistos) {
        await db.studentVistos.delete(v.id!);
      }
    } catch (err) {
      console.error('Error deleting column:', err);
    }
  };

  // Toggle checklist checkmark
  const handleToggleVisto = async (studentId: number, columnId: number) => {
    try {
      const existing = studentVistos.find(
        (v) => v.studentId === studentId && v.vistoColumnId === columnId
      );

      if (existing) {
        await db.studentVistos.update(existing.id!, { checked: !existing.checked });
      } else {
        await db.studentVistos.add({
          studentId,
          vistoColumnId: columnId,
          checked: true,
        });
      }
    } catch (err) {
      console.error('Error toggling visto:', err);
    }
  };

  const isChecked = (studentId: number, columnId: number): boolean => {
    const v = studentVistos.find((sv) => sv.studentId === studentId && sv.vistoColumnId === columnId);
    return v ? v.checked : false;
  };

  // Calculate stats for a student
  const getStudentStats = (studentId: number) => {
    if (columns.length === 0) return { received: 0, total: 0, pct: 0 };
    const received = studentVistos.filter(
      (v) => v.studentId === studentId && v.checked && columns.some((col) => col.id === v.vistoColumnId)
    ).length;
    const total = columns.length;
    const pct = Math.round((received / total) * 100);
    return { received, total, pct };
  };

  // CSV Export for Vistos
  const handleExportCSV = () => {
    if (students.length === 0) return;
    
    // Header
    const colHeaders = columns.map((col) => `"${col.title} (${col.date})"`).join(',');
    let csvContent = `Nº,Aluno,${colHeaders},"Vistos Entregues","Total","Aproveitamento %"\n`;

    // Rows
    students.forEach((student) => {
      const rowVistos = columns.map((col) => {
        return isChecked(student.id!, col.id!) ? 'SIM' : 'NÃO';
      }).join(',');
      
      const stats = getStudentStats(student.id!);
      csvContent += `${student.rollNumber},"${student.name}",${rowVistos},${stats.received},${stats.total},${stats.pct}%\n`;
    });

    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `vistos_bimestre_${bimonthly}_turma_${classId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div id="vistos-tab-content" className="space-y-6">
      {/* Upper Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-white font-bold text-lg tracking-tight flex items-center gap-2">
            Anotações de Vistos Diários
          </h2>
          <p className="text-xs text-zinc-400">
            Acompanhe vistos de caderno, dever de casa e tarefas cotidianas da turma.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="export-vistos-csv-btn"
            onClick={handleExportCSV}
            disabled={columns.length === 0}
            className="px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-300 font-semibold text-xs rounded-xl border border-zinc-700/80 flex items-center gap-2 transition"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
            Exportar CSV
          </button>
          
          {!isReadOnly && (
            <button
              id="toggle-add-column-btn"
              onClick={() => setShowAddColumn(!showAddColumn)}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-blue-500/10 flex items-center gap-1.5 transition"
            >
              <Plus className="w-4 h-4" />
              Adicionar Aula/Visto
            </button>
          )}
        </div>
      </div>

      {/* Add Column Dialog Inline */}
      {showAddColumn && (
        <form
          id="add-visto-column-form"
          onSubmit={handleAddColumn}
          className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl space-y-4 max-w-lg shadow-xl animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="flex items-center gap-2 border-b border-zinc-800 pb-2">
            <Calendar className="w-4 h-4 text-blue-400" />
            <h3 className="text-zinc-200 text-sm font-bold">Criar Nova Coluna de Visto</h3>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-zinc-400">Data do Visto</label>
              <input
                id="visto-date-input"
                type="date"
                required
                value={newColDate}
                onChange={(e) => setNewColDate(e.target.value)}
                className="bg-zinc-950 border border-zinc-800 text-zinc-200 text-xs rounded-xl px-2.5 py-2 w-full focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            
            <div className="space-y-1 col-span-1">
              <label className="text-xs font-medium text-zinc-400">Descrição / Título da Tarefa</label>
              <input
                id="visto-title-input"
                type="text"
                required
                placeholder="Ex: Tarefa Pág 12 ou Desenho Celular"
                value={newColTitle}
                onChange={(e) => setNewColTitle(e.target.value)}
                className="bg-zinc-950 border border-zinc-800 text-zinc-200 text-xs rounded-xl px-2.5 py-2 w-full focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
            <button
              id="cancel-add-column-btn"
              type="button"
              onClick={() => setShowAddColumn(false)}
              className="px-3.5 py-2 hover:bg-zinc-800 text-zinc-400 text-xs rounded-lg font-medium transition"
            >
              Cancelar
            </button>
            <button
              id="confirm-add-column-btn"
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded-lg font-bold transition shadow-sm"
            >
              Criar Coluna
            </button>
          </div>
        </form>
      )}

      {/* Checklist Grid */}
      <div className="overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-900/30">
        <table id="vistos-grid-table" className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-zinc-900 border-b border-zinc-800 text-zinc-400 text-xs font-semibold select-none">
              <th className="py-4 px-3 w-12 text-center">Nº</th>
              <th className="py-4 px-4 min-w-[200px]">Nome do Aluno</th>
              
              {/* Dynamic Seen Columns */}
              {columns.map((col) => (
                <th key={col.id} className="py-3 px-2 text-center w-36 border-l border-zinc-800/40">
                  <div className="flex flex-col items-center justify-between h-full min-h-[55px] px-1">
                    <span className="text-[11px] text-zinc-200 font-bold tracking-tight block truncate max-w-[120px]" title={col.title}>
                      {col.title}
                    </span>
                    <span className="text-[10px] text-zinc-500 font-mono block mt-0.5">
                      {col.date.split('-').reverse().slice(0, 2).join('/')}
                    </span>
                    {!isReadOnly && (
                      <button
                        id={`delete-column-btn-${col.id}`}
                        type="button"
                        onClick={() => handleDeleteColumn(col.id!)}
                        className="mt-1 text-zinc-500 hover:text-red-400 transition p-1 rounded hover:bg-zinc-800"
                        title="Excluir coluna"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </th>
              ))}

              {/* Summary columns */}
              <th className="py-4 px-3 text-center w-24 border-l border-zinc-800 bg-zinc-900/50">Vistos / Tot</th>
              <th className="py-4 px-3 text-center w-24 bg-blue-950/20 text-blue-400 font-bold">% Apr</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60 text-sm">
            {students.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 4} className="py-8 text-center text-zinc-500">
                  Nenhum aluno cadastrado nesta turma.
                </td>
              </tr>
            ) : columns.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-12 text-center text-zinc-400">
                  <Info className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
                  <p className="font-semibold text-zinc-300 text-sm">Nenhuma coluna de visto criada neste bimestre.</p>
                  <p className="text-xs text-zinc-500 mt-1">Clique em "Adicionar Aula/Visto" para iniciar os lançamentos!</p>
                </td>
              </tr>
            ) : (
              students.map((student) => {
                const stats = getStudentStats(student.id!);

                return (
                  <tr key={student.id} className="hover:bg-white/5 transition-colors group">
                    <td className="py-3 px-3 text-center text-zinc-500 font-mono text-xs">{student.rollNumber}</td>
                    <td className="py-3 px-4 font-medium text-zinc-200">{student.name}</td>
                    
                    {/* Checkbox columns */}
                    {columns.map((col) => {
                      const checked = isChecked(student.id!, col.id!);
                      return (
                        <td key={col.id} className="py-1.5 px-1 text-center border-l border-zinc-800/40">
                          <button
                            id={`visto-check-${student.id}-${col.id}`}
                            type="button"
                            disabled={isReadOnly}
                            onClick={() => !isReadOnly && handleToggleVisto(student.id!, col.id!)}
                            className="inline-flex items-center justify-center w-10 h-10 rounded-xl transition cursor-pointer active:scale-95 disabled:pointer-events-none text-xl"
                            title={`${student.name} - ${col.title}`}
                          >
                            {checked ? (
                              <CheckSquare className="w-5.5 h-5.5 text-emerald-400" />
                            ) : (
                              <Square className="w-5.5 h-5.5 text-zinc-750 hover:text-zinc-500 disabled:hover:text-zinc-750" />
                            )}
                          </button>
                        </td>
                      );
                    })}

                    {/* Stats */}
                    <td className="py-3 px-3 text-center font-mono text-xs border-l border-zinc-800 bg-zinc-950/20 text-zinc-300">
                      {stats.received} / {stats.total}
                    </td>

                    <td className={`py-3 px-3 text-center font-mono font-bold text-xs bg-blue-950/10 ${
                      stats.pct >= 70 ? 'text-emerald-400' : stats.pct >= 50 ? 'text-yellow-400' : 'text-rose-400'
                    }`}>
                      {stats.pct}%
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
