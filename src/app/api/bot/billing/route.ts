import { NextRequest, NextResponse } from 'next/server';
import { 
  CloudAdapter, 
  ConfigurationServiceClientCredentialFactory, 
  createBotFrameworkAuthenticationFromConfiguration 
} from 'botbuilder';
import { BedasoftBillingTeamsBot } from '@/lib/teams-bot-billing';

const credentialsFactory = new ConfigurationServiceClientCredentialFactory({
    MicrosoftAppId: process.env.BILLING_BOT_APP_ID || process.env.MicrosoftAppId || '23305851-2a0a-4431-8a97-ec8f3dde65bf',
    MicrosoftAppType: 'MultiTenant',
    MicrosoftAppPassword: process.env.BILLING_BOT_CLIENT_SECRET || process.env.MicrosoftAppPassword || process.env.MICROSOFT_CLIENT_SECRET || ''
});

const botFrameworkAuthentication = createBotFrameworkAuthenticationFromConfiguration(null, credentialsFactory);
const adapter = new CloudAdapter(botFrameworkAuthentication);

adapter.onTurnError = async (context, error) => {
    console.error(`[billing-bot-error] ${error}`);
    await context.sendActivity('El Asistente de Facturación ha detectado una anomalía de conexión. Reintentando...');
};

const bot = new BedasoftBillingTeamsBot();

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
        console.error("[Billing Bot Route Error]", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
