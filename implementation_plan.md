# Authentication Flow — CodeLens AI

## Background

The backend already has a fully functional auth stack:
- `POST /api/auth/register` — accepts `{username, email, full_name, password}`
- `POST /api/auth/login` — accepts `{username, password}`, returns JWT
- `GET /api/auth/me` — returns current user from Bearer token

**Key observation:** The backend login uses `username` (not email). The frontend Sign In page will collect **username + password**. The Register page will collect **full name, username, email, password, confirm password**.

---

## User Review Required

> [!IMPORTANT]
> The existing backend `/api/auth/login` endpoint accepts **`username`** (not email) per the `UserLogin` schema in `schemas/auth.py`. The Sign In form will therefore have a **Username** field rather than Email. If you want email-based login, the backend `UserLogin` schema and `auth.py` router need updating — just confirm and I'll adjust.

> [!WARNING]
> The existing `/login` route in `App.tsx` becomes `/signin`. The `/dashboard` route stays but becomes protected. No existing files are deleted.

---

## Proposed Changes

### Frontend — New Files

---

#### [NEW] `src/context/AuthContext.tsx`
Global auth state provider exposing:
```ts
{ user, isAuthenticated, loading, login(), register(), logout() }
```
- On mount: reads JWT from `localStorage`, calls `GET /api/auth/me` to restore session
- `login(username, password)` → `POST /api/auth/login` → stores token → sets user
- `register(data)` → `POST /api/auth/register` → then auto-calls `login()` → redirects to `/editor`
- `logout()` → clears token → sets user to null

---

#### [NEW] `src/components/ProtectedRoute.tsx`
Wraps a route; if `!isAuthenticated && !loading` → redirects to `/register`. While loading → shows a spinner.

---

#### [NEW] `src/pages/RegisterPage.tsx`
Fields: Full Name, Username, Email, Password, Confirm Password  
- Inline validation (all fields required, valid email, passwords match)
- Calls `register()` from `useAuth()`
- Shows loading state, success toast, error messages
- Link to `/signin`

---

#### [NEW] `src/pages/SignInPage.tsx`
Fields: Username, Password  
- Calls `login()` from `useAuth()`
- Shows loading, error on bad credentials
- Link to `/register`

---

### Frontend — Modified Files

---

#### [MODIFY] [App.tsx](file:///c:/Users/NAVEEN%20PRASANA/Downloads/code-visualizor-AI-main/code-visualizor-AI-main/frontend/src/App.tsx)

Changes:
1. Wrap everything in `<AuthProvider>`
2. Import `RegisterPage`, `SignInPage`, `ProtectedRoute`
3. Replace `/login` stub with `<Route path="/signin" element={<SignInPage/>}/>`
4. Add `<Route path="/register" element={<RegisterPage/>}/>`
5. Wrap DashboardLayout routes with `<ProtectedRoute>`
6. In `LandingPage`: replace `Link to="/dashboard"` with auth-aware `SmartLink` that goes to `/editor` if authed, `/register` if not
7. **Navbar**: show different items when authenticated (Open Editor + username + Logout) vs unauthenticated (Sign In + Start Coding)

---

#### [MODIFY] [Sidebar.tsx](file:///c:/Users/NAVEEN%20PRASANA/Downloads/code-visualizor-AI-main/code-visualizor-AI-main/frontend/src/components/Sidebar.tsx)

- Wire Logout button to `logout()` from `useAuth()`
- Show authenticated user's name/username

---

### Routing Table (final)

| Path | Component | Protected |
|------|-----------|-----------|
| `/` | LandingPage | No |
| `/register` | RegisterPage | No |
| `/signin` | SignInPage | No |
| `/dashboard` | DashboardHome | **Yes** |
| `/editor` | EditorPage | **Yes** |

---

## Verification Plan

### TypeScript
```bash
cd frontend && npx tsc --noEmit
```

### Manual Tests
1. **Unauthenticated → Start Coding** → lands on `/register`
2. **Register new user** → fills form → submits → redirects to `/editor`
3. **Refresh browser at `/editor`** → stays authenticated
4. **Sign In** with registered credentials → `/editor`
5. **Direct URL `/editor`** while logged out → redirects to `/register`
6. **Logout** → navbar reverts → `/editor` blocked
7. **Duplicate email** → inline error shown
8. **Wrong password** → inline error shown

