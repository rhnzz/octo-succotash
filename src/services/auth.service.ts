/**
 * Auth Service — src/services/auth.service.ts
 *
 * Base URL: NEXT_PUBLIC_AUTH_SERVICE_URL (Spring Boot, :8082)
 * Error shape: { success, message, data, errors } envelope
 *
 * BFF routes (/api/auth/*) are used for login/logout/refresh so the
 * refresh_token HttpOnly cookie is managed server-side.
 *
 * Backend contracts: .kiro/steering/backend-contracts-auth-service.md
 */

import { authRequest, ApiError, isApiError } from './api-client';

export { ApiError, isApiError };

// ---------------------------------------------------------------------------
// Shared enums / primitives
// ---------------------------------------------------------------------------

export type UserRole = 'TITIPERS' | 'JASTIPER' | 'ADMIN';
export type AccountStatus = 'ACTIVE' | 'BANNED' | 'PENDING_VERIFICATION';
export type KycStatus = 'PENDING_VERIFICATION' | 'APPROVED' | 'REJECTED';

// ---------------------------------------------------------------------------
// TASK-101: TypeScript types for all Auth Service responses
// ---------------------------------------------------------------------------

/** Embedded in LoginResponse.user */
export type AccountResponse = {
  user_id: string;
  email: string;
  role: UserRole;
  username: string | null;
  status: AccountStatus;
};

/**
 * LoginResponse — shape returned by the BFF POST /api/auth/login.
 *
 * NOTE: The Auth Service returns the access token in a field named
 * `refresh_token` — this is a backend naming quirk that cannot be changed.
 * The frontend reads `data.refresh_token` and treats it as the access token.
 */
export type LoginResponse = {
  /** Access token — named refresh_token by the backend (cannot be renamed) */
  refresh_token: string;
  expires_in: number;
  token_type: 'Bearer';
  user: AccountResponse;
};

/** RegisterResponse — shape returned by POST /auth/register (HTTP 200) */
export type RegisterResponse = {
  user_id: string;
  email: string;
  role: UserRole;
  created_at: string;
};

/** ProfileResponse — returned by GET /profile/me and PATCH /profile/me */
export type ProfileResponse = {
  user_id: string;
  email: string;
  username: string | null;
  full_name: string | null;
  role: UserRole;
  status: AccountStatus;
  profile_picture_url: string | null;
  phone_number: string | null;
  created_at: string;
  kyc_status: KycStatus | null;
};

/**
 * PublicProfileResponse — returned by GET /profile/{username}.
 * stats, rating, badges are only present for JASTIPER accounts.
 * They are omitted entirely (not null) for TITIPERS via @JsonInclude(NON_NULL).
 */
export type PublicProfileStats = {
  total_orders: number;
  success_rate: number;
  avg_rating: number;
};

export type PublicProfileResponse = {
  user_id: string;
  username: string;
  full_name: string | null;
  profile_picture_url: string | null;
  role: UserRole;
  member_since: string;
  status: AccountStatus;
  /** Only present for JASTIPER accounts */
  stats?: PublicProfileStats;
  /** Only present for JASTIPER accounts */
  rating?: number;
  /** Only present for JASTIPER accounts */
  badges?: string[];
};

/** KYCStatusResponse — returned by GET /profile/me/kyc */
export type KycStatusResponse = {
  kyc_id: string;
  status: KycStatus;
  submitted_at: string;
  reviewed_at: string | null;
  rejection_reason: string | null;
};

/**
 * AdminUserListResponse — returned by GET /admin/users.
 * NOTE: Auth service pagination uses { page, limit, total } — no total_pages.
 */
export type AdminUserListItem = {
  user_id: string;
  email: string;
  username: string | null;
  full_name: string | null;
  role: UserRole;
  status: AccountStatus;
  created_at: string;
};

export type AdminUserListResponse = {
  data: AdminUserListItem[];
  /** Auth service pagination: { page, limit, total } — no total_pages */
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
};

/** AdminUserDetailResponse — returned by GET /admin/users/{userId} */
export type AdminUserDetailStats = {
  totalOrders?: number;
  completedOrders?: number;
  successRate?: number;
  avgRating?: number;
  totalReviews?: number;
};

export type AdminUserDetailResponse = {
  user_id: string;
  email: string;
  username: string | null;
  full_name: string | null;
  role: UserRole;
  status: AccountStatus;
  profile_picture_url: string | null;
  phone_number: string | null;
  created_at: string;
  /** KYC fields — omitted if no KYC submitted */
  kyc_id?: string | null;
  kyc_status?: KycStatus | null;
  kyc_submitted_at?: string | null;
  kyc_reviewed_at?: string | null;
  kyc_rejection_reason?: string | null;
  /** Stats — omitted if not applicable */
  stats?: AdminUserDetailStats;
};

/**
 * AdminKYCListResponse — returned by GET /admin/kyc.
 * NOTE: Same pagination shape as AdminUserListResponse — { page, limit, total }.
 */
export type AdminKycListItem = {
  kyc_id: string;
  user_id: string;
  username: string | null;
  full_name_ktp: string;
  status: KycStatus;
  submitted_at: string;
};

export type AdminKycListResponse = {
  data: AdminKycListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
};

/** ReviewKycResponse — returned by PATCH /admin/kyc/{kycId}/review */
export type ReviewKycResponse = {
  kyc_id: string;
  status: KycStatus;
  submitted_at: string;
  reviewed_at: string;
  rejection_reason: string | null;
};

// ---------------------------------------------------------------------------
// TASK-102: register
// POST /auth/register  (direct to Auth Service — no BFF needed)
// Public — no token required
// Returns HTTP 200 (not 201)
// ---------------------------------------------------------------------------

export type RegisterInput = {
  email: string;
  password: string;
  password_confirmation: string;
  /** Only TITIPERS or JASTIPER — sending ADMIN returns HTTP 400 */
  role: 'TITIPERS' | 'JASTIPER';
};

export async function register(input: RegisterInput): Promise<RegisterResponse> {
  return authRequest<RegisterResponse>('/auth/register', {
    method: 'POST',
    body: input,
  });
}

// ---------------------------------------------------------------------------
// TASK-103: login
// POST /api/auth/login  (BFF — sets refresh_token HttpOnly cookie)
// Public — no token required
//
// NOTE: The BFF proxies to the Auth Service and returns the token directly
// in the response body as `refresh_token`. This IS the access token — it is
// named refresh_token due to a backend naming quirk that cannot be changed.
// The caller must store this value as the access token in AuthProvider context.
// ---------------------------------------------------------------------------

export type LoginInput = {
  email: string;
  password: string;
};

export async function login(input: LoginInput): Promise<LoginResponse> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  const body = await res.json().catch(() => null) as LoginResponse & { message?: string } | null;

  if (!res.ok) {
    const message = body?.message ?? `Login gagal (HTTP ${res.status}).`;
    throw new ApiError(res.status, message);
  }

  if (!body?.refresh_token) {
    throw new ApiError(502, 'Respons tidak valid dari server.');
  }

  return body;
}

// ---------------------------------------------------------------------------
// TASK-104: logout
// POST /api/auth/logout  (BFF — clears refresh_token cookie)
// Protected — requires current access token in Authorization header
//
// The BFF reads the refresh_token cookie and sends it to the Auth Service
// as the body field `refresh_token` to revoke it.
// ---------------------------------------------------------------------------

export async function logout(token: string): Promise<void> {
  const res = await fetch('/api/auth/logout', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null) as { message?: string } | null;
    const message = body?.message ?? `Logout gagal (HTTP ${res.status}).`;
    throw new ApiError(res.status, message);
  }
}

// ---------------------------------------------------------------------------
// refreshToken
// POST /api/auth/refresh-token  (BFF — reads refresh_token cookie)
// Public — no token required (cookie is sent automatically)
// ---------------------------------------------------------------------------

export type RefreshTokenResponse = {
  /** New access token */
  access_token: string;
  expires_in: number;
};

export async function refreshToken(): Promise<RefreshTokenResponse> {
  const res = await fetch('/api/auth/refresh-token', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  });

  const body = await res.json().catch(() => null) as RefreshTokenResponse & { message?: string } | null;

  if (!res.ok) {
    const message = body?.message ?? `Token refresh gagal (HTTP ${res.status}).`;
    throw new ApiError(res.status, message);
  }

  return body as RefreshTokenResponse;
}

// ---------------------------------------------------------------------------
// getMyProfile
// GET /profile/me
// Protected — JWT required
// ---------------------------------------------------------------------------

export async function getMyProfile(token: string): Promise<ProfileResponse> {
  return authRequest<ProfileResponse>('/profile/me', {
    method: 'GET',
    token,
  });
}

// ---------------------------------------------------------------------------
// updateMyProfile
// PATCH /profile/me
// Protected — JWT required
// ---------------------------------------------------------------------------

export type UpdateProfileInput = {
  username?: string;
  full_name?: string;
  phone_number?: string;
  profile_picture_url?: string;
};

export async function updateMyProfile(
  token: string,
  input: UpdateProfileInput
): Promise<ProfileResponse> {
  return authRequest<ProfileResponse>('/profile/me', {
    method: 'PATCH',
    token,
    body: input,
  });
}

// ---------------------------------------------------------------------------
// getPublicProfile
// GET /profile/{username}
// Public — no token required
// NOTE: stats, rating, badges are only present for JASTIPER accounts
//       (omitted entirely for TITIPERS via @JsonInclude NON_NULL)
// ---------------------------------------------------------------------------

export async function getPublicProfile(username: string): Promise<PublicProfileResponse> {
  return authRequest<PublicProfileResponse>(`/profile/${encodeURIComponent(username)}`, {
    method: 'GET',
  });
}

// ---------------------------------------------------------------------------
// submitKyc
// POST /profile/me/kyc
// Protected — TITIPERS role only (JASTIPER/ADMIN receive 403)
// Returns HTTP 200
// ---------------------------------------------------------------------------

export type KycSocialMediaLink = {
  platform: string;
  url: string;
};

export type SubmitKycInput = {
  full_name_ktp: string;
  /** Exactly 16 digits */
  ktp_number: string;
  ktp_photo_url: string;
  selfie_with_ktp_url: string;
  /** At least one entry required */
  social_media_links: KycSocialMediaLink[];
  bio?: string;
};

export async function submitKyc(token: string, input: SubmitKycInput): Promise<ProfileResponse> {
  return authRequest<ProfileResponse>('/profile/me/kyc', {
    method: 'POST',
    token,
    body: input,
  });
}

// ---------------------------------------------------------------------------
// getMyKycStatus
// GET /profile/me/kyc
// Protected — any authenticated user
// Returns 404 if no KYC submitted yet
// ---------------------------------------------------------------------------

export async function getMyKycStatus(token: string): Promise<KycStatusResponse> {
  return authRequest<KycStatusResponse>('/profile/me/kyc', {
    method: 'GET',
    token,
  });
}

// ---------------------------------------------------------------------------
// Admin — adminListUsers
// GET /admin/users
// Protected — ADMIN role only
// ---------------------------------------------------------------------------

export type AdminUserListParams = {
  status?: AccountStatus;
  role?: UserRole;
  search?: string;
  page?: number;
  limit?: number;
  sort_by?: string;
  order?: 'asc' | 'desc';
};

export async function adminListUsers(
  token: string,
  params?: AdminUserListParams
): Promise<AdminUserListResponse> {
  const query = new URLSearchParams();
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) query.set(k, String(v));
    }
  }
  const qs = query.toString();
  return authRequest<AdminUserListResponse>(`/admin/users${qs ? `?${qs}` : ''}`, {
    method: 'GET',
    token,
  });
}

// ---------------------------------------------------------------------------
// Admin — adminGetUser
// GET /admin/users/{userId}
// Protected — ADMIN role only
// ---------------------------------------------------------------------------

export async function adminGetUser(
  token: string,
  userId: string
): Promise<AdminUserDetailResponse> {
  return authRequest<AdminUserDetailResponse>(
    `/admin/users/${encodeURIComponent(userId)}`,
    { method: 'GET', token }
  );
}

// ---------------------------------------------------------------------------
// Admin — adminListKyc
// GET /admin/kyc
// Protected — ADMIN role only
// ---------------------------------------------------------------------------

export type AdminKycListParams = {
  status?: KycStatus;
  page?: number;
  limit?: number;
};

export async function adminListKyc(
  token: string,
  params?: AdminKycListParams
): Promise<AdminKycListResponse> {
  const query = new URLSearchParams();
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) query.set(k, String(v));
    }
  }
  const qs = query.toString();
  return authRequest<AdminKycListResponse>(`/admin/kyc${qs ? `?${qs}` : ''}`, {
    method: 'GET',
    token,
  });
}

// ---------------------------------------------------------------------------
// Admin — adminReviewKyc
// PATCH /admin/kyc/{kycId}/review
// Protected — ADMIN role only
//
// CRITICAL: The rejection reason field name is "rejection-reason" (hyphen),
// NOT "rejection_reason" (underscore). This is a backend DTO quirk.
// Using the underscore version silently fails validation.
// ---------------------------------------------------------------------------

export type ReviewKycInput =
  | { action: 'APPROVE' }
  | { action: 'REJECT'; 'rejection-reason': string };

export async function adminReviewKyc(
  token: string,
  kycId: string,
  input: ReviewKycInput
): Promise<ReviewKycResponse> {
  return authRequest<ReviewKycResponse>(
    `/admin/kyc/${encodeURIComponent(kycId)}/review`,
    { method: 'PATCH', token, body: input }
  );
}
