# Tutorly — Setup & Startup

Quick reference for running the Tutorly frontend and backend locally.

---

## Prerequisites

- **Node.js** (v18+)
- **Python** (3.x) — for serving the frontend, or any static server

---

## Backend (API)

The backend is an Express server that provides auth and will eventually handle tutors, bookings, and payments.

### 1. Install dependencies

```bash
cd server
npm install
```

### 2. Configure environment

Create a `.env` file in `server/` (copy from `.env.example`):

```bash
# From the server directory:
copy .env.example .env   # Windows
# cp .env.example .env  # macOS / Linux
```

Edit `.env` and set at least:

| Variable     | Description                     | Example                     |
|-------------|---------------------------------|-----------------------------|
| `JWT_SECRET`| Required. Secret for JWT tokens | `your-secret-key-change-me` |
| `PORT`      | API server port                 | `8787`                      |
| `CLIENT_ORIGIN` | CORS origin (or `*`)        | `*` or `http://localhost:5173` |

### 3. Start the server

```bash
npm run dev
# or
npm start
```

You should see:

```
Tutorly API listening on http://localhost:8787
```

### 4. Quick health check

```bash
curl http://localhost:8787/health
# {"ok":true}
```

---

## Frontend

Static HTML/CSS/JS. Must be served over HTTP (not `file://`) so the API calls work and CORS behaves correctly.

### Option A: Python

```bash
# From the project root (tutorly/)
python -m http.server 5173
```

### Option B: Node (npx)

```bash
npx serve -p 5173
```

### Option C: VS Code Live Server

1. Install the "Live Server" extension
2. Right‑click `index.html` → "Open with Live Server"

### Open the app

- **Landing page:** http://localhost:5173/
- **Onboarding (Sign In):** http://localhost:5173/pages/onboarding.html?mode=login
- **Onboarding (Create Account):** http://localhost:5173/pages/onboarding.html?mode=register

---

## Test Accounts (from seed)

| Role  | Email              | Password  |
|-------|--------------------|-----------|
| Admin | admin@tutorly.com  | admin123  |
| Tutor | dionte@tutorly.com   | tutor123  |
| Tutor | maldrick@tutorly.com | tutor123  |
| Tutor | esther@tutorly.com   | tutor123  (pending approval) |

---

## Full Startup Checklist

1. **Backend**
   ```bash
   cd server
   npm install
   # Create .env with JWT_SECRET (required)
   npm run dev
   ```

2. **Frontend** (in a new terminal, from project root)
   ```bash
   python -m http.server 5173
   ```

3. **Browser**
   - Open http://localhost:5173/
   - Sign in or create an account to use the app

---

## Ports

| Service  | Default Port |
|----------|--------------|
| Backend  | 8787         |
| Frontend | 5173         |

The frontend uses `window.location.hostname` for API calls, so **localhost** and **127.0.0.1** both work.

---

## Troubleshooting

- **Login not working / "Cannot reach server":** Make sure the backend is running on port 8787 (`cd server && npm run dev`). Both frontend (5173) and backend (8787) must be running.
- **401 / CORS errors:** Ensure the backend is running and `CLIENT_ORIGIN` in `.env` includes your frontend origin (or is `*`).
- **"Missing JWT_SECRET":** Add `JWT_SECRET=some-secret-string` to `server/.env`.
- **Blank page:** Serve the frontend over HTTP (not by opening the HTML file directly).
