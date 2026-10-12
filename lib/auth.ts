import jwt from 'jsonwebtoken';
import { NextRequest, NextResponse } from 'next/server';
import { Role, UserSession } from './types';

const JWT_SECRET = process.env.JWT_SECRET || 'stockpulse_jwt_secret_super_secure_key_2026_DBMS';
export const AUTH_COOKIE_NAME = 'stockpulse_auth_token';

export const DEMO_USERS: Record<string, { passwordHash: string; role: Role; name: string }> = {
  user_admin: {
    passwordHash: 'Admin@Secure123',
    role: 'admin',
    name: 'Chief Admin (Full Control)',
  },
  admin: {
    passwordHash: 'password',
    role: 'admin',
    name: 'Chief Admin (Full Control)',
  },
  user_manager: {
    passwordHash: 'Manager@Secure123',
    role: 'manager',
    name: 'Retail Store Manager',
  },
  manager: {
    passwordHash: 'password',
    role: 'manager',
    name: 'Retail Store Manager',
  },
  user_cashier: {
    passwordHash: 'Cashier@Secure123',
    role: 'cashier',
    name: 'POS Terminal Cashier',
  },
  cashier: {
    passwordHash: 'password',
    role: 'cashier',
    name: 'POS Terminal Cashier',
  },
};

export function signToken(user: UserSession): string {
  return jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): UserSession | null {
  try {
    return jwt.verify(token, JWT_SECRET) as UserSession;
  } catch {
    return null;
  }
}

export function getSessionFromRequest(req: NextRequest): UserSession | null {
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export function setAuthCookie(res: NextResponse, user: UserSession): NextResponse {
  const token = signToken(user);
  res.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: token,
    httpOnly: true,
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    sameSite: 'lax',
  });
  return res;
}

export function clearAuthCookie(res: NextResponse): NextResponse {
  res.cookies.delete(AUTH_COOKIE_NAME);
  return res;
}
