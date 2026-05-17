import { NextRequest, NextResponse } from 'next/server';
import { 
  CloudAdapter, 
  ConfigurationServiceClientCredentialFactory, 
  createBotFrameworkAuthenticationFromConfiguration 
} from 'botbuilder';
import { BedasoftJiraNeuralTeamsBot } from '@/lib/teams-bot-jiraneural';

const credentialsFactory = new ConfigurationServiceClientCredentialFactory({
    MicrosoftAppId: process.env.JIRANEURAL_BOT_APP_ID || process.env.MicrosoftAppId || '20cf5a63-31ab-417e-a124-4c3b02bbdf66',
    MicrosoftAppType: 'MultiTenant',
    MicrosoftAppPassword: process.env.JIRANEURAL_BOT_CLIENT_SECRET || process.env.MicrosoftAppPassword || ''
});

const botFrameworkAuthentication = createBotFrameworkAuthenticationFromConfiguration(null, credentialsFactory);
const adapter = new CloudAdapter(botFrameworkAuthentication);

adapter.onTurnError = async (context, error) => {
    console.error(`[jiraneural-bot-error] ${error}`);
    await context.sendActivity('El Asistente JiraNeural ha detectado una anomalía de conexión. Reintentando...');
};

const bot = new BedasoftJiraNeuralTeamsBot();

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
        console.error("[JiraNeural Bot Route Error]", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
