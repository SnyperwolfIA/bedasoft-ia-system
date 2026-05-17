import { NextRequest, NextResponse } from 'next/server';
import { 
  CloudAdapter, 
  ConfigurationServiceClientCredentialFactory, 
  createBotFrameworkAuthenticationFromConfiguration 
} from 'botbuilder';
import { BedasoftTeamsBot } from '@/lib/teams-bot';

// Credenciales del Bot (Inyectadas desde .env)
const credentialsFactory = new ConfigurationServiceClientCredentialFactory({
    MicrosoftAppId: '1cbb0b14-cfd9-4e8d-a65e-f5e64c949bb0',
    MicrosoftAppType: 'SingleTenant',
    MicrosoftAppPassword: process.env.MICROSOFT_CLIENT_SECRET || '',
    MicrosoftAppTenantId: '80324945-885b-4f3e-99db-a1057b53db70'
});

const botFrameworkAuthentication = createBotFrameworkAuthenticationFromConfiguration(null, credentialsFactory);

// Crear el adaptador
const adapter = new CloudAdapter(botFrameworkAuthentication);

// Manejo de errores
adapter.onTurnError = async (context, error) => {
    console.error(`[bot-error] ${error}`);
    await context.sendActivity('El sistema ha detectado una anomalía en el protocolo de comunicación. Reintentando...');
};

const bot = new BedasoftTeamsBot();

export async function POST(req: NextRequest) {
    try {
        // En Next.js App Router, necesitamos convertir la petición para el adaptador
        const body = await req.json();
        
        // Simular objetos req/res para el adaptador de botbuilder (que espera Node.js Http)
        const mockRes: any = {
            status: function(code: number) { this.statusCode = code; return this; },
            header: function(name: string, value: string) { return this; },
            end: function() { },
            send: function() { }
        };

        const mockReq: any = {
            body: body,
            headers: Object.fromEntries(req.headers.entries()),
            method: 'POST'
        };

        // Procesar actividad
        await adapter.process(mockReq, mockRes, async (context) => {
            await bot.run(context);
        });

        return new NextResponse(null, { status: 200 });

    } catch (err: any) {
        console.error("[Bot Route Error]", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
