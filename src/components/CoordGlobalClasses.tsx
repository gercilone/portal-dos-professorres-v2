import React, { useState, useEffect, useRef } from 'react';
import {
  GlobalSchool,
  GlobalClass,
  GlobalStudent,
  getGlobalSchools,
  saveGlobalSchool,
  deleteGlobalSchool,
  getGlobalClasses,
  saveGlobalClass,
  deleteGlobalClass,
  getGlobalStudents,
  saveGlobalStudent,
  deleteGlobalStudent
} from '../firebase';
import { 
  Plus, 
  Trash2, 
  Edit2, 
  X, 
  Import, 
  School as SchoolIcon, 
  Users, 
  BookOpen, 
  Sparkles, 
  Check, 
  AlertTriangle,
  FileText,
  Upload
} from 'lucide-react';
import { sortClasses } from '../types';

export default function CoordGlobalClasses() {
  // Lists from cloud
  const [schools, setSchools] = useState<GlobalSchool[]>([]);
  const [classes, setClasses] = useState<GlobalClass[]>([]);
  const [students, setStudents] = useState<GlobalStudent[]>([]);

  // Selection states
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>('');
  const [selectedClassId, setSelectedClassId] = useState<string>('');

  // Loading states
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Form states - School
  const [newSchoolName, setNewSchoolName] = useState('');
  const [editingSchoolId, setEditingSchoolId] = useState<string | null>(null);
  const [editingSchoolName, setEditingSchoolName] = useState('');

  // Form states - Class
  const [newClassName, setNewClassName] = useState('');
  const [editingClassId, setEditingClassId] = useState<string | null>(null);
  const [editingClassName, setEditingClassName] = useState('');

  // Form states - Student
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentRoll, setNewStudentRoll] = useState<number | ''>('');
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [editingStudentName, setEditingStudentName] = useState('');
  const [editingStudentRoll, setEditingStudentRoll] = useState<number | ''>('');
  const [bulkStudentText, setBulkStudentText] = useState('');

  // SIMADE SMART PARSER STATES
  const [showSimadeImporter, setShowSimadeImporter] = useState(false);
  const [simadeTab, setSimadeTab] = useState<'pdf' | 'text'>('pdf');
  const [simadeRawText, setSimadeRawText] = useState('');
  const [parsingSimade, setParsingSimade] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Parsed Preview States
  const [parsedSchool, setParsedSchool] = useState('');
  const [parsedClass, setParsedClass] = useState('');
  const [parsedStudents, setParsedStudents] = useState<{ name: string; rollNumber: number }[]>([]);
  const [isSimadeParsed, setIsSimadeParsed] = useState(false);

  // Load everything on mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const schs = await getGlobalSchools();
      const cls = await getGlobalClasses();
      const stds = await getGlobalStudents();
      setSchools(schs);
      setClasses(cls);
      setStudents(stds);

      // Auto-select first school if none selected
      if (schs.length > 0 && !selectedSchoolId) {
        setSelectedSchoolId(schs[0].id);
      }
    } catch (error) {
      console.error(error);
      showMsg('Erro ao carregar dados da nuvem.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const showMsg = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 5000);
  };

  // --- SCHOOL ACTIONS ---
  const handleAddSchool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSchoolName.trim()) return;

    setIsLoading(true);
    const newId = 'sch_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const item: GlobalSchool = { id: newId, name: newSchoolName.trim() };

    try {
      await saveGlobalSchool(item);
      setSchools(prev => [...prev, item]);
      setNewSchoolName('');
      setSelectedSchoolId(newId);
      showMsg('Escola cadastrada com sucesso!', 'success');
    } catch (err) {
      showMsg('Erro ao salvar escola.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateSchool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSchoolId || !editingSchoolName.trim()) return;

    setIsLoading(true);
    const item: GlobalSchool = { id: editingSchoolId, name: editingSchoolName.trim() };

    try {
      await saveGlobalSchool(item);
      setSchools(prev => prev.map(s => s.id === editingSchoolId ? item : s));
      setEditingSchoolId(null);
      setEditingSchoolName('');
      showMsg('Escola atualizada com sucesso!', 'success');
    } catch (err) {
      showMsg('Erro ao atualizar escola.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteSchoolClick = async (id: string, name: string) => {
    if (!window.confirm(`Tem certeza de que deseja excluir a escola "${name}"? Todas as turmas e alunos dela serão excluídos permanentemente.`)) return;

    setIsLoading(true);
    try {
      await deleteGlobalSchool(id);
      setSchools(prev => prev.filter(s => s.id !== id));
      setClasses(prev => prev.filter(c => c.schoolId !== id));
      setStudents(prev => prev.filter(st => {
        const cls = classes.find(c => c.id === st.classId);
        return cls ? cls.schoolId !== id : true;
      }));

      if (selectedSchoolId === id) {
        setSelectedSchoolId('');
        setSelectedClassId('');
      }
      showMsg('Escola excluída com sucesso!', 'success');
    } catch (err) {
      showMsg('Erro ao excluir escola.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // --- CLASS ACTIONS ---
  const handleAddClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassName.trim() || !selectedSchoolId) return;

    setIsLoading(true);
    const newId = 'cls_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const item: GlobalClass = { id: newId, name: newClassName.trim(), schoolId: selectedSchoolId };

    try {
      await saveGlobalClass(item);
      setClasses(prev => [...prev, item]);
      setNewClassName('');
      setSelectedClassId(newId);
      showMsg('Turma cadastrada com sucesso!', 'success');
    } catch (err) {
      showMsg('Erro ao salvar turma.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClassId || !editingClassName.trim() || !selectedSchoolId) return;

    setIsLoading(true);
    const item: GlobalClass = { id: editingClassId, name: editingClassName.trim(), schoolId: selectedSchoolId };

    try {
      await saveGlobalClass(item);
      setClasses(prev => prev.map(c => c.id === editingClassId ? item : c));
      setEditingClassId(null);
      setEditingClassName('');
      showMsg('Turma atualizada com sucesso!', 'success');
    } catch (err) {
      showMsg('Erro ao atualizar turma.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteClassClick = async (id: string, name: string) => {
    if (!window.confirm(`Tem certeza de que deseja excluir a turma "${name}"? Todos os alunos dela serão excluídos permanentemente.`)) return;

    setIsLoading(true);
    try {
      await deleteGlobalClass(id);
      setClasses(prev => prev.filter(c => c.id !== id));
      setStudents(prev => prev.filter(st => st.classId !== id));

      if (selectedClassId === id) {
        setSelectedClassId('');
      }
      showMsg('Turma excluída com sucesso!', 'success');
    } catch (err) {
      showMsg('Erro ao excluir turma.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // --- STUDENT ACTIONS ---
  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudentName.trim() || !selectedClassId) return;

    setIsLoading(true);
    const classStudents = students.filter(st => st.classId === selectedClassId);
    const roll = newStudentRoll === '' 
      ? (classStudents.length > 0 ? Math.max(...classStudents.map(s => s.rollNumber)) + 1 : 1) 
      : Number(newStudentRoll);
    const newId = 'st_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const item: GlobalStudent = {
      id: newId,
      name: newStudentName.trim(),
      rollNumber: roll,
      classId: selectedClassId
    };

    try {
      await saveGlobalStudent(item);
      setStudents(prev => [...prev, item].sort((a, b) => a.rollNumber - b.rollNumber || a.name.localeCompare(b.name)));
      setNewStudentName('');
      setNewStudentRoll('');
      showMsg('Aluno cadastrado com sucesso!', 'success');
    } catch (err) {
      showMsg('Erro ao salvar aluno.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudentId || !editingStudentName.trim() || !selectedClassId) return;

    setIsLoading(true);
    const roll = editingStudentRoll === '' ? 1 : Number(editingStudentRoll);
    const item: GlobalStudent = {
      id: editingStudentId,
      name: editingStudentName.trim(),
      rollNumber: roll,
      classId: selectedClassId
    };

    try {
      await saveGlobalStudent(item);
      setStudents(prev => prev.map(s => s.id === editingStudentId ? item : s).sort((a, b) => a.rollNumber - b.rollNumber || a.name.localeCompare(b.name)));
      setEditingStudentId(null);
      setEditingStudentName('');
      setEditingStudentRoll('');
      showMsg('Aluno atualizado com sucesso!', 'success');
    } catch (err) {
      showMsg('Erro ao atualizar aluno.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteStudentClick = async (id: string, name: string) => {
    if (!window.confirm(`Excluir aluno "${name}"?`)) return;

    setIsLoading(true);
    try {
      await deleteGlobalStudent(id);
      setStudents(prev => prev.filter(st => st.id !== id));
      showMsg('Aluno excluído com sucesso!', 'success');
    } catch (err) {
      showMsg('Erro ao excluir aluno.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // BULK IMPORT STUDENTS
  const handleBulkImportStudents = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkStudentText.trim() || !selectedClassId) return;

    setIsLoading(true);
    const lines = bulkStudentText.split('\n');
    const newlyAdded: GlobalStudent[] = [];
    let startRoll = students.filter(st => st.classId === selectedClassId).length + 1;

    try {
      for (let line of lines) {
        line = line.trim();
        if (!line) continue;

        // Try to parse "1 - Name" or just "Name"
        let name = line;
        let roll = startRoll;

        const match = line.match(/^(\d+)\s*[-;.]?\s*(.+)$/);
        if (match) {
          roll = Number(match[1]);
          name = match[2].trim();
        } else {
          startRoll++;
        }

        const newId = 'st_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7) + '_' + Math.random().toString(36).substring(2, 5);
        const item: GlobalStudent = {
          id: newId,
          name,
          rollNumber: roll,
          classId: selectedClassId
        };

        await saveGlobalStudent(item);
        newlyAdded.push(item);
      }

      setStudents(prev => [...prev, ...newlyAdded].sort((a, b) => a.rollNumber - b.rollNumber || a.name.localeCompare(b.name)));
      setBulkStudentText('');
      showMsg(`${newlyAdded.length} alunos importados com sucesso!`, 'success');
    } catch (err) {
      console.error(err);
      showMsg('Erro durante a importação em lote de alunos.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // --- SMART SIMADE PARSER METHODS ---

  const reconstructLines = (items: any[]): string[] => {
    // Group items that are close vertically
    const linesMap: { [y: number]: any[] } = {};
    
    for (const item of items) {
      if (!item.str || !item.transform) continue;
      
      const y = item.transform[5];
      
      // Find if there's a group with a close y coordinate (within 5 units tolerance)
      let found = false;
      for (const keyStr of Object.keys(linesMap)) {
        const keyY = parseFloat(keyStr);
        if (Math.abs(keyY - y) < 5) {
          linesMap[keyY].push(item);
          found = true;
          break;
        }
      }
      
      if (!found) {
        linesMap[y] = [item];
      }
    }
    
    // Sort the keys (Y coordinate) descending (from top of page to bottom)
    const sortedYKeys = Object.keys(linesMap)
      .map(Number)
      .sort((a, b) => b - a);
      
    const reconstructed: string[] = [];
    
    for (const y of sortedYKeys) {
      // Sort items within the same line from left to right (X ascending, transform[4] is X coordinate)
      const lineItems = linesMap[y].sort((a, b) => a.transform[4] - b.transform[4]);
      // Join items with a space
      const lineText = lineItems.map(item => item.str).join(' ').replace(/\s+/g, ' ').trim();
      if (lineText) {
        reconstructed.push(lineText);
      }
    }
    
    return reconstructed;
  };

  const loadPdfJS = (): Promise<any> => {
    return new Promise((resolve, reject) => {
      if ((window as any).pdfjsLib) {
        resolve((window as any).pdfjsLib);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.async = true;
      script.onload = async () => {
        const pdfjs = (window as any).pdfjsLib;
        if (pdfjs) {
          try {
            // Fetch the worker file and create a Blob URL to avoid same-origin restrictions on Web Workers inside iframes
            const response = await fetch('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js');
            const workerCode = await response.text();
            const blob = new Blob([workerCode], { type: 'application/javascript' });
            const workerUrl = URL.createObjectURL(blob);
            pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
            resolve(pdfjs);
          } catch (workerErr) {
            console.warn('Failed to load PDF worker via Blob fetch. Falling back to direct URL.', workerErr);
            pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
            resolve(pdfjs);
          }
        } else {
          reject(new Error('Failed to load pdfjsLib from CDN'));
        }
      };
      script.onerror = () => reject(new Error('Failed to load PDF.js script'));
      document.head.appendChild(script);
    });
  };

  const handlePdfUpload = async (file: File) => {
    setParsingSimade(true);
    try {
      const pdfjs = await loadPdfJS();
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const typedarray = new Uint8Array(event.target?.result as ArrayBuffer);
          const loadingTask = pdfjs.getDocument({ data: typedarray });
          const pdf = await loadingTask.promise;
          let extractedText = '';

          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageLines = reconstructLines(textContent.items);
            extractedText += pageLines.join('\n') + '\n';
          }

          runSimadeParser(extractedText);
          showMsg('PDF do Simade lido com sucesso! Verifique e confirme a prévia abaixo.', 'success');
        } catch (err: any) {
          console.error('Error parsing PDF content:', err);
          showMsg('Erro ao extrair texto do PDF. Mas você pode colar o texto do PDF na aba ao lado!', 'error');
        } finally {
          setParsingSimade(false);
        }
      };
      reader.onerror = () => {
        showMsg('Erro ao ler arquivo do computador.', 'error');
        setParsingSimade(false);
      };
      reader.readAsArrayBuffer(file);
    } catch (err: any) {
      console.error(err);
      showMsg('Erro ao carregar o leitor de PDF: ' + (err.message || err), 'error');
      setParsingSimade(false);
    }
  };

  const runSimadeParser = (text: string) => {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    
    let schoolName = '';
    let className = '';
    const studentsList: { name: string; rollNumber: number }[] = [];

    // 1. Detect School Name (Escola)
    for (const line of lines) {
      const lower = line.toLowerCase();
      
      // Look for explicit "Escola:" or "Escola Estadual:"
      if (lower.includes('escola:') || lower.includes('colégio:') || lower.includes('colegio:') || lower.includes('escola estadual:')) {
        const parts = line.split(':');
        if (parts[1] && parts[1].trim().length > 4) {
          schoolName = parts[1].trim();
          break;
        }
      }
      
      // Look for lines containing "Escola Estadual" or "E.E. " or "EE "
      if (
        lower.startsWith('escola estadual') || 
        lower.startsWith('e.e. ') || 
        lower.startsWith('ee ') ||
        lower.includes('esc. est.')
      ) {
        schoolName = line;
        break;
      }
    }
    
    // Fallback search in the top 15 lines if still empty
    if (!schoolName) {
      for (let i = 0; i < Math.min(15, lines.length); i++) {
        const line = lines[i];
        const lower = line.toLowerCase();
        if (
          lower.includes('esc ') || 
          lower.includes('escola') || 
          lower.includes('colégio') || 
          lower.includes('colegio') || 
          lower.includes('centro de ed') || 
          lower.includes('instituto') ||
          lower.startsWith('esc ') ||
          lower.startsWith('e.e. ') ||
          lower.startsWith('ee ')
        ) {
          schoolName = line;
          break;
        }
      }
    }
    // Deep fallback
    if (!schoolName && lines.length > 1) {
      if (lines[0].toLowerCase().includes('estado do')) {
        schoolName = lines[1];
      } else {
        schoolName = lines[0];
      }
    }

    // 2. Detect Class/Turma/Série/Ano
    // Look for explicit keys
    for (const line of lines) {
      const lower = line.toLowerCase();
      if (
        lower.includes('série/ano:') || 
        lower.includes('série:') || 
        lower.includes('turma:') || 
        lower.includes('ano:') ||
        lower.includes('série/ano :') || 
        lower.includes('série :') || 
        lower.includes('turma :') || 
        lower.includes('ano :')
      ) {
        const parts = line.split(':');
        if (parts[1] && parts[1].trim().length >= 2) {
          className = parts[1].trim();
          break;
        }
      }
    }

    // Fallback if not found with colon
    if (!className) {
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lower = line.toLowerCase();
        if (lower === 'turma' && i + 1 < lines.length) {
          className = lines[i + 1];
          break;
        } else if (lower.startsWith('turma ')) {
          className = line.substring(6).trim();
          break;
        } else if (lower.startsWith('série ') || lower.startsWith('serie ')) {
          className = line.substring(6).trim();
          break;
        }
      }
    }

    // 3. Detect Students, their roll number, and names
    const excludeWords = [
      'página', 'pagina', 'rua', 'avenida', 'telefone', 'email', 'escola', 'estado', 
      'secretaria', 'educação', 'ensino', 'período', 'periodo', 'série', 'serie', 
      'turno', 'turma', 'alunos', 'nome', 'aluno', 'tipo', 'ensino', 'letivo', 
      'componente', 'curricular', 'professor', 'diário', 'diario'
    ];

    for (const line of lines) {
      // Regex that matches:
      // - Start of line, optional spaces
      // - A roll number (1 to 60)
      // - Optional separator like dash, dot, space, or dash/hyphen variants
      // - A capitalized name starting with at least 2 letters, followed by more words of at least 1 letter
      const studentMatch = line.match(/^\s*(\d+)\s*[\-.\s–—]+\s*([A-ZÀ-Ÿa-zà-ÿ'\.\-–—\s]+)/);
      if (studentMatch) {
        const roll = parseInt(studentMatch[1], 10);
        let fullName = studentMatch[2].trim();
        
        if (roll > 0 && roll <= 60 && fullName.length >= 5) {
          // Clean up trailing status and gender from name
          fullName = fullName.replace(/\s+[MFmf]\s*$/, '').trim();
          fullName = fullName.replace(/\s+(?:ativo|ativa|frequente|não frequente|nao frequente|matriculado|transferido|evadido|cancelado)\b/i, '').trim();
          fullName = fullName.replace(/\s+/g, ' ');

          const nameLower = fullName.toLowerCase();
          const isExcluded = excludeWords.some(w => nameLower === w || nameLower.includes(w)) || 
                             fullName.includes('/') || 
                             fullName.includes('@') ||
                             fullName.includes('.') ||
                             fullName.length < 5;

          if (!isExcluded) {
            // Avoid duplicate roll numbers
            if (!studentsList.some(s => s.rollNumber === roll)) {
              studentsList.push({ name: fullName, rollNumber: roll });
            }
          }
        }
      }
    }

    // Sort students by roll number
    studentsList.sort((a, b) => a.rollNumber - b.rollNumber);

    setParsedSchool(schoolName || 'Escola Detectada');
    setParsedClass(className || 'Turma Detectada');
    setParsedStudents(studentsList);
    setIsSimadeParsed(true);
  };

  const handleConfirmSimadeImport = async () => {
    if (!parsedSchool.trim() || !parsedClass.trim() || parsedStudents.length === 0) {
      showMsg('Dados inválidos para importação.', 'error');
      return;
    }

    setIsLoading(true);
    try {
      // 1. School
      let schoolId = '';
      const existingSchool = schools.find(s => s.name.trim().toLowerCase() === parsedSchool.trim().toLowerCase());
      
      if (existingSchool) {
        schoolId = existingSchool.id;
      } else {
        schoolId = 'sch_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
        const newSchool: GlobalSchool = { id: schoolId, name: parsedSchool.trim() };
        await saveGlobalSchool(newSchool);
        setSchools(prev => [...prev, newSchool]);
      }

      // 2. Class
      let classId = '';
      const existingClass = classes.find(c => c.name.trim().toLowerCase() === parsedClass.trim().toLowerCase() && c.schoolId === schoolId);
      
      if (existingClass) {
        classId = existingClass.id;
      } else {
        classId = 'cls_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
        const newClass: GlobalClass = { id: classId, name: parsedClass.trim(), schoolId };
        await saveGlobalClass(newClass);
        setClasses(prev => [...prev, newClass]);
      }

      // 3. Students
      const existingStudents = students.filter(st => st.classId === classId);
      let added = 0;
      let skipped = 0;

      for (const st of parsedStudents) {
        const studentExists = existingStudents.some(
          es => es.name.toLowerCase() === st.name.toLowerCase() || es.rollNumber === st.rollNumber
        );

        if (!studentExists) {
          const studentId = 'st_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7) + '_' + added;
          const newStudent: GlobalStudent = {
            id: studentId,
            name: st.name,
            rollNumber: st.rollNumber,
            classId
          };
          await saveGlobalStudent(newStudent);
          added++;
        } else {
          skipped++;
        }
      }

      // Refresh data
      const updatedStds = await getGlobalStudents();
      setStudents(updatedStds);

      setSelectedSchoolId(schoolId);
      setSelectedClassId(classId);

      showMsg(
        `Sucesso! Turma "${parsedClass}" criada na escola "${parsedSchool}". ${added} alunos novos adicionados de forma oficial.`,
        'success'
      );

      // Reset
      setIsSimadeParsed(false);
      setParsedStudents([]);
      setParsedSchool('');
      setParsedClass('');
      setSimadeRawText('');
      setShowSimadeImporter(false);
    } catch (err) {
      console.error(err);
      showMsg('Erro ao salvar dados do Simade na nuvem.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Filter lists
  const filteredClasses = [...classes].filter(c => c.schoolId === selectedSchoolId).sort(sortClasses);
  const filteredStudents = students.filter(st => st.classId === selectedClassId);

  // Auto-select class when school changes
  useEffect(() => {
    if (filteredClasses.length > 0) {
      // Find if current selection is in filtered, if not select first
      if (!filteredClasses.some(c => c.id === selectedClassId)) {
        setSelectedClassId(filteredClasses[0].id);
      }
    } else {
      setSelectedClassId('');
    }
  }, [selectedSchoolId, classes]);

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
              <Sparkles className="w-5 h-5 text-amber-500" /> Registro de Turmas Globais & Alunos
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed max-w-2xl">
              Como coordenador, você pode registrar as escolas, turmas e a lista de alunos oficial aqui. 
              Os professores poderão anexar diretamente essas turmas prontas nos seus diários de classe, garantindo a padronização e evitando erros de cadastro ou digitação de alunos!
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            <button
              onClick={() => {
                setShowSimadeImporter(!showSimadeImporter);
                setIsSimadeParsed(false);
              }}
              className={`flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                showSimadeImporter 
                  ? 'bg-amber-500 hover:bg-amber-400 text-zinc-950 border-amber-400 font-extrabold shadow-lg shadow-amber-500/15' 
                  : 'bg-zinc-950/60 hover:bg-zinc-950 border-zinc-800 text-amber-500 hover:border-amber-500/30'
              }`}
            >
              <Sparkles className="w-4 h-4 shrink-0 text-current" />
              <span>{showSimadeImporter ? 'Fechar Importador' : 'Importar PDF Simade'}</span>
            </button>
            {isLoading && (
              <div className="flex items-center justify-center gap-2 text-xs text-amber-500 font-mono bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-full animate-pulse">
                <span>Sincronizando Nuvem...</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Smart Simade Importer Panel */}
      {showSimadeImporter && (
        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl space-y-6 animate-in slide-in-from-top-4 duration-300">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              <div>
                <h4 className="text-white font-bold text-sm">Leitor Inteligente de PDF Simade</h4>
                <p className="text-[10px] text-zinc-400">Cadastre escolas, turmas e diários oficiais lendo o PDF oficial do Simade</p>
              </div>
            </div>
            <button 
              onClick={() => {
                setShowSimadeImporter(false);
                setIsSimadeParsed(false);
              }}
              className="p-1.5 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-lg transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {!isSimadeParsed ? (
            <div className="space-y-4">
              {/* Tabs */}
              <div className="flex border-b border-zinc-800">
                <button
                  onClick={() => setSimadeTab('pdf')}
                  className={`px-4 py-2 text-xs font-bold border-b-2 transition ${
                    simadeTab === 'pdf' 
                      ? 'border-amber-500 text-amber-500 font-extrabold' 
                      : 'border-transparent text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <Upload className="w-3.5 h-3.5 inline mr-1.5" /> Arquivo PDF Oficial (.pdf)
                </button>
                <button
                  onClick={() => setSimadeTab('text')}
                  className={`px-4 py-2 text-xs font-bold border-b-2 transition ${
                    simadeTab === 'text' 
                      ? 'border-amber-500 text-amber-500 font-extrabold' 
                      : 'border-transparent text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5 inline mr-1.5" /> Copiar & Colar Texto do PDF
                </button>
              </div>

              {simadeTab === 'pdf' ? (
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-zinc-800 hover:border-amber-500/50 bg-zinc-950/40 p-8 rounded-2xl text-center cursor-pointer transition group"
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="application/pdf"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handlePdfUpload(file);
                    }}
                    className="hidden"
                  />
                  <Upload className="w-10 h-10 mx-auto mb-3 text-zinc-500 group-hover:text-amber-500 transition duration-300" />
                  <p className="text-xs font-bold text-zinc-300">Arraste ou clique para selecionar o PDF do Simade</p>
                  <p className="text-[10px] text-zinc-500 mt-1">O arquivo será processado 100% no seu navegador de forma privada</p>
                  {parsingSimade && (
                    <div className="mt-4 flex items-center justify-center gap-2 text-xs text-amber-500 font-mono animate-pulse">
                      <span>Processando e lendo conteúdo do PDF...</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-[10px] text-zinc-400 font-medium">Abra o PDF gerado pelo Simade, selecione tudo (Ctrl+A), copie (Ctrl+C) e cole no campo abaixo:</p>
                  <textarea
                    rows={6}
                    placeholder="Cole aqui o texto copiado do PDF do Simade..."
                    value={simadeRawText}
                    onChange={(e) => setSimadeRawText(e.target.value)}
                    className="bg-zinc-950 border border-zinc-800 text-zinc-200 text-xs rounded-xl p-3.5 w-full focus:ring-1 focus:ring-amber-500 focus:outline-none font-mono"
                  />
                  <button
                    onClick={() => {
                      if (!simadeRawText.trim()) return;
                      runSimadeParser(simadeRawText);
                    }}
                    disabled={!simadeRawText.trim()}
                    className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-zinc-950 font-extrabold rounded-xl text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4 text-zinc-950" /> Ler e Processar Texto Colado
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* PREVIEW AND EDIT STATE */
            <div className="space-y-4 bg-zinc-950/40 border border-zinc-800 p-5 rounded-2xl">
              <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
                <p className="text-xs font-bold text-amber-500 uppercase tracking-wider flex items-center gap-1">
                  <Check className="w-4 h-4" /> Prévia dos Dados Identificados no Simade
                </p>
                <button 
                  onClick={() => {
                    setIsSimadeParsed(false);
                    setParsedStudents([]);
                  }} 
                  className="text-[10px] text-zinc-400 hover:text-zinc-200 font-semibold"
                >
                  Tentar Outro Arquivo
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] text-zinc-400 font-bold uppercase">Nome da Escola:</label>
                  <input
                    type="text"
                    value={parsedSchool}
                    onChange={(e) => setParsedSchool(e.target.value)}
                    className="bg-zinc-900 border border-zinc-800 text-zinc-200 text-xs rounded-xl px-3 py-2 w-full focus:ring-1 focus:ring-amber-500 focus:outline-none font-medium"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] text-zinc-400 font-bold uppercase">Nome da Turma:</label>
                  <input
                    type="text"
                    value={parsedClass}
                    onChange={(e) => setParsedClass(e.target.value)}
                    className="bg-zinc-900 border border-zinc-800 text-zinc-200 text-xs rounded-xl px-3 py-2 w-full focus:ring-1 focus:ring-amber-500 focus:outline-none font-medium"
                  />
                </div>
              </div>

              {/* Students Table/List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] text-zinc-400 font-bold uppercase">Lista de Alunos Oficial ({parsedStudents.length} alunos):</p>
                  <p className="text-[9px] text-zinc-500">Os alunos estão ordenados pelo número de chamada do diário</p>
                </div>
                
                <div className="max-h-60 overflow-y-auto divide-y divide-zinc-855 bg-zinc-950/60 rounded-xl border border-zinc-800 p-2">
                  {parsedStudents.map((st, idx) => (
                    <div key={idx} className="flex items-center justify-between py-1.5 px-2 hover:bg-zinc-900/50 rounded-lg text-xs gap-3">
                      <div className="flex items-center gap-2.5 w-full">
                        <span className="font-mono text-[10px] font-bold text-amber-500 bg-amber-500/5 border border-amber-500/10 w-5 h-5 rounded flex items-center justify-center shrink-0">
                          {st.rollNumber}
                        </span>
                        <input
                          type="text"
                          value={st.name}
                          onChange={(e) => {
                            const val = e.target.value;
                            setParsedStudents(prev => prev.map((item, i) => i === idx ? { ...item, name: val } : item));
                          }}
                          className="bg-transparent border-0 hover:bg-zinc-900/80 focus:bg-zinc-900 text-zinc-200 text-xs rounded px-1.5 py-0.5 w-full focus:outline-none focus:ring-1 focus:ring-amber-500"
                        />
                      </div>
                      <button
                        onClick={() => {
                          setParsedStudents(prev => prev.filter((_, i) => i !== idx));
                        }}
                        className="p-1 text-zinc-500 hover:text-rose-400 transition"
                        title="Remover aluno"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Attention Info */}
              <div className="p-3 bg-amber-500/5 border border-amber-500/10 rounded-xl flex gap-2.5 text-[11px] text-zinc-400">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-bold text-zinc-300">Consistência dos Números de Chamada:</p>
                  <p>Os números originais foram identificados com sucesso (ex: Arthur Henrique começará no número 3). Não haverá preenchimento automático para os números 1 e 2, mantendo a chamada oficial intocável e garantindo total correspondência com o Simade.</p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => {
                    setIsSimadeParsed(false);
                    setParsedStudents([]);
                  }}
                  className="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-zinc-200"
                >
                  Voltar
                </button>
                <button
                  onClick={handleConfirmSimadeImport}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-extrabold text-xs rounded-xl transition shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4 text-zinc-950" /> Confirmar e Salvar na Nuvem
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* COL 1: SCHOOLS & CLASSES (LHS) */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* ESCOLAS E SÉRIES (SUB-MENU) */}
          <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl space-y-4">
            <h4 className="text-white font-bold text-xs flex items-center gap-2 uppercase tracking-wider text-zinc-300">
              <SchoolIcon className="w-4 h-4 text-amber-500" /> 1. Escolas & Séries
            </h4>

            {/* School Registration Form */}
            {editingSchoolId ? (
              <form onSubmit={handleUpdateSchool} className="flex gap-2">
                <input
                  type="text"
                  required
                  value={editingSchoolName}
                  onChange={(e) => setEditingSchoolName(e.target.value)}
                  className="bg-zinc-950 border border-zinc-800 text-zinc-200 text-xs rounded-xl px-3 py-2 w-full focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
                <button type="submit" className="px-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition cursor-pointer">
                  Salvar
                </button>
                <button type="button" onClick={() => setEditingSchoolId(null)} className="p-2 bg-zinc-800 hover:bg-zinc-750 text-zinc-400 rounded-xl transition cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </form>
            ) : (
              <form onSubmit={handleAddSchool} className="flex gap-2">
                <input
                  type="text"
                  required
                  placeholder="Cadastrar nova escola..."
                  value={newSchoolName}
                  onChange={(e) => setNewSchoolName(e.target.value)}
                  className="bg-zinc-950 border border-zinc-800 text-zinc-350 text-xs rounded-xl px-3 py-2 w-full focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
                <button type="submit" className="p-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl transition cursor-pointer shrink-0" title="Cadastrar Escola">
                  <Plus className="w-4 h-4" />
                </button>
              </form>
            )}

            {/* Schools & Nested Classes List */}
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
              {schools.map((sch) => {
                const schoolClasses = [...classes].filter(c => c.schoolId === sch.id).sort(sortClasses);
                const isSelected = selectedSchoolId === sch.id;

                return (
                  <div key={sch.id} className="space-y-2 border border-zinc-850 bg-zinc-950/20 p-2 rounded-xl">
                    {/* School row */}
                    <div 
                      onClick={() => {
                        setSelectedSchoolId(sch.id);
                        // Auto-select first class of this school if available
                        const firstClass = schoolClasses[0];
                        if (firstClass) {
                          setSelectedClassId(firstClass.id);
                        } else {
                          setSelectedClassId('');
                        }
                      }}
                      className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition ${
                        isSelected
                          ? 'bg-amber-600/15 border border-amber-500/20 text-amber-400 font-bold'
                          : 'text-zinc-300 hover:bg-zinc-900/40'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate pr-2">
                        <SchoolIcon className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <span className="truncate text-xs">{sch.name}</span>
                        <span className="text-[9px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded-full font-mono shrink-0">
                          {schoolClasses.length}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                        <button 
                          onClick={() => {
                            setEditingSchoolId(sch.id);
                            setEditingSchoolName(sch.name);
                          }} 
                          className="p-1 hover:bg-zinc-850 text-zinc-400 hover:text-white rounded transition cursor-pointer"
                          title="Editar Escola"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button 
                          onClick={() => handleDeleteSchoolClick(sch.id, sch.name)} 
                          className="p-1 hover:bg-zinc-850 text-zinc-500 hover:text-rose-400 rounded transition cursor-pointer"
                          title="Excluir Escola"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {/* Submenu of series/classes for the selected school */}
                    {isSelected && (
                      <div className="pl-3.5 pr-1 py-1 space-y-1.5 border-l border-zinc-800/80 ml-2.5">
                        <p className="text-[10px] text-zinc-500 font-extrabold uppercase tracking-wide">Séries / Turmas:</p>
                        
                        {/* Class creation/editing inside submenu */}
                        {editingClassId ? (
                          <form 
                            onSubmit={(e) => {
                              e.preventDefault();
                              handleUpdateClass(e);
                            }} 
                            className="flex gap-1"
                            onClick={e => e.stopPropagation()}
                          >
                            <input
                              type="text"
                              required
                              value={editingClassName}
                              onChange={(e) => setEditingClassName(e.target.value)}
                              className="bg-zinc-950 border border-zinc-800 text-zinc-200 text-[11px] rounded-lg px-2.5 py-1 w-full focus:outline-none focus:ring-1 focus:ring-amber-500"
                            />
                            <button type="submit" className="px-2 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold rounded-lg transition cursor-pointer">
                              Ok
                            </button>
                            <button type="button" onClick={() => setEditingClassId(null)} className="p-1 bg-zinc-800 hover:bg-zinc-750 text-zinc-400 rounded-lg transition cursor-pointer">
                              <X className="w-3 h-3" />
                            </button>
                          </form>
                        ) : (
                          <form 
                            onSubmit={(e) => {
                              e.preventDefault();
                              handleAddClass(e);
                            }} 
                            className="flex gap-1"
                            onClick={e => e.stopPropagation()}
                          >
                            <input
                              type="text"
                              required
                              placeholder="Nova série (ex: 1º Ano A)..."
                              value={newClassName}
                              onChange={(e) => setNewClassName(e.target.value)}
                              className="bg-zinc-950 border border-zinc-800 text-zinc-300 text-[11px] rounded-lg px-2.5 py-1.5 w-full focus:outline-none focus:ring-1 focus:ring-amber-500"
                            />
                            <button type="submit" className="p-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition cursor-pointer shrink-0" title="Cadastrar Série">
                              <Plus className="w-3 h-3" />
                            </button>
                          </form>
                        )}

                        {/* List of series */}
                        <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                          {schoolClasses.map((cls) => {
                            const isClassSelected = selectedClassId === cls.id;
                            return (
                              <div
                                key={cls.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedClassId(cls.id);
                                }}
                                className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-[11px] font-medium cursor-pointer transition ${
                                  isClassSelected
                                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-300 font-bold'
                                    : 'bg-zinc-950/40 border-zinc-900/40 text-zinc-400 hover:text-zinc-300 hover:bg-zinc-900/30'
                                }`}
                              >
                                <span className="truncate pr-2">{cls.name}</span>
                                <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                                  <button 
                                    onClick={() => {
                                      setEditingClassId(cls.id);
                                      setEditingClassName(cls.name);
                                    }} 
                                    className="p-0.5 hover:bg-zinc-850 text-zinc-500 hover:text-white rounded transition cursor-pointer"
                                    title="Editar Série"
                                  >
                                    <Edit2 className="w-2.5 h-2.5" />
                                  </button>
                                  <button 
                                    onClick={() => handleDeleteClassClick(cls.id, cls.name)} 
                                    className="p-0.5 hover:bg-zinc-850 text-zinc-650 hover:text-rose-450 rounded transition cursor-pointer"
                                    title="Excluir Série"
                                  >
                                    <Trash2 className="w-2.5 h-2.5" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                          {schoolClasses.length === 0 && (
                            <p className="text-zinc-600 text-[10px] italic py-1 pl-1">Nenhuma série cadastrada.</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {schools.length === 0 && (
                <p className="text-zinc-500 text-xs text-center py-4">Nenhuma escola cadastrada.</p>
              )}
            </div>
          </div>

        </div>

        {/* COL 2: STUDENTS LIST & ADDITION (RHS) */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl space-y-6">
            <h4 className="text-white font-bold text-xs flex items-center gap-2 uppercase tracking-wider text-zinc-300">
              <Users className="w-4 h-4 text-amber-500" /> 3. Alunos da Turma Selecionada
            </h4>

            {selectedClassId ? (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                
                {/* Student Forms (LHS of right panel) */}
                <div className="md:col-span-5 space-y-6">
                  
                  {/* Single student add / edit */}
                  <div className="bg-zinc-950/50 border border-zinc-855 p-4 rounded-xl space-y-3">
                    <p className="text-xs font-bold text-zinc-300">
                      {editingStudentId ? 'Editar Aluno' : 'Adicionar Único Aluno'}
                    </p>

                    {editingStudentId ? (
                      <form onSubmit={handleUpdateStudent} className="space-y-3">
                        <div className="space-y-1">
                          <label className="text-[10px] text-zinc-500 font-bold uppercase block">Nome do Aluno</label>
                          <input
                            type="text"
                            required
                            value={editingStudentName}
                            onChange={(e) => setEditingStudentName(e.target.value)}
                            className="bg-zinc-950 border border-zinc-800 text-zinc-200 text-xs rounded-xl px-3 py-2 w-full focus:outline-none focus:ring-1 focus:ring-amber-500"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-zinc-500 font-bold uppercase block">Número de Chamada (Opcional)</label>
                          <input
                            type="number"
                            placeholder="Número da chamada..."
                            value={editingStudentRoll}
                            onChange={(e) => setEditingStudentRoll(e.target.value === '' ? '' : Number(e.target.value))}
                            className="bg-zinc-950 border border-zinc-800 text-zinc-200 text-xs rounded-xl px-3 py-2 w-full focus:outline-none focus:ring-1 focus:ring-amber-500"
                          />
                        </div>
                        <div className="flex gap-2 pt-1">
                          <button type="submit" className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition cursor-pointer">
                            Salvar Alteração
                          </button>
                          <button type="button" onClick={() => setEditingStudentId(null)} className="py-2 px-3 bg-zinc-800 hover:bg-zinc-750 text-zinc-400 rounded-xl transition cursor-pointer">
                            Cancelar
                          </button>
                        </div>
                      </form>
                    ) : (
                      <form onSubmit={handleAddStudent} className="space-y-3">
                        <div className="space-y-1">
                          <label className="text-[10px] text-zinc-500 font-bold uppercase block">Nome do Aluno</label>
                          <input
                            type="text"
                            required
                            placeholder="Ex: João da Silva..."
                            value={newStudentName}
                            onChange={(e) => setNewStudentName(e.target.value)}
                            className="bg-zinc-950 border border-zinc-800 text-zinc-300 text-xs rounded-xl px-3 py-2.5 w-full focus:outline-none focus:ring-1 focus:ring-amber-500"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-zinc-500 font-bold uppercase block">Nº de Chamada (Opcional)</label>
                          <input
                            type="number"
                            placeholder="Deixe vazio para auto-incremento"
                            value={newStudentRoll}
                            onChange={(e) => setNewStudentRoll(e.target.value === '' ? '' : Number(e.target.value))}
                            className="bg-zinc-950 border border-zinc-800 text-zinc-300 text-xs rounded-xl px-3 py-2.5 w-full focus:outline-none focus:ring-1 focus:ring-amber-500"
                          />
                        </div>
                        <button type="submit" className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5">
                          <Plus className="w-4 h-4" /> Cadastrar Aluno
                        </button>
                      </form>
                    )}
                  </div>

                  {/* Bulk import form */}
                  <div className="bg-zinc-950/50 border border-zinc-855 p-4 rounded-xl space-y-3">
                    <p className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                      <Import className="w-4 h-4 text-amber-500" /> Importar em Lote (Lote de Alunos)
                    </p>
                    <p className="text-[10px] text-zinc-500 leading-normal">
                      Insira um nome por linha. Você também pode colocar o número de chamada no formato <code className="text-amber-500 font-mono">1 - Nome</code>.
                    </p>
                    <form onSubmit={handleBulkImportStudents} className="space-y-3">
                      <textarea
                        required
                        rows={6}
                        placeholder="1 - Ana Souza&#10;2 - Bruno Lima&#10;Carlos Oliveira&#10;Daniela Santos"
                        value={bulkStudentText}
                        onChange={(e) => setBulkStudentText(e.target.value)}
                        className="bg-zinc-950 border border-zinc-800 text-zinc-300 text-xs rounded-xl p-3 w-full focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono"
                      />
                      <button type="submit" className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-750 border border-zinc-700 text-zinc-300 hover:text-white font-bold text-xs rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5">
                        <Import className="w-4 h-4" /> Importar Lista
                      </button>
                    </form>
                  </div>

                </div>

                {/* Students list of class (RHS of right panel) */}
                <div className="md:col-span-7 space-y-3">
                  <div className="flex items-center justify-between border-b border-zinc-850 pb-2">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase">Estudantes da Turma ({filteredStudents.length})</span>
                  </div>

                  <div className="space-y-1.5 max-h-[500px] overflow-y-auto pr-1">
                    {filteredStudents.map((st) => (
                      <div key={st.id} className="flex items-center justify-between bg-zinc-950/30 border border-zinc-850 rounded-xl px-3 py-2 text-xs hover:border-zinc-800 transition">
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-[11px] font-bold text-amber-500/70 bg-amber-500/5 border border-amber-500/10 w-6 h-6 rounded flex items-center justify-center shrink-0">
                            {st.rollNumber}
                          </span>
                          <span className="text-zinc-200 font-medium truncate">{st.name}</span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button 
                            onClick={() => {
                              setEditingStudentId(st.id);
                              setEditingStudentName(st.name);
                              setEditingStudentRoll(st.rollNumber);
                            }} 
                            className="p-1 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded transition cursor-pointer"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button 
                            onClick={() => handleDeleteStudentClick(st.id, st.name)} 
                            className="p-1 hover:bg-zinc-800 text-zinc-500 hover:text-rose-400 rounded transition cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                    {filteredStudents.length === 0 && (
                      <div className="text-center py-12 text-zinc-500">
                        <Users className="w-8 h-8 mx-auto mb-2 opacity-20" />
                        <p className="text-xs">Nenhum aluno cadastrado nesta turma ainda.</p>
                      </div>
                    )}
                  </div>
                </div>

              </div>
            ) : (
              <div className="text-center py-16 text-zinc-500 bg-zinc-950/20 border border-dashed border-zinc-800 rounded-2xl">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p className="text-sm font-medium">Selecione uma turma para ver e gerenciar os alunos.</p>
                <p className="text-xs text-zinc-650 mt-1">Crie escolas e turmas no painel lateral esquerdo.</p>
              </div>
            )}

          </div>
        </div>

      </div>
    </div>
  );
}
