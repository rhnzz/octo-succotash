import { NextResponse } from 'next/server';

// The auth service login response shape (before BFF transformation)
type BackendLoginResponse = {
  success: boolean;
  data: {
    refresh_token: string; // this is actually the access token — backend naming quirk
    expires_in: number;
    token_type: 'Bearer';
    user: {
      user_id: string;
      email: string;
      role: string;
      username: string | null;
      status: string;
    };
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

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ message: 'Body tidak valid.' }, { status: 400 });
  }

  const baseUrl = getAuthBaseUrl();
  const res = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await readJsonSafe(res) as BackendLoginResponse | null;

  if (!res.ok) {
    const message = data?.message ?? 'Login gagal.';
    return NextResponse.json({ message }, { status: res.status });
  }

  if (!data?.data) {
    return NextResponse.json({ message: 'Respons tidak valid dari server.' }, { status: 502 });
  }

  const { refresh_token, expires_in, token_type, user } = data.data;

  const response = NextResponse.json(
    { refresh_token, expires_in, token_type, user },
    { status: 200 }
  );

  // Store the token in an HttpOnly cookie for server-side access (middleware, BFF routes)
  response.cookies.set({
    name: 'refresh_token',
    value: refresh_token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });

  return response;
}
