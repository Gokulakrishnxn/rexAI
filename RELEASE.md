# REX Healthify — Release & Setup

Full product report, setup requirements, and smoke test for the real-working MVP.

---

## A) Full feature list implemented

| Feature | Description |
|--------|--------------|
| **Router Agent Brain** | Intent detection (EMERGENCY, TRIAGE, BOOKING, LITERACY, TODAY_PLAN, GENERAL); routes to handlers or backend `/api/chat`. |
| **AI Chat + Voice** | Chat uses GPT-4o (via backend); voice transcript routes through same RouterAgent; tool suggestions (e.g. Book Appointment) in chat and voice. |
| **Plate Scan Vision** | Backend `/api/vision/plate` (GPT-4o Vision → Gemini fallback); returns food items, calories, protein, carbs, fat, recommendation. |
| **SOAP Notes** | Backend `/api/soap/generate` from conversation transcript; returns subjective, objective, assessment, plan. |
| **Timeline OS** | Events from chat, voice, appointments, SOAP, emergency; stored and displayed. |
| **Emergency Golden Hour Mode** | Emergency intent opens EmergencyMode screen; timeline logs emergency events. |
| **Digital Twin Risk Engine** | Risk score, level, signals, nudges from timeline + medications; used in Today Plan. |
| **Medication Reminders** | Medication store, reminders (notificationService); Today Plan shows meds + taken state. |
| **Booking Tool** | Booking intent returns draft + suggestedTool; [Book Appointment] button confirms and saves locally (no auto-book); Google Calendar sync when OAuth added later. |
| **Demo Checklist** | DemoChecklistScreen for feature walkthrough. |

---

## B) What you must provide (keys)

**Required (in `server/.env` only; never in Expo app):**

- **OPENAI_API_KEY** — [OpenAI API keys](https://platform.openai.com/api-keys). Used for chat, SOAP, vision/plate, extract, voice/realtime.
- **GEMINI_API_KEY** — [Google AI Studio](https://aistudio.google.com/apikey). Used as fallback when OpenAI fails (server-side only).

**Optional:**

- **LIVEKIT_URL**, **LIVEKIT_API_KEY**, **LIVEKIT_API_SECRET** — For real LiveKit voice rooms (`/api/voice/token`). Omit for MVP; app can use stub.
- **Google OAuth credentials** — For real Google Calendar sync later; booking currently saves locally only.

---

## C) Exact run commands

**Backend (PowerShell; no `&&`):**

```powershell
cd "c:\Users\Thameem Ansari\Documents\GitHub\rexAI\server"
copy .env.example .env
```

Edit `server/.env`: set `OPENAI_API_KEY`, `GEMINI_API_KEY`, `PORT=8000`.

```powershell
npm install
npm run dev
```

You should see: `Server running on http://localhost:8000`.

**Frontend:**

```powershell
cd "c:\Users\Thameem Ansari\Documents\GitHub\rexAI"
copy .env.example .env
```

Edit root `.env`: set `EXPO_PUBLIC_API_URL`:

- Android Emulator: `EXPO_PUBLIC_API_URL=http://10.0.2.2:8000`
- iOS Simulator: `EXPO_PUBLIC_API_URL=http://localhost:8000`
- Real phone: `EXPO_PUBLIC_API_URL=http://<your-LAN-IP>:8000` (e.g. `http://192.168.1.5:8000`).

**Windows firewall** (if device can’t reach backend; run as Administrator):

```powershell
netsh advfirewall firewall add rule name="REX Backend" dir=in action=allow protocol=TCP localport=8000
```

Then:

```powershell
npx expo start --clear
```

---

## D) Final smoke test script

1. **Chat — GPT reply**  
   Ask: “Explain diabetes.”  
   Expect: Real GPT-4o (or Gemini) reply from backend.

2. **Plate Scan**  
   Open Plate Scan, capture/upload a food image.  
   Expect: Nutrition result (foodItems, calories, etc.) from backend.

3. **SOAP**  
   In chat, have a short conversation, then tap “SOAP Summary”.  
   Expect: Clinical note (subjective, objective, assessment, plan) from backend.

4. **Emergency**  
   In chat, say e.g. “chest pain” or “emergency”.  
   Expect: Emergency reply and navigation to Emergency Mode screen; timeline logs event.

5. **Timeline**  
   Trigger events (chat, SOAP, booking, emergency).  
   Expect: Events appear in Timeline.

6. **Booking confirmation**  
   Say: “Book dentist tomorrow 4pm”.  
   Expect: “Appointment draft found” message and [Book Appointment] button; only on tap does it save locally.

7. **Today Plan**  
   Ask: “What should I do today?”  
   Expect: Summary of meds, appointments, twin nudges (no backend call; local data).

8. **Medication reminder**  
   Add a medication in Profile → Medication Reminder.  
   Expect: Medication stored and reminder scheduled (notification when permitted).

---

REX Healthify is now a fully real-working MVP with GPT + Gemini fallback.  
Ready for hackathon submission.
