import { google } from 'googleapis';

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_URI || 'http://localhost:3002/api/auth/google/callback';

export const createOAuth2Client = () => {
  return new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI
  );
};

export const getDriveService = (accessToken: string, refreshToken?: string) => {
  const auth = createOAuth2Client();
  auth.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  return google.drive({ version: 'v3', auth });
};

export const searchAndDownloadFile = async (drive: any, query: string) => {
  try {
    const res = await drive.files.list({
      q: `name contains '${query}' and trashed = false`,
      fields: 'files(id, name, mimeType)',
      pageSize: 1
    });
    
    if (!res.data.files || res.data.files.length === 0) return null;
    
    const file = res.data.files[0];
    
    let content = '';
    if (file.mimeType === 'application/vnd.google-apps.document') {
      // Si es Google Doc, exportar como texto
      const exportRes = await drive.files.export({
        fileId: file.id,
        mimeType: 'text/plain'
      });
      content = exportRes.data;
    } else {
      // Si es archivo binario (PDF, etc), intentar leer como stream si es posible o texto
      const getRes = await drive.files.get({
        fileId: file.id,
        alt: 'media'
      });
      content = typeof getRes.data === 'string' ? getRes.data : '[Archivo binario - No se puede leer directamente como texto]';
    }
    
    return { name: file.name, content };
  } catch (error) {
    console.error('Error downloading from Drive:', error);
    return null;
  }
};
