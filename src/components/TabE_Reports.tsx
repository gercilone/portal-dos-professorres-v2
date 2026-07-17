import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { Student, QUICK_SCORE_OPTIONS, sortClasses } from '../types';
import { FileText, Printer, FileSpreadsheet, Award, CheckCircle, Calendar, AlertTriangle, Eye, BookOpen, Share2, Info } from 'lucide-react';

interface TabEReportsProps {
  schoolId: number | undefined;
  classId: number | undefined;
  subjectId: number | undefined;
  bimonthly: number;
  isReadOnly?: boolean;
}

type ReportType = 'grades' | 'attendance' | 'vistos' | 'behavior' | 'lessons_count';

export default function TabEReports({ schoolId, classId, subjectId, bimonthly, isReadOnly }: TabEReportsProps) {
  const [activeReport, setActiveReport] = useState<ReportType>('grades');

  // Load database metadata
  const school = useLiveQuery(() => (schoolId ? db.schools.get(schoolId) : undefined), [schoolId]);
  const clazz = useLiveQuery(() => (classId ? db.classes.get(classId) : undefined), [classId]);
  const subject = useLiveQuery(() => (subjectId ? db.subjects.get(subjectId) : undefined), [subjectId]);

  // Load students
  const students = useLiveQuery(async () => {
    if (!classId) return [];
    return db.students.where({ classId }).sortBy('rollNumber');
  }, [classId]) || [];

  // Load bimonthly grades
  const grades = useLiveQuery(async () => {
    if (!subjectId) return [];
    const targetSubjectId = Number(subjectId);
    const targetBimonthly = Number(bimonthly);
    return db.bimonthlyGrades
      .filter(g => Number(g.subjectId) === targetSubjectId && Number(g.bimonthly) === targetBimonthly)
      .toArray();
  }, [bimonthly, subjectId]) || [];

  // Load descriptor labels
  const descriptor = useLiveQuery(async () => {
    if (!classId || !subjectId) return null;
    const targetClassId = Number(classId);
    const targetSubjectId = Number(subjectId);
    const targetBimonthly = Number(bimonthly);
    return db.assignmentDescriptions
      .filter(a => Number(a.classId) === targetClassId && Number(a.subjectId) === targetSubjectId && Number(a.bimonthly) === targetBimonthly)
      .first();
  }, [classId, subjectId, bimonthly]);

  // Load seen columns & vistos
  const vistoColumns = useLiveQuery(async () => {
    if (!classId || !subjectId) return [];
    const targetClassId = Number(classId);
    const targetSubjectId = Number(subjectId);
    const targetBimonthly = Number(bimonthly);
    return db.vistoColumns
      .filter(c => Number(c.classId) === targetClassId && Number(c.subjectId) === targetSubjectId && Number(c.bimonthly) === targetBimonthly)
      .toArray();
  }, [classId, subjectId, bimonthly]) || [];

  const studentVistos = useLiveQuery(async () => {
    if (vistoColumns.length === 0) return [];
    return db.studentVistos.where('vistoColumnId').anyOf(vistoColumns.map((c) => c.id!)).toArray();
  }, [vistoColumns]) || [];

  // Load behavior ranking scores
  const behaviorScores = useLiveQuery(async () => {
    if (!subjectId) return [];
    const targetSubjectId = Number(subjectId);
    const targetBimonthly = Number(bimonthly);
    return db.vistoRankingScores
      .filter(s => Number(s.subjectId) === targetSubjectId && Number(s.bimonthly) === targetBimonthly)
      .toArray();
  }, [subjectId, bimonthly]) || [];

  // Load attendance lessons and absences
  const lessons = useLiveQuery(async () => {
    if (!classId || !subjectId) return [];
    const targetClassId = Number(classId);
    const targetSubjectId = Number(subjectId);
    const targetBimonthly = Number(bimonthly);
    return db.lessons
      .filter(l => Number(l.classId) === targetClassId && Number(l.subjectId) === targetSubjectId && Number(l.bimonthly) === targetBimonthly)
      .toArray();
  }, [classId, subjectId, bimonthly]) || [];

  const attendance = useLiveQuery(async () => {
    if (!subjectId) return [];
    const targetSubjectId = Number(subjectId);
    const targetBimonthly = Number(bimonthly);
    return db.attendance
      .filter(a => Number(a.subjectId) === targetSubjectId && Number(a.bimonthly) === targetBimonthly)
      .toArray();
  }, [subjectId, bimonthly]) || [];

  // Load all classes in the current school
  const allSchoolClasses = useLiveQuery(async () => {
    if (!schoolId) return [];
    const targetSchoolId = Number(schoolId);
    const list = await db.classes.filter(c => Number(c.schoolId) === targetSchoolId).toArray();
    return list.sort(sortClasses);
  }, [schoolId]) || [];

  // Load all lessons in the database for the selected subject
  const allLessonsForSubject = useLiveQuery(async () => {
    if (!subjectId) return [];
    const targetSubjectId = Number(subjectId);
    return db.lessons.filter(l => Number(l.subjectId) === targetSubjectId).toArray();
  }, [subjectId]) || [];

  if (!schoolId || !classId || !subjectId) {
    return (
      <div id="reports-no-selection" className="flex flex-col items-center justify-center py-16 px-4 text-center max-w-md mx-auto">
        <div className="w-16 h-16 bg-zinc-900 rounded-2xl flex items-center justify-center mb-4 text-amber-500 border border-zinc-800">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h3 className="text-white font-bold text-lg mb-2">Seleção Pendente</h3>
        <p className="text-zinc-400 text-sm">
          Selecione **Escola**, **Turma** e **Disciplina** no painel superior para habilitar a geração de relatórios de classe.
        </p>
      </div>
    );
  }

  const schoolName = school?.name || 'Escola Não Identificada';
  const className = clazz?.name || 'Turma Não Identificada';
  const subjectName = subject?.name || 'Disciplina Não Identificada';

  // Assignment labels
  const t1Label = descriptor?.t1 || 'Trabalho 1';
  const t2Label = descriptor?.t2 || 'Trabalho 2';
  const t3Label = descriptor?.t3 || 'Trabalho 3';
  const t4Label = descriptor?.t4 || 'Trabalho 4';
  const t5Label = descriptor?.t5 || 'Trabalho 5';

  // Average grades calculation
  const getStudentGradesRow = (studentId: number) => {
    const record = grades.find((g) => g.studentId === studentId);
    if (!record) return { t1: '-', t2: '-', t3: '-', t4: '-', t5: '-', exam: '-', average: '-' };

    const t1 = record.t1 !== undefined ? record.t1 : undefined;
    const t2 = record.t2 !== undefined ? record.t2 : undefined;
    const t3 = record.t3 !== undefined ? record.t3 : undefined;
    const t4 = record.t4 !== undefined ? record.t4 : undefined;
    const t5 = record.t5 !== undefined ? record.t5 : undefined;
    const exam = record.exam !== undefined ? record.exam : undefined;

    const hasAny = t1 !== undefined || t2 !== undefined || t3 !== undefined || t4 !== undefined || t5 !== undefined || exam !== undefined;
    if (!hasAny) return { t1: '-', t2: '-', t3: '-', t4: '-', t5: '-', exam: '-', average: '-' };

    const worksSum = (t1 ?? 0) + (t2 ?? 0) + (t3 ?? 0) + (t4 ?? 0) + (t5 ?? 0);
    
    let averageVal = 0;
    if (exam !== undefined) {
      const hasAnyTrab = t1 !== undefined || t2 !== undefined || t3 !== undefined || t4 !== undefined || t5 !== undefined;
      if (!hasAnyTrab) {
        averageVal = exam;
      } else {
        averageVal = (worksSum + exam) / 2;
      }
    } else {
      averageVal = worksSum;
    }

    const average = parseFloat(averageVal.toFixed(1));

    return {
      t1: t1 !== undefined ? t1.toFixed(1) : '-',
      t2: t2 !== undefined ? t2.toFixed(1) : '-',
      t3: t3 !== undefined ? t3.toFixed(1) : '-',
      t4: t4 !== undefined ? t4.toFixed(1) : '-',
      t5: t5 !== undefined ? t5.toFixed(1) : '-',
      exam: exam !== undefined ? exam.toFixed(1) : '-',
      average: average.toFixed(1),
    };
  };

  // Vistos calculation
  const getStudentVistosRow = (studentId: number) => {
    if (vistoColumns.length === 0) return { checklist: [], received: 0, total: 0, pct: 0 };
    const checklist = vistoColumns.map((col) => {
      const v = studentVistos.find((sv) => sv.studentId === studentId && sv.vistoColumnId === col.id);
      return v ? v.checked : false;
    });
    const received = checklist.filter(Boolean).length;
    const total = vistoColumns.length;
    const pct = Math.round((received / total) * 100);
    return { checklist, received, total, pct };
  };

  // Behavior summary
  const getStudentBehaviorRow = (studentId: number) => {
    const studentScores = behaviorScores.filter((s) => s.studentId === studentId);
    const totalPoints = studentScores.reduce((acc, curr) => acc + curr.points, 0);
    const positives = studentScores.filter((s) => s.points > 0).length;
    const negatives = studentScores.filter((s) => s.points < 0).length;
    return { totalPoints, positives, negatives };
  };

  // Attendance summary
  const getStudentAttendanceRow = (studentId: number) => {
    const totalLessons = lessons.reduce((acc, curr) => acc + (Number(curr.lessonCount) || 2), 0);
    const absences = attendance
      .filter((a) => a.studentId === studentId)
      .reduce((acc, curr) => acc + curr.absences, 0);

    const pct = totalLessons === 0 ? 100 : Math.max(0, Math.min(100, Math.round(((totalLessons - absences) / totalLessons) * 100)));
    return { totalLessons, absences, pct };
  };

  const getClassLessonsForBimonthly = (classIdVal: number, bim: number) => {
    const cid = Number(classIdVal);
    const bimNum = Number(bim);
    return allLessonsForSubject
      .filter((l) => Number(l.classId) === cid && Number(l.bimonthly) === bimNum)
      .reduce((sum, curr) => sum + (Number(curr.lessonCount) || 2), 0);
  };

  // Print Report Handler
  const handlePrint = () => {
    window.print();
  };

  // EXPORT CSV HANDLERS
  const handleExportCSV = () => {
    if (activeReport !== 'lessons_count' && students.length === 0) return;
    if (activeReport === 'lessons_count' && allSchoolClasses.length === 0) return;

    let csvContent = '';
    let fileName = '';

    if (activeReport === 'lessons_count') {
      fileName = `Contagem_Aulas_Materia_${subjectName.replace(/\s+/g, '_')}.csv`;
      csvContent = `Contagem de Aulas Ministradas\n`;
      csvContent += `Escola: ${schoolName}\nMatéria: ${subjectName}\n\n`;
      csvContent += `Série / Turma,1º Bim,2º Bim,3º Bim,4º Bim,Total Anual\n`;

      let totalBim1 = 0;
      let totalBim2 = 0;
      let totalBim3 = 0;
      let totalBim4 = 0;

      allSchoolClasses.forEach((cls) => {
        const b1 = getClassLessonsForBimonthly(cls.id!, 1);
        const b2 = getClassLessonsForBimonthly(cls.id!, 2);
        const b3 = getClassLessonsForBimonthly(cls.id!, 3);
        const b4 = getClassLessonsForBimonthly(cls.id!, 4);
        const rowTotal = b1 + b2 + b3 + b4;

        totalBim1 += b1;
        totalBim2 += b2;
        totalBim3 += b3;
        totalBim4 += b4;

        csvContent += `"${cls.name}",${b1},${b2},${b3},${b4},${rowTotal}\n`;
      });

      const schoolTotal = totalBim1 + totalBim2 + totalBim3 + totalBim4;
      csvContent += `"TOTAL DA ESCOLA",${totalBim1},${totalBim2},${totalBim3},${totalBim4},${schoolTotal}\n`;
    } 
    else if (activeReport === 'grades') {
      fileName = `Boletim_Notas_Bimestre_${bimonthly}_Turma_${clazz?.name}.csv`;
      csvContent = `Relatório de Notas Bimestrais\n`;
      csvContent += `Escola: ${schoolName}\nTurma: ${className}\nDisciplina: ${subjectName}\nBimestre: ${bimonthly}º Bimestre\n\n`;
      csvContent += `Nº,Nome Aluno,T1 (${t1Label}),T2 (${t2Label}),T3 (${t3Label}),T4 (${t4Label}),T5 (${t5Label}),Prova,Média Final\n`;
      
      students.forEach((st) => {
        const row = getStudentGradesRow(st.id!);
        csvContent += `${st.rollNumber},"${st.name}",${row.t1},${row.t2},${row.t3},${row.t4},${row.t5},${row.exam},${row.average}\n`;
      });
    } 
    else if (activeReport === 'attendance') {
      fileName = `Frequencia_Aulas_Bimestre_${bimonthly}_Turma_${clazz?.name}.csv`;
      csvContent = `Relatório de Frequência Acumulada\n`;
      csvContent += `Escola: ${schoolName}\nTurma: ${className}\nDisciplina: ${subjectName}\nBimestre: ${bimonthly}º Bimestre\n\n`;
      csvContent += `Nº,Nome Aluno,Aulas Ministradas,Faltas Totais,Presença %\n`;

      students.forEach((st) => {
        const row = getStudentAttendanceRow(st.id!);
        csvContent += `${st.rollNumber},"${st.name}",${row.totalLessons},${row.absences},${row.pct}%\n`;
      });
    } 
    else if (activeReport === 'vistos') {
      fileName = `Anotacoes_Vistos_Bimestre_${bimonthly}_Turma_${clazz?.name}.csv`;
      csvContent = `Anotações de Vistos de Caderno\n`;
      csvContent += `Escola: ${schoolName}\nTurma: ${className}\nDisciplina: ${subjectName}\nBimestre: ${bimonthly}º Bimestre\n\n`;
      
      // Seen columns header
      const seenHeaders = vistoColumns.map((col) => `"${col.title} (${col.date})"`).join(',');
      csvContent += `Nº,Nome Aluno,${seenHeaders},Entregues,Total,Aproveitamento %\n`;

      students.forEach((st) => {
        const row = getStudentVistosRow(st.id!);
        const marks = row.checklist.map((c) => (c ? 'SIM' : 'NÃO')).join(',');
        csvContent += `${st.rollNumber},"${st.name}",${marks},${row.received},${row.total},${row.pct}%\n`;
      });
    } 
    else if (activeReport === 'behavior') {
      fileName = `Estatisticas_Rank_Bimestre_${bimonthly}_Turma_${clazz?.name}.csv`;
      csvContent = `Estatísticas do Rank de Comportamento\n`;
      csvContent += `Escola: ${schoolName}\nTurma: ${className}\nDisciplina: ${subjectName}\nBimestre: ${bimonthly}º Bimestre\n\n`;
      csvContent += `Classificação,Nº,Nome Aluno,Pontos Totais,Ocorrências Positivas,Ocorrências Negativas\n`;

      const ranked = students.map((st) => ({ student: st, row: getStudentBehaviorRow(st.id!) }))
        .sort((a, b) => b.row.totalPoints - a.row.totalPoints);

      ranked.forEach((item, idx) => {
        csvContent += `${idx + 1}º,${item.student.rollNumber},"${item.student.name}",${item.row.totalPoints},${item.row.positives},${item.row.negatives}\n`;
      });
    }

    // Force UTF-8 download with BOM for Excel compat
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div id="reports-tab-content" className="space-y-6">
      
      {/* Printable Wrapper (hides normal UI when printing) */}
      <style>{`
        @media print {
          body {
            background: white !important;
            color: black !important;
          }
          /* Hide non-printable workspace elements */
          #header-filters-container,
          #app-main-tabs-nav,
          #report-selectors-pane,
          #report-action-buttons,
          .aistudio-frame-wrapper,
          #workspace-nav {
            display: none !important;
          }
          #print-document-preview {
            background: white !important;
            color: black !important;
            padding: 0 !important;
            margin: 0 !important;
            border: none !important;
            box-shadow: none !important;
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          table {
            border-collapse: collapse;
            width: 100%;
            color: black !important;
          }
          th, td {
            border: 1px solid #444 !important;
            color: black !important;
            font-size: 11px !important;
            padding: 6px 4px !important;
          }
          th {
            background-color: #f1f1f1 !important;
          }
          tr {
            page-break-inside: avoid;
          }
        }
      `}</style>

      {/* Main Panel */}
      <div id="report-selectors-pane" className="grid grid-cols-2 md:grid-cols-5 gap-3 bg-zinc-900/60 p-3 rounded-2xl border border-zinc-800">
        <button
          id="select-report-grades-btn"
          onClick={() => setActiveReport('grades')}
          className={`flex items-center gap-2 p-3 rounded-xl font-semibold text-xs tracking-tight border transition cursor-pointer ${
            activeReport === 'grades'
              ? 'bg-blue-600 border-blue-500 text-white shadow shadow-blue-500/10'
              : 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:bg-zinc-900'
          }`}
        >
          <FileText className="w-4 h-4 text-sky-400 shrink-0" />
          Boletim de Notas
        </button>

        <button
          id="select-report-attendance-btn"
          onClick={() => setActiveReport('attendance')}
          className={`flex items-center gap-2 p-3 rounded-xl font-semibold text-xs tracking-tight border transition cursor-pointer ${
            activeReport === 'attendance'
              ? 'bg-blue-600 border-blue-500 text-white shadow shadow-blue-500/10'
              : 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:bg-zinc-900'
          }`}
        >
          <Calendar className="w-4 h-4 text-emerald-400 shrink-0" />
          Frequência Acumulada
        </button>

        <button
          id="select-report-vistos-btn"
          onClick={() => setActiveReport('vistos')}
          className={`flex items-center gap-2 p-3 rounded-xl font-semibold text-xs tracking-tight border transition cursor-pointer ${
            activeReport === 'vistos'
              ? 'bg-blue-600 border-blue-500 text-white shadow shadow-blue-500/10'
              : 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:bg-zinc-900'
          }`}
        >
          <CheckCircle className="w-4 h-4 text-teal-400 shrink-0" />
          Anotações de Vistos
        </button>

        <button
          id="select-report-behavior-btn"
          onClick={() => setActiveReport('behavior')}
          className={`flex items-center gap-2 p-3 rounded-xl font-semibold text-xs tracking-tight border transition cursor-pointer ${
            activeReport === 'behavior'
              ? 'bg-blue-600 border-blue-500 text-white shadow shadow-blue-500/10'
              : 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:bg-zinc-900'
          }`}
        >
          <Award className="w-4 h-4 text-yellow-400 shrink-0" />
          Estatísticas do Rank
        </button>

        <button
          id="select-report-lessons-count-btn"
          onClick={() => setActiveReport('lessons_count')}
          className={`flex items-center gap-2 p-3 rounded-xl font-semibold text-xs tracking-tight border transition cursor-pointer ${
            activeReport === 'lessons_count'
              ? 'bg-blue-600 border-blue-500 text-white shadow shadow-blue-500/10'
              : 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:bg-zinc-900'
          }`}
        >
          <BookOpen className="w-4 h-4 text-indigo-400 shrink-0" />
          Contagem de Aulas
        </button>
      </div>

      {/* Preview Header & Printable trigger */}
      <div id="report-action-buttons" className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-zinc-500" />
          <h3 className="text-zinc-300 font-bold text-sm">Pré-visualização do Relatório</h3>
        </div>
        
        <div className="flex items-center gap-2 shrink-0">
          <button
            id="report-export-csv-btn"
            onClick={handleExportCSV}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl font-semibold text-xs border border-zinc-700 flex items-center gap-1.5 transition cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
            Baixar Planilha (.csv)
          </button>
          
          <button
            id="report-print-btn"
            onClick={handlePrint}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 transition shadow cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            Imprimir Relatório (PDF)
          </button>
        </div>
      </div>

      {/* Visual Report Document (High-Fidelity Paper look-alike inside application) */}
      <div
        id="print-document-preview"
        className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 md:p-8 space-y-6 shadow-2xl relative overflow-hidden"
      >
        {/* Document School Header */}
        <div className="border-b-2 border-zinc-850 pb-4 flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-white print:text-black font-extrabold text-xl uppercase tracking-tight">{schoolName}</h2>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-400 font-medium">
              <p>Turma: <strong className="text-zinc-300 print:text-black">{className}</strong></p>
              <p>Componente: <strong className="text-zinc-300 print:text-black">{subjectName}</strong></p>
            </div>
          </div>
          
          <div className="text-right shrink-0">
            <span className="inline-block bg-blue-950/40 text-blue-400 border border-blue-500/10 text-xs font-bold uppercase px-3 py-1.5 rounded-xl print:border-black print:text-black">
              {bimonthly}º Bimestre - Diário de Classe
            </span>
            <p className="text-[10px] text-zinc-500 font-mono mt-1">Data de emissão: {new Date().toLocaleDateString('pt-BR')}</p>
          </div>
        </div>

        {/* 1. GRADES REPORT TABLE */}
        {activeReport === 'grades' && (() => {
          // Calculate student statistics for the bimonthly grades
          const classifiedStudents = students.map((st) => {
            const row = getStudentGradesRow(st.id!);
            const avg = row.average === '-' ? null : parseFloat(row.average);
            return { student: st, avg };
          });

          const stats = {
            abaixo: 0,
            basico: 0,
            adequado: 0,
            avancado: 0,
            semNota: 0,
          };

          classifiedStudents.forEach((item) => {
            if (item.avg === null) {
              stats.semNota++;
            } else if (item.avg < 5.0) {
              stats.abaixo++;
            } else if (item.avg >= 5.0 && item.avg < 7.0) {
              stats.basico++;
            } else if (item.avg >= 7.0 && item.avg < 9.0) {
              stats.adequado++;
            } else if (item.avg >= 9.0) {
              stats.avancado++;
            }
          });

          const totalClassified = stats.abaixo + stats.basico + stats.adequado + stats.avancado;

          const r = 36;
          const strokeWidth = 10;
          const circumference = 2 * Math.PI * r; // ~226.195

          const data = [
            { key: 'abaixo', value: stats.abaixo, color: '#ef4444', label: 'Abaixo do Básico' },
            { key: 'basico', value: stats.basico, color: '#f59e0b', label: 'Básico' },
            { key: 'adequado', value: stats.adequado, color: '#3b82f6', label: 'Adequado' },
            { key: 'avancado', value: stats.avancado, color: '#10b981', label: 'Avançado' },
          ];

          // Calculate percentage and dash offset
          let currentOffset = 0;
          const slices = data.map((d) => {
            const percentage = totalClassified > 0 ? (d.value / totalClassified) : 0;
            const strokeLength = percentage * circumference;
            const strokeDasharray = `${strokeLength} ${circumference}`;
            const strokeDashoffset = currentOffset;
            currentOffset -= strokeLength;
            return {
              ...d,
              percentage: Math.round(percentage * 100),
              strokeDasharray,
              strokeDashoffset,
            };
          });

          return (
            <div className="space-y-6">
              <h4 className="text-zinc-200 print:text-black font-bold text-xs uppercase tracking-wider">Boletim de Aproveitamento</h4>

              {/* Desempenho Geral da Turma - High Fidelity Card */}
              <div id="class-performance-chart-card" className="bg-zinc-950/40 border border-zinc-800 rounded-2xl p-6 print:bg-transparent print:border-zinc-300 print:text-black space-y-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-blue-500/10 text-blue-400 rounded-xl shrink-0 print:hidden">
                    <Award className="w-5 h-5 text-sky-400" />
                  </div>
                  <div>
                    <h3 className="text-white print:text-black font-extrabold text-sm md:text-base tracking-tight flex items-center gap-1.5">
                      Desempenho Geral da Turma
                    </h3>
                    <p className="text-zinc-400 print:text-zinc-600 text-[11px] md:text-xs mt-0.5">
                      Classificação e distribuição dos alunos com base na média obtida neste bimestre.
                    </p>
                  </div>
                </div>

                {totalClassified === 0 ? (
                  <div className="text-center py-8 text-zinc-500 text-xs font-medium">
                    Nenhuma nota bimestral calculada ainda. Lance as notas na aba "Notas" para visualizar o gráfico de distribuição.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                    {/* Chart Column */}
                    <div className="md:col-span-5 flex justify-center py-2">
                      <div className="relative flex items-center justify-center w-40 h-40 md:w-44 md:h-44">
                        <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-md">
                          <circle
                            cx="50"
                            cy="50"
                            r={r}
                            fill="transparent"
                            stroke="#27272a"
                            strokeWidth={strokeWidth}
                            className="print:stroke-zinc-200"
                          />
                          {slices.map((slice) => {
                            if (slice.value === 0) return null;
                            return (
                              <circle
                                key={slice.key}
                                cx="50"
                                cy="50"
                                r={r}
                                fill="transparent"
                                stroke={slice.color}
                                strokeWidth={strokeWidth}
                                strokeDasharray={slice.strokeDasharray}
                                strokeDashoffset={slice.strokeDashoffset}
                                transform="rotate(-90 50 50)"
                                strokeLinecap="butt"
                                className="transition-all duration-500 ease-out"
                              />
                            );
                          })}
                          <text x="50" y="48" textAnchor="middle" className="fill-white print:fill-black font-extrabold text-[15px]">
                            {totalClassified}
                          </text>
                          <text x="50" y="58" textAnchor="middle" className="fill-zinc-400 print:fill-zinc-600 font-bold text-[7px] uppercase tracking-wider">
                            {totalClassified === 1 ? 'Aluno' : 'Alunos'}
                          </text>
                        </svg>
                      </div>
                    </div>

                    {/* Categories Column */}
                    <div className="md:col-span-7 space-y-2.5">
                      {slices.map((slice) => {
                        const pct = totalClassified > 0 ? Math.round((slice.value / totalClassified) * 100) : 0;
                        
                        let rowClass = "";
                        let dotClass = "";
                        let textPrimaryClass = "";
                        let textSecondaryClass = "";
                        let badgeClass = "";

                        if (slice.key === 'abaixo') {
                          rowClass = "bg-rose-500/5 border-rose-500/10 text-rose-400 print:bg-rose-50 print:border-rose-200 print:text-rose-700";
                          dotClass = "bg-rose-500";
                          textPrimaryClass = "text-rose-200 print:text-rose-900";
                          textSecondaryClass = "text-rose-400/70 print:text-rose-600/80";
                          badgeClass = "text-rose-400 print:text-rose-800 font-extrabold";
                        } else if (slice.key === 'basico') {
                          rowClass = "bg-amber-500/5 border-amber-500/10 text-amber-400 print:bg-amber-50 print:border-amber-200 print:text-amber-700";
                          dotClass = "bg-amber-500";
                          textPrimaryClass = "text-amber-200 print:text-amber-900";
                          textSecondaryClass = "text-amber-400/70 print:text-amber-600/80";
                          badgeClass = "text-amber-400 print:text-amber-800 font-extrabold";
                        } else if (slice.key === 'adequado') {
                          rowClass = "bg-blue-500/5 border-blue-500/10 text-blue-400 print:bg-blue-50 print:border-blue-200 print:text-blue-700";
                          dotClass = "bg-blue-500";
                          textPrimaryClass = "text-blue-200 print:text-blue-900";
                          textSecondaryClass = "text-blue-400/70 print:text-blue-600/80";
                          badgeClass = "text-blue-400 print:text-blue-800 font-extrabold";
                        } else {
                          rowClass = "bg-emerald-500/5 border-emerald-500/10 text-emerald-400 print:bg-emerald-50 print:border-emerald-200 print:text-emerald-700";
                          dotClass = "bg-emerald-500";
                          textPrimaryClass = "text-emerald-200 print:text-emerald-900";
                          textSecondaryClass = "text-emerald-400/70 print:text-emerald-600/80";
                          badgeClass = "text-emerald-400 print:text-emerald-800 font-extrabold";
                        }

                        return (
                          <div
                            key={slice.key}
                            className={`flex items-center justify-between p-3 rounded-xl border transition duration-200 ${rowClass}`}
                          >
                            <div className="flex items-center gap-2.5">
                              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${dotClass}`} />
                              <div>
                                <p className={`font-bold text-xs tracking-tight ${textPrimaryClass}`}>{slice.label}</p>
                                <p className={`text-[10px] font-medium ${textSecondaryClass}`}>
                                  {slice.key === 'abaixo' && 'Média < 5.0'}
                                  {slice.key === 'basico' && 'Média 5.0 a 6.9'}
                                  {slice.key === 'adequado' && 'Média 7.0 a 8.9'}
                                  {slice.key === 'avancado' && 'Média >= 9.0'}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <span className={`font-bold text-xs ${badgeClass}`}>
                                {slice.value} <span className="text-[10px] opacity-80">({pct}%)</span>
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Table Container */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-zinc-950/60 print:bg-zinc-200 border-b border-zinc-800 text-zinc-300 print:text-black font-bold uppercase text-[10px]">
                      <th className="py-2.5 px-2 text-center w-10">Nº</th>
                      <th className="py-2.5 px-3">Aluno</th>
                      <th className="py-2.5 px-2 text-center w-16" title={t1Label}>T1</th>
                      <th className="py-2.5 px-2 text-center w-16" title={t2Label}>T2</th>
                      <th className="py-2.5 px-2 text-center w-16" title={t3Label}>T3</th>
                      <th className="py-2.5 px-2 text-center w-16" title={t4Label}>T4</th>
                      <th className="py-2.5 px-2 text-center w-16" title={t5Label}>T5</th>
                      <th className="py-2.5 px-2 text-center w-16">Prova</th>
                      <th className="py-2.5 px-3 text-center w-24 bg-blue-950/20 text-blue-400 font-bold border-l border-zinc-800">Média Final</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60 text-zinc-300 print:text-black">
                    {students.map((st) => {
                      const row = getStudentGradesRow(st.id!);
                      const isBelow = row.average !== '-' && parseFloat(row.average) < 7.0;

                      return (
                        <tr key={st.id} className="hover:bg-white/5">
                          <td className="py-2 px-2 text-center font-mono">{st.rollNumber}</td>
                          <td className="py-2 px-3 font-semibold text-zinc-200 print:text-black">{st.name}</td>
                          <td className="py-2 px-2 text-center font-mono">{row.t1}</td>
                          <td className="py-2 px-2 text-center font-mono">{row.t2}</td>
                          <td className="py-2 px-2 text-center font-mono">{row.t3}</td>
                          <td className="py-2 px-2 text-center font-mono">{row.t4}</td>
                          <td className="py-2 px-2 text-center font-mono">{row.t5}</td>
                          <td className="py-2 px-2 text-center font-mono">{row.exam}</td>
                          <td className={`py-2 px-3 text-center font-mono font-extrabold bg-blue-950/10 text-blue-400 print:text-black ${isBelow ? 'text-rose-400' : ''}`}>
                            {row.average}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="text-[10px] text-zinc-500 font-medium pt-3 leading-relaxed">
                <p>* Descritores Bimestrais cadastrados: T1 = {t1Label}; T2 = {t2Label}; T3 = {t3Label}; T4 = {t4Label}; T5 = {t5Label}</p>
                <p>* Nota de corte para aprovação do bimestre: 7.0 (A recuperação é realizada ao fim de cada semestre)</p>
              </div>
            </div>
          );
        })()}

        {/* 2. ATTENDANCE REPORT TABLE */}
        {activeReport === 'attendance' && (
          <div className="space-y-3">
            <h4 className="text-zinc-200 print:text-black font-bold text-xs uppercase tracking-wider">Frequência Acumulada do Aluno</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-zinc-950/60 print:bg-zinc-200 border-b border-zinc-800 text-zinc-300 print:text-black font-bold uppercase text-[10px]">
                    <th className="py-2.5 px-3 w-12 text-center">Nº</th>
                    <th className="py-2.5 px-4">Nome do Aluno</th>
                    <th className="py-2.5 px-3 text-center w-40">Horas-Aula Ministradas</th>
                    <th className="py-2.5 px-3 text-center w-40">Faltas Registradas</th>
                    <th className="py-2.5 px-3 text-center w-40 bg-blue-950/20 text-blue-400 font-bold">Porcentagem de Presença</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 text-zinc-300 print:text-black">
                  {students.map((st) => {
                    const row = getStudentAttendanceRow(st.id!);
                    const hasAttendanceRisk = row.pct < 75;

                    return (
                      <tr key={st.id} className="hover:bg-white/5">
                        <td className="py-2 px-3 text-center font-mono">{st.rollNumber}</td>
                        <td className="py-2 px-4 font-semibold text-zinc-200 print:text-black">{st.name}</td>
                        <td className="py-2 px-3 text-center font-mono">{row.totalLessons}</td>
                        <td className="py-2 px-3 text-center font-mono text-rose-400">{row.absences}</td>
                        <td className={`py-2 px-3 text-center font-mono font-bold bg-blue-950/10 text-blue-400 print:text-black ${hasAttendanceRisk ? 'text-rose-400 font-extrabold' : ''}`}>
                          {row.pct}% {hasAttendanceRisk ? '⚠️' : ''}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="text-[10px] text-zinc-500 font-medium pt-3">
              <p>* Limite de Faltas Legal: Alunos necessitam de no mínimo 75% de presença para aprovação.</p>
              <p>* O símbolo "⚠️" indica que o aluno se encontra abaixo do percentual mínimo permitido por lei.</p>
            </div>
          </div>
        )}

        {/* 3. VISTOS REPORT TABLE */}
        {activeReport === 'vistos' && (
          <div className="space-y-3">
            <h4 className="text-zinc-200 print:text-black font-bold text-xs uppercase tracking-wider">Anotações do Bimestre (Checklist de Vistos de Caderno)</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-zinc-950/60 print:bg-zinc-200 border-b border-zinc-800 text-zinc-300 print:text-black font-bold uppercase text-[10px]">
                    <th className="py-2.5 px-2 w-10 text-center">Nº</th>
                    <th className="py-2.5 px-3">Aluno</th>
                    {vistoColumns.map((col) => (
                      <th key={col.id} className="py-2.5 px-1 text-center w-20 border-l border-zinc-800/40" title={col.title}>
                        <span className="block text-[9px] truncate max-w-[70px]">{col.title}</span>
                        <span className="block text-[8px] text-zinc-500 font-normal font-mono">{col.date.split('-').reverse().slice(0,2).join('/')}</span>
                      </th>
                    ))}
                    <th className="py-2.5 px-2 text-center w-20 border-l border-zinc-800">Vistos / Tot</th>
                    <th className="py-2.5 px-2 text-center w-20 bg-blue-950/20 text-blue-400 font-bold">% Apr</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 text-zinc-300 print:text-black">
                  {students.map((st) => {
                    const row = getStudentVistosRow(st.id!);

                    return (
                      <tr key={st.id} className="hover:bg-white/5">
                        <td className="py-2 px-2 text-center font-mono">{st.rollNumber}</td>
                        <td className="py-2 px-3 font-semibold text-zinc-200 print:text-black">{st.name}</td>
                        
                        {/* Vistos checklist symbols */}
                        {row.checklist.map((checked, colIdx) => (
                          <td key={colIdx} className="py-2 px-1 text-center font-semibold text-[10px] border-l border-zinc-800/40">
                            {checked ? 'OK' : '-'}
                          </td>
                        ))}

                        <td className="py-2 px-2 text-center font-mono border-l border-zinc-800">{row.received} / {row.total}</td>
                        <td className="py-2 px-2 text-center font-mono font-bold bg-blue-950/10 text-blue-400 print:text-black">{row.pct}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="text-[10px] text-zinc-500 font-medium pt-3">
              <p>* "OK" indica que o aluno apresentou a tarefa de caderno satisfatoriamente na data estabelecida.</p>
              <p>* % Apr = Porcentagem de aproveitamento (vistos entregues em relação ao total de colunas lançadas).</p>
            </div>
          </div>
        )}

        {/* 4. BEHAVIOR STATS REPORT */}
        {activeReport === 'behavior' && (
          <div className="space-y-3">
            <h4 className="text-zinc-200 print:text-black font-bold text-xs uppercase tracking-wider">Classificação de Comportamento & Gamificação</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-zinc-950/60 print:bg-zinc-200 border-b border-zinc-800 text-zinc-300 print:text-black font-bold uppercase text-[10px]">
                    <th className="py-2.5 px-3 w-16 text-center">Posição</th>
                    <th className="py-2.5 px-2 w-12 text-center">Nº</th>
                    <th className="py-2.5 px-4">Nome do Aluno</th>
                    <th className="py-2.5 px-3 text-center w-36">Pontos Acumulados</th>
                    <th className="py-2.5 px-3 text-center w-36 text-emerald-400 print:text-black">Ocorrências Positivas</th>
                    <th className="py-2.5 px-3 text-center w-36 text-rose-400 print:text-black">Ocorrências Negativas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 text-zinc-300 print:text-black">
                  {students.map((st) => ({ student: st, row: getStudentBehaviorRow(st.id!) }))
                    .sort((a, b) => b.row.totalPoints - a.row.totalPoints)
                    .map((item, idx) => {
                      return (
                        <tr key={item.student.id} className="hover:bg-white/5">
                          <td className="py-2 px-3 text-center font-bold">{idx + 1}º</td>
                          <td className="py-2 px-2 text-center font-mono text-zinc-500">{item.student.rollNumber}</td>
                          <td className="py-2 px-4 font-semibold text-zinc-200 print:text-black">{item.student.name}</td>
                          <td className={`py-2 px-3 text-center font-mono font-bold ${item.row.totalPoints > 0 ? 'text-emerald-400' : item.row.totalPoints < 0 ? 'text-rose-400' : 'text-zinc-500'}`}>
                            {item.row.totalPoints > 0 ? `+${item.row.totalPoints}` : item.row.totalPoints} pts
                          </td>
                          <td className="py-2 px-3 text-center font-mono text-emerald-500">{item.row.positives}</td>
                          <td className="py-2 px-3 text-center font-mono text-rose-500">{item.row.negatives}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
            <div className="text-[10px] text-zinc-500 font-medium pt-3 leading-relaxed">
              <p>* A pontuação é somada e subtraída de acordo com a conduta diária em classe do estudante.</p>
              <p>* Ocorrências positivas incluem: cópia integral de conteúdos (+1), resposta correta (+1), explicações à turma (+2), dever de casa (+1).</p>
              <p>* Ocorrências negativas incluem: atrapalhar aula (-2), conversar excessivamente (-1), não copiar matéria (-1), não fazer tarefa (-1).</p>
            </div>
          </div>
        )}

        {/* 5. LESSONS COUNT REPORT TABLE */}
        {activeReport === 'lessons_count' && (
          <div className="space-y-4">
            {/* Export Header Block */}
            <div className="bg-blue-950/20 border border-blue-900/30 p-5 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4 print:hidden">
              <div className="space-y-1 w-full text-left">
                <h4 className="text-white font-bold text-sm flex items-center gap-1.5">
                  <Share2 className="w-4 h-4 text-blue-400" /> Exportar Contagem de Aulas
                </h4>
                <p className="text-zinc-400 text-xs leading-relaxed max-w-2xl">
                  Gere e salve a planilha contendo a contagem consolidada de aulas ministradas para a matéria <strong className="text-blue-400">'{subjectName}'</strong> em todas as turmas, separadas por bimestre e o total anual.
                </p>
              </div>
              <button
                id="export-lessons-count-csv-btn"
                onClick={handleExportCSV}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-xs flex items-center gap-2 transition shadow-lg shadow-blue-500/10 shrink-0 cursor-pointer w-full md:w-auto justify-center"
              >
                <FileSpreadsheet className="w-4 h-4" />
                Exportar Planilha de Aulas (.csv)
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-1.5 border-b border-zinc-800/60 pb-2">
                <Info className="w-4 h-4 text-blue-400" />
                <h4 className="text-zinc-200 print:text-black font-bold text-xs uppercase tracking-wider">
                  Quadro de Aulas Ministradas - Matéria: {subjectName}
                </h4>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-zinc-950/60 print:bg-zinc-200 border-b border-zinc-800 text-zinc-300 print:text-black font-bold uppercase text-[10px]">
                      <th className="py-3 px-4">Série / Turma</th>
                      <th className="py-3 px-3 text-center w-28">1º Bim</th>
                      <th className="py-3 px-3 text-center w-28">2º Bim</th>
                      <th className="py-3 px-3 text-center w-28">3º Bim</th>
                      <th className="py-3 px-3 text-center w-28">4º Bim</th>
                      <th className="py-3 px-4 text-center w-32 bg-blue-950/20 text-blue-400 font-bold border-l border-zinc-800">Total Anual</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60 text-zinc-300 print:text-black">
                    {(() => {
                      let schoolBim1 = 0;
                      let schoolBim2 = 0;
                      let schoolBim3 = 0;
                      let schoolBim4 = 0;

                      return (
                        <>
                          {allSchoolClasses.map((cls) => {
                            const b1 = getClassLessonsForBimonthly(cls.id!, 1);
                            const b2 = getClassLessonsForBimonthly(cls.id!, 2);
                            const b3 = getClassLessonsForBimonthly(cls.id!, 3);
                            const b4 = getClassLessonsForBimonthly(cls.id!, 4);
                            const classTotal = b1 + b2 + b3 + b4;

                            schoolBim1 += b1;
                            schoolBim2 += b2;
                            schoolBim3 += b3;
                            schoolBim4 += b4;

                            return (
                              <tr key={cls.id} className="hover:bg-white/5 font-semibold text-zinc-200 print:text-black">
                                <td className="py-3 px-4 text-zinc-200 print:text-black">{cls.name}</td>
                                <td className="py-3 px-3 text-center font-mono">{b1}</td>
                                <td className="py-3 px-3 text-center font-mono">{b2}</td>
                                <td className="py-3 px-3 text-center font-mono">{b3}</td>
                                <td className="py-3 px-3 text-center font-mono">{b4}</td>
                                <td className="py-3 px-4 text-center font-mono font-extrabold bg-blue-950/10 text-blue-400 print:text-black">
                                  {classTotal}
                                </td>
                              </tr>
                            );
                          })}

                          {/* SCHOOL TOTAL ROW */}
                          <tr className="bg-zinc-950/40 print:bg-zinc-100 font-black text-blue-400 print:text-black text-sm uppercase">
                            <td className="py-3 px-4 font-extrabold text-blue-400 print:text-black">TOTAL DA ESCOLA</td>
                            <td className="py-3 px-3 text-center font-mono">{schoolBim1}</td>
                            <td className="py-3 px-3 text-center font-mono">{schoolBim2}</td>
                            <td className="py-3 px-3 text-center font-mono">{schoolBim3}</td>
                            <td className="py-3 px-3 text-center font-mono">{schoolBim4}</td>
                            <td className="py-3 px-4 text-center font-mono font-black text-blue-400 print:text-black bg-blue-950/20">
                              {schoolBim1 + schoolBim2 + schoolBim3 + schoolBim4}
                            </td>
                          </tr>
                        </>
                      );
                    })()}
                  </tbody>
                </table>
              </div>
              <div className="text-[10px] text-zinc-500 font-medium pt-3 leading-relaxed">
                <p>* Exibe o somatório das cargas horárias dadas por cada uma das turmas ativas na escola.</p>
                <p>* A contagem é atualizada instantaneamente conforme os Diários de Aula são salvos na aba correspondente.</p>
              </div>
            </div>
          </div>
        )}

        {/* Teacher Signature Line for Print */}
        <div className="pt-12 border-t border-dashed border-zinc-800 flex justify-end">
          <div className="text-center w-64 space-y-1">
            <div className="border-b border-zinc-500 h-8 w-full print:border-black" />
            <p className="text-[10px] text-zinc-400 uppercase tracking-wider print:text-black">Assinatura do Docente</p>
          </div>
        </div>

      </div>

    </div>
  );
}
