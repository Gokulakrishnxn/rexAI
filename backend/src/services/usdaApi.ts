/**
 * USDA FoodData Central API Service
 * Query nutrition information from USDA database
 * 
 * API Docs: https://fdc.nal.usda.gov/api-guide.html
 * Base URL: https://api.nal.usda.gov/fdc/v1/
 * 
 * Note: Requires API key from https://fdc.nal.usda.gov/api-key-signup.html
 * Free tier: 1000 requests/hour
 */

import dotenv from 'dotenv';
dotenv.config();

const USDA_BASE_URL = 'https://api.nal.usda.gov/fdc/v1';
const USDA_API_KEY = process.env.USDA_API_KEY || 'DEMO_KEY';

export interface FoodNutrient {
    nutrientId: number;
    nutrientName: string;
    value: number;
    unitName: string;
}

export interface FoodSearchResult {
    fdcId: number;
    description: string;
    dataType: string;
    brandOwner?: string;
    ingredients?: string;
    servingSize?: number;
    servingSizeUnit?: string;
    nutrients: FoodNutrient[];
}

export interface NutritionFacts {
    fdcId: number;
    name: string;
    servingSize?: string;
    calories: number;
    protein: number;
    carbohydrates: number;
    fat: number;
    fiber: number;
    sugar: number;
    sodium: number;
    vitamins: {
        vitaminA?: number;
        vitaminC?: number;
        vitaminD?: number;
        vitaminE?: number;
        vitaminK?: number;
        vitaminB6?: number;
        vitaminB12?: number;
        folate?: number;
    };
    minerals: {
        calcium?: number;
        iron?: number;
        potassium?: number;
        magnesium?: number;
        zinc?: number;
    };
}

// Nutrient ID mappings for USDA data
const NUTRIENT_IDS = {
    calories: 1008,
    protein: 1003,
    carbohydrates: 1005,
    fat: 1004,
    fiber: 1079,
    sugar: 2000,
    sodium: 1093,
    vitaminA: 1106,
    vitaminC: 1162,
    vitaminD: 1114,
    vitaminE: 1109,
    vitaminK: 1185,
    vitaminB6: 1175,
    vitaminB12: 1178,
    folate: 1177,
    calcium: 1087,
    iron: 1089,
    potassium: 1092,
    magnesium: 1090,
    zinc: 1095
};

/**
 * Search for foods by name
 */
export async function searchFood(query: string, pageSize: number = 5): Promise<FoodSearchResult[]> {
    try {
        console.log(`[USDA] Searching for food: ${query}`);
        
        const url = `${USDA_BASE_URL}/foods/search`;
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Api-Key': USDA_API_KEY
            },
            body: JSON.stringify({
                query,
                pageSize,
                dataType: ['Survey (FNDDS)', 'Foundation', 'SR Legacy', 'Branded']
            })
        });
        
        if (!response.ok) {
            throw new Error(`USDA API error: ${response.status}`);
        }
        
        const data: any = await response.json();
        
        const results: FoodSearchResult[] = (data.foods || []).map((food: any) => ({
            fdcId: food.fdcId,
            description: food.description,
            dataType: food.dataType,
            brandOwner: food.brandOwner,
            ingredients: food.ingredients,
            servingSize: food.servingSize,
            servingSizeUnit: food.servingSizeUnit,
            nutrients: (food.foodNutrients || []).map((n: any) => ({
                nutrientId: n.nutrientId,
                nutrientName: n.nutrientName,
                value: n.value,
                unitName: n.unitName
            }))
        }));
        
        console.log(`[USDA] Found ${results.length} results`);
        return results;
        
    } catch (error) {
        console.error('[USDA] Search error:', error);
        return [];
    }
}

/**
 * Get detailed nutrition facts for a specific food by FDC ID
 */
export async function getFoodDetails(fdcId: number): Promise<NutritionFacts | null> {
    try {
        console.log(`[USDA] Getting details for fdcId: ${fdcId}`);
        
        const url = `${USDA_BASE_URL}/food/${fdcId}?api_key=${USDA_API_KEY}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`USDA API error: ${response.status}`);
        }
        
        const food: any = await response.json();
        
        // Extract nutrients into structured object
        const nutrients = food.foodNutrients || [];
        const getNutrientValue = (nutrientId: number): number => {
            const nutrient = nutrients.find((n: any) => 
                n.nutrient?.id === nutrientId || n.nutrientId === nutrientId
            );
            return nutrient?.amount || nutrient?.value || 0;
        };
        
        const nutritionFacts: NutritionFacts = {
            fdcId,
            name: food.description,
            servingSize: food.servingSize ? 
                `${food.servingSize}${food.servingSizeUnit || 'g'}` : undefined,
            calories: getNutrientValue(NUTRIENT_IDS.calories),
            protein: getNutrientValue(NUTRIENT_IDS.protein),
            carbohydrates: getNutrientValue(NUTRIENT_IDS.carbohydrates),
            fat: getNutrientValue(NUTRIENT_IDS.fat),
            fiber: getNutrientValue(NUTRIENT_IDS.fiber),
            sugar: getNutrientValue(NUTRIENT_IDS.sugar),
            sodium: getNutrientValue(NUTRIENT_IDS.sodium),
            vitamins: {
                vitaminA: getNutrientValue(NUTRIENT_IDS.vitaminA),
                vitaminC: getNutrientValue(NUTRIENT_IDS.vitaminC),
                vitaminD: getNutrientValue(NUTRIENT_IDS.vitaminD),
                vitaminE: getNutrientValue(NUTRIENT_IDS.vitaminE),
                vitaminK: getNutrientValue(NUTRIENT_IDS.vitaminK),
                vitaminB6: getNutrientValue(NUTRIENT_IDS.vitaminB6),
                vitaminB12: getNutrientValue(NUTRIENT_IDS.vitaminB12),
                folate: getNutrientValue(NUTRIENT_IDS.folate)
            },
            minerals: {
                calcium: getNutrientValue(NUTRIENT_IDS.calcium),
                iron: getNutrientValue(NUTRIENT_IDS.iron),
                potassium: getNutrientValue(NUTRIENT_IDS.potassium),
                magnesium: getNutrientValue(NUTRIENT_IDS.magnesium),
                zinc: getNutrientValue(NUTRIENT_IDS.zinc)
            }
        };
        
        return nutritionFacts;
        
    } catch (error) {
        console.error(`[USDA] Error getting food details for ${fdcId}:`, error);
        return null;
    }
}

/**
 * Search and get full nutrition facts in one call
 */
export async function searchFoodWithNutrition(query: string): Promise<NutritionFacts | null> {
    const results = await searchFood(query, 1);
    
    if (results.length === 0) {
        return null;
    }
    
    return await getFoodDetails(results[0].fdcId);
}

/**
 * Calculate daily value percentages based on FDA guidelines
 */
export function calculateDailyValues(nutrition: NutritionFacts): Record<string, number> {
    // FDA Daily Values (based on 2000 calorie diet)
    const DV = {
        calories: 2000,
        protein: 50, // g
        carbohydrates: 275, // g
        fat: 78, // g
        fiber: 28, // g
        sodium: 2300, // mg
        calcium: 1300, // mg
        iron: 18, // mg
        potassium: 4700, // mg
        vitaminA: 900, // mcg
        vitaminC: 90, // mg
        vitaminD: 20, // mcg
    };
    
    return {
        calories: Math.round((nutrition.calories / DV.calories) * 100),
        protein: Math.round((nutrition.protein / DV.protein) * 100),
        carbohydrates: Math.round((nutrition.carbohydrates / DV.carbohydrates) * 100),
        fat: Math.round((nutrition.fat / DV.fat) * 100),
        fiber: Math.round((nutrition.fiber / DV.fiber) * 100),
        sodium: Math.round((nutrition.sodium / DV.sodium) * 100),
        calcium: Math.round(((nutrition.minerals.calcium || 0) / DV.calcium) * 100),
        iron: Math.round(((nutrition.minerals.iron || 0) / DV.iron) * 100),
        potassium: Math.round(((nutrition.minerals.potassium || 0) / DV.potassium) * 100),
        vitaminA: Math.round(((nutrition.vitamins.vitaminA || 0) / DV.vitaminA) * 100),
        vitaminC: Math.round(((nutrition.vitamins.vitaminC || 0) / DV.vitaminC) * 100),
        vitaminD: Math.round(((nutrition.vitamins.vitaminD || 0) / DV.vitaminD) * 100)
    };
}
