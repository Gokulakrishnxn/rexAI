# Rex Healthify – App Structure

This document describes the application architecture.

## Root

- **App.tsx** – Root: `TamaguiProvider` + `NavigationContainer` + `AppNavigator`
- **tamagui.config.ts** – Tamagui config (extends `@tamagui/config`)
- **app.json** – Expo config (camera, notifications, splash, etc.)
- **index.js** – Entry: registers `App` with Expo

## src/

### assets/
- **icons/** – App icons
- **illustrations/** – Illustrations
- **qr-templates/** – Printable QR card SVG/PNG

### components/
- **ui/** – Core blocks: `EmergencyCard`, `MedicationCard`, `RecordCard`, `AIInsightCard`, `QuickActionButton`, `UploadSheet`, `ExtractedDataPreview`
- **qr/** – `QRDisplay`, `PrintableQRTemplate`
- **chat/** – `CustomMessageBubble`

### navigation/
- **AppNavigator.tsx** – Root stack (Onboarding/Auth → Main, EmergencyMode)
- **TabNavigator.tsx** – Bottom tabs
- **stacks/** – Per-tab stacks: `HomeStack`, `RecordsStack`, `CoachStack`, `DoctorStack`, `ProfileStack`

### screens/
- **Onboarding/** – Welcome, Permissions, ProfileSetup, QRSetup
- **Home/** – HomeDashboard, EmergencyMode
- **Records/** – RecordsDashboard, AddRecord, RecordDetail, PrescriptionDetail
- **Coach/** – CoachChat, VoiceAssistant
- **Doctor/** – DoctorFinder
- **Profile/** – Profile, QRManagement, Settings

### services/
- **api/** – `openaiProxy.ts`, `backend.ts`
- **authService.ts**, **qrService.ts**, **recordService.ts**, **medAgentService.ts**, **notificationService.ts**, **storageService.ts**

### store/ (Zustand)
- **useAuthStore**, **useUserStore**, **useRecordsStore**, **useMedAgentStore**, **useChatStore**, **useQRStore**

### utils/
- **encryption.ts**, **dateUtils.ts**, **constants.ts**

### theme/
- **brand.ts** – Health-specific colors (optional override in Tamagui)

## types/ (root)

- **record.ts** – `HealthRecord`
- **medication.ts** – `Medication`

## Tech stack

- **UI:** Tamagui, @tamagui/config, @tamagui/toast
- **Navigation:** @react-navigation/native, bottom-tabs, native-stack
- **State:** Zustand
- **Other:** react-native-qrcode-svg, react-native-gifted-chat, axios, date-fns, expo-secure-store, expo-camera, expo-notifications
