# Medical Records Data Flow Documentation

This document explains the complete data flow for medical records/documents in the RexAI application - from storage to display.

---

## Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            DATA FLOW OVERVIEW                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌──────────┐     ┌──────────────┐     ┌──────────┐     ┌──────────────┐   │
│   │ Supabase │ ──► │   Backend    │ ──► │  Zustand │ ──► │    React     │   │
│   │    DB    │     │   Express    │     │   Store  │     │   Screens    │   │
│   └──────────┘     └──────────────┘     └──────────┘     └──────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 1. Data Storage Layer (Supabase)

### Database Schema

**`documents` table:**
```sql
id              UUID PRIMARY KEY
user_id         UUID (references auth.users)
file_url        TEXT (Supabase Storage public URL)
file_name       TEXT
file_type       TEXT (mime type)
summary         TEXT (AI-generated summary)
doc_category    TEXT ('lab', 'prescription', 'imaging', 'other')
validation_status TEXT ('pending', 'verified', 'rejected')
created_at      TIMESTAMP
```

**`document_chunks` table:**
```sql
id              UUID PRIMARY KEY
document_id     UUID (references documents)
user_id         UUID
chunk_index     INTEGER
content         TEXT
embedding       VECTOR(1536)
created_at      TIMESTAMP
```

### File Storage

Files are stored in **Supabase Storage** under:
```
medical-records/{user_id}/{timestamp}_{filename}
```

---

## 2. Backend API Layer

### File Location
```
backend/src/routes/ingest.ts
backend/src/services/vectorStore.ts
```

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/ingest` | List all user documents |
| POST | `/api/ingest/agentic` | Upload & process new document |
| DELETE | `/api/ingest/:documentId` | Delete a document |

### GET /api/ingest - Fetch Documents

```typescript
// backend/src/routes/ingest.ts
router.get('/', verifyFirebaseToken, async (req, res) => {
    const userId = req.user.id;
    const documents = await getUserDocuments(userId);
    res.json({ success: true, documents });
});
```

### getUserDocuments Service

```typescript
// backend/src/services/vectorStore.ts
export async function getUserDocuments(userId: string) {
    const { data } = await supabase
        .from('documents')
        .select()
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
    return data || [];
}
```

---

## 3. Frontend API Client

### File Location
```
src/services/api/backendApi.ts
```

### fetchUserDocuments Function

```typescript
export const fetchUserDocuments = async (): Promise<any[]> => {
    const response = await fetch(`${getBackendUrl()}/api/ingest`, {
        headers: await getHeaders(), // Includes Firebase Auth token
    });
    const data = await response.json();
    return data.success ? data.documents : [];
};
```

---

## 4. State Management (Zustand Store)

### File Location
```
src/store/useRecordsStore.ts
```

### Store Structure

```typescript
interface RecordsState {
    records: HealthRecord[];
    fetchRecords: () => Promise<void>;
    addRecord: (record: HealthRecord) => void;
    updateRecord: (id: string, updates: Partial<HealthRecord>) => void;
    removeRecord: (id: string) => void;
}
```

### HealthRecord Type

```typescript
// types/record.ts
interface HealthRecord {
    id: string;
    type: 'lab' | 'prescription' | 'imaging' | 'other';
    title: string;
    date: string;
    summary?: string;
    doctor?: string;
    supabaseUrl?: string;      // Image/file URL
    documentId?: string;        // Backend document ID
    ingestionStatus: 'pending' | 'uploading' | 'processing' | 'complete' | 'error';
}
```

### fetchRecords Implementation

```typescript
fetchRecords: async () => {
    const docs = await fetchUserDocuments();
    const formatted: HealthRecord[] = docs.map((d) => ({
        id: d.id,
        type: d.doc_category || 'other',
        title: d.file_name,
        date: new Date(d.created_at).toISOString().split('T')[0],
        summary: d.summary,
        ingestionStatus: d.validation_status === 'verified' ? 'complete' : 'pending',
        supabaseUrl: d.file_url,    // ◄── Image URL for display
        documentId: d.id,
    }));
    set({ records: formatted });
}
```

---

## 5. UI Components

### Screen Files
```
src/screens/Records/RecordsDashboardScreen.tsx  → List view
src/screens/Records/RecordDetailScreen.tsx      → Detail view
```

---

## Complete Data Flow Diagram

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                         RECORDS LIST FLOW                                       │
├────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─────────────────────┐                                                        │
│  │ RecordsDashboard    │                                                        │
│  │ Screen loads        │                                                        │
│  └─────────┬───────────┘                                                        │
│            │                                                                    │
│            ▼                                                                    │
│  ┌─────────────────────┐                                                        │
│  │ useEffect calls     │                                                        │
│  │ fetchRecords()      │                                                        │
│  └─────────┬───────────┘                                                        │
│            │                                                                    │
│            ▼                                                                    │
│  ┌─────────────────────┐     HTTP GET      ┌─────────────────────┐             │
│  │ fetchUserDocuments  │ ───────────────►  │ Backend             │             │
│  │ (backendApi.ts)     │                   │ /api/ingest         │             │
│  └─────────────────────┘                   └──────────┬──────────┘             │
│                                                       │                         │
│                                                       ▼                         │
│                                            ┌─────────────────────┐             │
│                                            │ getUserDocuments    │             │
│                                            │ (vectorStore.ts)    │             │
│                                            └──────────┬──────────┘             │
│                                                       │                         │
│                                                       ▼                         │
│                                            ┌─────────────────────┐             │
│                                            │ Supabase            │             │
│                                            │ documents table     │             │
│                                            └──────────┬──────────┘             │
│                                                       │                         │
│            ┌──────────────────────────────────────────┘                         │
│            │  JSON Response                                                     │
│            ▼                                                                    │
│  ┌─────────────────────┐                                                        │
│  │ Zustand Store       │                                                        │
│  │ set({ records })    │                                                        │
│  └─────────┬───────────┘                                                        │
│            │                                                                    │
│            ▼                                                                    │
│  ┌─────────────────────┐                                                        │
│  │ Component re-render │                                                        │
│  │ Display cards       │                                                        │
│  └─────────────────────┘                                                        │
│                                                                                 │
└────────────────────────────────────────────────────────────────────────────────┘
```

---

## Record Detail Flow (On Card Click)

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                         RECORD DETAIL FLOW                                      │
├────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  User taps document card                                                        │
│            │                                                                    │
│            ▼                                                                    │
│  ┌─────────────────────┐                                                        │
│  │ navigation.navigate │                                                        │
│  │ ('RecordDetail',    │                                                        │
│  │  { id: doc.id })    │                                                        │
│  └─────────┬───────────┘                                                        │
│            │                                                                    │
│            ▼                                                                    │
│  ┌─────────────────────┐                                                        │
│  │ RecordDetailScreen  │                                                        │
│  │ useRoute() gets id  │                                                        │
│  └─────────┬───────────┘                                                        │
│            │                                                                    │
│            ▼                                                                    │
│  ┌─────────────────────┐                                                        │
│  │ useRecordsStore()   │◄── NO new API call!                                   │
│  │ records.find(id)    │    Data already in memory                             │
│  └─────────┬───────────┘                                                        │
│            │                                                                    │
│            ▼                                                                    │
│  ┌─────────────────────┐                                                        │
│  │ Render Detail View  │                                                        │
│  │ - Image from        │                                                        │
│  │   record.supabaseUrl│                                                        │
│  │ - Summary from      │                                                        │
│  │   record.summary    │                                                        │
│  │ - Status badge      │                                                        │
│  └─────────────────────┘                                                        │
│                                                                                 │
└────────────────────────────────────────────────────────────────────────────────┘
```

---

## Key Code Locations

| Component | File Path |
|-----------|-----------|
| Dashboard Screen | `src/screens/Records/RecordsDashboardScreen.tsx` |
| Detail Screen | `src/screens/Records/RecordDetailScreen.tsx` |
| Zustand Store | `src/store/useRecordsStore.ts` |
| API Client | `src/services/api/backendApi.ts` |
| Record Type | `types/record.ts` |
| Backend Route | `backend/src/routes/ingest.ts` |
| DB Service | `backend/src/services/vectorStore.ts` |

---

## Document Upload Flow

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                         DOCUMENT UPLOAD FLOW                                    │
├────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  1. User picks file (DocumentPicker)                                           │
│            │                                                                    │
│            ▼                                                                    │
│  2. Navigate to DocumentProcessingScreen                                        │
│     with { fileUri, fileName, mimeType, userId }                                │
│            │                                                                    │
│            ▼                                                                    │
│  3. Upload to Supabase Storage                                                  │
│     uploadToStorage() → returns { url, path }                                   │
│            │                                                                    │
│            ▼                                                                    │
│  4. Call Backend /api/ingest/agentic                                            │
│     POST { fileUrl, fileName, fileType }                                        │
│            │                                                                    │
│            ▼                                                                    │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  Backend Processing (ingestAdvanced.ts)                                  │   │
│  │                                                                          │   │
│  │  5. Download file from URL                                               │   │
│  │            │                                                             │   │
│  │            ▼                                                             │   │
│  │  6. OCR with LlamaParse                                                  │   │
│  │     Extract text/markdown                                                │   │
│  │            │                                                             │   │
│  │            ▼                                                             │   │
│  │  7. Medical Validation (GPT-3.5)                                         │   │
│  │     Check if document is medical                                         │   │
│  │     Return { is_medical, category, reason }                              │   │
│  │            │                                                             │   │
│  │            ├─── NOT MEDICAL ──► Return 400 Error                         │   │
│  │            │                                                             │   │
│  │            ▼ (IS MEDICAL)                                                │   │
│  │  8. Create document record in DB                                         │   │
│  │            │                                                             │   │
│  │            ▼                                                             │   │
│  │  9. Chunk text (256 tokens, 50 overlap)                                  │   │
│  │            │                                                             │   │
│  │            ▼                                                             │   │
│  │  10. Generate embeddings (OpenAI text-embedding-ada-002)                 │   │
│  │            │                                                             │   │
│  │            ▼                                                             │   │
│  │  11. Store chunks with embeddings in document_chunks                     │   │
│  │            │                                                             │   │
│  │            ▼                                                             │   │
│  │  12. Generate summary (GPT-4) - async                                    │   │
│  │            │                                                             │   │
│  │            ▼                                                             │   │
│  │  13. Return { success, documentId, summary }                             │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│            │                                                                    │
│            ▼                                                                    │
│  14. Update local record in Zustand store                                       │
│            │                                                                    │
│            ▼                                                                    │
│  15. Navigate back to RecordsDashboard                                          │
│                                                                                 │
└────────────────────────────────────────────────────────────────────────────────┘
```

---

## Delete Document Flow

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                         DELETE DOCUMENT FLOW                                    │
├────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  1. User taps Trash icon in RecordDetailScreen                                  │
│            │                                                                    │
│            ▼                                                                    │
│  2. Show confirmation Alert                                                     │
│            │                                                                    │
│            ▼ (User confirms)                                                    │
│  3. Call deleteDocument(documentId)                                             │
│     DELETE /api/ingest/:documentId                                              │
│            │                                                                    │
│            ▼                                                                    │
│  4. Backend deletes from documents table                                        │
│     (chunks auto-delete via CASCADE)                                            │
│            │                                                                    │
│            ▼                                                                    │
│  5. removeRecord(id) from Zustand store                                         │
│            │                                                                    │
│            ▼                                                                    │
│  6. navigation.goBack() to dashboard                                            │
│                                                                                 │
└────────────────────────────────────────────────────────────────────────────────┘
```

---

## Image Display

The document image is displayed using the `supabaseUrl` field:

```typescript
// RecordDetailScreen.tsx
const imageUrl = record.supabaseUrl || record.fileUri;

<Image
    source={{ uri: imageUrl }}
    style={styles.documentImage}
    resizeMode="cover"
/>
```

The URL points to Supabase Storage:
```
https://[project-id].supabase.co/storage/v1/object/public/medical-records/[user-id]/[filename]
```

---

## Authentication Flow

All API requests include Firebase Auth token:

```typescript
// backendApi.ts
const getHeaders = async () => {
    const token = await auth.currentUser?.getIdToken();
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
};
```

Backend validates token and extracts user ID:

```typescript
// backend/src/middleware/firebase_auth.ts
const decodedToken = await admin.auth().verifyIdToken(token);
req.user = { id: decodedToken.uid };
```

---

## Summary

| Layer | Technology | Purpose |
|-------|------------|---------|
| Database | Supabase PostgreSQL | Store document metadata & embeddings |
| File Storage | Supabase Storage | Store actual files (images, PDFs) |
| Backend | Express.js + TypeScript | API, OCR, AI processing |
| State | Zustand | Cache records in memory |
| UI | React Native + Tamagui | Display screens |
| Auth | Firebase Auth | User authentication |
