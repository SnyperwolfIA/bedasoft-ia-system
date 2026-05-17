import { NextResponse } from 'next/server';
import { handleTeamsMessage } from '@/lib/teams-ai';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        
        // El Bot Framework envía diferentes tipos de actividades
        if (body.type === 'message') {
            const userText = body.text;
            const aiResponse = await handleTeamsMessage(userText);
            
            // Estructura de respuesta para el Bot Framework de Microsoft
            return NextResponse.json({
                type: 'message',
                text: aiResponse
            });
        }

        // Responder a eventos de instalación o ping de Microsoft
        return NextResponse.json({ success: true });
        
    } catch (error) {
        console.error('Teams Route Error:', error);
        return NextResponse.json({ error: 'Internal Protocol Error' }, { status: 500 });
    }
}
