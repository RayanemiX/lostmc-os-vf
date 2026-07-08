/**
 * main.js
 * Point d'entrée de l'application. Enchaîne : boot -> (session existante ?
 * bureau direct : écran de login) -> bureau. Charge les paramètres du club
 * et les permissions du membre avant d'afficher quoi que ce soit de sensible.
 */
import { qs, el } from './utils/dom.js';
import { supabase } from './services/supabaseClient.js';
import { getSession, getCurrentMemberProfile } from './services/authService.js';
import { loadPermissions } from './services/permissionsService.js';
import { buildBootScreen, runBootSequence } from './pages/boot/boot.js';
import { buildLoginScreen } from './pages/login/login.js';
import { buildDesktop } from './pages/desktop/desktop.js';

const root = qs('#app-root');

async function getClubSettings() {
    const { data } = await supabase.from('club_settings').select('*').eq('id', 1).single();
    return data || {};
}

async function bootThenLogin() {
    const club = await getClubSettings();

    root.append(buildBootScreen(club.logo_url || 'assets/images/lost-mc-logo.jpg'));

    runBootSequence(async () => {
        const session = await getSession();
        if (session) {
            await enterDesktop(club);
            return;
        }
        showLogin(club);
    });
}

function showLogin(club) {
    const loginScreen = buildLoginScreen(club.wallpaper_url || 'assets/images/lost-mc-logo.jpg');
    root.append(loginScreen.el);
    loginScreen.show();
    loginScreen.focusUsername();

    loginScreen.onSuccess(async (member) => {
        loginScreen.el.remove();
        await enterDesktop(club, member);
    });
}

async function enterDesktop(club, memberProfile) {
    const profile = memberProfile || await getCurrentMemberProfile();
    if (!profile) {
        // Session invalide ou fiche membre manquante : retour au login
        await supabase.auth.signOut();
        location.reload();
        return;
    }

    await loadPermissions();

    // Priorité : fond d'écran du grade > fond d'écran général du club > logo par défaut
    const wallpaperUrl = profile.grade_wallpaper_url || club.wallpaper_url || 'assets/images/lost-mc-logo.jpg';

    buildDesktop({
        wallpaperUrl,
        clubName: club.club_name || 'LOST MC',
        memberProfile: profile,
    });
}

bootThenLogin();
