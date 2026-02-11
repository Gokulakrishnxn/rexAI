/**
 * Nutrition API Routes
 * Handles food search, logging, and daily summary
 */

import { Response, Router } from 'express';
import { verifyFirebaseToken, FirebaseRequest } from '../middleware/firebase_auth.js';
import { searchFood, getFoodDetails, searchFoodWithNutrition, calculateDailyValues } from '../services/usdaApi.js';
import { supabase } from '../utils/supabase.js';

const router = Router();

/**
 * GET /api/nutrition/search
 * Search for foods by name
 */
router.get('/search', verifyFirebaseToken as any, async (req: FirebaseRequest, res: Response) => {
    try {
        const { query, limit = '5' } = req.query;
        
        if (!query || typeof query !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'Query parameter required'
            });
        }
        
        const results = await searchFood(query, parseInt(limit as string));
        
        res.json({
            success: true,
            foods: results.map(f => ({
                fdcId: f.fdcId,
                name: f.description,
                brand: f.brandOwner,
                dataType: f.dataType,
                servingSize: f.servingSize,
                servingSizeUnit: f.servingSizeUnit
            }))
        });
        
    } catch (error) {
        console.error('Food search error:', error);
        res.status(500).json({ success: false, error: 'Search failed' });
    }
});

/**
 * GET /api/nutrition/food/:fdcId
 * Get detailed nutrition facts for a food
 */
router.get('/food/:fdcId', verifyFirebaseToken as any, async (req: FirebaseRequest, res: Response) => {
    try {
        const { fdcId } = req.params;
        
        const nutrition = await getFoodDetails(parseInt(fdcId));
        
        if (!nutrition) {
            return res.status(404).json({
                success: false,
                error: 'Food not found'
            });
        }
        
        const dailyValues = calculateDailyValues(nutrition);
        
        res.json({
            success: true,
            food: nutrition,
            dailyValues
        });
        
    } catch (error) {
        console.error('Get food details error:', error);
        res.status(500).json({ success: false, error: 'Failed to get food details' });
    }
});

/**
 * POST /api/nutrition/log
 * Log a food entry
 */
router.post('/log', verifyFirebaseToken as any, async (req: FirebaseRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const { 
            foodName, 
            fdcId, 
            servingSize, 
            quantity = 1,
            mealType = 'other',
            calories = 0,
            protein = 0,
            carbs = 0,
            fat = 0,
            fiber = 0,
            sugar = 0,
            sodium = 0,
            vitamins = {},
            minerals = {}
        } = req.body;
        
        if (!foodName) {
            return res.status(400).json({
                success: false,
                error: 'Food name required'
            });
        }
        
        // If fdcId provided but no nutrition, fetch from USDA
        let nutritionData = { calories, protein, carbs, fat, fiber, sugar, sodium, vitamins, minerals };
        
        if (fdcId && calories === 0) {
            const details = await getFoodDetails(parseInt(fdcId));
            if (details) {
                nutritionData = {
                    calories: details.calories,
                    protein: details.protein,
                    carbs: details.carbohydrates,
                    fat: details.fat,
                    fiber: details.fiber,
                    sugar: details.sugar,
                    sodium: details.sodium,
                    vitamins: details.vitamins,
                    minerals: details.minerals
                };
            }
        }
        
        const { data, error } = await supabase
            .from('food_nutrition')
            .insert({
                user_id: userId,
                food_name: foodName,
                fdc_id: fdcId?.toString(),
                serving_size: servingSize,
                quantity,
                meal_type: mealType,
                calories: nutritionData.calories,
                protein_g: nutritionData.protein,
                carbs_g: nutritionData.carbs,
                fat_g: nutritionData.fat,
                fiber_g: nutritionData.fiber,
                sugar_g: nutritionData.sugar,
                sodium_mg: nutritionData.sodium,
                vitamins: nutritionData.vitamins,
                minerals: nutritionData.minerals,
                logged_at: new Date().toISOString()
            })
            .select()
            .single();
        
        if (error) {
            throw error;
        }
        
        res.json({
            success: true,
            entry: data,
            message: 'Food logged successfully'
        });
        
    } catch (error) {
        console.error('Log food error:', error);
        res.status(500).json({ success: false, error: 'Failed to log food' });
    }
});

/**
 * GET /api/nutrition/logs
 * Get food logs for a date range
 */
router.get('/logs', verifyFirebaseToken as any, async (req: FirebaseRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const { date, startDate, endDate, limit = '50' } = req.query;
        
        let query = supabase
            .from('food_nutrition')
            .select('*')
            .eq('user_id', userId)
            .order('logged_at', { ascending: false })
            .limit(parseInt(limit as string));
        
        // Filter by specific date or date range
        if (date) {
            const dateStr = date as string;
            query = query
                .gte('logged_at', `${dateStr}T00:00:00`)
                .lt('logged_at', `${dateStr}T23:59:59`);
        } else if (startDate && endDate) {
            query = query
                .gte('logged_at', `${startDate}T00:00:00`)
                .lte('logged_at', `${endDate}T23:59:59`);
        }
        
        const { data, error } = await query;
        
        if (error) {
            throw error;
        }
        
        res.json({
            success: true,
            logs: data
        });
        
    } catch (error) {
        console.error('Get food logs error:', error);
        res.status(500).json({ success: false, error: 'Failed to get food logs' });
    }
});

/**
 * GET /api/nutrition/summary
 * Get daily nutrition summary
 */
router.get('/summary', verifyFirebaseToken as any, async (req: FirebaseRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const { date = new Date().toISOString().split('T')[0] } = req.query;
        
        const { data, error } = await supabase
            .from('daily_nutrition_summary')
            .select('*')
            .eq('user_id', userId)
            .eq('date', date)
            .single();
        
        if (error && error.code !== 'PGRST116') { // PGRST116 = not found
            throw error;
        }
        
        // Calculate daily value percentages
        const summary = data || {
            total_calories: 0,
            total_protein_g: 0,
            total_carbs_g: 0,
            total_fat_g: 0,
            total_fiber_g: 0,
            total_sodium_mg: 0,
            meal_count: 0
        };
        
        // FDA Daily Values
        const dailyValues = {
            calories: { current: summary.total_calories, target: 2000, percentage: Math.round((summary.total_calories / 2000) * 100) },
            protein: { current: summary.total_protein_g, target: 50, percentage: Math.round((summary.total_protein_g / 50) * 100) },
            carbs: { current: summary.total_carbs_g, target: 275, percentage: Math.round((summary.total_carbs_g / 275) * 100) },
            fat: { current: summary.total_fat_g, target: 78, percentage: Math.round((summary.total_fat_g / 78) * 100) },
            fiber: { current: summary.total_fiber_g, target: 28, percentage: Math.round((summary.total_fiber_g / 28) * 100) },
            sodium: { current: summary.total_sodium_mg, target: 2300, percentage: Math.round((summary.total_sodium_mg / 2300) * 100) }
        };
        
        res.json({
            success: true,
            date,
            summary: {
                ...summary,
                dailyValues
            }
        });
        
    } catch (error) {
        console.error('Get nutrition summary error:', error);
        res.status(500).json({ success: false, error: 'Failed to get summary' });
    }
});

/**
 * DELETE /api/nutrition/log/:id
 * Delete a food log entry
 */
router.delete('/log/:id', verifyFirebaseToken as any, async (req: FirebaseRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const { id } = req.params;
        
        const { error } = await supabase
            .from('food_nutrition')
            .delete()
            .eq('id', id)
            .eq('user_id', userId);
        
        if (error) {
            throw error;
        }
        
        res.json({
            success: true,
            message: 'Entry deleted'
        });
        
    } catch (error) {
        console.error('Delete food log error:', error);
        res.status(500).json({ success: false, error: 'Failed to delete entry' });
    }
});

export default router;
