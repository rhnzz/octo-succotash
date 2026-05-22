import { jwtVerify, type JWTPayload } from 'jose';

export type JwtUserPayload = JWTPayload & {
  // sub sudah otomatis ada di dalam JWTPayload (string | undefined)
  email?: string;
  role?: 'TITIPERS' | 'JASTIPER' | 'ADMIN';
};

let cachedJwtSecret: Uint8Array | null = null;

/**
 * Mendecode string Base64 menjadi Uint8Array secara aman
 * yang kompatibel dengan Next.js Edge Runtime / Middleware.
 */
function decodeBase64ToUint8Array(base64String: string): Uint8Array {
  const binaryString = atob(base64String);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function getJwtSecret(): Uint8Array {
  if (cachedJwtSecret) {
    return cachedJwtSecret;
  }

  const rawSecret = process.env.JWT_SECRET;
  if (!rawSecret) {
    throw new Error('JWT_SECRET is not set');
  }

  // Bersihkan spasi serta tanda kutip yang tidak sengaja ikut ter-copy ke Vercel Env
  const trimmedSecret = rawSecret.trim().replace(/^["']|["']$/g, '');

  try {
    // Jika string memiliki karakteristik Base64 valid (panjang >= 40 dan karakter base64),
    // urus menggunakan biner asli agar sinkron dengan implementasi Java Spring Boot
    if (trimmedSecret.length >= 40 && /^[A-Za-z0-9+/=]+$/.test(trimmedSecret)) {
      cachedJwtSecret = decodeBase64ToUint8Array(trimmedSecret);
    } else {
      // Jika string teks biasa, gunakan encoder biner teks standar
      cachedJwtSecret = new TextEncoder().encode(trimmedSecret);
    }
  } catch (e) {
    // Fallback jika proses decode base64 gagal
    cachedJwtSecret = new TextEncoder().encode(trimmedSecret);
  }

  return cachedJwtSecret;
}

export async function verifyJwt(token: string): Promise<JwtUserPayload | null> {
  try {
    const jwtSecret = getJwtSecret();
    const { payload } = await jwtVerify(token, jwtSecret, { algorithms: ['HS256'] });
    return payload as JwtUserPayload;
  } catch (error) {
    console.error('JWT verification failed', error);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Helper Guards & Roles (Kembalikan ke tempat semula agar middleware bekerja)
// ---------------------------------------------------------------------------

export const isLoggedIn = (payload: JwtUserPayload | null): payload is JwtUserPayload => {
  return Boolean(payload?.sub && payload?.role);
};

function hasRole(payload: JwtUserPayload | null, role: string): boolean {
  return payload?.role === role;
}

export const isAdmin = (payload: JwtUserPayload | null): boolean => hasRole(payload, 'ADMIN');
export const isTitipers = (payload: JwtUserPayload | null): boolean => hasRole(payload, 'TITIPERS');
export const isJastiper = (payload: JwtUserPayload | null): boolean => hasRole(payload, 'JASTIPER');