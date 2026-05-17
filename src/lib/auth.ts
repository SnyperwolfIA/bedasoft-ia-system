import { SignJWT, jwtVerify } from 'jose';
import { NextRequest, NextResponse } from 'next/server';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'bedasoft-ia-super-secret-jwt-key-2026-change-in-prod'
);

export interface JWTPayload {
  userId: string;
  email: string;
  name: string | null;
  activeModules: string;
  googleConnected: boolean;
}

/**
 * Sign a JWT token valid for 7 days
 */
export async function signToken(payload: JWTPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(JWT_SECRET);
}

/**
 * Verify and decode a JWT token
 */
export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as JWTPayload;
  } catch {
    return null;
  }
}

/**
 * Extract the JWT payload from a request's Authorization header or cookie
 */
export async function getSession(req: NextRequest): Promise<JWTPayload | null> {
  // Try Authorization header first
  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return verifyToken(authHeader.slice(7));
  }
  // Try cookie
  const tokenCookie = req.cookies.get('bedasoft_token')?.value;
  if (tokenCookie) {
    return verifyToken(tokenCookie);
  }
  return null;
}

/**
 * Create a response that sets the session cookie
 */
export function setSessionCookie(response: NextResponse, token: string): NextResponse {
  response.cookies.set('bedasoft_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  });
  return response;
}

/**
 * Clear the session cookie
 */
export function clearSessionCookie(response: NextResponse): NextResponse {
  response.cookies.set('bedasoft_token', '', {
    httpOnly: true,
    maxAge: 0,
    path: '/',
  });
  return response;
}
