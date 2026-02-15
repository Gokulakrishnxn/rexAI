import { Router } from 'express';
import multer from 'multer';
import { verifyFirebaseToken } from '../middleware/firebase_auth.js';
import { handleVoiceRequest } from '../controllers/voiceController.js';

const upload = multer({ dest: 'uploads/' });
const router = Router();

// Endpoint: POST /api/voice
// Expects: 'audio' file field
router.post('/', verifyFirebaseToken as any, upload.single('audio'), handleVoiceRequest as any);

export default router;
