import OpenAI from 'openai';
import fs from 'fs';

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
    console.warn("OPENAI_API_KEY is not set in environment variables. Voice features may fail.");
}

const openai = new OpenAI({
    apiKey: apiKey,
});

/**
 * Transcribes audio file to text using OpenAI Whisper
 * @param filePath Path to the audio file
 * @returns Transcribed text
 */
export const transcribeAudio = async (filePath: string): Promise<string> => {
    try {
        console.log(`[VoiceService] Transcribing file: ${filePath}`);
        // fs.createReadStream is compatible with OpenAI SDK's file upload
        const transcription = await openai.audio.transcriptions.create({
            file: fs.createReadStream(filePath),
            model: "whisper-1",
        });
        console.log(`[VoiceService] Transcription success: "${transcription.text.substring(0, 50)}..."`);
        return transcription.text;
    } catch (error) {
        console.error("[VoiceService] Error transcribing audio:", error);
        throw error;
    }
};

/**
 * Converts text to speech using OpenAI TTS
 * @param text Text to convert to speech
 * @returns Audio buffer (MP3)
 */
export const synthesizeSpeech = async (text: string): Promise<Buffer> => {
    try {
        console.log(`[VoiceService] Synthesizing speech for: "${text.substring(0, 50)}..."`);
        const mp3 = await openai.audio.speech.create({
            model: "tts-1",
            voice: "alloy", // Options: alloy, echo, fable, onyx, nova, shimmer
            input: text,
        });
        const buffer = Buffer.from(await mp3.arrayBuffer());
        console.log(`[VoiceService] Synthesis success. Buffer size: ${buffer.length}`);
        return buffer;
    } catch (error) {
        console.error("[VoiceService] Error synthesizing speech:", error);
        throw error;
    }
};
