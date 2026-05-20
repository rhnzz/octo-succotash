import { NextRequest, NextResponse } from 'next/server';

type BackendRefreshResponse = {
  success: boolean;
  data: {
    refresh_token: string;
    expires_in: number;
  } | null;
  message?: string;
};

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
  const token = request.cookies.get('refresh_token')?.value;
  if (!token) {
    return NextResponse.json({ message: 'Invalid or expired token' }, { status: 401 });
  }

  const baseUrl = getAuthBaseUrl();
  const res = await fetch(`${baseUrl}/auth/refresh-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: token }),
  });

  const data = await readJsonSafe(res) as BackendRefreshResponse | null;

  if (!res.ok) {
    const message = data?.message ?? 'Invalid or expired token';
    return NextResponse.json({ message }, { status: res.status });
  }

  if (!data?.data) {
    return NextResponse.json({ message: 'Respons tidak valid dari server.' }, { status: 502 });
  }

  const { refresh_token: newToken, expires_in } = data.data;

  const response = NextResponse.json(
    { access_token: newToken, expires_in },
    { status: 200 }
  );

  response.cookies.set({
    name: 'refresh_token',
    value: newToken,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });

  return response;
}
