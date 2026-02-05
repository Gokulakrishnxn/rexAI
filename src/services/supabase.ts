import { createClient } from '@supabase/supabase-js';
import { decode } from 'base64-arraybuffer';
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';

// Get environment variables
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || Constants.expoConfig?.extra?.supabaseUrl || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || Constants.expoConfig?.extra?.supabaseAnonKey || '';

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('Supabase credentials not configured. Please check your .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
    },
});

// Storage bucket name for prescription files
export const STORAGE_BUCKET = 'prescriptions';

// Helper to generate a unique file path
export const getStoragePath = (userId: string, fileName: string): string => {
    const timestamp = Date.now();
    const sanitizedName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    return `${userId}/${timestamp}_${sanitizedName}`;
};

/**
 * Upload file to Supabase Storage
 */
export const uploadToStorage = async (
    userId: string,
    fileUri: string,
    fileName: string,
    mimeType: string
): Promise<{ url: string; path: string }> => {
    const filePath = getStoragePath(userId, fileName);

    console.log(`[Supabase] Reading file: ${fileUri}`);

    // Read file as Base64 using Expo FileSystem
    const base64 = await FileSystem.readAsStringAsync(fileUri, {
        encoding: 'base64',
    });

    // Convert Base64 to ArrayBuffer
    const fileData = decode(base64);

    console.log(`[Supabase] Uploading ${fileData.byteLength} bytes to ${filePath}`);

    const { data, error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(filePath, fileData, {
            contentType: mimeType,
            upsert: false,
        });

    if (error) {
        console.error('Supabase Upload Error:', error);
        throw new Error(`Upload failed: ${error.message}`);
    }

    // Get public URL
    const { data: urlData } = supabase.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(data.path);

    return {
        url: urlData.publicUrl,
        path: data.path,
    };
};

/**
 * Delete file from Supabase Storage
 */
export const deleteFromStorage = async (filePath: string): Promise<void> => {
    const { error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .remove([filePath]);

    if (error) {
        throw new Error(`Delete failed: ${error.message}`);
    }
};
