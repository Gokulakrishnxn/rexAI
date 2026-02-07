# REX Healthify Backend

Node.js + TypeScript + Express backend for the REX Healthify Expo app. Uses **OpenAI GPT-4o** as primary and **Gemini Pro** as fallback. API keys stay server-side only.

---

## Setup

### 1. Install dependencies

```powershell
cd "c:\Users\Thameem Ansari\Documents\GitHub\rexAI\server"
npm install
```

*(npm warnings like `inflight deprecated`, `rimraf deprecated`, `glob deprecated` are dependency warnings, not errors. Install still succeeds — ignore for hackathon.)*

### 2. Environment

Copy `.env.example` to `.env` and add your keys:

**Windows (PowerShell):**
```powershell
copy .env.example .env
```

**macOS/Linux:**
```bash
cp .env.example .env
```

Edit `.env` and set:

- `OPENAI_API_KEY` — [OpenAI API key](https://platform.openai.com/api-keys)
- `GEMINI_API_KEY` — [Google AI Studio](https://aistudio.google.com/apikey) (fallback)
- `PORT=8000` (optional; default 8000)

Optional for LiveKit voice: `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_URL`.

### 3. Run the server

```powershell
npm run dev
```

You should see:

```
Server running on http://localhost:8000
```

And in the terminal, when you hit health: `GET /health 200 OK`.

---

## Verify backend (do this)

Open a **new** terminal (PowerShell):

**Windows PowerShell** (use backticks for line continuation, no `&&`):

```powershell
curl -X POST http://localhost:8000/api/chat `
  -H "Content-Type: application/json" `
  -d "{\"message\":\"Hello Rex\"}"
```

Expected: JSON with a `reply` from GPT-4o, e.g. `{ "reply": "Hello! I'm Rex..." }` → GPT is live.

---

## Connect Expo app to backend

1. In the **repo root** (not inside `server`):

   **Windows:**
   ```powershell
   cd "c:\Users\Thameem Ansari\Documents\GitHub\rexAI"
   copy .env.example .env
   ```

2. Edit root `.env` and set `EXPO_PUBLIC_API_URL` for your target:
   - **Android Emulator:** `EXPO_PUBLIC_API_URL=http://10.0.2.2:8000`
   - **iOS Simulator:** `EXPO_PUBLIC_API_URL=http://localhost:8000`
   - **Real phone:** `EXPO_PUBLIC_API_URL=http://<LAN-IP>:8000` (e.g. `http://192.168.1.5:8000`). Find LAN IP: run `ipconfig` and use **IPv4 Address**.

3. **Windows firewall** (if phone/emulator can’t reach backend): run as Administrator:
   ```powershell
   netsh advfirewall firewall add rule name="REX Backend" dir=in action=allow protocol=TCP localport=8000
   ```

4. Restart Expo (from repo root):
   ```powershell
   npx expo start --clear
   ```

Once the backend is running, the app uses real AI: chat (GPT-4o), plate scan (GPT Vision), SOAP (GPT), and Gemini fallback when OpenAI fails. No mock/demo needed.

---

## Next immediate action checklist

Do in order:

1. **TypeScript check**
   ```powershell
   cd "c:\Users\Thameem Ansari\Documents\GitHub\rexAI\server"
   npx tsc --noEmit
   ```

2. **Start backend**
   ```powershell
   npm run dev
   ```
   See: `Server running on http://localhost:8000`.

3. **Test chat with curl** (command above).

4. **Set Expo API URL** in root `.env` → `EXPO_PUBLIC_API_URL=http://localhost:8000`.

5. **Run app:** `npx expo start --clear`, then in chat ask: *“What should I do today?”*  
   If Rex answers with GPT → product is real.

---

## Endpoints (match Expo app contracts)

| Method | Path | Body | Response |
|--------|------|------|----------|
| POST | `/api/chat` | `{ message, context?, extra? }` | `{ reply }` |
| POST | `/api/soap/generate` | `{ transcript }` | `{ subjective, objective, assessment, plan, ... }` |
| POST | `/api/vision/plate` | `{ image }` (base64) | `{ foodItems, calories, protein, carbs, fat, recommendation }` |
| POST | `/api/voice/token` | `{ roomName?, identity? }` | `{ token }` |
| POST | `/api/voice/realtime` | `{ transcript }` | `{ text }` |
| POST | `/api/extract` | `{ image }` (base64) | `Record<string, unknown>` |
| POST | `/api/sync/records` | - | `{ ok: true }` |
| POST | `/api/sync/profile` | - | `{ ok: true }` |
| GET | `/health` | - | `{ ok: true }` |
