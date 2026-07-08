/**
 * permissionsService.js (v2)
 * Charge les permissions EFFECTIVES du membre connecté : celles de son grade
 * principal ET celles de toutes ses fonctions cumulées (OR logique), via la
 * vue SQL v_my_effective_permissions. Les modules marqués "is_common" (ex:
 * Tableau de bord, Profil, Formations, Planning) sont toujours visibles,
 * même sans ligne de permission.
 */
import { supabase } from './supabaseClient.js';

let _permsCache = null;   // { moduleKey: { can_view, can_create, can_edit, can_delete, can_manage } }
let _modules = null;      // liste ordonnée de tous les modules (avec is_common)

export async function loadPermissions() {
    const { data: modules, error: modErr } = await supabase
        .from('modules')
        .select('*')
        .order('sort_order', { ascending: true });
    if (modErr) console.error('Erreur chargement modules :', modErr);
    _modules = modules || [];

    const { data: perms, error } = await supabase
        .from('v_my_effective_permissions')
        .select('*');
    if (error) console.error('Erreur chargement permissions effectives :', error);

    _permsCache = {};
    for (const p of perms || []) {
        _permsCache[p.module_key] = p;
    }
    return _permsCache;
}

export function can(moduleKey, action = 'view') {
    const mod = (_modules || []).find((m) => m.key === moduleKey);
    if (action === 'view' && mod?.is_common) return true;

    const perm = _permsCache?.[moduleKey];
    if (!perm) return false;
    switch (action) {
        case 'view': return !!perm.can_view;
        case 'create': return !!perm.can_create;
        case 'edit': return !!perm.can_edit;
        case 'delete': return !!perm.can_delete;
        case 'manage': return !!perm.can_manage;
        default: return false;
    }
}

/** Modules visibles pour le membre connecté (communs + permissions accordées), triés. */
export function getVisibleModules() {
    if (!_modules) return [];
    return _modules.filter((m) => m.is_common || can(m.key, 'view'));
}

export function getAllModules() {
    return _modules || [];
}
