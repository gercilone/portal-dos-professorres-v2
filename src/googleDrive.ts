import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

// Storage key for cached token in memory / sessionStorage
let cachedDriveToken: string | null = null;

/**
 * Generates a clean, formatted backup filename according to user role, name, date, and time.
 * Format: Backup_[Professor|Coordenador]_[Nome]_[YYYY-MM-DD]_[HHmm].json
 */
export function getBackupFilename(): string {
  const role = localStorage.getItem('portal_user_role') || 'teacher';
  const teacherName = localStorage.getItem('portal_teacher_name') || '';
  const activeUser = localStorage.getItem('portal_active_user') || 'usuario';

  let displayName = teacherName.trim() || activeUser.trim();
  if (role === 'coordinator' && (!teacherName || teacherName.toLowerCase() === 'coordenador')) {
    displayName = 'Coordenacao';
  }

  const sanitizedName = displayName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_');

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');

  const prefix = role === 'coordinator' ? 'Backup_Coordenador' : 'Backup_Professor';
  return `${prefix}_${sanitizedName}_${year}-${month}-${day}_${hours}h${minutes}.json`;
}

/**
 * Obtains a valid Google OAuth Access Token with Google Drive scope.
 */
export async function getGoogleDriveAccessToken(forcePrompt = false): Promise<string> {
  if (cachedDriveToken && !forcePrompt) {
    return cachedDriveToken;
  }

  const storedToken = sessionStorage.getItem('gdrive_access_token');
  if (storedToken && !forcePrompt) {
    cachedDriveToken = storedToken;
    return storedToken;
  }

  try {
    const auth = getAuth();
    const provider = new GoogleAuthProvider();
    provider.addScope(DRIVE_SCOPE);
    provider.setCustomParameters({
      prompt: 'consent'
    });

    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const token = credential?.accessToken;

    if (!token) {
      throw new Error('Não foi possível obter o token de acesso do Google Drive.');
    }

    cachedDriveToken = token;
    sessionStorage.setItem('gdrive_access_token', token);
    return token;
  } catch (err: any) {
    console.error('Error acquiring Google Drive token via Firebase Auth:', err);
    throw new Error('Autenticação com o Google Drive falhou. Por favor, permita a janela popup e autorize o acesso.');
  }
}

/**
 * Uploads a JSON backup payload to Google Drive.
 */
export async function uploadBackupToDrive(
  backupData: any,
  customFilename?: string
): Promise<{ id: string; name: string; webViewLink?: string }> {
  const token = await getGoogleDriveAccessToken();
  const filename = customFilename || getBackupFilename();
  const jsonString = typeof backupData === 'string' ? backupData : JSON.stringify(backupData, null, 2);

  const boundary = 'portal_backup_boundary_' + Date.now();
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const metadata = {
    name: filename,
    mimeType: 'application/json',
    description: 'Backup Unificado do Portal do Professor'
  };

  const multipartRequestBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    jsonString +
    closeDelimiter;

  const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`
    },
    body: multipartRequestBody
  });

  if (response.status === 401) {
    // Token expired or invalid, try once more with forced prompt
    sessionStorage.removeItem('gdrive_access_token');
    cachedDriveToken = null;
    const freshToken = await getGoogleDriveAccessToken(true);

    const retryResponse = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${freshToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`
      },
      body: multipartRequestBody
    });

    if (!retryResponse.ok) {
      const errText = await retryResponse.text();
      throw new Error(`Falha no upload para o Google Drive: ${retryResponse.statusText} (${errText})`);
    }
    return await retryResponse.json();
  }

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Falha no upload para o Google Drive: ${response.statusText} (${errText})`);
  }

  return await response.json();
}

export interface DriveBackupFile {
  id: string;
  name: string;
  createdTime: string;
  size?: string;
}

/**
 * Lists backup JSON files stored in Google Drive.
 */
export async function listDriveBackups(): Promise<DriveBackupFile[]> {
  const token = await getGoogleDriveAccessToken();

  const queryParams = new URLSearchParams({
    q: "mimeType = 'application/json' and (name contains 'Backup_' or name contains 'backup_') and trashed = false",
    orderBy: 'createdTime desc',
    pageSize: '20',
    fields: 'files(id, name, createdTime, size)'
  });

  let response = await fetch(`https://www.googleapis.com/drive/v3/files?${queryParams.toString()}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (response.status === 401) {
    sessionStorage.removeItem('gdrive_access_token');
    cachedDriveToken = null;
    const freshToken = await getGoogleDriveAccessToken(true);

    response = await fetch(`https://www.googleapis.com/drive/v3/files?${queryParams.toString()}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${freshToken}`
      }
    });
  }

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Erro ao listar arquivos do Google Drive: ${errText}`);
  }

  const data = await response.json();
  return data.files || [];
}

/**
 * Downloads and parses JSON content of a backup file from Google Drive.
 */
export async function downloadDriveBackup(fileId: string): Promise<any> {
  const token = await getGoogleDriveAccessToken();

  let response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (response.status === 401) {
    sessionStorage.removeItem('gdrive_access_token');
    cachedDriveToken = null;
    const freshToken = await getGoogleDriveAccessToken(true);

    response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${freshToken}`
      }
    });
  }

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Erro ao baixar backup do Google Drive: ${errText}`);
  }

  return await response.json();
}
