import { NextRequest, NextResponse } from 'next/server';

const INGESTION_URL = process.env.INTERNAL_INGESTION_URL || process.env.NEXT_PUBLIC_INGESTION_URL || 'http://localhost:4000';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const response = await fetch(`${INGESTION_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.error || 'Login failed' },
        { status: response.status }
      );
    }

    const res = NextResponse.json(data, { status: 200 });

    const setCookie = response.headers.get('set-cookie');
    const tokenMatch = setCookie?.match(/session_token=([^;]+)/);
    if (tokenMatch?.[1]) {
      const maxAge = body?.rememberMe ? 30 * 24 * 60 * 60 : 24 * 60 * 60;
      res.cookies.set('session_token', tokenMatch[1], { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge });
    } else if (setCookie) {
      res.headers.set('set-cookie', setCookie);
    }

    return res;
  } catch (error) {
    console.error('Login proxy error:', error);
    return NextResponse.json(
      { error: 'Unable to connect to authentication service' },
      { status: 503 }
    );
  }
}
