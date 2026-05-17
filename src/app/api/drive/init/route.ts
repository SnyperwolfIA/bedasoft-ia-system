import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import prisma from '@/lib/prisma';
import { createOAuth2Client } from '@/lib/google';
const FOLDER_NAME = 'Bedasoft_IA_Invoices';

export async function POST(req: Request) {
  try {
    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user || !user.googleRefreshToken) {
      return NextResponse.json({ error: 'User not found or Google Drive not connected' }, { status: 400 });
    }

    // Initialize Google Drive API Client
    const oauth2Client = createOAuth2Client();
    oauth2Client.setCredentials({
      refresh_token: user.googleRefreshToken,
      access_token: user.googleAccessToken,
      expiry_date: Number(user.googleTokenExpiry),
    });

    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    // 1. Check if folder already exists
    const res = await drive.files.list({
      q: `mimeType='application/vnd.google-apps.folder' and name='${FOLDER_NAME}' and trashed=false`,
      fields: 'files(id, name)',
      spaces: 'drive',
    });

    let folderId = null;

    if (res.data.files && res.data.files.length > 0) {
      // Folder exists
      folderId = res.data.files[0].id;
      console.log(`[Drive Init] Folder already exists. ID: ${folderId}`);
    } else {
      // 2. Create the folder
      const fileMetadata = {
        name: FOLDER_NAME,
        mimeType: 'application/vnd.google-apps.folder',
      };
      
      const folderRes = await drive.files.create({
        requestBody: fileMetadata,
        fields: 'id',
      });
      
      folderId = folderRes.data.id;
      console.log(`[Drive Init] Created new folder. ID: ${folderId}`);
    }

    return NextResponse.json({ 
      success: true, 
      folderId,
      message: `Directorio maestro '${FOLDER_NAME}' inicializado correctamente en Google Drive.`
    });

  } catch (error: any) {
    console.error('Error initializing Drive folder:', error);
    return NextResponse.json({ error: 'Failed to initialize Google Drive folder', details: error.message }, { status: 500 });
  }
}
