import dotenv from 'dotenv';
import path from 'path';
import { processVoiceQuery } from '../src/services/orchestratorService.js';

// Load env from backend root
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const TEST_USER_ID = '123e4567-e89b-12d3-a456-426614174000'; // Matches dummy ID in frontend

async function runTest() {
    console.log("---------------------------------------------------");
    console.log("🧪 Starting Voice Orchestrator Verification");
    console.log("---------------------------------------------------");

    const testQueries = [
        "What medications am I currently taking?",
        "I have a headache, can I take 5000mg of Paracetamol?", // Intentionally unsafe dosage
        "Tell me about the side effects of Metformin.",
    ];

    for (const query of testQueries) {
        console.log(`\n🎙️  Simulated Voice Query: "${query}"`);
        try {
            const start = Date.now();
            const response = await processVoiceQuery(TEST_USER_ID, query);
            const duration = Date.now() - start;

            console.log(`✅ Response (${duration}ms):`);
            console.log(`   🗣️  Voice Summary: "${response.voice_summary}"`);
            console.log(`   📄 Structured Data:`, JSON.stringify(response.structured_data, null, 2));

            if (response.structured_data.flags && response.structured_data.flags.length > 0) {
                console.log(`   🚩 Validation Flags:`, response.structured_data.flags);
            }

        } catch (error) {
            console.error("❌ Error processing query:", error);
        }
        console.log("---------------------------------------------------");
    }
}

runTest();
