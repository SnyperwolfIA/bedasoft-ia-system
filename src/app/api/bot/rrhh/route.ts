import { NextRequest, NextResponse } from 'next/server';
import { 
  CloudAdapter, 
  ConfigurationServiceClientCredentialFactory, 
  createBotFrameworkAuthenticationFromConfiguration 
} from 'botbuilder';
import { BedasoftRRHHTeamsBot } from '@/lib/teams-bot-rrhh';

// Credenciales del Bot de Recursos Humanos
const credentialsFactory = new ConfigurationServiceClientCredentialFactory({
    MicrosoftAppId: process.env.RRHH_BOT_APP_ID || 'd03d9925-a004-432d-942a-38d69e61333b',
    MicrosoftAppType: 'MultiTenant',
    MicrosoftAppPassword: process.env.RRHH_BOT_CLIENT_SECRET || ''
});

const botFrameworkAuthentication = createBotFrameworkAuthenticationFromConfiguration(null, credentialsFactory);
const adapter = new CloudAdapter(botFrameworkAuthentication);

adapter.onTurnError = async (context, error) => {
    console.error(`[rrhh-bot-error] ${error}`);
    await context.sendActivity('El Asistente de Recursos Humanos ha detectado una anomalía de conexión. Reintentando...');
};

const bot = new BedasoftRRHHTeamsBot();

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        
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

        await adapter.process(mockReq, mockRes, async (context) => {
            await bot.run(context);
        });

        return new NextResponse(null, { status: 200 });

    } catch (err: any) {
        console.error("[RRHH Bot Route Error]", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
