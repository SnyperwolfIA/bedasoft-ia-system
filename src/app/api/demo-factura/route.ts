import { NextResponse } from 'next/server';

// Serve a simple redirect to a public sample invoice PDF for demo purposes
export async function GET() {
  return NextResponse.redirect('https://www.w3.org/WAI/WCAG21/Techniques/pdf/sample.pdf', { status: 302 });
}
