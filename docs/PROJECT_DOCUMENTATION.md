## Civilify – Full Project Documentation (Backend + Frontend)

**Purpose**: AI-powered legal assistant that helps users assess case plausibility, get general legal information, and organize their case via a conversational UI. Supports user profiles, admin management, Cloudinary image uploads, and conversation history.

**Scope**: Monorepo with Spring Boot backend (JWT, Firebase Admin, Cloudinary, OpenAI integration) and React + Vite frontend (MUI, Tailwind, axios with auth interceptors, Firebase SDK helpers).

### Table of Contents
- Tech Stack
- Repository Layout
- Configuration & Environment
- Backend Architecture
- Backend Endpoints
- Data Models & Persistence
- Frontend Architecture
- Frontend Flows
- Security & Privacy
- Build, Run, and Deploy
- Extensibility Guide

## Tech Stack

- Backend
  - Spring Boot 3.4.x (Java 17)
  - Spring Security, OAuth2 Client (Google)
  - JJWT (io.jsonwebtoken) for JWT issuing/validation
  - Firebase Admin SDK
  - Cloudinary Java SDK
  - OpenAI API integration
  - Build: Maven; Env management: spring-dotenv

- Frontend
  - React 18, Vite 6, HashRouter
  - MUI 7, TailwindCSS 4, PostCSS
  - axios with JWT interceptors
  - Firebase JS SDK 11 (Firestore helpers)
  - React Router 7, react-toastify, react-markdown, react-icons

## Repository Layout

- `backend/`
  - `src/main/java/com/capstone/civilify/`
    - `CivilifyApplication.java`: Spring Boot entry point
    - `config/`: `SecurityConfig.java`, `JwtAuthenticationFilter.java`, `CorsConfig.java`, `FirebaseConfig.java`, `CloudinaryConfig.java`, `FirebaseAuthService.java`
    - `controller/`: `AdminController.java`, `AuthController.java`, `ChatController.java`, `DebugController.java`, `HealthController.java`, `OpenAIController.java`, `UserController.java`
    - `service/`: `AdminService*`, `ChatService`, `CloudinaryService`, `CustomUserDetailsService`, `FirebaseAuthService` (service), `FirebaseStorageService`, `FirestoreService`, `OpenAIService`
    - `dto/`: `LoginRequest`, `AuthResponse`, `ApiResponse`, `ErrorResponse`, `UserDTO`
    - `entity/`: `User`, `CloudinaryProperties`
    - `model/`: `ChatConversation`, `ChatMessage`
    - `repository/`: custom repository abstraction (Firestore-oriented)
  - `src/main/resources/application.properties`: runtime configuration
  - `API_DOCUMENTATION.md`: authoritative endpoint specs
  - `dataconnect/`: GraphQL schema/connector (not wired into Spring runtime)
  - `pom.xml`: dependencies/build plugins

- `frontend/`
  - `src/main.jsx`: HashRouter mount, safe localStorage wrapper on `window.safeStorage`
  - `src/App.jsx`, `src/Routes.jsx`: route map and guards
  - `src/utils/axiosConfig.js`: axios instance with JWT interceptors
  - `src/utils/auth.js`: token utilities, profile CRUD, upload, API base URL
  - `src/firebase-config.js`: Firebase app init + Firestore chat helpers
  - `src/pages/`: landing, signin/signup, forgot/verify/reset, chat, profile, edit-profile, diagnostics, admin, documents, loading
  - `src/components/`: `ProtectedRoute`, `NetworkDiagnostic`, `ProfileAvatar`, `VillyReportCard`
  - Tailwind/PostCSS/Vite configs and assets

## Configuration & Environment

- Backend `application.properties`
  - Server: `server.port=8081`
  - Firebase: `FIREBASE_DATABASE_URL`, `FIREBASE_PROJECT_ID`, `FIREBASE_SERVICE_ACCOUNT_FILE`, `FIREBASE_API_KEY`
  - CORS: `cors.allowed-origins` (localhost 3000/5173 and 127.0.0.1 variants), `cors.allowed-methods` (GET,POST,PUT,DELETE,OPTIONS), `cors.allowed-headers` (*), `cors.allow-credentials` (true)
  - Google OAuth2: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
  - Cloudinary: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `CLOUDINARY_UPLOAD_PRESET`
  - JWT: `JWT_SECRET` (strong secret required in production), `JWT_EXPIRATION` (default 7 days)
  - OpenAI:
    - Defaults: `OPENAI_API_KEY`, `OPENAI_MODEL`
    - GLI Mode A: `OPENAI_GLI_*` (model default `gpt-3.5-turbo`, temp 0.3, max-tokens 600)
    - CPA Mode B: `OPENAI_CPA_*` (model default `gpt-4o`, temp 0.2, max-tokens 2000)
  - Auto-config disabled: JDBC/JPA and Spring Cloud GCP (custom Firestore service)

- Backend env files via spring-dotenv
  - `.env` not committed; `.env.example` documented in `backend/README.md`

- Frontend environment
  - `VITE_API_URL` or default `http://localhost:8081`; API base used as `${VITE_API_URL}/api`
  - HashRouter uses `/#/` paths

## Backend Architecture

- Security
  - `SecurityConfig.java`: defines filter chain and access rules
  - `JwtAuthenticationFilter.java`: extracts `Authorization: Bearer <token>`, validates JWT, sets security context
  - OAuth2 Google configured; backend exchanges Google ID token for app JWT
  - CORS configured from properties; credentials allowed

- Services
  - `OpenAIService`: routes to GLI (A) or CPA (B) models using configured temps/tokens; returns structured outputs (label/summary in Mode B)
  - `FirestoreService`: CRUD for users, conversations, messages (custom, JPA disabled)
  - `ChatService`: conversation/message orchestration
  - `FirebaseAuthService` (service): email/password and Google auth flows, password reset
  - `CloudinaryService`: uploads and returns secure URLs
  - `AdminService*`: admin workflows (list users, role updates, deletion)

- Controllers
  - `HealthController`: GET `/health`
  - `DebugController`: GET `/api/debug/request-info`, `/api/debug/validate-token`
  - `AuthController`: POST `/api/auth/signin`, `/api/auth/google`, `/api/auth/forgot-password`, GET `/api/auth/test`
  - `UserController`: register/login, GET `/profile`, PUT `/profile`, POST `/upload-profile-picture`, GET `/email/{email}`, GET `/{uid}/profile-picture`
  - `OpenAIController`: POST `/api/ai/chat`, POST `/api/ai/delete-previous-conversations`
  - `ChatController`: conversations/messages CRUD, admin assignment, status filtering
  - `AdminController`: admin-only user management

## Backend Endpoints

Use `backend/API_DOCUMENTATION.md` for complete contracts. Key highlights:

- Health
  - `GET /health`

- Debug
  - `GET /api/debug/request-info`
  - `GET /api/debug/validate-token?token=<jwt>`

- Auth (`/api/auth`)
  - `POST /signin` → `{ token, user }`
  - `POST /google` → `{ token, user }`
  - `POST /forgot-password` → `{ success, message }`
  - `GET /test`

- Users (`/api/users`)
  - `POST /register` (multipart: `email`, `password`, `username`, `profilePicture?`) → `{ token, user }`
  - `POST /login` → `{ token, user }`
  - `GET /email/{email}` → user details
  - `GET /{uid}/profile-picture` → URL only
  - `GET /profile` (JWT) → user
  - `PUT /profile` (JWT) → updated user
  - `POST /upload-profile-picture` (JWT, FormData `profilePicture`) → `{ profile_picture_url }`

- AI (`/api/ai`)
  - `POST /chat` `{ message, mode, conversationId?, userId?, userEmail? }`
    - Mode A: general info text
    - Mode B: adds `plausibilityLabel`, `plausibilitySummary`, `isReport`
  - `POST /delete-previous-conversations` `{ userEmail }` → `{ deletedCount }`

- Chat (`/api/chat`)
  - `POST /conversations`
  - `GET /conversations/user/{email}`
  - `GET|PUT /conversations/{id}`
  - `POST /conversations/{id}/messages`
  - `GET /conversations/{id}/messages`
  - `PUT /conversations/{id}/assign`
  - `PUT /conversations/{id}/status`
  - `GET /conversations/admin/{id}`
  - `GET /conversations/status/{status}`

- Admin (`/api/admin`, ROLE_ADMIN)
  - `GET /users` → list
  - `PUT /users/{userId}/role` → update role
  - `DELETE /users/{userId}`
  - `POST /setup-initial-admin?userEmail=`

## Data Models & Persistence

- JPA disabled; custom `FirestoreService` handles persistence
- `entity/User`: `userId`, `email`, `username`, `profilePictureUrl`, `role`
- `model/ChatConversation`: `id`, `title`, `userEmail`, `userId`, `createdAt`, `updatedAt`, `status`, `adminId`
- `model/ChatMessage`: `id`, `conversationId`, `userId`, `userEmail`, `content`, `userMessage`, `timestamp`

## Frontend Architecture

- Routing & Shell
  - `src/main.jsx`: mounts `<App />` inside `HashRouter`; provides `window.safeStorage`
  - `src/App.jsx`: renders `AppRoutes`
  - `src/Routes.jsx` routes:
    - Public: `/landing`, `/signin`, `/signup`, `/forgot-password`, `/verify-code`, `/reset-password`, `/civilify-documents`, `/diagnostics`
    - Protected: `/chat`, `/edit-profile`, `/profile`, `/admin` wrapped in `ProtectedRoute`
    - `/` redirects to `/landing`

- Route Guarding: `src/components/ProtectedRoute.jsx`
  - Gets token via `getAuthToken()` and validates with `validateAuthToken()`
  - On invalid/expired: clears session keys, stores `redirectAfterLogin`, navigates to `/signin`
  - Role-based rules:
    - Admin (`user.role === 'ROLE_ADMIN'`): only `/admin` and `/edit-profile` allowed
    - Regular users: blocked from `/admin`

- HTTP & Session: `src/utils/axiosConfig.js`
  - Request interceptor: validates token on each request, injects `Authorization`, redirects to `/#/signin` if invalid
  - Response interceptor: on 401/403 clears session, stores `redirectAfterLogin`, optional toast, redirects to `/#/signin`
  - Exports `authAxios` (JSON) and `formDataAxios` (FormData safe)

- Auth/Profile Utilities: `src/utils/auth.js`
  - `API_URL = (VITE_API_URL || http://localhost:8081) + '/api'`
  - Token helpers: `getAuthToken()`, `validateAuthToken()`, `clearAuthData()`
  - User helpers: `getUserData()`, `getProfilePicture(forceRefresh)`, `getProfilePictureSync()`
  - API calls (direct axios):
    - `fetchUserProfile()` GET `/users/profile` (10s timeout, stores result in localStorage; diagnostics on network error)
    - `updateUserProfile(profileData)` PUT `/users/profile`
    - `uploadProfilePicture(file)` POST `/users/upload-profile-picture` with FormData `profilePicture`

- Diagnostics: `src/components/NetworkDiagnostic.jsx` (+ page `pages/diagnostics.jsx`)
  - Health check and CORS test (via `utils/backendHealthCheck.js`)
  - `GET /api/debug/request-info` when backend is reachable
  - Optional token validation via `GET /api/debug/validate-token?token=...`
  - UI with expandable sections and success/error indicators

- Firebase Helpers: `src/firebase-config.js`
  - Initializes Firebase app/analytics/Firestore/Auth for project `civilify-a9de6`
  - Firestore helper functions:
    - `addUserProfile(uid, username, profilePictureUrl)`
    - `createConversation(userId, userEmail, title?)` → writes to `conversations`
    - `getUserConversations(userEmail)` → list by email
    - `addMessage(conversationId, userId, userEmail, content, isUserMessage)` → subcollection `messages`; updates `updatedAt`
    - `getConversationMessages(conversationId)` → ordered by `timestamp`
    - `updateConversation(conversationId, updates)`

- Chat UI: `src/pages/chat.jsx`
  - Manages conversation state (`currentConversationId`, `chatMessages`, `selectedMode` in localStorage)
  - Calls `/api/ai/chat` for AI responses with Mode A (general info) or Mode B (plausibility report)
  - Renders report details via `VillyReportCard` for Mode B
  - Integrates with conversation/message listing via backend endpoints or Firestore helpers

- Other Pages
  - `landing.jsx`, `signin.jsx`, `signup.jsx`, `forgotpassword.jsx`, `verifycode.jsx`, `resetpassword.jsx`
  - `profile.jsx`, `editprofile.jsx` (uses profile utilities and upload)
  - `admin.jsx` (ROLE_ADMIN only, guarded)
  - `CivilifyDocuments.jsx`, `LoadingScreen.jsx`

## Frontend Flows

- Registration
  - POST `/api/users/register` (multipart); on success, store `authToken`, `user`, navigate to protected route

- Login
  - POST `/api/auth/signin` or `/api/users/login`; on success store token/user; interceptors apply auth header

- Google Sign-in
  - Obtain Google ID token on client; POST `/api/auth/google` → backend JWT

- Profile
  - GET `/api/users/profile` to load; PUT `/api/users/profile` to update
  - Upload picture via `POST /api/users/upload-profile-picture` with FormData

- Chat
  - Send user message to `/api/ai/chat` with `{ message, mode, conversationId?, userId?, userEmail? }`
  - Mode A: returns general response
  - Mode B: includes `plausibilityLabel`, `plausibilitySummary`, `isReport`
  - Manage history via `/api/chat/...` endpoints (or Firestore helpers)

- Admin
  - Access `/admin`; use `/api/admin/...` to list/update/delete users or bootstrap admin

## Security & Privacy

- JWT is validated client-side (UX) and authoritatively server-side
- Role-based access enforced client and server
- OpenAI keys never exposed to frontend; all calls via backend `OpenAIService`
- Cloudinary uploads proxied through backend
- Conversation deletion supported via `/api/ai/delete-previous-conversations`

## Build, Run, and Deploy

- Backend
  - Create `backend/.env` from `backend/README.md` variables
  - Run: `mvn spring-boot:run` (port 8081)
  - Ensure `cors.allowed-origins` includes your frontend origin

- Frontend
  - Create `frontend/.env` with `VITE_API_URL=http://localhost:8081`
  - Install: `npm install`
  - Dev: `npm run dev` (default `http://localhost:5173`)
  - Build: `npm run build`; Deploy static: `npm run deploy` (gh-pages)

## Extensibility Guide

- Add a protected backend feature
  - Implement controller + service, define DTOs, secure in `SecurityConfig`, document in `API_DOCUMENTATION.md`

- Add a new chat mode
  - Extend `OpenAIService` with config/prompting; update `OpenAIController`; add frontend UI handling and renderers

- Expand roles/permissions
  - Update `entity/User`, `SecurityConfig`, and client `ProtectedRoute` logic

---

This document summarizes the actual code and configuration in the repository, including `API_DOCUMENTATION.md`, `application.properties`, `pom.xml`, frontend routing/guards, and auth utilities.


