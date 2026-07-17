import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { Student, BimonthlyGrade, AssignmentDescription, ExtraGrade } from '../types';
import { Edit2, Save, Info, AlertTriangle, Check, RefreshCw, Download, Upload } from 'lucide-react';
import { pushTeacherDataToCloud } from '../firebase';

interface TabAGradesProps {
  schoolId: number | undefined;
  classId: number | undefined;
  subjectId: number | undefined;
  bimonthly: number;
  isReadOnly?: boolean;
}

export default function TabAGrades({ schoolId, classId, subjectId, bimonthly, isReadOnly = false }: TabAGradesProps) {
  const [subTab, setSubTab] = useState<'bimonthly' | 'semester'>('bimonthly');
  const [editingDesc, setEditingDesc] = useState(false);
  const [tempDesc, setTempDesc] = useState({ t1: '', t2: '', t3: '', t4: '', t5: '' });

  // Dialog States
  const [alertDialog, setAlertDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onClose?: () => void;
  } | null>(null);

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText: string;
    cancelText: string;
    onConfirm: () => void;
  } | null>(null);

  // Load students
  const students = useLiveQuery(async () => {
    if (!classId) return [];
    return db.students.where({ classId }).sortBy('rollNumber');
  }, [classId]) || [];

  // Load grades
  const grades = useLiveQuery(async () => {
    if (!subjectId) return [];
    return db.bimonthlyGrades.where('subjectId').equals(subjectId).filter(g => g.bimonthly === bimonthly).toArray();
  }, [bimonthly, subjectId]) || [];

  // Load descriptors
  const descriptor = useLiveQuery(async () => {
    if (!classId || !subjectId) return null;
    return db.assignmentDescriptions.where('[classId+subjectId+bimonthly]').equals([classId, subjectId, bimonthly]).first();
  }, [classId, subjectId, bimonthly]);

  // Load extra/semester grades
  const extraGrades = useLiveQuery(async () => {
    if (!subjectId) return [];
    return db.extraGrades.where({ subjectId }).toArray();
  }, [subjectId]) || [];

  // Sync temp descriptor when loaded descriptor changes
  useEffect(() => {
    if (descriptor) {
      setTempDesc({
        t1: descriptor.t1 || 'Trabalho 1',
        t2: descriptor.t2 || 'Trabalho 2',
        t3: descriptor.t3 || 'Trabalho 3',
        t4: descriptor.t4 || 'Trabalho 4',
        t5: descriptor.t5 || 'Trabalho 5',
      });
    } else {
      setTempDesc({
        t1: 'Trabalho 1',
        t2: 'Trabalho 2',
        t3: 'Trabalho 3',
        t4: 'Trabalho 4',
        t5: 'Trabalho 5',
      });
    }
  }, [descriptor]);

  if (!schoolId || !classId || !subjectId) {
    return (
      <div id="grades-no-selection" className="flex flex-col items-center justify-center py-16 px-4 text-center max-w-md mx-auto">
        <div className="w-16 h-16 bg-zinc-900 rounded-2xl flex items-center justify-center mb-4 text-amber-500 border border-zinc-800">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h3 className="text-white font-bold text-lg mb-2">Seleção Pendente</h3>
        <p className="text-zinc-400 text-sm">
          Por favor, selecione uma <strong>Escola</strong>, <strong>Turma</strong> e <strong>Disciplina</strong> no cabeçalho superior para acessar o lançamento de notas.
        </p>
      </div>
    );
  }

  // Handle saving descriptor titles
  const handleSaveDescriptor = async () => {
    try {
      const existing = await db.assignmentDescriptions
        .where('[classId+subjectId+bimonthly]')
        .equals([classId!, subjectId!, bimonthly])
        .first();

      if (existing) {
        await db.assignmentDescriptions.update(existing.id!, tempDesc);
      } else {
        await db.assignmentDescriptions.add({
          classId,
          subjectId,
          bimonthly,
          ...tempDesc
        });
      }
      setEditingDesc(false);
    } catch (err) {
      console.error('Error saving assignment descriptors:', err);
    }
  };

  // Handle grade change on blur
  const handleGradeBlur = async (
    studentId: number,
    field: 't1' | 't2' | 't3' | 't4' | 't5' | 'exam',
    valStr: string
  ) => {
    const value = valStr.trim() === '' ? undefined : parseFloat(valStr.replace(',', '.'));
    
    // Validate grade range (0 to 10)
    if (value !== undefined && (isNaN(value) || value < 0 || value > 10)) {
      return; // Ignore invalid values
    }

    try {
      const gradeRecord = grades.find((g) => g.studentId === studentId);
      if (gradeRecord) {
        await db.bimonthlyGrades.update(gradeRecord.id!, { [field]: value });
      } else {
        await db.bimonthlyGrades.add({
          studentId,
          bimonthly,
          subjectId,
          [field]: value
        });
      }
    } catch (err) {
      console.error('Error saving grade:', err);
    }
  };

  // Handle extra grade change on blur
  const handleExtraGradeBlur = async (
    studentId: number,
    field: 'recSem1' | 'recSem2' | 'finalExam',
    valStr: string
  ) => {
    const value = valStr.trim() === '' ? undefined : parseFloat(valStr.replace(',', '.'));
    
    if (value !== undefined && (isNaN(value) || value < 0 || value > 10)) {
      return;
    }

    try {
      const extraRecord = extraGrades.find((eg) => eg.studentId === studentId);
      if (extraRecord) {
        await db.extraGrades.update(extraRecord.id!, { [field]: value });
      } else {
        await db.extraGrades.add({
          studentId,
          subjectId,
          [field]: value
        });
      }
    } catch (err) {
      console.error('Error saving extra grade:', err);
    }
  };

  // EXPORTAR NOTAS BIMESTRAIS PARA CSV
  const handleExportCSV = async () => {
    try {
      const classObj = await db.classes.get(Number(classId));
      const subjectObj = await db.subjects.get(Number(subjectId));
      
      const className = classObj ? classObj.name : `Turma_${classId}`;
      const subjectName = subjectObj ? subjectObj.name : `Disciplina_${subjectId}`;
      
      const headers = ['Nº', 'Nome do Aluno', 'T1', 'T2', 'T3', 'T4', 'T5', 'Prova'];
      const csvLines = [headers.join(';')];

      students.forEach((student) => {
        const gradeRecord = grades.find((g) => g.studentId === student.id);
        const t1 = gradeRecord?.t1 !== undefined ? gradeRecord.t1 : '';
        const t2 = gradeRecord?.t2 !== undefined ? gradeRecord.t2 : '';
        const t3 = gradeRecord?.t3 !== undefined ? gradeRecord.t3 : '';
        const t4 = gradeRecord?.t4 !== undefined ? gradeRecord.t4 : '';
        const t5 = gradeRecord?.t5 !== undefined ? gradeRecord.t5 : '';
        const exam = gradeRecord?.exam !== undefined ? gradeRecord.exam : '';

        const row = [
          student.rollNumber,
          student.name,
          t1,
          t2,
          t3,
          t4,
          t5,
          exam
        ];
        csvLines.push(row.join(';'));
      });

      // Inclui UTF-8 BOM para garantir acentos corretos no Excel em português
      const csvContent = '\uFEFF' + csvLines.join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      const sanitizedClassName = className.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const sanitizedSubjectName = subjectName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      link.download = `notas_${sanitizedClassName}_${sanitizedSubjectName}_${bimonthly}Bim.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error exporting CSV:', err);
      setAlertDialog({
        isOpen: true,
        title: 'Erro',
        message: 'Ocorreu um erro ao exportar as notas para CSV.'
      });
    }
  };

  // IMPORTAR NOTAS BIMESTRAIS DE CSV
  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split(/\r?\n/);
        if (lines.length < 2) {
          setAlertDialog({
            isOpen: true,
            title: 'Erro de Formato',
            message: 'O arquivo CSV selecionado está vazio ou não possui registros.'
          });
          return;
        }

        let firstLine = lines[0].replace(/^\uFEFF/, '').trim();
        const sep = firstLine.includes(';') ? ';' : ',';
        const headers = firstLine.split(sep).map(h => h.trim().toLowerCase());

        // Identifica os índices das colunas
        const rollIdx = headers.findIndex(h => h.includes('nº') || h.includes('no') || h.includes('num'));
        const nameIdx = headers.findIndex(h => h.includes('nome'));
        const t1Idx = headers.indexOf('t1');
        const t2Idx = headers.indexOf('t2');
        const t3Idx = headers.indexOf('t3');
        const t4Idx = headers.indexOf('t4');
        const t5Idx = headers.indexOf('t5');
        const examIdx = headers.findIndex(h => h.includes('prova') || h.includes('exam'));

        const parseGradeValue = (valStr: string | undefined): number | undefined => {
          if (!valStr) return undefined;
          const trimmed = valStr.trim();
          if (trimmed === '' || trimmed === '-') return undefined;
          const parsed = parseFloat(trimmed.replace(',', '.'));
          return isNaN(parsed) ? undefined : parsed;
        };

        const gradesToUpdate: {
          studentId: number;
          t1?: number;
          t2?: number;
          t3?: number;
          t4?: number;
          t5?: number;
          exam?: number;
        }[] = [];

        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          
          const columns = line.split(sep).map(c => c.trim());
          
          let matchedStudent: Student | undefined = undefined;
          
          const rollVal = rollIdx !== -1 ? parseInt(columns[rollIdx], 10) : NaN;
          const nameVal = nameIdx !== -1 ? columns[nameIdx] : '';

          if (!isNaN(rollVal)) {
            matchedStudent = students.find(s => s.rollNumber === rollVal);
          }
          if (!matchedStudent && nameVal) {
            matchedStudent = students.find(s => s.name.trim().toLowerCase() === nameVal.toLowerCase());
          }

          if (matchedStudent && matchedStudent.id) {
            const t1 = t1Idx !== -1 ? parseGradeValue(columns[t1Idx]) : undefined;
            const t2 = t2Idx !== -1 ? parseGradeValue(columns[t2Idx]) : undefined;
            const t3 = t3Idx !== -1 ? parseGradeValue(columns[t3Idx]) : undefined;
            const t4 = t4Idx !== -1 ? parseGradeValue(columns[t4Idx]) : undefined;
            const t5 = t5Idx !== -1 ? parseGradeValue(columns[t5Idx]) : undefined;
            const exam = examIdx !== -1 ? parseGradeValue(columns[examIdx]) : undefined;

            gradesToUpdate.push({
              studentId: matchedStudent.id,
              t1,
              t2,
              t3,
              t4,
              t5,
              exam
            });
          }
        }

        if (gradesToUpdate.length === 0) {
          setAlertDialog({
            isOpen: true,
            title: 'Nenhum Aluno Correspondido',
            message: 'Não foi possível fazer a correspondência de nenhum aluno do CSV com os alunos cadastrados nesta turma. Verifique se os nomes ou números de chamada (Nº) estão idênticos.'
          });
          return;
        }

        setConfirmDialog({
          isOpen: true,
          title: 'Confirmar Importação de Notas',
          message: `Deseja importar, restaurar e salvar as notas de ${gradesToUpdate.length} alunos correspondidos nesta turma para o ${bimonthly}º Bimestre? Qualquer nota existente do mesmo trabalho/prova no banco de dados local e na nuvem será substituída pelas novas do CSV.`,
          confirmText: 'Importar Notas',
          cancelText: 'Cancelar',
          onConfirm: async () => {
            setConfirmDialog(null);
            
            try {
              await db.transaction('rw', [db.bimonthlyGrades], async () => {
                for (const update of gradesToUpdate) {
                  const existingGrade = grades.find(g => g.studentId === update.studentId);
                  
                  const updateData: Partial<BimonthlyGrade> = {};
                  if (update.t1 !== undefined) updateData.t1 = update.t1;
                  if (update.t2 !== undefined) updateData.t2 = update.t2;
                  if (update.t3 !== undefined) updateData.t3 = update.t3;
                  if (update.t4 !== undefined) updateData.t4 = update.t4;
                  if (update.t5 !== undefined) updateData.t5 = update.t5;
                  if (update.exam !== undefined) updateData.exam = update.exam;

                  if (existingGrade && existingGrade.id) {
                    await db.bimonthlyGrades.update(existingGrade.id, updateData);
                  } else {
                    await db.bimonthlyGrades.add({
                      studentId: update.studentId,
                      bimonthly,
                      subjectId: Number(subjectId),
                      ...updateData
                    });
                  }
                }
              });

              // Sincronizar as alterações com o Firebase Firestore se logado
              const activeUser = localStorage.getItem('portal_active_user');
              if (activeUser) {
                try {
                  await pushTeacherDataToCloud(activeUser, db);
                } catch (cloudErr) {
                  console.error('Failed to sync CSV imported grades to Cloud:', cloudErr);
                }
              }

              setAlertDialog({
                isOpen: true,
                title: 'Importação Concluída',
                message: `As notas de ${gradesToUpdate.length} alunos foram importadas, restauradas e sincronizadas com sucesso tanto localmente quanto na nuvem!`
              });
            } catch (saveErr) {
              console.error('Error saving imported grades:', saveErr);
              setAlertDialog({
                isOpen: true,
                title: 'Erro de Banco de Dados',
                message: 'Ocorreu um erro ao salvar as notas importadas no banco de dados.'
              });
            }
          }
        });

      } catch (parseErr) {
        console.error('Error parsing CSV:', parseErr);
        setAlertDialog({
          isOpen: true,
          title: 'Erro de Leitura',
          message: 'Falha ao analisar o arquivo CSV. Certifique-se de que é um arquivo CSV separado por vírgulas ou ponto-e-vírgula válido.'
        });
      }
    };

    reader.readAsText(file, 'utf-8');
    e.target.value = ''; // limpa input
  };

  // Keyboard navigation by column (not by row)
  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    studentId: number,
    field: 't1' | 't2' | 't3' | 't4' | 't5' | 'exam' | 'recSem1' | 'recSem2' | 'finalExam'
  ) => {
    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault();
      
      // Find current student index
      const idx = students.findIndex((s) => s.id === studentId);
      if (idx !== -1 && idx < students.length - 1) {
        const nextStudent = students[idx + 1];
        // Focus the next student's input for the same field
        const nextInputId = field.startsWith('rec') || field === 'finalExam'
          ? `grade-${field.toLowerCase()}-${nextStudent.id}`
          : `grade-${field}-${nextStudent.id}`;
        
        const nextInput = document.getElementById(nextInputId) as HTMLInputElement | null;
        if (nextInput) {
          nextInput.focus();
          nextInput.select();
        }
      } else {
        // If last student, blur current input to trigger save and finish
        (e.target as HTMLInputElement).blur();
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      
      const idx = students.findIndex((s) => s.id === studentId);
      if (idx > 0) {
        const prevStudent = students[idx - 1];
        const prevInputId = field.startsWith('rec') || field === 'finalExam'
          ? `grade-${field.toLowerCase()}-${prevStudent.id}`
          : `grade-${field}-${prevStudent.id}`;
        
        const prevInput = document.getElementById(prevInputId) as HTMLInputElement | null;
        if (prevInput) {
          prevInput.focus();
          prevInput.select();
        }
      } else {
        // If first student, just blur
        (e.target as HTMLInputElement).blur();
      }
    }
  };

  const getGradeValue = (studentId: number, field: 't1' | 't2' | 't3' | 't4' | 't5' | 'exam') => {
    const gradeRecord = grades.find((g) => g.studentId === studentId);
    if (!gradeRecord) return '';
    const val = gradeRecord[field];
    return val === undefined ? '' : val.toString();
  };

  const getExtraGradeValue = (studentId: number, field: 'recSem1' | 'recSem2' | 'finalExam') => {
    const extraRecord = extraGrades.find((eg) => eg.studentId === studentId);
    if (!extraRecord) return '';
    const val = extraRecord[field];
    return val === undefined ? '' : val.toString();
  };

  // Helper to calculate student averages
  const calculateMedia = (studentId: number) => {
    const record = grades.find((g) => g.studentId === studentId);
    if (!record) return { media: 0, hasGrades: false };

    const hasAnyGrade =
      record.t1 !== undefined ||
      record.t2 !== undefined ||
      record.t3 !== undefined ||
      record.t4 !== undefined ||
      record.t5 !== undefined ||
      record.exam !== undefined;

    if (!hasAnyGrade) return { media: 0, hasGrades: false };

    const t1 = record.t1 ?? 0;
    const t2 = record.t2 ?? 0;
    const t3 = record.t3 ?? 0;
    const t4 = record.t4 ?? 0;
    const t5 = record.t5 ?? 0;
    const exam = record.exam;

    const trabalhosSum = t1 + t2 + t3 + t4 + t5;

    let media = 0;
    if (exam !== undefined) {
      // Se a prova já foi realizada, calcula a média dividindo a soma dos trabalhos e a prova por 2
      const hasAnyTrab =
        record.t1 !== undefined ||
        record.t2 !== undefined ||
        record.t3 !== undefined ||
        record.t4 !== undefined ||
        record.t5 !== undefined;
      
      if (!hasAnyTrab) {
        media = exam; // Se só tem prova e nenhum trabalho, a nota é a própria prova
      } else {
        media = (trabalhosSum + exam) / 2;
      }
    } else {
      // Se a prova ainda não foi lançada, a nota do bimestre é a soma dos trabalhos realizados
      media = trabalhosSum;
    }

    return { media: parseFloat(media.toFixed(1)), hasGrades: true };
  };

  // Helper style classes for individual grades (individual grades should not be highlighted in red)
  const getGradeInputClass = (studentId: number, field: 't1' | 't2' | 't3' | 't4' | 't5' | 'exam') => {
    return 'text-zinc-100 bg-zinc-800 focus:ring-blue-500';
  };

  const getExtraGradeInputClass = (studentId: number, field: 'recSem1' | 'recSem2' | 'finalExam') => {
    return field === 'finalExam'
      ? 'text-red-400 font-bold bg-zinc-800 focus:ring-red-500'
      : 'text-amber-400 font-bold bg-zinc-800 focus:ring-blue-500';
  };

  const t1Label = tempDesc.t1 || 'Trabalho 1';
  const t2Label = tempDesc.t2 || 'Trabalho 2';
  const t3Label = tempDesc.t3 || 'Trabalho 3';
  const t4Label = tempDesc.t4 || 'Trabalho 4';
  const t5Label = tempDesc.t5 || 'Trabalho 5';

  return (
    <div id="grades-tab-content" className="space-y-6">
      {/* Sub-tab Navigation */}
      <div className="flex border-b border-zinc-800">
        <button
          id="subtab-bimonthly-btn"
          onClick={() => setSubTab('bimonthly')}
          className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors ${
            subTab === 'bimonthly'
              ? 'border-blue-500 text-blue-400 bg-blue-500/5'
              : 'border-transparent text-zinc-400 hover:text-zinc-300 hover:bg-zinc-900/40'
          }`}
        >
          Notas Bimestrais ({bimonthly}º Bim)
        </button>
        <button
          id="subtab-semester-btn"
          onClick={() => setSubTab('semester')}
          className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors ${
            subTab === 'semester'
              ? 'border-blue-500 text-blue-400 bg-blue-500/5'
              : 'border-transparent text-zinc-400 hover:text-zinc-300 hover:bg-zinc-900/40'
          }`}
        >
          Recuperações Semestrais & Final
        </button>
      </div>

      {subTab === 'bimonthly' ? (
        <div id="bimonthly-grades-section" className="space-y-4">
          {/* Header Info & Edit Descriptors */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-900/50 p-4 rounded-xl border border-zinc-800">
            <div className="flex items-start gap-2.5 text-xs text-zinc-400 max-w-2xl">
              <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-zinc-300">Regra de Cálculo:</p>
                <p>
                  Média = (Soma dos 5 Trabalhos [T1 a T5, que devem somar até 10 pontos] + Nota da Prova [até 10 pontos]) / 2.
                  Se a Média for menor que 7.0, ela será destacada em vermelho. A recuperação é semestral e pode ser lançada na aba "Recuperações Semestrais & Final".
                </p>
              </div>
            </div>

            {!isReadOnly && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  id="export-csv-btn"
                  onClick={handleExportCSV}
                  className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-zinc-750 transition cursor-pointer"
                  title="Exportar notas da turma para planilha Excel/CSV"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-400" />
                  Exportar Notas (CSV)
                </button>

                <label
                  id="import-csv-label"
                  className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-zinc-750 transition cursor-pointer"
                  title="Importar notas de uma planilha Excel/CSV"
                >
                  <Upload className="w-3.5 h-3.5 text-amber-400" />
                  <span>Importar Notas (CSV)</span>
                  <input
                    id="import-csv-file-input"
                    type="file"
                    accept=".csv"
                    onChange={handleImportCSV}
                    className="hidden"
                  />
                </label>

                <button
                  id="edit-descriptors-btn"
                  onClick={() => setEditingDesc(!editingDesc)}
                  className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-zinc-750 transition cursor-pointer"
                >
                  <Edit2 className="w-3.5 h-3.5 text-blue-400" />
                  {editingDesc ? 'Fechar Editor' : 'Atividades (T1-T5)'}
                </button>
              </div>
            )}
          </div>

          {/* Collapsible Edit Descriptors Form */}
          {editingDesc && (
            <div id="descriptors-form-panel" className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl space-y-3 shadow-inner animate-in fade-in zoom-in-95 duration-150">
              <h4 className="text-zinc-200 text-xs font-bold uppercase tracking-wider">Identificadores Personalizados do {bimonthly}º Bimestre</h4>
              <p className="text-xs text-zinc-400">Atribua nomes reais para facilitar o preenchimento das notas (Ex: "Trabalho de campo", "Seminário", etc):</p>
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                {['t1', 't2', 't3', 't4', 't5'].map((field, idx) => (
                  <div key={field} className="space-y-1">
                    <label className="text-xs font-medium text-zinc-400 block">Trabalho {idx + 1} (T{idx + 1})</label>
                    <input
                      id={`descriptor-input-t${idx + 1}`}
                      type="text"
                      value={(tempDesc as any)[field]}
                      onChange={(e) => setTempDesc({ ...tempDesc, [field]: e.target.value })}
                      placeholder={`Trabalho ${idx + 1}`}
                      className="bg-zinc-950 border border-zinc-800 text-zinc-200 text-xs rounded-lg px-2.5 py-1.5 w-full focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                ))}
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
                <button
                  id="cancel-descriptors-btn"
                  type="button"
                  onClick={() => setEditingDesc(false)}
                  className="px-3 py-1.5 hover:bg-zinc-800 text-zinc-400 text-xs rounded-lg font-medium transition"
                >
                  Cancelar
                </button>
                <button
                  id="save-descriptors-btn"
                  type="button"
                  onClick={handleSaveDescriptor}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded-lg font-semibold flex items-center gap-1 shadow transition"
                >
                  <Save className="w-3.5 h-3.5" />
                  Salvar Títulos
                </button>
              </div>
            </div>
          )}

          {/* Grades Grid Table */}
          <div className="overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-900/30">
            <table id="grades-table" className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-900 border-b border-zinc-800 text-zinc-400 text-xs font-semibold select-none">
                  <th className="py-4 px-3 w-12 text-center">Nº</th>
                  <th className="py-4 px-4 min-w-[180px]">Nome do Aluno</th>
                  <th className="py-4 px-2 text-center w-18" title={t1Label}>{t1Label.length > 10 ? t1Label.substring(0, 8) + '..' : t1Label}<span className="block text-[9px] text-zinc-500 font-normal">T1</span></th>
                  <th className="py-4 px-2 text-center w-18" title={t2Label}>{t2Label.length > 10 ? t2Label.substring(0, 8) + '..' : t2Label}<span className="block text-[9px] text-zinc-500 font-normal">T2</span></th>
                  <th className="py-4 px-2 text-center w-18" title={t3Label}>{t3Label.length > 10 ? t3Label.substring(0, 8) + '..' : t3Label}<span className="block text-[9px] text-zinc-500 font-normal">T3</span></th>
                  <th className="py-4 px-2 text-center w-18" title={t4Label}>{t4Label.length > 10 ? t4Label.substring(0, 8) + '..' : t4Label}<span className="block text-[9px] text-zinc-500 font-normal">T4</span></th>
                  <th className="py-4 px-2 text-center w-18" title={t5Label}>{t5Label.length > 10 ? t5Label.substring(0, 8) + '..' : t5Label}<span className="block text-[9px] text-zinc-500 font-normal">T5</span></th>
                  <th className="py-4 px-2 text-center w-18">Prova<span className="block text-[9px] text-zinc-500 font-normal">Fim</span></th>
                  <th className="py-4 px-3 text-center w-24 bg-blue-950/20 text-blue-400 font-bold border-l border-zinc-800">Média Final</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 text-sm">
                {students.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-zinc-500">
                      Nenhum aluno cadastrado nesta turma. Cadastre alunos nas Configurações.
                    </td>
                  </tr>
                ) : (
                  students.map((student, idx) => {
                    const { media, hasGrades } = calculateMedia(student.id!);
                    const isBelowAverage = hasGrades && media < 7.0;

                    return (
                      <tr key={student.id} className="hover:bg-white/5 transition-colors group">
                        <td className="py-3 px-3 text-center text-zinc-500 font-mono text-xs">{student.rollNumber}</td>
                        <td className="py-3 px-4 font-medium text-zinc-200">{student.name}</td>
                        
                        {/* T1 */}
                        <td className="py-2 px-1 text-center">
                          <input
                            id={`grade-t1-${student.id}`}
                            type="text"
                            disabled={isReadOnly}
                            defaultValue={getGradeValue(student.id!, 't1')}
                            onBlur={(e) => handleGradeBlur(student.id!, 't1', e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, student.id!, 't1')}
                            placeholder="-"
                            tabIndex={100 + idx}
                            className={`w-12 text-center disabled:opacity-75 disabled:text-zinc-400 border-none rounded py-1 px-2 font-mono text-xs focus:ring-1 focus:outline-none ${getGradeInputClass(student.id!, 't1')}`}
                          />
                        </td>
                        {/* T2 */}
                        <td className="py-2 px-1 text-center">
                          <input
                            id={`grade-t2-${student.id}`}
                            type="text"
                            disabled={isReadOnly}
                            defaultValue={getGradeValue(student.id!, 't2')}
                            onBlur={(e) => handleGradeBlur(student.id!, 't2', e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, student.id!, 't2')}
                            placeholder="-"
                            tabIndex={200 + idx}
                            className={`w-12 text-center disabled:opacity-75 disabled:text-zinc-400 border-none rounded py-1 px-2 font-mono text-xs focus:ring-1 focus:outline-none ${getGradeInputClass(student.id!, 't2')}`}
                          />
                        </td>
                        {/* T3 */}
                        <td className="py-2 px-1 text-center">
                          <input
                            id={`grade-t3-${student.id}`}
                            type="text"
                            disabled={isReadOnly}
                            defaultValue={getGradeValue(student.id!, 't3')}
                            onBlur={(e) => handleGradeBlur(student.id!, 't3', e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, student.id!, 't3')}
                            placeholder="-"
                            tabIndex={300 + idx}
                            className={`w-12 text-center disabled:opacity-75 disabled:text-zinc-400 border-none rounded py-1 px-2 font-mono text-xs focus:ring-1 focus:outline-none ${getGradeInputClass(student.id!, 't3')}`}
                          />
                        </td>
                        {/* T4 */}
                        <td className="py-2 px-1 text-center">
                          <input
                            id={`grade-t4-${student.id}`}
                            type="text"
                            disabled={isReadOnly}
                            defaultValue={getGradeValue(student.id!, 't4')}
                            onBlur={(e) => handleGradeBlur(student.id!, 't4', e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, student.id!, 't4')}
                            placeholder="-"
                            tabIndex={400 + idx}
                            className={`w-12 text-center disabled:opacity-75 disabled:text-zinc-400 border-none rounded py-1 px-2 font-mono text-xs focus:ring-1 focus:outline-none ${getGradeInputClass(student.id!, 't4')}`}
                          />
                        </td>
                        {/* T5 */}
                        <td className="py-2 px-1 text-center">
                          <input
                            id={`grade-t5-${student.id}`}
                            type="text"
                            disabled={isReadOnly}
                            defaultValue={getGradeValue(student.id!, 't5')}
                            onBlur={(e) => handleGradeBlur(student.id!, 't5', e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, student.id!, 't5')}
                            placeholder="-"
                            tabIndex={500 + idx}
                            className={`w-12 text-center disabled:opacity-75 disabled:text-zinc-400 border-none rounded py-1 px-2 font-mono text-xs focus:ring-1 focus:outline-none ${getGradeInputClass(student.id!, 't5')}`}
                          />
                        </td>
                        {/* Exam */}
                        <td className="py-2 px-1 text-center">
                          <input
                            id={`grade-exam-${student.id}`}
                            type="text"
                            disabled={isReadOnly}
                            defaultValue={getGradeValue(student.id!, 'exam')}
                            onBlur={(e) => handleGradeBlur(student.id!, 'exam', e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, student.id!, 'exam')}
                            placeholder="-"
                            tabIndex={600 + idx}
                            className={`w-12 text-center disabled:opacity-75 disabled:text-zinc-400 border-none rounded py-1 px-2 font-mono text-xs focus:ring-1 focus:outline-none ${getGradeInputClass(student.id!, 'exam')}`}
                          />
                        </td>
                        
                        {/* final grade */}
                        <td className={`py-3 px-3 text-center font-mono font-extrabold text-sm border-l border-zinc-800 bg-blue-950/10 ${
                          isBelowAverage ? 'text-rose-400 bg-rose-500/5' : hasGrades ? 'text-blue-400' : 'text-zinc-500'
                        }`}>
                          {hasGrades ? media.toFixed(1) : '-'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div id="semester-recovery-section" className="space-y-4">
          <div className="bg-zinc-900/50 p-4 rounded-xl border border-zinc-800 text-xs text-zinc-400 flex items-start gap-2.5 max-w-3xl">
            <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-zinc-300">Recuperações de Médio & Longo Prazo:</p>
              <p>
                Utilize este espaço para lançar as notas de <strong>Recuperação Semestral 1</strong> (geralmente compensa notas do 1º e 2º bimestre), <strong>Recuperação Semestral 2</strong> (3º e 4º bimestre), e a <strong>Prova Final</strong> de fechamento anual. Estas notas são consolidadas no diário escolar do aluno.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-900/30">
            <table id="recovery-table" className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-900 border-b border-zinc-800 text-zinc-400 text-xs font-semibold select-none">
                  <th className="py-4 px-3 w-12 text-center">Nº</th>
                  <th className="py-4 px-4 min-w-[200px]">Nome do Aluno</th>
                  <th className="py-4 px-3 text-center w-36">Recuperação Semestral 1<span className="block text-[9px] text-zinc-500 font-normal">Bimestres 1 e 2</span></th>
                  <th className="py-4 px-3 text-center w-36">Recuperação Semestral 2<span className="block text-[9px] text-zinc-500 font-normal">Bimestres 3 e 4</span></th>
                  <th className="py-4 px-3 text-center w-36 bg-red-950/10 text-red-400">Prova Final<span className="block text-[9px] text-red-500/50 font-normal">Encerramento Anual</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 text-sm">
                {students.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-zinc-500">
                      Nenhum aluno cadastrado nesta turma.
                    </td>
                  </tr>
                ) : (
                  students.map((student, idx) => {
                    return (
                      <tr key={student.id} className="hover:bg-white/5 transition-colors group">
                        <td className="py-3 px-3 text-center text-zinc-500 font-mono text-xs">{student.rollNumber}</td>
                        <td className="py-3 px-4 font-medium text-zinc-200">{student.name}</td>
                        
                        {/* Rec Sem 1 */}
                        <td className="py-2 px-3 text-center">
                          <input
                            id={`grade-recsem1-${student.id}`}
                            type="text"
                            disabled={isReadOnly}
                            defaultValue={getExtraGradeValue(student.id!, 'recSem1')}
                            onBlur={(e) => handleExtraGradeBlur(student.id!, 'recSem1', e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, student.id!, 'recSem1')}
                            placeholder="-"
                            tabIndex={1000 + idx}
                            className={`w-24 text-center disabled:opacity-75 disabled:text-zinc-500 border-none rounded py-1 px-2 font-mono text-xs focus:ring-1 focus:outline-none ${getExtraGradeInputClass(student.id!, 'recSem1')}`}
                          />
                        </td>

                        {/* Rec Sem 2 */}
                        <td className="py-2 px-3 text-center">
                          <input
                            id={`grade-recsem2-${student.id}`}
                            type="text"
                            disabled={isReadOnly}
                            defaultValue={getExtraGradeValue(student.id!, 'recSem2')}
                            onBlur={(e) => handleExtraGradeBlur(student.id!, 'recSem2', e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, student.id!, 'recSem2')}
                            placeholder="-"
                            tabIndex={1100 + idx}
                            className={`w-24 text-center disabled:opacity-75 disabled:text-zinc-500 border-none rounded py-1 px-2 font-mono text-xs focus:ring-1 focus:outline-none ${getExtraGradeInputClass(student.id!, 'recSem2')}`}
                          />
                        </td>

                        {/* Prova Final */}
                        <td className="py-2 px-3 text-center bg-red-950/5">
                          <input
                            id={`grade-finalexam-${student.id}`}
                            type="text"
                            disabled={isReadOnly}
                            defaultValue={getExtraGradeValue(student.id!, 'finalExam')}
                            onBlur={(e) => handleExtraGradeBlur(student.id!, 'finalExam', e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, student.id!, 'finalExam')}
                            placeholder="-"
                            tabIndex={1200 + idx}
                            className={`w-24 text-center disabled:opacity-75 disabled:text-zinc-500 border-none rounded py-1 px-2 font-mono font-bold text-xs focus:ring-1 focus:outline-none ${getExtraGradeInputClass(student.id!, 'finalExam')}`}
                          />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Diálogo de Confirmação Customizado */}
      {confirmDialog && confirmDialog.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-amber-500">
              <AlertTriangle className="w-6 h-6 shrink-0 text-amber-500" />
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
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold transition cursor-pointer shadow-lg shadow-blue-900/20"
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
              <Check className="w-5 h-5 shrink-0 bg-emerald-500/10 p-1 rounded-full text-emerald-400" />
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
