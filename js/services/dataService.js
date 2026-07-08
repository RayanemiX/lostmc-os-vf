/**
 * dataService.js
 * Fine couche générique au-dessus de Supabase pour lister / créer / modifier /
 * supprimer des enregistrements. Utilisée par le moteur CRUD (crudEngine.js)
 * afin qu'aucune application ne réécrive sa propre plomberie Supabase.
 */
import { supabase } from './supabaseClient.js';

/**
 * @param {string} table - nom de la table OU d'une vue (ex: 'v_members_full')
 * @param {object} options
 *   - search: { columns: string[], term: string }  -> ILIKE sur plusieurs colonnes
 *   - filters: { colonne: valeur }                  -> égalité stricte
 *   - orderBy: { column, ascending }
 */
export async function listRecords(table, options = {}) {
    let query = supabase.from(table).select('*');

    if (options.filters) {
        for (const [col, val] of Object.entries(options.filters)) {
            if (val !== undefined && val !== null && val !== '') {
                query = query.eq(col, val);
            }
        }
    }

    if (options.search && options.search.term && options.search.columns?.length) {
        const orClause = options.search.columns
            .map((col) => `${col}.ilike.%${options.search.term}%`)
            .join(',');
        query = query.or(orClause);
    }

    if (options.orderBy) {
        query = query.order(options.orderBy.column, { ascending: options.orderBy.ascending ?? true });
    }

    const { data, error } = await query;
    if (error) {
        console.error(`Erreur listRecords(${table}) :`, error);
        return { data: [], error };
    }
    return { data, error: null };
}

export async function getRecord(table, id) {
    const { data, error } = await supabase.from(table).select('*').eq('id', id).single();
    if (error) console.error(`Erreur getRecord(${table}) :`, error);
    return { data, error };
}

export async function createRecord(table, payload) {
    const { data, error } = await supabase.from(table).insert(payload).select().single();
    if (error) console.error(`Erreur createRecord(${table}) :`, error);
    return { data, error };
}

export async function updateRecord(table, id, payload) {
    const { data, error } = await supabase.from(table).update(payload).eq('id', id).select().single();
    if (error) console.error(`Erreur updateRecord(${table}) :`, error);
    return { data, error };
}

export async function deleteRecord(table, id) {
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) console.error(`Erreur deleteRecord(${table}) :`, error);
    return { error };
}

/** Suppression par critères multiples, utile pour les tables à clé composite (ex: member_functions). */
export async function deleteWhere(table, filters) {
    let query = supabase.from(table).delete();
    for (const [col, val] of Object.entries(filters)) {
        query = query.eq(col, val);
    }
    const { error } = await query;
    if (error) console.error(`Erreur deleteWhere(${table}) :`, error);
    return { error };
}

/** Appel générique d'une fonction RPC Supabase (ex: craftable_quantity, get_treasury_balance) */
export async function callRpc(fnName, params = {}) {
    const { data, error } = await supabase.rpc(fnName, params);
    if (error) console.error(`Erreur callRpc(${fnName}) :`, error);
    return { data, error };
}
