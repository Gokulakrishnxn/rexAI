import { Response } from 'express';
import { FirebaseRequest } from '../middleware/firebase_auth.js';
import { transcribeAudio, synthesizeSpeech } from '../services/voiceService.js';
import { processVoiceQuery } from '../services/orchestratorService.js';
import fs from 'fs';

export const handleVoiceRequest = async (req: FirebaseRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        let transcript = '';

        // Case 1: Text Input (from frontend STT)
        if (req.body.text) {
            transcript = req.body.text;
            console.log(`[VoiceController] Received text input: "${transcript}"`);
        }
        // Case 2: Audio File (legacy/fallback)
        else if (req.file) {
            const originalPath = req.file.path;
            console.log(`[VoiceController] Upload received. Original Name: ${req.file.originalname}, MimeType: ${req.file.mimetype}, Size: ${req.file.size}`);

            // Force .m4a extension if it's coming from the app (Expo AV High Quality is usually m4a)
            // OpenAI Whisper is strict about extensions.
            let ext = 'm4a';
            if (req.file.originalname.endsWith('.wav')) ext = 'wav';
            if (req.file.originalname.endsWith('.mp3')) ext = 'mp3';

            const audioPath = `${originalPath}.${ext}`;

            fs.renameSync(originalPath, audioPath);
            console.log(`[VoiceController] Renamed temp file to: ${audioPath}`);

            // 1. Transcribe
            transcript = await transcribeAudio(audioPath);
            console.log(`[VoiceController] Transcript: "${transcript}"`);

            // Cleanup
            fs.unlink(audioPath, (err) => {
                if (err) console.error("Error deleting temp audio:", err);
                else console.log(`[VoiceController] Cleaned up ${audioPath}`);
            });
        } else {
            return res.status(400).json({ success: false, error: 'No audio file or text provided' });
        }

        // 2. Orchestrate (Get JSON + Summary)
        console.log(`[VoiceController] Orchestrating for User: ${userId}`);
        const responseMatches = await processVoiceQuery(userId, transcript, req.body.sessionId);

        // 3. Synthesize Speech
        console.log(`[VoiceController] Synthesizing summary...`);
        const audioBuffer = await synthesizeSpeech(responseMatches.voice_summary);

        // 4. Return strictly structured response
        res.json({
            success: true,
            transcript,
            voice_summary: responseMatches.voice_summary,
            structured_data: responseMatches.structured_data,
            audio_base64: audioBuffer.toString('base64'),
            sessionId: req.body.sessionId
        });



    } catch (error: any) {
        console.error("Voice Controller Error:", error);
        res.status(500).json({ success: false, error: 'Voice processing failed', details: error.message });
    }
};
