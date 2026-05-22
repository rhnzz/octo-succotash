# JaStip Online Nasional (JSON) — Technical Specification

## Module 1: Auth and Profile

### Overview
The Auth module handles all user identity operations: registration, authentication, profile management, and KYC verification. It is backed by the Auth Service (Spring Boot, port 8082) and accessed via the NEXT_PUBLIC_AUTH_SERVICE_URL environment variable. The frontend communicates with the Auth Service through a combination of direct service calls (for public endpoints) and BFF route handlers (for token management).

The module implements a single-token architecture where the same JWT serves as both access and refresh token. Despite the backend naming the field refresh_token in the login response, this token is the access token used for all authenticated requests. Tokens expire in 15 minutes and are auto-refreshed via the /api/auth/refresh-token BFF route. The token is stored in an HttpOnly cookie (refresh_token) for security and in React context (AuthProvider) for client-side access.

### Actors and Permissions
| Actor | Can Do | Cannot Do |
|-------|--------|-----------|
| TITIPERS | Register, login, update profile, submit KYC, view own profile | Register as ADMIN, approve/reject KYC, access admin routes |
| JASTIPER | Login, update profile, view own profile, view public profiles | Submit KYC (already a jastiper), register as ADMIN |
| ADMIN | List all users, view user detail, ban/unban users, approve/reject KYC | Self-register (must be seeded), change own role |
| Guest | Register (TITIPERS or JASTIPER), login, view public profiles | Access any protected route |

### Data Models

User:
  user_id: UUID string
  email: string (unique, valid email format)
  role: TITIPERS | JASTIPER | ADMIN
  status: ACTIVE | BANNED | PENDING_VERIFICATION
  username: string | null (max 30 chars, pattern ^[A-Za-z0-9_]*$, unique)
  full_name: string | null
  profile_picture_url: string | null
  phone_number: string | null
  created_at: ISO8601 datetime with offset
  kyc_status: PENDING_VERIFICATION | APPROVED | REJECTED | null

KYCSubmission:
  kyc_id: UUID string
  user_id: UUID string (FK to User)
  full_name_ktp: string (required)
  ktp_number: string (exactly 16 digits, pattern ^\d{16}$)
  ktp_photo_url: string (required)
  selfie_with_ktp_url: string (required)
  social_media_links: Array<{ platform: string, url: string }> (min 1 entry)
  bio: string | null
  status: PENDING_VERIFICATION | APPROVED | REJECTED
  submitted_at: ISO8601 datetime
  reviewed_at: ISO8601 datetime | null
  rejection_reason: string | null

