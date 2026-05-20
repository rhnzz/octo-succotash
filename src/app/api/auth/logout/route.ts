import { NextRequest, NextResponse } from 'next/server';

function getAuthBaseUrl(): string {
  const baseUrl = process.env.NEXT_PUBLIC_AUTH_SERVICE_URL;
  if (!baseUrl) throw new Error('NEXT_PUBLIC_AUTH_SERVICE_URL is not set');
  return baseUrl;
}

async function readJsonSafe(res: Response): Promise<unknown> {
  const ct = res.headers.get('content-type') ?? '';
  if (!ct.toLowerCase().includes('application/json')) return null;
  try { return await res.json(); } catch { return null; }
}

export async function POST(request: NextRequest) {
  const authorization = request.headers.get('authorization');
  if (!authorization) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const token = request.cookies.get('refresh_token')?.value;
  if (!token) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const baseUrl = getAuthBaseUrl();
  const res = await fetch(`${baseUrl}/auth/logout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: authorization,
    },
    body: JSON.stringify({ refresh_token: token }),
  });

  const data = await readJsonSafe(res) as { message?: string } | null;

  if (!res.ok) {
    return NextResponse.json(
      { message: data?.message ?? 'Logout gagal.' },
      { status: res.status }
    );
  }

  const response = NextResponse.json({ message: data?.message ?? 'Logged out successfully' }, { status: 200 });

  // Clear the token cookie
  response.cookies.set({
    name: 'refresh_token',
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });

  return response;
}
