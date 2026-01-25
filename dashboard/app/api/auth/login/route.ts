import { NextRequest, NextResponse } from 'next/server';

// Use INTERNAL_INGESTION_URL for server-side requests (Docker network)
// Falls back to NEXT_PUBLIC_INGESTION_URL for local development
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
    if (setCookie) {
      res.headers.set('set-cookie', setCookie);
    }

    return res;
  } catch (error) {
    console.error('Login proxy failed:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
