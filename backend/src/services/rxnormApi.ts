/**
 * RxNorm API Service
 * Query drug information from NIH RxNorm database
 * 
 * API Docs: https://lhncbc.nlm.nih.gov/RxNav/APIs/RxNormAPIs.html
 * Base URL: https://rxnav.nlm.nih.gov/REST/
 */

const RXNORM_BASE_URL = 'https://rxnav.nlm.nih.gov/REST';

export interface RxDrugInfo {
    rxcui: string;
    name: string;
    genericName?: string;
    brandNames: string[];
    dosageForms: string[];
    ingredients: string[];
    strength?: string;
}

export interface DrugInteraction {
    severity: 'high' | 'moderate' | 'low';
    description: string;
    drug1: string;
    drug2: string;
}

/**
 * Search for a drug by name and get RxCUI (RxNorm Concept Unique Identifier)
 */
export async function searchDrug(drugName: string): Promise<RxDrugInfo | null> {
    try {
        console.log(`[RxNorm] Searching for drug: ${drugName}`);
        
        // Approximate match API for fuzzy drug name matching
        const approxUrl = `${RXNORM_BASE_URL}/approximateTerm.json?term=${encodeURIComponent(drugName)}&maxEntries=1`;
        const approxResponse = await fetch(approxUrl);
        const approxData: any = await approxResponse.json();
        
        let rxcui: string | null = null;
        
        if (approxData.approximateGroup?.candidate?.[0]?.rxcui) {
            rxcui = approxData.approximateGroup.candidate[0].rxcui;
        } else {
            // Fallback: Try exact match via drugs API
            const drugsUrl = `${RXNORM_BASE_URL}/drugs.json?name=${encodeURIComponent(drugName)}`;
            const drugsResponse = await fetch(drugsUrl);
            const drugsData: any = await drugsResponse.json();
            
            if (drugsData.drugGroup?.conceptGroup) {
                for (const group of drugsData.drugGroup.conceptGroup) {
                    if (group.conceptProperties?.[0]?.rxcui) {
                        rxcui = group.conceptProperties[0].rxcui;
                        break;
                    }
                }
            }
        }
        
        if (!rxcui) {
            console.warn(`[RxNorm] No rxcui found for: ${drugName}`);
            return null;
        }
        
        // Get detailed drug properties
        const drugInfo = await getDrugDetails(rxcui);
        return drugInfo;
        
    } catch (error) {
        console.error(`[RxNorm] Error searching for drug ${drugName}:`, error);
        return null;
    }
}

/**
 * Get detailed drug information by RxCUI
 */
export async function getDrugDetails(rxcui: string): Promise<RxDrugInfo | null> {
    try {
        // Get properties
        const propsUrl = `${RXNORM_BASE_URL}/rxcui/${rxcui}/properties.json`;
        const propsResponse = await fetch(propsUrl);
        const propsData: any = await propsResponse.json();
        
        const properties = propsData.properties || {};
        
        // Get related concepts (brand names, ingredients, etc.)
        const relatedUrl = `${RXNORM_BASE_URL}/rxcui/${rxcui}/allrelated.json`;
        const relatedResponse = await fetch(relatedUrl);
        const relatedData: any = await relatedResponse.json();
        
        const conceptGroups = relatedData.allRelatedGroup?.conceptGroup || [];
        
        const brandNames: string[] = [];
        const ingredients: string[] = [];
        const dosageForms: string[] = [];
        let genericName: string | undefined;
        
        for (const group of conceptGroups) {
            const concepts = group.conceptProperties || [];
            
            switch (group.tty) {
                case 'BN': // Brand Name
                    brandNames.push(...concepts.map((c: any) => c.name));
                    break;
                case 'IN': // Ingredient
                    ingredients.push(...concepts.map((c: any) => c.name));
                    break;
                case 'DF': // Dose Form
                    dosageForms.push(...concepts.map((c: any) => c.name));
                    break;
                case 'SCD': // Semantic Clinical Drug (generic)
                    if (!genericName && concepts[0]) {
                        genericName = concepts[0].name;
                    }
                    break;
            }
        }
        
        return {
            rxcui,
            name: properties.name || '',
            genericName,
            brandNames: [...new Set(brandNames)],
            ingredients: [...new Set(ingredients)],
            dosageForms: [...new Set(dosageForms)],
            strength: properties.strength
        };
        
    } catch (error) {
        console.error(`[RxNorm] Error getting details for rxcui ${rxcui}:`, error);
        return null;
    }
}

/**
 * Check for drug-drug interactions between multiple medications
 */
export async function checkInteractions(rxcuis: string[]): Promise<DrugInteraction[]> {
    if (rxcuis.length < 2) {
        return [];
    }
    
    try {
        const rxcuiList = rxcuis.join('+');
        const url = `${RXNORM_BASE_URL}/interaction/list.json?rxcuis=${rxcuiList}`;
        const response = await fetch(url);
        
        // Check if response is OK and is actually JSON
        if (!response.ok) {
            console.log(`[RxNorm] Interaction API returned ${response.status}`);
            return [];
        }
        
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const text = await response.text();
            console.log(`[RxNorm] Non-JSON response: ${text.substring(0, 100)}`);
            return [];
        }
        
        const data: any = await response.json();
        
        const interactions: DrugInteraction[] = [];
        
        const interactionGroups = data.fullInteractionTypeGroup || [];
        
        for (const group of interactionGroups) {
            for (const type of group.fullInteractionType || []) {
                for (const pair of type.interactionPair || []) {
                    const severity = pair.severity?.toLowerCase() || 'moderate';
                    const description = pair.description || 'Potential interaction';
                    
                    const concepts = pair.interactionConcept || [];
                    const drug1 = concepts[0]?.minConceptItem?.name || 'Drug 1';
                    const drug2 = concepts[1]?.minConceptItem?.name || 'Drug 2';
                    
                    interactions.push({
                        severity: severity.includes('high') ? 'high' : 
                                  severity.includes('low') ? 'low' : 'moderate',
                        description,
                        drug1,
                        drug2
                    });
                }
            }
        }
        
        console.log(`[RxNorm] Found ${interactions.length} drug interactions`);
        return interactions;
        
    } catch (error) {
        console.error('[RxNorm] Error checking interactions:', error);
        return [];
    }
}

/**
 * Get NDC (National Drug Code) for a given RxCUI
 */
export async function getNdcCodes(rxcui: string): Promise<string[]> {
    try {
        const url = `${RXNORM_BASE_URL}/rxcui/${rxcui}/ndcs.json`;
        const response = await fetch(url);
        const data: any = await response.json();
        
        return data.ndcGroup?.ndcList?.ndc || [];
        
    } catch (error) {
        console.error(`[RxNorm] Error getting NDC codes for ${rxcui}:`, error);
        return [];
    }
}

/**
 * Enhance medication drafts with RxNorm data
 */
export async function enrichMedicationWithRxNorm(drugName: string): Promise<{
    rxcui?: string;
    genericName?: string;
    brandNames: string[];
    ingredients: string[];
}> {
    const drugInfo = await searchDrug(drugName);
    
    if (!drugInfo) {
        return {
            brandNames: [],
            ingredients: []
        };
    }
    
    return {
        rxcui: drugInfo.rxcui,
        genericName: drugInfo.genericName,
        brandNames: drugInfo.brandNames,
        ingredients: drugInfo.ingredients
    };
}
