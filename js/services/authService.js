/**
 * authService.js
 * Gère la connexion façon Windows (identifiant + mot de passe), la session
 * et la récupération du profil membre complet (avec grade) une fois connecté.
 */
import { supabase } from './supabaseClient.js';

/**
 * Aperçu non sensible (nom + avatar) pendant la saisie de l'identifiant.
 */
export async function fetchLoginPreview(username) {
    if (!username) return null;
    const { data, error } = await supabase.rpc('get_login_preview', { p_username: username });
    if (error || !data || data.length === 0) return null;
    return data[0]; // { rp_name, avatar_url }
}

/**
 * Connecte un membre à partir de son identifiant (real_username) + mot de passe.
 * Retourne { success, member, error }.
 */
export async function login(username, password) {
    const { data: email, error: emailError } = await supabase.rpc('get_login_email', { p_username: username });

    if (emailError || !email) {
        return { success: false, error: 'Identifiant ou mot de passe incorrect.' };
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
        return { success: false, error: 'Identifiant ou mot de passe incorrect.' };
    }

    // Met à jour last_login_at (fonction security definer, voir 03_functions.sql)
    await supabase.rpc('update_last_login');

    const member = await getCurrentMemberProfile();
    return { success: true, member };
}

export async function logout() {
    await supabase.auth.signOut();
}

export async function getSession() {
    const { data } = await supabase.auth.getSession();
    return data.session;
}

/**
 * Récupère la fiche complète du membre connecté, avec son grade
 * (via la vue v_members_full). C'est cette fonction qui permet de dire
 * "le compte connecté récupère automatiquement son grade dans Supabase" :
 * rien n'est stocké côté client, tout vient de la base à chaque connexion.
 */
export async function getCurrentMemberProfile() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
        .from('v_members_full')
        .select('*')
        .eq('id', user.id)
        .single();

    if (error) {
        console.error('Erreur récupération profil membre :', error);
        return null;
    }
    return data;
}
