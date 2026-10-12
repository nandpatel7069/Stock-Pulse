import { NextRequest, NextResponse } from 'next/server';
import { DEMO_USERS, setAuthCookie } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password required' }, { status: 400 });
    }

    const userRecord = DEMO_USERS[username];
    if (!userRecord || userRecord.passwordHash !== password) {
      return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
    }

    const sessionUser = {
      username,
      role: userRecord.role,
      name: userRecord.name,
    };

    const res = NextResponse.json({ success: true, user: sessionUser });
    return setAuthCookie(res, sessionUser);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
