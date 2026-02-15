import { searchDrug } from './rxnormApi.js';

interface ValidationResult {
    isValid: boolean;
    flags: string[];
    safeResponse?: any;
}

/**
 * Validates the structured output from the AI Orchestrator
 * Ensures drug names are real and dosages look reasonable.
 */
export const validateMedicalResponse = async (voiceResponse: any): Promise<ValidationResult> => {
    const flags: string[] = [];
    const data = voiceResponse.structured_data;

    // 1. Validate Scheduled Medication
    if (data && (data.type === 'medication_scheduled' || data.type === 'medication_list')) {
        const meds = Array.isArray(data.data) ? data.data : [data.data];

        for (const med of meds) {
            if (med.drug_name) {
                // Verify Drug Name Exists in RxNorm
                const drugInfo = await searchDrug(med.drug_name);
                if (!drugInfo) {
                    flags.push(`Unknown drug name detected: "${med.drug_name}". Please verify spelling.`);
                } else {
                    // Check for potential interactions if multiple meds are being scheduled (future scope)
                    // console.log(`Verified drug: ${med.drug_name} (RxCUI: ${drugInfo.rxcui})`);
                }

                // Verify Dosage Pattern
                if (med.dosage && !isValidDosage(med.dosage)) {
                    flags.push(`Unusual dosage format detected for ${med.drug_name}: "${med.dosage}". Expected standard units (mg, ml, etc.).`);
                }
            }
        }
    }

    // 2. Hallucination Guard for Voice Summary
    // Ensure the voice summary doesn't promise a "cure" or "diagnosis" if not backed by data
    const summary = voiceResponse.voice_summary.toLowerCase();
    const riskyKeywords = ['cure', 'guarantee', 'miracle', '100% effective'];
    for (const word of riskyKeywords) {
        if (summary.includes(word)) {
            flags.push(`Risky language detected in voice summary: "${word}".`);
        }
    }

    return {
        isValid: flags.length === 0,
        flags
    };
};

/**
 * Basic regex check for standard dosage units
 */
function isValidDosage(dosage: string): boolean {
    // Matches: "500", "500mg", "500 mg", "5.5ml", "1 tablet", etc.
    // Allow numbers followed by optional space and unit
    const dosageRegex = /^[\d\.]+\s*(mg|g|ml|mcg|iu|unit|tablet|cap|pill|drop|puff)s?$/i;
    // Also allow "1-2 tablets"
    const rangeRegex = /^[\d\.]+-[\d\.]+\s*(mg|g|ml|mcg|iu|unit|tablet|cap|pill|drop|puff)s?$/i;

    return dosageRegex.test(dosage.trim()) || rangeRegex.test(dosage.trim());
}
