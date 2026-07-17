import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, seedDatabase } from './db';
import HeaderFilters from './components/HeaderFilters';
import TabAGrades from './components/TabA_Grades';
import TabBVistos from './components/TabB_Vistos';
import TabCGamification from './components/TabC_Gamification';
import TabDAttendance from './components/TabD_Attendance';
import TabEReports from './components/TabE_Reports';
import TabFSettings from './components/TabF_Settings';
import CoordGlobalClasses from './components/CoordGlobalClasses';
import CoordGlobalSubjects from './components/CoordGlobalSubjects';
import { sortClasses } from './types';
import { FileText, CheckSquare, Trophy, Calendar, FileBarChart2, Settings, Sparkles, Lock, User, Eye, EyeOff, LogOut, Key, AlertTriangle, Plus, ShieldAlert, Shield, Search, UserPlus, Trash2, ArrowLeft, Check, LogIn, Users, Pencil, X, School, BookOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  deleteProfessorFromCloud,
  deleteCoordinatorFromCloud,
  saveProfessorToCloud,
  saveCoordinatorToCloud,
  syncCoordinatorsListInCloud,
  syncProfessorsListInCloud,
  pullTeacherDataFromCloud,
  pushTeacherDataToCloud
} from './firebase';

type TabKey = 'attendance' | 'grades' | 'vistos' | 'gamification' | 'reports' | 'settings';

interface ProfessorAccount {
  username: string;
  password:  string;
  teacherName: string;
  dbName: string;
  passwordHint?: string;
  securityQuestion?: string;
  securityAnswer?: string;
  authEnabled: boolean;
}

function getProfessorsList(): ProfessorAccount[] {
  const listStr = localStorage.getItem('portal_professors_list');
  if (listStr) {
    try {
      return JSON.parse(listStr);
    } catch (e) {
      console.error(e);
    }
  }
  
  // Migrate existing single user if available
  const oldUsername = localStorage.getItem('portal_username') || 'professor';
  const oldPassword = localStorage.getItem('portal_password') || '123456';
  const oldName = localStorage.getItem('portal_teacher_name') || 'Gercilone';
  const oldAuthEnabled = localStorage.getItem('portal_auth_enabled') === 'true';
  const oldHint = localStorage.getItem('portal_password_hint') || '';
  const oldQuestion = localStorage.getItem('portal_security_question') || '';
  const oldAnswer = localStorage.getItem('portal_security_answer') || '';
  
  const defaultUser: ProfessorAccount = {
    username: oldUsername,
    password: oldPassword,
    teacherName: oldName,
    dbName: 'TeacherDatabase', // Keep original default database name
    passwordHint: oldHint,
    securityQuestion: oldQuestion,
    securityAnswer: oldAnswer,
    authEnabled: oldAuthEnabled
  };
  
  const list = [defaultUser];
  localStorage.setItem('portal_professors_list', JSON.stringify(list));
  
  if (!localStorage.getItem('portal_active_user')) {
    localStorage.setItem('portal_active_user', oldUsername);
    localStorage.setItem('portal_active_user_db', 'TeacherDatabase');
  }
  
  return list;
}

function getGradientForName(name: string) {
  const colors = [
    'from-blue-600 to-indigo-700 shadow-blue-500/10 border-blue-400/20',
    'from-emerald-500 to-teal-600 shadow-emerald-500/10 border-emerald-400/20',
    'from-purple-600 to-pink-700 shadow-purple-500/10 border-purple-400/20',
    'from-amber-500 to-orange-600 shadow-amber-500/10 border-amber-400/20',
    'from-rose-500 to-red-600 shadow-rose-500/10 border-rose-400/20',
    'from-cyan-500 to-blue-600 shadow-cyan-500/10 border-cyan-400/20',
  ];
  let sum = 0;
  for (let i = 0; i < name.length; i++) {
    sum += name.charCodeAt(i);
  }
  return colors[sum % colors.length];
}

export default function App() {
  const [selectedSchoolId, setSelectedSchoolId] = useState<number | undefined>(undefined);
  const [selectedClassId, setSelectedClassId] = useState<number | undefined>(undefined);
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | undefined>(undefined);
  const [selectedBimonthly, setSelectedBimonthly] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<TabKey>('attendance');

  // ROLE & COORD STATES
  const [userRole, setUserRole] = useState<'teacher' | 'coordinator'>(() => {
    return (localStorage.getItem('portal_user_role') as 'teacher' | 'coordinator') || 'teacher';
  });
  const [isInspectingMode, setIsInspectingMode] = useState<boolean>(() => {
    return localStorage.getItem('portal_is_inspecting_mode') === 'true';
  });
  const [coordinators, setCoordinators] = useState<any[]>(() => {
    const defaultCoords = [
      { username: 'coordenador', password: '123', name: 'Coordenador Geral' },
      { username: 'admin', password: 'admin', name: 'Administrador Geral' },
      { username: 'administrador', password: 'administrador', name: 'Administrador Geral' }
    ];
    try {
      const localCoords = localStorage.getItem('portal_coordinators_list');
      if (localCoords) {
        const list = JSON.parse(localCoords);
        if (!list.some((c: any) => c.username.toLowerCase() === 'admin')) {
          list.push({ username: 'admin', password: 'admin', name: 'Administrador Geral' });
        }
        if (!list.some((c: any) => c.username.toLowerCase() === 'administrador')) {
          list.push({ username: 'administrador', password: 'administrador', name: 'Administrador Geral' });
        }
        return list;
      }
      return defaultCoords;
    } catch (e) {
      return defaultCoords;
    }
  });

  // Coordinator dashboard states
  const [coordActiveTab, setCoordActiveTab] = useState<'inspect' | 'accounts' | 'global-classes' | 'global-subjects'>('inspect');
  const [searchTeacherQuery, setSearchTeacherQuery] = useState('');
  
  // Coordinator Account creation form
  const [newAccRole, setNewAccRole] = useState<'teacher' | 'coordinator'>('teacher');
  const [newAccName, setNewAccName] = useState('');
  const [newAccUser, setNewAccUser] = useState('');
  const [newAccPass, setNewAccPass] = useState('');
  const [accSuccessMessage, setAccSuccessMessage] = useState('');
  const [accErrorMessage, setAccErrorMessage] = useState('');
  const [editingAcc, setEditingAcc] = useState<any | null>(null);

  // TEACHER PROFILE & AUTHENTICATION STATES
  const [professors, setProfessors] = useState<ProfessorAccount[]>(() => getProfessorsList());
  const [selectedProf, setSelectedProf] = useState<ProfessorAccount | null>(null);
  
  // Registration form states
  const [isRegistering, setIsRegistering] = useState(false);
  const [regName, setRegName] = useState('');
  const [regUser, setRegUser] = useState('');
  const [regPass, setRegPass] = useState('');

  const [teacherName, setTeacherName] = useState<string>(() => localStorage.getItem('portal_teacher_name') || '');
  const [isAuthEnabled, setIsAuthEnabled] = useState<boolean>(() => localStorage.getItem('portal_auth_enabled') === 'true');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    const activeUser = localStorage.getItem('portal_active_user');
    if (!activeUser) return false;

    const enabled = localStorage.getItem('portal_auth_enabled') === 'true';
    if (!enabled) return true;

    return (
      sessionStorage.getItem('portal_is_authenticated') === 'true' ||
      localStorage.getItem('portal_is_authenticated_persistent') === 'true'
    );
  });

  // LOGIN FORM STATES
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [showLoginPass, setShowLoginPass] = useState(false);
  const [showManualLogin, setShowManualLogin] = useState(false);

  // PASSWORD RECOVERY STATES
  const [isRecoveryOpen, setIsRecoveryOpen] = useState(false);
  const [recoveryStep, setRecoveryStep] = useState<'menu' | 'hint' | 'question' | 'reset_confirm' | 'success'>('menu');
  const [recoveryAnswerInput, setRecoveryAnswerInput] = useState('');
  const [recoveryMessage, setRecoveryMessage] = useState('');
  const [recoveryError, setRecoveryError] = useState('');

  const [isInitialSyncing, setIsInitialSyncing] = useState(false);
  const [syncStatusMessage, setSyncStatusMessage] = useState('');

  const handleSecuritySaved = () => {
    const enabled = localStorage.getItem('portal_auth_enabled') === 'true';
    setIsAuthEnabled(enabled);
    if (!enabled) {
      setIsAuthenticated(true);
    } else {
      const currentlyAuthed = (
        sessionStorage.getItem('portal_is_authenticated') === 'true' ||
        localStorage.getItem('portal_is_authenticated_persistent') === 'true'
      );
      setIsAuthenticated(currentlyAuthed);
    }
  };

  const handleLogout = async () => {
    sessionStorage.removeItem('portal_is_authenticated');
    localStorage.removeItem('portal_is_authenticated_persistent');
    localStorage.removeItem('portal_active_user');
    localStorage.removeItem('portal_active_user_db');
    localStorage.removeItem('portal_user_role');
    localStorage.removeItem('portal_is_inspecting_mode');
    localStorage.removeItem('portal_coord_logged_in_username');
    localStorage.removeItem('portal_teacher_name');
    localStorage.removeItem('portal_username');
    localStorage.removeItem('portal_password');
    localStorage.removeItem('portal_auth_enabled');
    localStorage.removeItem('portal_password_hint');
    localStorage.removeItem('portal_security_question');
    localStorage.removeItem('portal_security_answer');
    
    // Clear IndexedDB local database tables on logout
    try {
      const tables = [
        'schools', 'classes', 'subjects', 'students', 'subjectWorkloads',
        'lessons', 'attendances', 'vistos', 'evaluations', 'grades',
        'positivesNegatives', 'gamificationPoints', 'gamificationHistory',
        'gamificationStore', 'gamificationInventory'
      ];
      for (const tableName of tables) {
        if ((db as any)[tableName]) {
          await (db as any)[tableName].clear();
        }
      }
    } catch (err) {
      console.error('Error clearing database on logout:', err);
    }

    setSelectedProf(null);
    setIsAuthenticated(false);
    window.location.reload();
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const u = loginUser.trim().toLowerCase();
    const p = loginPass;

    // Check coordinators list first
    let coordinatorsList: any[] = [];
    try {
      const localCoords = localStorage.getItem('portal_coordinators_list');
      if (localCoords) coordinatorsList = JSON.parse(localCoords);
    } catch(err) {}

    // Ensure master admin is always present in login check list
    if (!coordinatorsList.some(c => c.username.toLowerCase() === 'admin')) {
      coordinatorsList.push({
        username: 'admin',
        password: 'admin',
        name: 'Administrador Geral'
      });
    }

    if (!coordinatorsList.some(c => c.username.toLowerCase() === 'administrador')) {
      coordinatorsList.push({
        username: 'administrador',
        password: 'administrador',
        name: 'Administrador Geral'
      });
    }

    const matchingCoord = coordinatorsList.find(c => c.username.toLowerCase() === u);
    if (matchingCoord) {
      if (matchingCoord.password === p) {
        localStorage.setItem('portal_active_user', matchingCoord.username);
        localStorage.setItem('portal_user_role', 'coordinator');
        localStorage.setItem('portal_is_inspecting_mode', 'false');
        localStorage.setItem('portal_auth_enabled', 'true');
        localStorage.setItem('portal_teacher_name', matchingCoord.name);
        localStorage.setItem('portal_username', matchingCoord.username);
        localStorage.setItem('portal_password', matchingCoord.password);
        localStorage.setItem('portal_force_cloud_pull', 'true');
        
        if (rememberMe) {
          localStorage.setItem('portal_is_authenticated_persistent', 'true');
        } else {
          sessionStorage.setItem('portal_is_authenticated', 'true');
        }
        setIsAuthenticated(true);
        setUserRole('coordinator');
        setLoginError('');
        window.location.reload();
        return;
      } else {
        setLoginError('Senha incorreta.');
        return;
      }
    }

    // Then check professors list
    const matchingProf = selectedProf || professors.find(prof => prof.username.toLowerCase() === u);

    if (matchingProf) {
      if (p === matchingProf.password) {
        setLoginError('Restaurando seus diários de classe da nuvem... Por favor, aguarde.');
        
        localStorage.setItem('portal_active_user', matchingProf.username);
        localStorage.setItem('portal_active_user_db', matchingProf.dbName);
        localStorage.setItem('portal_user_role', 'teacher');
        localStorage.setItem('portal_is_inspecting_mode', 'false');
        localStorage.setItem('portal_teacher_name', matchingProf.teacherName);
        localStorage.setItem('portal_username', matchingProf.username);
        localStorage.setItem('portal_password', matchingProf.password);
        localStorage.setItem('portal_auth_enabled', matchingProf.authEnabled ? 'true' : 'false');
        localStorage.setItem('portal_password_hint', matchingProf.passwordHint || '');
        localStorage.setItem('portal_security_question', matchingProf.securityQuestion || '');
        localStorage.setItem('portal_security_answer', matchingProf.securityAnswer || '');

        if (rememberMe) {
          localStorage.setItem('portal_is_authenticated_persistent', 'true');
        } else {
          sessionStorage.setItem('portal_is_authenticated', 'true');
        }
        localStorage.setItem('portal_force_cloud_pull', 'true');

        // UNCONDITIONAL DATABASE RESTORE DURING LOGIN
        try {
          // Clear all local tables to avoid merging with other teachers' cached records
          const tables = [
            'schools', 'classes', 'subjects', 'students', 'subjectWorkloads',
            'lessons', 'attendances', 'vistos', 'evaluations', 'grades',
            'positivesNegatives', 'gamificationPoints', 'gamificationHistory',
            'gamificationStore', 'gamificationInventory'
          ];
          for (const tableName of tables) {
            if ((db as any)[tableName]) {
              await (db as any)[tableName].clear();
            }
          }

          // Pull fresh
          await pullTeacherDataFromCloud(matchingProf.username, db);

          // Seed default demo data ONLY if this is a completely blank account in cloud
          const schoolCount = await db.schools.count();
          if (schoolCount === 0) {
            await seedDatabase();
            // Store seed in cloud so they start synchronized
            await pushTeacherDataToCloud(matchingProf.username, db);
          }
        } catch (err) {
          console.error('Error restoring cloud data on login:', err);
        }

        setLoginError('');
        setIsAuthenticated(true);
        setUserRole('teacher');
        setTeacherName(matchingProf.teacherName);
        setIsAuthEnabled(matchingProf.authEnabled);
        
        window.location.reload();
      } else {
        setLoginError('Senha incorreta. Tente novamente.');
      }
    } else {
      setLoginError('Usuário não encontrado.');
    }
  };

  const handleDemoLogin = () => {
    setLoginUser('professor');
    setLoginPass('123456');
    setLoginError('');

    const u = 'professor';
    const p = '123456';

    const list = getProfessorsList();
    let matchingProf = list.find(prof => prof.username.toLowerCase() === u);

    if (!matchingProf) {
      matchingProf = {
        username: u,
        password: p,
        teacherName: 'Professor Demo',
        dbName: 'TeacherDatabase',
        authEnabled: true
      };
      const updatedList = [...list, matchingProf];
      localStorage.setItem('portal_professors_list', JSON.stringify(updatedList));
      setProfessors(updatedList);
    }

    localStorage.setItem('portal_active_user', matchingProf.username);
    localStorage.setItem('portal_active_user_db', matchingProf.dbName);
    localStorage.setItem('portal_user_role', 'teacher');
    localStorage.setItem('portal_is_inspecting_mode', 'false');
    localStorage.setItem('portal_teacher_name', matchingProf.teacherName);
    localStorage.setItem('portal_username', matchingProf.username);
    localStorage.setItem('portal_password', matchingProf.password);
    localStorage.setItem('portal_auth_enabled', 'true');

    if (rememberMe) {
      localStorage.setItem('portal_is_authenticated_persistent', 'true');
    } else {
      sessionStorage.setItem('portal_is_authenticated', 'true');
    }

    localStorage.setItem('portal_force_cloud_pull', 'true');
    setLoginError('');
    setIsAuthenticated(true);
    setUserRole('teacher');
    setTeacherName(matchingProf.teacherName);
    setIsAuthEnabled(true);

    window.location.reload();
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedUser = regUser.trim().toLowerCase();
    const trimmedName = regName.trim();

    if (!trimmedName || !trimmedUser || !regPass) {
      setLoginError('Preencha todos os campos.');
      return;
    }

    if (proforsMatch(trimmedUser)) {
      setLoginError('Este usuário já está cadastrado.');
      return;
    }

    const newProf: ProfessorAccount = {
      username: trimmedUser,
      password: regPass,
      teacherName: trimmedName,
      dbName: `TeacherDatabase_${trimmedUser}`,
      authEnabled: true,
      passwordHint: '',
      securityQuestion: '',
      securityAnswer: ''
    };

    const updatedList = [...professors, newProf];
    localStorage.setItem('portal_professors_list', JSON.stringify(updatedList));
    setProfessors(updatedList);

    localStorage.setItem('portal_active_user', newProf.username);
    localStorage.setItem('portal_active_user_db', newProf.dbName);
    localStorage.setItem('portal_teacher_name', newProf.teacherName);
    localStorage.setItem('portal_username', newProf.username);
    localStorage.setItem('portal_password', newProf.password);
    localStorage.setItem('portal_auth_enabled', 'true');
    localStorage.setItem('portal_password_hint', '');
    localStorage.setItem('portal_security_question', '');
    localStorage.setItem('portal_security_answer', '');

    if (rememberMe) {
      localStorage.setItem('portal_is_authenticated_persistent', 'true');
    } else {
      sessionStorage.setItem('portal_is_authenticated', 'true');
    }

    setIsAuthenticated(true);
    setTeacherName(newProf.teacherName);
    setIsAuthEnabled(true);
    setIsRegistering(false);
    setRegName('');
    setRegUser('');
    setRegPass('');

    window.location.reload();
  };

  const handleSelectInspectTeacher = async (teacherUsername: string, teacherName: string) => {
    // 1. Save original coordinator username
    const currentCoord = localStorage.getItem('portal_active_user') || 'coordenador';
    localStorage.setItem('portal_coord_logged_in_username', currentCoord);
    
    // 2. Set inspecting mode to true
    localStorage.setItem('portal_is_inspecting_mode', 'true');
    localStorage.setItem('portal_needs_inspect_pull', 'true');
    
    // 3. Switch active user/db credentials to target teacher
    localStorage.setItem('portal_active_user', teacherUsername);
    localStorage.setItem('portal_active_user_db', `TeacherDatabase_${teacherUsername}`);
    localStorage.setItem('portal_teacher_name', teacherName);
    
    // 4. Force a quick page reload to load the target database
    window.location.reload();
  };

  const handleExitInspectingMode = () => {
    const originalCoord = localStorage.getItem('portal_coord_logged_in_username') || 'coordenador';
    
    localStorage.setItem('portal_is_inspecting_mode', 'false');
    localStorage.setItem('portal_active_user', originalCoord);
    localStorage.removeItem('portal_active_user_db');
    localStorage.removeItem('portal_coord_logged_in_username');
    
    // Restore coordinator name
    const localCoords = localStorage.getItem('portal_coordinators_list');
    if (localCoords) {
      try {
        const list = JSON.parse(localCoords);
        const coord = list.find((c: any) => c.username === originalCoord);
        if (coord) {
          localStorage.setItem('portal_teacher_name', coord.name);
        }
      } catch(e) {}
    }
    
    window.location.reload();
  };

  const handleCreateAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAccSuccessMessage('');
    setAccErrorMessage('');

    const name = newAccName.trim();
    const username = newAccUser.trim().toLowerCase();
    const password = newAccPass;

    if (!name || !username || !password) {
      setAccErrorMessage('Preencha todos os campos.');
      return;
    }

    if (password.length < 3) {
      setAccErrorMessage('A senha deve conter pelo menos 3 caracteres.');
      return;
    }

    const activeUser = localStorage.getItem('portal_active_user')?.toLowerCase();
    const isMasterAdmin = activeUser === 'admin' || activeUser === 'administrador';
    
    // Block regular coordinators from creating/editing admin/administrador accounts
    const isTargetingAdmin = username === 'admin' || username === 'administrador' || (editingAcc && (editingAcc.username.toLowerCase() === 'admin' || editingAcc.username.toLowerCase() === 'administrador'));
    if (isTargetingAdmin && !isMasterAdmin) {
      setAccErrorMessage('Acesso negado: Somente administradores gerais podem alterar credenciais administrativas.');
      return;
    }

    if (editingAcc) {
      const oldUsername = editingAcc.username.toLowerCase();
      const newUsername = username.toLowerCase();

      if (oldUsername !== newUsername) {
        const duplicateProf = professors.some(p => p.username.toLowerCase() === newUsername);
        const duplicateCoord = coordinators.some(c => c.username.toLowerCase() === newUsername);
        if (duplicateProf || duplicateCoord) {
          setAccErrorMessage('Este nome de usuário já está cadastrado no sistema.');
          return;
        }
      }

      if (editingAcc.role === 'teacher') {
        try {
          const updatedProf = {
            ...editingAcc,
            username: newUsername,
            password: password,
            teacherName: name,
            dbName: editingAcc.dbName || `TeacherDatabase_${newUsername}`
          };
          
          await saveProfessorToCloud(updatedProf);
          
          if (oldUsername !== newUsername) {
            await deleteProfessorFromCloud(oldUsername);
          }
          
          const updatedList = professors.map(p => p.username.toLowerCase() === oldUsername ? updatedProf : p);
          localStorage.setItem('portal_professors_list', JSON.stringify(updatedList));
          setProfessors(updatedList);
          
          if (localStorage.getItem('portal_active_user')?.toLowerCase() === oldUsername) {
            localStorage.setItem('portal_active_user', newUsername);
            localStorage.setItem('portal_username', newUsername);
            localStorage.setItem('portal_password', password);
            localStorage.setItem('portal_teacher_name', name);
          }
          
          setAccSuccessMessage('Conta de professor atualizada com sucesso!');
          setEditingAcc(null);
          setNewAccName('');
          setNewAccUser('');
          setNewAccPass('');
        } catch (err) {
          console.error(err);
          setAccErrorMessage('Erro ao atualizar professor na nuvem.');
        }
      } else {
        try {
          const updatedCoord = {
            username: newUsername,
            password: password,
            name: name
          };
          
          await saveCoordinatorToCloud(updatedCoord);
          
          if (oldUsername !== newUsername) {
            await deleteCoordinatorFromCloud(oldUsername);
          }
          
          const updatedList = coordinators.map(c => c.username.toLowerCase() === oldUsername ? updatedCoord : c);
          localStorage.setItem('portal_coordinators_list', JSON.stringify(updatedList));
          setCoordinators(updatedList);
          
          if (localStorage.getItem('portal_active_user')?.toLowerCase() === oldUsername) {
            localStorage.setItem('portal_active_user', newUsername);
            localStorage.setItem('portal_username', newUsername);
            localStorage.setItem('portal_password', password);
            localStorage.setItem('portal_teacher_name', name);
          }
          
          setAccSuccessMessage('Conta de coordenador atualizada com sucesso!');
          setEditingAcc(null);
          setNewAccName('');
          setNewAccUser('');
          setNewAccPass('');
        } catch (err) {
          console.error(err);
          setAccErrorMessage('Erro ao atualizar coordenador na nuvem.');
        }
      }
      return;
    }

    // Check duplicate (creation mode)
    const localProfessors = professors;
    const duplicateProf = localProfessors.some(p => p.username.toLowerCase() === username);
    const duplicateCoord = coordinators.some(c => c.username.toLowerCase() === username);

    if (duplicateProf || duplicateCoord) {
      setAccErrorMessage('Este nome de usuário já está cadastrado no sistema.');
      return;
    }

    if (newAccRole === 'teacher') {
      try {
        const newProf = {
          username,
          password,
          teacherName: name,
          dbName: `TeacherDatabase_${username}`,
          authEnabled: true
        };
        await saveProfessorToCloud(newProf);
        
        // Update local list
        const updatedList = [...localProfessors, newProf];
        localStorage.setItem('portal_professors_list', JSON.stringify(updatedList));
        setProfessors(updatedList);
        
        setAccSuccessMessage('Professor cadastrado com sucesso!');
        setNewAccName('');
        setNewAccUser('');
        setNewAccPass('');
      } catch (err) {
        console.error(err);
        setAccErrorMessage('Erro ao cadastrar professor na nuvem.');
      }
    } else {
      try {
        const newCoord = {
          username,
          password,
          name
        };
        await saveCoordinatorToCloud(newCoord);
        
        // Update local list
        const updatedList = [...coordinators, newCoord];
        localStorage.setItem('portal_coordinators_list', JSON.stringify(updatedList));
        setCoordinators(updatedList);
        
        setAccSuccessMessage('Coordenador cadastrado com sucesso!');
        setNewAccName('');
        setNewAccUser('');
        setNewAccPass('');
      } catch (err) {
        console.error(err);
        setAccErrorMessage('Erro ao cadastrar coordenador na nuvem.');
      }
    }
  };

  const handleDeleteAccount = async (usernameToDelete: string, roleToDelete: 'teacher' | 'coordinator') => {
    if (localStorage.getItem('portal_active_user') === usernameToDelete) {
      return; // Can't delete self
    }

    const activeUser = localStorage.getItem('portal_active_user')?.toLowerCase();
    const isMasterAdmin = activeUser === 'admin' || activeUser === 'administrador';
    
    // Prevent non-admins from deleting admin/administrador accounts
    const isTargetingAdmin = usernameToDelete.toLowerCase() === 'admin' || usernameToDelete.toLowerCase() === 'administrador';
    if (isTargetingAdmin && !isMasterAdmin) {
      alert('Erro: Acesso negado. Apenas administradores gerais podem excluir contas administrativas.');
      return;
    }

    const confirmDeletion = window.confirm(`Deseja realmente excluir permanentemente a conta de @${usernameToDelete}?`);
    if (!confirmDeletion) return;

    if (roleToDelete === 'teacher') {
      try {
        await deleteProfessorFromCloud(usernameToDelete);
        const localList = professors;
        const updatedList = localList.filter(p => p.username.toLowerCase() !== usernameToDelete.toLowerCase());
        localStorage.setItem('portal_professors_list', JSON.stringify(updatedList));
        setProfessors(updatedList);
      } catch (err) {
        console.error(err);
        alert('Erro ao excluir conta de professor.');
      }
    } else {
      try {
        await deleteCoordinatorFromCloud(usernameToDelete);
        const updatedList = coordinators.filter(c => c.username.toLowerCase() !== usernameToDelete.toLowerCase());
        localStorage.setItem('portal_coordinators_list', JSON.stringify(updatedList));
        setCoordinators(updatedList);
      } catch (err) {
        console.error(err);
        alert('Erro ao excluir conta de coordenador.');
      }
    }
  };

  function proforsMatch(user: string) {
    return professors.some(p => p.username.toLowerCase() === user);
  }

  const handleOpenRecovery = () => {
    setIsRecoveryOpen(true);
    setRecoveryStep('menu');
    setRecoveryAnswerInput('');
    setRecoveryMessage('');
    setRecoveryError('');
  };

  const handleCloseRecovery = () => {
    setIsRecoveryOpen(false);
  };

  const handleCheckHint = () => {
    const hint = localStorage.getItem('portal_password_hint');
    if (hint && hint.trim()) {
      setRecoveryMessage(`Sua dica de senha cadastrada é:\n"${hint.trim()}"`);
    } else {
      setRecoveryMessage(
        "Nenhuma dica de senha personalizada foi cadastrada no seu perfil. " +
        "Se você ainda não alterou as configurações padrão, tente Usuário: 'professor' e Senha: '123456'."
      );
    }
    setRecoveryStep('hint');
  };

  const handleOpenQuestion = () => {
    const question = localStorage.getItem('portal_security_question');
    const answer = localStorage.getItem('portal_security_answer');
    if (question && answer && question.trim() && answer.trim()) {
      setRecoveryStep('question');
      setRecoveryError('');
    } else {
      setRecoveryError("Você ainda não configurou uma pergunta de segurança nas configurações do seu Perfil.");
      setRecoveryStep('question');
    }
  };

  const handleVerifyQuestionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const storedAnswer = localStorage.getItem('portal_security_answer') || '';
    const storedUser = localStorage.getItem('portal_username') || 'professor';
    const storedPass = localStorage.getItem('portal_password') || '123456';

    if (
      storedAnswer.trim() &&
      recoveryAnswerInput.trim().toLowerCase() === storedAnswer.trim().toLowerCase()
    ) {
      setRecoveryMessage(
        `Resposta correta! Suas credenciais são:\n\nUsuário: ${storedUser}\nSenha: ${storedPass}`
      );
      setRecoveryStep('success');
      setRecoveryError('');
    } else {
      setRecoveryError('Resposta de segurança incorreta. Tente novamente.');
    }
  };

  const handleConfirmEmergencyReset = () => {
    localStorage.setItem('portal_username', 'professor');
    localStorage.setItem('portal_password', '123456');
    localStorage.setItem('portal_auth_enabled', 'false');
    sessionStorage.removeItem('portal_is_authenticated');
    localStorage.removeItem('portal_is_authenticated_persistent');
    
    // Sync React states
    setIsAuthEnabled(false);
    setIsAuthenticated(true);
    setIsRecoveryOpen(false);
    setLoginError('');
  };

  // Load basic entities for automatic defaults
  const schools = useLiveQuery(() => db.schools.toArray()) || [];
  const classes = useLiveQuery(() => db.classes.toArray()) || [];
  const subjects = useLiveQuery(() => db.subjects.toArray()) || [];

  // Seed database silently on mount if empty, and sync with Firebase online database
  useEffect(() => {
    const initDb = async () => {
      // Sync coordinator profiles list from the cloud on mount
      try {
        const updatedList = await syncCoordinatorsListInCloud();
        if (updatedList && updatedList.length > 0) {
          setCoordinators(updatedList);
        }
      } catch (err) {
        console.error('Error syncing coordinators list on mount:', err);
      }

      // Sync professor profiles list from the cloud on mount
      try {
        const updatedList = await syncProfessorsListInCloud();
        if (updatedList && updatedList.length > 0) {
          setProfessors(updatedList);
        }
      } catch (err) {
        console.error('Error syncing professors list on mount:', err);
      }

      // Check active teacher data sync
      const activeUser = localStorage.getItem('portal_active_user');
      const role = localStorage.getItem('portal_user_role') || 'teacher';
      const inspecting = localStorage.getItem('portal_is_inspecting_mode') === 'true';
      const needsInspectPull = localStorage.getItem('portal_needs_inspect_pull') === 'true';

      if (activeUser && isAuthenticated && (role === 'teacher' || inspecting)) {
        try {
          const schoolCount = await db.schools.count();
          const forcePull = localStorage.getItem('portal_force_cloud_pull') === 'true';
          const shouldPull = inspecting ? needsInspectPull : (schoolCount === 0 || forcePull);

          if (shouldPull) {
            setIsInitialSyncing(true);
            setSyncStatusMessage(`Sincronizando com a Nuvem... Buscando diário de classe de @${activeUser}...`);
            
            await pullTeacherDataFromCloud(activeUser, db);

            if (forcePull) {
              localStorage.removeItem('portal_force_cloud_pull');
            }

            if (inspecting && needsInspectPull) {
              localStorage.removeItem('portal_needs_inspect_pull');
            }
            
            // If still 0 schools and we are NOT inspecting, it's a completely new user. Let's seed default demo data!
            const newSchoolCount = await db.schools.count();
            if (newSchoolCount === 0 && !inspecting) {
              setSyncStatusMessage('Nenhum dado encontrado na nuvem. Criando diários de demonstração...');
              await seedDatabase();
              // Save the seeded data back to Firestore so it starts synced!
              await pushTeacherDataToCloud(activeUser, db);
            }
            
            setIsInitialSyncing(false);
            window.location.reload();
          }
        } catch (err) {
          console.error('Error during startup sync:', err);
          setIsInitialSyncing(false);
          if (!inspecting) {
            await seedDatabase();
          }
        }
      } else if (activeUser && isAuthenticated && role === 'coordinator') {
        try {
          const forcePull = localStorage.getItem('portal_force_cloud_pull') === 'true';
          if (forcePull) {
            setIsInitialSyncing(true);
            setSyncStatusMessage('Sincronizando com a Nuvem... Carregando dados da coordenação e turmas...');
            // Wait 1.2 seconds for a smooth visual feedback
            await new Promise((r) => setTimeout(r, 1200));
            await syncCoordinatorsListInCloud();
            await syncProfessorsListInCloud();
            localStorage.removeItem('portal_force_cloud_pull');
            setIsInitialSyncing(false);
          }
        } catch (err) {
          console.error('Error during coordinator startup sync:', err);
          setIsInitialSyncing(false);
        }
      } else {
        // Fallback for default unauthenticated startup or coordinator view (no local db sync needed unless inspecting)
        if (!activeUser || role === 'teacher') {
          await seedDatabase();
        }
      }
    };
    initDb();
  }, [isAuthenticated]);

  // Proactive Selection Sync:
  // If no school is selected, pick the first one as default when loaded
  useEffect(() => {
    if (selectedSchoolId === undefined && schools.length > 0) {
      setSelectedSchoolId(schools[0].id);
    }
  }, [schools, selectedSchoolId]);

  // If school is selected but no class is selected, pick the first class for that school
  useEffect(() => {
    if (selectedSchoolId) {
      const schoolClasses = [...classes].filter((c) => c.schoolId === selectedSchoolId).sort(sortClasses);
      if (selectedClassId === undefined && schoolClasses.length > 0) {
        setSelectedClassId(schoolClasses[0].id);
      }
    }
  }, [classes, selectedSchoolId, selectedClassId]);

  // If no subject is selected, pick the first one as default when loaded
  useEffect(() => {
    if (selectedSubjectId === undefined && subjects.length > 0) {
      setSelectedSubjectId(subjects[0].id);
    }
  }, [subjects, selectedSubjectId]);

  // Render core tab content based on key
  const renderTabContent = () => {
    switch (activeTab) {
      case 'grades':
        return (
          <TabAGrades
            schoolId={selectedSchoolId}
            classId={selectedClassId}
            subjectId={selectedSubjectId}
            bimonthly={selectedBimonthly}
            isReadOnly={isInspectingMode}
          />
        );
      case 'vistos':
        return (
          <TabBVistos
            schoolId={selectedSchoolId}
            classId={selectedClassId}
            subjectId={selectedSubjectId}
            bimonthly={selectedBimonthly}
            isReadOnly={isInspectingMode}
          />
        );
      case 'gamification':
        return (
          <TabCGamification
            schoolId={selectedSchoolId}
            classId={selectedClassId}
            subjectId={selectedSubjectId}
            bimonthly={selectedBimonthly}
            isReadOnly={isInspectingMode}
          />
        );
      case 'attendance':
        return (
          <TabDAttendance
            schoolId={selectedSchoolId}
            classId={selectedClassId}
            subjectId={selectedSubjectId}
            bimonthly={selectedBimonthly}
            onSelectSchool={setSelectedSchoolId}
            onSelectClass={setSelectedClassId}
            onSelectSubject={setSelectedSubjectId}
            isReadOnly={isInspectingMode}
          />
        );
      case 'reports':
        return (
          <TabEReports
            schoolId={selectedSchoolId}
            classId={selectedClassId}
            subjectId={selectedSubjectId}
            bimonthly={selectedBimonthly}
            isReadOnly={isInspectingMode}
          />
        );
      case 'settings':
        return <TabFSettings teacherName={teacherName} setTeacherName={setTeacherName} onSecuritySaved={handleSecuritySaved} isReadOnly={isInspectingMode} />;
      default:
        return null;
    }
  };

  const tabsInfo = [
    { key: 'attendance', label: 'Frequência & Chamada', icon: Calendar, color: 'text-emerald-400' },
    { key: 'grades', label: 'Notas', icon: FileText, color: 'text-blue-400' },
    { key: 'vistos', label: 'Vistos', icon: CheckSquare, color: 'text-teal-400' },
    { key: 'gamification', label: 'Comportamento', icon: Trophy, color: 'text-yellow-400' },
    { key: 'reports', label: 'Relatórios', icon: FileBarChart2, color: 'text-sky-400' },
    { key: 'settings', label: 'Configurações', icon: Settings, color: 'text-slate-400' },
  ];

  if (!isAuthenticated) {
    return (
      <div id="portal-lockscreen-root" className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col items-center justify-center font-sans antialiased relative overflow-hidden px-4">
        {/* Subtle decorative background lights */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-10 left-10 w-[250px] h-[250px] bg-emerald-500/5 rounded-full blur-[80px] pointer-events-none" />

        <div className="w-full max-w-md relative z-10 animate-in fade-in zoom-in-95 duration-300">
          {/* Logo / Title Area */}
          <div className="text-center mb-8">
            <div className="inline-flex w-16 h-16 bg-blue-600 rounded-2xl items-center justify-center shadow-2xl shadow-blue-500/30 mb-4 ring-1 ring-blue-400/20">
              <Lock className="w-8 h-8 text-white animate-pulse" />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white">Portal do Professor</h1>
            <p className="text-sm text-zinc-500 mt-1 font-medium">Insira suas credenciais para gerenciar seus diários</p>
          </div>

          {/* Conditional: Recovery Card or Login Card */}
          {isRecoveryOpen ? (
            <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl shadow-2xl shadow-black/50 space-y-6 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center gap-2 pb-2 border-b border-zinc-800">
                <Key className="w-5 h-5 text-blue-400" />
                <div>
                  <h3 className="text-white font-bold text-sm">Recuperação de Acesso</h3>
                  <p className="text-[11px] text-zinc-500">Recupere ou redefina sua senha de acesso local</p>
                </div>
              </div>

              {recoveryStep === 'menu' && (
                <div className="space-y-3">
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Como o aplicativo funciona de forma 100% offline e privada neste navegador, escolha uma das opções de recuperação local abaixo:
                  </p>

                  <button
                    type="button"
                    onClick={handleCheckHint}
                    className="w-full p-3 bg-zinc-950/50 hover:bg-zinc-950 border border-zinc-800 hover:border-zinc-700 text-left rounded-xl transition flex items-center justify-between group cursor-pointer"
                  >
                    <div>
                      <span className="text-xs font-bold text-zinc-300 block">1. Ver Dica de Senha</span>
                      <span className="text-[10px] text-zinc-500 block">Mostrar a dica cadastrada no seu perfil</span>
                    </div>
                    <span className="text-zinc-500 group-hover:text-zinc-300 text-lg">→</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleOpenQuestion}
                    className="w-full p-3 bg-zinc-950/50 hover:bg-zinc-950 border border-zinc-800 hover:border-zinc-700 text-left rounded-xl transition flex items-center justify-between group cursor-pointer"
                  >
                    <div>
                      <span className="text-xs font-bold text-zinc-300 block">2. Responder Pergunta de Segurança</span>
                      <span className="text-[10px] text-zinc-500 block">Use a pergunta configurada previamente</span>
                    </div>
                    <span className="text-zinc-500 group-hover:text-zinc-300 text-lg">→</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRecoveryStep('reset_confirm')}
                    className="w-full p-3 bg-rose-500/5 hover:bg-rose-500/10 border border-rose-500/10 hover:border-rose-500/20 text-left rounded-xl transition flex items-center justify-between group cursor-pointer"
                  >
                    <div>
                      <span className="text-xs font-bold text-rose-400 block">3. Redefinição de Emergência</span>
                      <span className="text-[10px] text-rose-500/80 block">Caso tenha esquecido tudo, desative a senha</span>
                    </div>
                    <span className="text-rose-500 group-hover:text-rose-400 text-lg">→</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCloseRecovery}
                    className="w-full py-2.5 mt-2 bg-zinc-800 hover:bg-zinc-750 text-zinc-300 hover:text-white rounded-xl text-xs font-semibold transition text-center cursor-pointer"
                  >
                    Voltar para o Login
                  </button>
                </div>
              )}

              {recoveryStep === 'hint' && (
                <div className="space-y-4">
                  <div className="p-4 bg-zinc-950/60 rounded-xl border border-zinc-800 text-zinc-300 text-xs leading-relaxed space-y-2">
                    <span className="text-blue-400 font-bold block">Dica de Senha:</span>
                    <p className="whitespace-pre-line leading-relaxed">{recoveryMessage}</p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setRecoveryStep('menu')}
                      className="flex-1 py-2.5 bg-zinc-850 hover:bg-zinc-800 text-zinc-300 rounded-xl text-xs font-semibold transition cursor-pointer"
                    >
                      Outras Opções
                    </button>
                    <button
                      type="button"
                      onClick={handleCloseRecovery}
                      className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                    >
                      Tentar Login
                    </button>
                  </div>
                </div>
              )}

              {recoveryStep === 'question' && (
                <div className="space-y-4">
                  {recoveryError && !localStorage.getItem('portal_security_question') ? (
                    <div className="space-y-4">
                      <div className="p-3 bg-amber-500/5 border border-amber-500/10 text-amber-400 text-xs rounded-xl leading-relaxed">
                        {recoveryError}
                      </div>
                      <button
                        type="button"
                        onClick={() => setRecoveryStep('menu')}
                        className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-750 text-zinc-300 rounded-xl text-xs font-semibold transition cursor-pointer"
                      >
                        Voltar
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleVerifyQuestionSubmit} className="space-y-4">
                      <div className="p-3.5 bg-zinc-950/40 border border-zinc-850 rounded-xl">
                        <span className="text-[10px] text-zinc-500 font-bold uppercase block tracking-wider">Pergunta de Segurança</span>
                        <span className="text-xs font-semibold text-zinc-300 block mt-1">
                          {localStorage.getItem('portal_security_question')}
                        </span>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-zinc-400 block">Sua Resposta</label>
                        <input
                          type="text"
                          required
                          placeholder="Digite a resposta que você configurou"
                          value={recoveryAnswerInput}
                          onChange={(e) => setRecoveryAnswerInput(e.target.value)}
                          className="bg-zinc-950 border border-zinc-800 text-zinc-200 text-xs rounded-xl px-3 py-2.5 w-full focus:ring-1 focus:ring-blue-500 focus:outline-none transition"
                        />
                      </div>

                      {recoveryError && (
                        <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl">
                          {recoveryError}
                        </div>
                      )}

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setRecoveryStep('menu')}
                          className="flex-1 py-2.5 bg-zinc-850 hover:bg-zinc-800 text-zinc-300 rounded-xl text-xs font-semibold transition cursor-pointer"
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                        >
                          Verificar Resposta
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}

              {recoveryStep === 'success' && (
                <div className="space-y-4">
                  <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 text-emerald-400 text-xs rounded-xl leading-relaxed space-y-2">
                    <div className="flex items-center gap-1.5 font-bold text-emerald-400">
                      <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full shrink-0" />
                      Acesso Validado!
                    </div>
                    <p className="whitespace-pre-line text-zinc-350">{recoveryMessage}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const storedUser = localStorage.getItem('portal_username') || 'professor';
                      const storedPass = localStorage.getItem('portal_password') || '123456';
                      setLoginUser(storedUser);
                      setLoginPass(storedPass);
                      setIsRecoveryOpen(false);
                    }}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                  >
                    Preencher Credenciais & Ir para Login
                  </button>
                </div>
              )}

              {recoveryStep === 'reset_confirm' && (
                <div className="space-y-4">
                  <div className="p-4 bg-rose-500/5 border border-rose-500/10 text-rose-400 text-xs rounded-xl leading-relaxed space-y-3">
                    <div className="flex items-center gap-1.5 font-bold">
                      <AlertTriangle className="w-4 h-4" />
                      Redefinição de Emergência
                    </div>
                    <p className="text-zinc-300 text-[11px]">
                      Como seus dados são armazenados localmente com privacidade absoluta, o reset de emergência permite remover a senha sem perder suas escolas, turmas, notas ou chamadas!
                    </p>
                    <p className="text-zinc-400 font-medium text-[11px]">
                      Suas credenciais serão redefinidas para o padrão:
                      <br />• Usuário: <strong className="text-zinc-200">professor</strong>
                      <br />• Senha: <strong className="text-zinc-200">123456</strong>
                      <br />• Bloqueio por senha: <strong className="text-zinc-200">Desativado</strong>
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setRecoveryStep('menu')}
                      className="flex-1 py-2.5 bg-zinc-850 hover:bg-zinc-800 text-zinc-300 rounded-xl text-xs font-semibold transition cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmEmergencyReset}
                      className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                    >
                      Sim, Resetar Acesso
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Single Direct Login Card (Username + Password) */
            <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl shadow-2xl shadow-black/50 space-y-6 w-full max-w-sm animate-in fade-in zoom-in-95 duration-200">
              <div>
                <h3 className="text-white font-bold text-base flex items-center gap-2">
                  <User className="w-5 h-5 text-blue-400" /> Entrar com Credenciais
                </h3>
                <p className="text-xs text-zinc-500 mt-1">Acesse o seu diário de classe ou painel</p>
              </div>

              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-400 block">Nome de Usuário (Login)</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500">
                      <User className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      required
                      placeholder="Digite seu usuário"
                      value={loginUser}
                      onChange={(e) => setLoginUser(e.target.value.toLowerCase())}
                      className="bg-zinc-950 border border-zinc-800 text-zinc-200 text-xs rounded-xl pl-10 pr-4 py-3 w-full focus:ring-1 focus:ring-blue-500 focus:outline-none placeholder-zinc-650 font-mono transition"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-400 block">Sua Senha</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500">
                      <Key className="w-4 h-4" />
                    </span>
                    <input
                      type={showLoginPass ? 'text' : 'password'}
                      required
                      placeholder="Digite sua senha"
                      value={loginPass}
                      onChange={(e) => setLoginPass(e.target.value)}
                      className="bg-zinc-950 border border-zinc-800 text-zinc-200 text-xs rounded-xl pl-10 pr-10 py-3 w-full focus:ring-1 focus:ring-blue-500 focus:outline-none placeholder-zinc-650 transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPass(!showLoginPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 cursor-pointer"
                    >
                      {showLoginPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Remember Me Toggle */}
                <div className="flex items-center gap-2 pt-1 select-none">
                  <input
                    id="remember-me-checkbox"
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-zinc-800 bg-zinc-950 text-blue-600 focus:ring-blue-500/30 focus:ring-offset-zinc-900 cursor-pointer"
                  />
                  <label htmlFor="remember-me-checkbox" className="text-xs text-zinc-400 cursor-pointer">
                    Manter conectado neste dispositivo
                  </label>
                </div>

                {loginError && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-rose-500 rounded-full shrink-0" />
                    <span>{loginError}</span>
                  </div>
                )}

                <button
                  id="submit-login-btn"
                  type="submit"
                  className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-lg shadow-blue-500/10 cursor-pointer"
                >
                  <LogIn className="w-4 h-4" /> Acessar Painel
                </button>

                <div className="flex flex-col gap-2.5 items-center pt-3 border-t border-zinc-850 mt-3 text-center">
                  <button
                    type="button"
                    onClick={handleDemoLogin}
                    className="text-xs text-blue-400 hover:text-blue-300 hover:underline transition font-bold cursor-pointer"
                  >
                    Não tenho conta, ver demonstração
                  </button>

                  <button
                    type="button"
                    onClick={handleOpenRecovery}
                    className="text-xs text-zinc-500 hover:text-zinc-300 transition cursor-pointer font-medium hover:underline inline-flex items-center gap-1"
                  >
                    Esqueceu a senha? Relembrar acesso
                  </button>
                </div>
              </form>
            </div>
          )}

          <p className="text-center text-[10px] text-zinc-600 mt-6 uppercase tracking-wider">
            Portal do Professor — 100% Offline e Seguro
          </p>
        </div>
      </div>
    );
  }

  if (isInitialSyncing) {
    return (
      <div className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col items-center justify-center font-sans antialiased relative overflow-hidden px-4">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-emerald-600/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="w-full max-w-md relative z-10 text-center space-y-6 animate-in fade-in zoom-in-95 duration-300">
          <div className="inline-flex w-16 h-16 bg-emerald-600 rounded-2xl items-center justify-center shadow-2xl shadow-emerald-500/30 ring-1 ring-emerald-400/20">
            <Sparkles className="w-8 h-8 text-white animate-pulse" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-bold text-white">Sincronização Online</h1>
            <p className="text-sm text-zinc-400 font-medium leading-relaxed">
              {syncStatusMessage}
            </p>
          </div>
          <div className="w-32 h-1 bg-zinc-800 rounded-full mx-auto overflow-hidden relative">
            <div className="h-full bg-emerald-500 rounded-full w-1/2 absolute left-0 animate-[shimmer_1.5s_infinite]" style={{
              backgroundImage: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)'
            }} />
          </div>
        </div>
      </div>
    );
  }

  if (userRole === 'coordinator' && !isInspectingMode) {
    return (
      <div id="portal-app-root" className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col font-sans antialiased selection:bg-amber-600/30 selection:text-amber-200">
        {/* Top Header */}
        <header className="bg-zinc-900 border-b border-zinc-800 p-4 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-600/15 border border-amber-500/30 text-amber-500 rounded-xl flex items-center justify-center shrink-0">
                <Shield className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h1 className="text-sm font-black text-white flex items-center gap-1.5 uppercase tracking-wide">
                  Painel do Coordenador
                  <span className="text-[9px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-full font-bold uppercase tracking-normal">ADMIN</span>
                </h1>
                <p className="text-[11px] text-zinc-400 truncate">{teacherName}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleLogout}
                className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-750 border border-zinc-700 text-zinc-300 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" /> Sair
              </button>
            </div>
          </div>
        </header>

        {/* Dashboard Navigation Tabs */}
        <div className="bg-zinc-900/40 border-b border-zinc-800/50">
          <div className="max-w-7xl mx-auto px-4 flex items-center gap-2">
            <button
              onClick={() => setCoordActiveTab('inspect')}
              className={`px-4 py-3 font-bold text-xs border-b-2 transition flex items-center gap-2 cursor-pointer ${
                coordActiveTab === 'inspect' ? 'border-amber-500 text-amber-400 bg-amber-500/5' : 'border-transparent text-zinc-400 hover:text-zinc-300'
              }`}
            >
              <Users className="w-4 h-4" /> Inspeção de Diários
            </button>
            <button
              onClick={() => {
                setCoordActiveTab('accounts');
                setAccSuccessMessage('');
                setAccErrorMessage('');
              }}
              className={`px-4 py-3 font-bold text-xs border-b-2 transition flex items-center gap-2 cursor-pointer ${
                coordActiveTab === 'accounts' ? 'border-amber-500 text-amber-400 bg-amber-500/5' : 'border-transparent text-zinc-400 hover:text-zinc-300'
              }`}
            >
              <UserPlus className="w-4 h-4" /> Gerenciar Contas
            </button>
            <button
              onClick={() => setCoordActiveTab('global-classes')}
              className={`px-4 py-3 font-bold text-xs border-b-2 transition flex items-center gap-2 cursor-pointer ${
                coordActiveTab === 'global-classes' ? 'border-amber-500 text-amber-400 bg-amber-500/5' : 'border-transparent text-zinc-400 hover:text-zinc-300'
              }`}
            >
              <School className="w-4 h-4" /> Turmas & Alunos Globais
            </button>
            <button
              onClick={() => setCoordActiveTab('global-subjects')}
              className={`px-4 py-3 font-bold text-xs border-b-2 transition flex items-center gap-2 cursor-pointer ${
                coordActiveTab === 'global-subjects' ? 'border-amber-500 text-amber-400 bg-amber-500/5' : 'border-transparent text-zinc-400 hover:text-zinc-300'
              }`}
            >
              <BookOpen className="w-4 h-4" /> Disciplinas & Cargas Globais
            </button>
          </div>
        </div>

        {/* Dashboard Content */}
        <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 pb-20">
          {coordActiveTab === 'global-classes' && (
            <CoordGlobalClasses />
          )}

          {coordActiveTab === 'global-subjects' && (
            <CoordGlobalSubjects />
          )}

          {coordActiveTab === 'inspect' && (
            /* INSPECT MODE: List all teachers for inspection */
            <div className="space-y-6">
              <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-white font-bold text-sm">Visualizar Diários de Professores</h3>
                    <p className="text-xs text-zinc-500">Selecione qualquer professor abaixo para entrar no modo de inspeção (leitura e consulta) do diário de classe dele.</p>
                  </div>
                  
                  <div className="relative max-w-md w-full">
                    <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Buscar professor por nome ou usuário..."
                      value={searchTeacherQuery}
                      onChange={(e) => setSearchTeacherQuery(e.target.value)}
                      className="bg-zinc-950 border border-zinc-800 text-zinc-300 text-xs rounded-xl pl-9 pr-4 py-2.5 w-full focus:ring-1 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
                  {professors
                    .filter(p => 
                      p.teacherName.toLowerCase().includes(searchTeacherQuery.toLowerCase()) || 
                      p.username.toLowerCase().includes(searchTeacherQuery.toLowerCase())
                    )
                    .map((p) => (
                      <div key={p.username} className="bg-zinc-950/40 border border-zinc-850 hover:border-zinc-800 rounded-2xl p-4 flex flex-col justify-between gap-4 transition duration-250">
                        <div className="flex items-start gap-3">
                          <div className={`w-11 h-11 rounded-xl bg-gradient-to-tr ${getGradientForName(p.teacherName)} flex items-center justify-center text-white text-sm font-black shrink-0`}>
                            {p.teacherName.substring(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="text-xs font-bold text-zinc-200 block truncate">{p.teacherName}</span>
                            <span className="text-[10px] text-zinc-500 font-mono block">@{p.username}</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-zinc-900">
                          <span className="text-[10px] text-zinc-500 flex items-center gap-1">
                            <Lock className="w-3 h-3 text-zinc-650" /> Senha: {p.password}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleSelectInspectTeacher(p.username, p.teacherName)}
                            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-bold text-[11px] rounded-lg transition flex items-center gap-1 cursor-pointer shrink-0"
                          >
                            <Eye className="w-3.5 h-3.5" /> Inspecionar Diário
                          </button>
                        </div>
                      </div>
                    ))
                  }
                  {professors.length === 0 && (
                    <div className="col-span-full py-12 text-center text-zinc-500 text-xs">
                      Nenhum professor cadastrado no sistema. Vá em "Gerenciar Contas" para criar o primeiro cadastro.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {coordActiveTab === 'accounts' && (
            /* ACCOUNTS MODE: Create and delete accounts */
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Card 1: Account Creation Form */}
              <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl space-y-4">
                {editingAcc ? (
                  <h3 className="text-white font-bold text-sm flex items-center gap-2">
                    <Pencil className="w-4 h-4 text-amber-500 animate-pulse" /> Editar Conta: @{editingAcc.username}
                  </h3>
                ) : (
                  <h3 className="text-white font-bold text-sm flex items-center gap-2">
                    <UserPlus className="w-4 h-4 text-amber-500" /> Cadastrar Nova Conta
                  </h3>
                )}
                <p className="text-xs text-zinc-500">
                  {editingAcc 
                    ? "Altere o nome completo, o usuário de acesso (login) e a senha de acesso para esta conta."
                    : "Crie contas para professores acessarem o portal ou para outros coordenadores gerais."
                  }
                </p>

                <form onSubmit={handleCreateAccountSubmit} className="space-y-4">
                  {/* Role selection */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-400 block">Tipo de Usuário</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        disabled={!!editingAcc}
                        onClick={() => setNewAccRole('teacher')}
                        className={`py-2 rounded-xl text-xs font-bold transition border cursor-pointer disabled:opacity-50 ${
                          newAccRole === 'teacher' ? 'bg-amber-600/10 border-amber-500 text-amber-400 animate-in fade-in' : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white'
                        }`}
                      >
                        Professor
                      </button>
                      <button
                        type="button"
                        disabled={!!editingAcc}
                        onClick={() => setNewAccRole('coordinator')}
                        className={`py-2 rounded-xl text-xs font-bold transition border cursor-pointer disabled:opacity-50 ${
                          newAccRole === 'coordinator' ? 'bg-amber-600/10 border-amber-500 text-amber-400 animate-in fade-in' : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white'
                        }`}
                      >
                        Coordenador
                      </button>
                    </div>
                  </div>

                  {/* Name field */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-400 block">Nome Completo</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Prof. Dr. André Costa"
                      value={newAccName}
                      onChange={(e) => setNewAccName(e.target.value)}
                      className="bg-zinc-950 border border-zinc-800 text-zinc-200 text-xs rounded-xl px-3 py-2.5 w-full focus:ring-1 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>

                  {/* Username login field */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-400 block">Usuário de Acesso (Login)</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: andrecosta"
                      value={newAccUser}
                      onChange={(e) => setNewAccUser(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))}
                      className="bg-zinc-950 border border-zinc-800 text-zinc-200 text-xs rounded-xl px-3 py-2.5 w-full focus:ring-1 focus:ring-amber-500 focus:outline-none font-mono"
                    />
                  </div>

                  {/* Password field */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-400 block">Senha de Acesso</label>
                    <input
                      type="text"
                      required
                      placeholder="Mínimo de 3 caracteres"
                      value={newAccPass}
                      onChange={(e) => setNewAccPass(e.target.value)}
                      className="bg-zinc-950 border border-zinc-800 text-zinc-200 text-xs rounded-xl px-3 py-2.5 w-full focus:ring-1 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>

                  {/* Message alerts */}
                  {accSuccessMessage && (
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-xl animate-in zoom-in-95">
                      {accSuccessMessage}
                    </div>
                  )}

                  {accErrorMessage && (
                    <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl animate-in zoom-in-95">
                      {accErrorMessage}
                    </div>
                  )}

                  {editingAcc ? (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingAcc(null);
                          setNewAccName('');
                          setNewAccUser('');
                          setNewAccPass('');
                          setAccSuccessMessage('');
                          setAccErrorMessage('');
                        }}
                        className="py-2.5 bg-zinc-800 hover:bg-zinc-750 text-zinc-300 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <X className="w-4.5 h-4.5" /> Cancelar
                      </button>
                      <button
                        type="submit"
                        className="py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer shadow-lg shadow-emerald-500/15"
                      >
                        <Check className="w-4.5 h-4.5" /> Salvar
                      </button>
                    </div>
                  ) : (
                    <button
                      type="submit"
                      className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer shadow-lg shadow-amber-500/15"
                    >
                      <Plus className="w-4 h-4" /> Criar Conta
                    </button>
                  )}
                </form>
              </div>

              {/* List and manage existing accounts */}
              <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl lg:col-span-2 space-y-4">
                <h3 className="text-white font-bold text-sm flex items-center gap-2">
                  <Users className="w-4 h-4 text-amber-500" /> Contas Ativas no Sistema
                </h3>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-zinc-350 text-left">
                    <thead>
                      <tr className="border-b border-zinc-850 text-zinc-500 uppercase tracking-wider text-[10px] font-bold">
                        <th className="py-2.5">Nome Completo</th>
                        <th className="py-2.5">Usuário</th>
                        <th className="py-2.5">Tipo</th>
                        <th className="py-2.5">Senha</th>
                        <th className="py-2.5 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-850/60">
                      {/* List Coordinators */}
                      {coordinators.map((c) => {
                        const activeUser = localStorage.getItem('portal_active_user')?.toLowerCase();
                        const isMasterAdmin = activeUser === 'admin' || activeUser === 'administrador';
                        const isAccountAdmin = c.username.toLowerCase() === 'admin' || c.username.toLowerCase() === 'administrador';
                        const hidePassword = isAccountAdmin && !isMasterAdmin;

                        return (
                          <tr key={c.username} className="hover:bg-zinc-950/20">
                            <td className="py-3 font-semibold text-zinc-100">{c.name}</td>
                            <td className="py-3 font-mono text-zinc-400">@{c.username}</td>
                            <td className="py-3">
                              <span className="text-[10px] bg-amber-500/10 text-amber-400 font-bold px-1.5 py-0.5 rounded-full uppercase">Coordenador</span>
                            </td>
                            <td className="py-3 text-zinc-500 font-mono">
                              {hidePassword ? '••••••••' : c.password}
                            </td>
                            <td className="py-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {!hidePassword ? (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingAcc({ ...c, role: 'coordinator' });
                                        setNewAccRole('coordinator');
                                        setNewAccName(c.name);
                                        setNewAccUser(c.username);
                                        setNewAccPass(c.password);
                                        setAccSuccessMessage('');
                                        setAccErrorMessage('');
                                      }}
                                      className="text-zinc-500 hover:text-amber-400 p-1 transition cursor-pointer"
                                      title="Editar Coordenador"
                                    >
                                      <Pencil className="w-4 h-4" />
                                    </button>
                                    <button
                                      type="button"
                                      disabled={localStorage.getItem('portal_active_user') === c.username}
                                      onClick={() => handleDeleteAccount(c.username, 'coordinator')}
                                      className="text-zinc-500 hover:text-rose-400 disabled:opacity-30 disabled:hover:text-zinc-500 p-1 transition cursor-pointer"
                                      title="Excluir Coordenador"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </>
                                ) : (
                                  <span className="text-[10px] text-zinc-650 italic font-semibold px-2">Acesso Restrito</span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}

                      {/* List Professors */}
                      {professors.map((p) => (
                        <tr key={p.username} className="hover:bg-zinc-950/20">
                          <td className="py-3 font-semibold text-zinc-100">{p.teacherName}</td>
                          <td className="py-3 font-mono text-zinc-400">@{p.username}</td>
                          <td className="py-3">
                            <span className="text-[10px] bg-blue-500/10 text-blue-400 font-bold px-1.5 py-0.5 rounded-full uppercase">Professor</span>
                          </td>
                          <td className="py-3 text-zinc-500 font-mono">{p.password}</td>
                          <td className="py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingAcc({ ...p, role: 'teacher' });
                                  setNewAccRole('teacher');
                                  setNewAccName(p.teacherName);
                                  setNewAccUser(p.username);
                                  setNewAccPass(p.password);
                                  setAccSuccessMessage('');
                                  setAccErrorMessage('');
                                }}
                                className="text-zinc-500 hover:text-amber-400 p-1 transition cursor-pointer"
                                title="Editar Professor"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteAccount(p.username, 'teacher')}
                                className="text-zinc-500 hover:text-rose-400 p-1 transition cursor-pointer"
                                title="Excluir Professor"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    );
  }

  return (
    <div id="portal-app-root" className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col font-sans antialiased selection:bg-blue-600/30 selection:text-blue-200">
      
      {isInspectingMode && (
        <div className="bg-amber-600 text-zinc-950 text-xs font-bold py-2.5 px-4 flex items-center justify-between gap-4 shadow-md relative z-50 animate-in slide-in-from-top duration-300 select-none">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 animate-bounce" />
            <span>
              MODO DE INSPEÇÃO (SOMENTE LEITURA): Você está visualizando o diário do(a) professor(a) <strong className="underline text-black font-extrabold">{teacherName}</strong>. Alterações estão bloqueadas.
            </span>
          </div>
          <button
            type="button"
            onClick={handleExitInspectingMode}
            className="bg-zinc-950 hover:bg-zinc-900 text-white font-extrabold px-3 py-1 rounded-lg transition shrink-0 flex items-center gap-1 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Voltar ao Painel
          </button>
        </div>
      )}

      {/* Top filter navbar */}
      <HeaderFilters
        selectedSchoolId={selectedSchoolId}
        setSelectedSchoolId={setSelectedSchoolId}
        selectedClassId={selectedClassId}
        setSelectedClassId={setSelectedClassId}
        selectedSubjectId={selectedSubjectId}
        setSelectedSubjectId={setSelectedSubjectId}
        selectedBimonthly={selectedBimonthly}
        setSelectedBimonthly={setSelectedBimonthly}
        teacherName={teacherName}
        isAuthEnabled={isAuthEnabled}
        onLogout={handleLogout}
      />

      {/* Main Tabs Navigation Bar */}
      <nav id="app-main-tabs-nav" className="bg-zinc-900/60 border-b border-zinc-800/60 sticky top-0 z-40 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-2 sm:px-4">
          <div className="grid grid-cols-3 md:flex md:flex-row md:flex-wrap md:space-x-2 py-2 gap-1 sm:gap-1.5 md:gap-0">
            {tabsInfo.map((tab) => {
              const IconComp = tab.icon;
              const isActive = activeTab === tab.key;

              return (
                <button
                  id={`main-tab-${tab.key}`}
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key as TabKey)}
                  className={`flex flex-col sm:flex-row items-center justify-center text-center md:text-left gap-1 sm:gap-2 px-1 py-2 sm:px-2 md:px-4 md:py-2 rounded-xl text-[10px] sm:text-xs font-bold transition duration-200 cursor-pointer select-none shrink-0 ${
                    isActive
                      ? 'bg-zinc-800 border border-zinc-700/80 text-white shadow shadow-black/20'
                      : 'text-zinc-400 hover:text-zinc-300 hover:bg-zinc-900/50 border border-transparent'
                  }`}
                >
                  <IconComp className={`w-4 h-4 ${tab.color} shrink-0`} />
                  <span className="text-center sm:text-left">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Main Content Pane */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 pb-20">
        
        {/* Dynamic content with transition wrapper */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="w-full h-full"
          >
            {renderTabContent()}
          </motion.div>
        </AnimatePresence>

      </main>

      {/* Ambient Footer */}
      <footer className="bg-[#09090b] border-t border-zinc-900/60 py-4 text-center text-zinc-500 text-[10px] uppercase tracking-wider print:hidden">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>© 2026 Portal do Professor - Offline-First IndexedDB</p>
          <div className="flex items-center gap-1.5 text-zinc-400">
            <Sparkles className="w-3 h-3 text-blue-500" />
            <span>Design Inteligente & Gamificado</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
