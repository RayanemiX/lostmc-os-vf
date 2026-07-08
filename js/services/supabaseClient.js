/**
 * supabaseClient.js
 * Initialise le client Supabase unique utilisé par toute l'application.
 * Dépend de supabaseConfig.js (voir supabaseConfig.example.js pour le modèle).
 */
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_CONFIG } from './supabaseconfig.js';

export const supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
    },
});
