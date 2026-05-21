import { NextRequest, NextResponse } from 'next/server';
import { 
  CloudAdapter, 
  ConfigurationServiceClientCredentialFactory, 
  createBotFrameworkAuthenticationFromConfiguration 
} from 'botbuilder';
import { BedasoftMailingTeamsBot } from '@/lib/teams-bot-mailing';

const credentialsFactory = new ConfigurationServiceClientCredentialFactory({
    MicrosoftAppId: process.env.MAILING_BOT_APP_ID || 'd2650c82-8418-47e0-94cb-fa7d53b927df',
    MicrosoftAppType: process.env.MAILING_BOT_APP_TYPE || process.env.MicrosoftAppType || 'MultiTenant',
    MicrosoftAppPassword: process.env.MAILING_BOT_CLIENT_SECRET || process.env.MicrosoftAppPassword || process.env.MICROSOFT_CLIENT_SECRET || '',
    MicrosoftAppTenantId: process.env.MAILING_BOT_TENANT_ID || process.env.MicrosoftAppTenantId || '80324945-885b-4f3e-99db-a1057b53db70'
});

const botFrameworkAuthentication = createBotFrameworkAuthenticationFromConfiguration(null, credentialsFactory);
const adapter = new CloudAdapter(botFrameworkAuthentication);

adapter.onTurnError = async (context, error) => {
    console.error(`[mailing-bot-error] ${error}`);
    await context.sendActivity('El Asistente de Mailing ha detectado una anomalía de conexión. Reintentando...');
};

const bot = new BedasoftMailingTeamsBot();

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
        console.error("[Mailing Bot Route Error]", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
