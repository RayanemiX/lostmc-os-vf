/**
 * members.js - Application "Dossiers Membres"
 * Accessible aux grades ayant la permission 'view' sur le module 'members'
 * (typiquement Président, Vice-Président, Secrétaire — défini dans Supabase,
 * jamais en dur ici).
 */
import { el } from '../../utils/dom.js';
import { listRecords, createRecord, deleteWhere } from '../../services/dataService.js';
import { renderCrudApp } from './crudEngine.js';
import { can } from '../../services/permissionsService.js';
import { formatDate } from '../../utils/format.js';

export async function mountMembersApp(container) {
    const [{ data: grades }, { data: chapters }] = await Promise.all([
        listRecords('grades', { orderBy: { column: 'hierarchy_order', ascending: true } }),
        listRecords('chapters'),
    ]);

    const listContainer = el('div');
    const functionsContainer = el('div', { style: 'margin-top:24px; padding-top:16px; border-top:1px solid var(--color-border);' });
    container.append(listContainer, functionsContainer);

    renderCrudApp(listContainer, {
        moduleKey: 'members',
        table: 'v_members_full',
        baseTable: 'members',
        idField: 'id',
        titleField: 'rp_name',
        searchColumns: ['rp_name', 'discord', 'matricule'],
        orderBy: { column: 'hierarchy_order', ascending: true },
        emptyLabel: 'Aucun membre pour le moment. Ajoutez le premier avec "+ Ajouter".',
        filters: [
            { key: 'grade_id', label: 'Tous les grades', options: grades.map((g) => ({ value: g.id, label: g.name })) },
            { key: 'status', label: 'Tous les statuts', options: [
                { value: 'actif', label: 'Actif' }, { value: 'en_conge', label: 'En congé' },
                { value: 'suspendu', label: 'Suspendu' }, { value: 'exclu', label: 'Exclu' },
                { value: 'prospect', label: 'Prospect' },
            ] },
        ],
        columns: [
            { key: 'avatar_url', label: '', render: (r) => `<span class="avatar-thumb" style="background-image:url('${r.avatar_url || ''}')"></span>` },
            { key: 'rp_name', label: 'Nom RP' },
            { key: 'matricule', label: 'Matricule' },
            { key: 'grade_name', label: 'Grade' },
            { key: 'function_names', label: 'Fonctions' },
            { key: 'chapter_name', label: 'Chapter' },
            { key: 'status', label: 'Statut', render: (r) => `<span class="status-pill status-${r.status}">${r.status}</span>` },
            { key: 'entry_date', label: "Date d'entrée", render: (r) => formatDate(r.entry_date) },
            { key: 'discord', label: 'Discord' },
        ],
        fields: [
            { key: 'rp_name', label: 'Nom RP', required: true },
            { key: 'real_username', label: 'Identifiant de connexion' },
            { key: 'phone', label: 'Téléphone' },
            { key: 'discord', label: 'Discord' },
            { key: 'grade_id', label: 'Grade', type: 'select', options: grades.map((g) => ({ value: g.id, label: g.name })) },
            { key: 'chapter_id', label: 'Chapter', type: 'select', options: chapters.map((c) => ({ value: c.id, label: c.name })) },
            { key: 'status', label: 'Statut', type: 'select', options: [
                { value: 'actif', label: 'Actif' }, { value: 'en_conge', label: 'En congé' },
                { value: 'suspendu', label: 'Suspendu' }, { value: 'exclu', label: 'Exclu' },
                { value: 'prospect', label: 'Prospect' },
            ] },
            { key: 'entry_date', label: "Date d'entrée", type: 'date' },
            { key: 'promotion_date', label: 'Date de promotion', type: 'date' },
            { key: 'avatar_url', label: 'URL photo' },
            { key: 'notes', label: 'Notes', type: 'textarea' },
        ],
    });

    if (can('members', 'edit')) {
        await renderFunctionAssignment(functionsContainer);
    }

    return container;
}

async function renderFunctionAssignment(container) {
    const [{ data: members }, { data: functionsList }] = await Promise.all([
        listRecords('v_members_full', { orderBy: { column: 'rp_name', ascending: true } }),
        listRecords('functions', { orderBy: { column: 'name', ascending: true } }),
    ]);

    container.append(el('h4', {}, '🧰 Fonctions cumulées par membre'));

    if (!functionsList.length) {
        container.append(el('div', { class: 'app-empty-state' }, 'Aucune fonction créée pour le moment. Créez-en dans Paramètres > Fonctions (ex: Barman, Mécanicien).'));
        return;
    }

    const memberSelect = el('select', {}, [
        el('option', { value: '' }, 'Choisir un membre'),
        ...members.map((m) => el('option', { value: m.id }, m.rp_name)),
    ]);
    const list = el('div', { style: 'margin-top:12px;' });
    container.append(el('div', { class: 'field-row' }, [memberSelect]), list);

    async function refresh() {
        list.innerHTML = '';
        if (!memberSelect.value) return;

        const { data: assigned } = await listRecords('member_functions', { filters: { member_id: memberSelect.value } });
        const assignedIds = new Set(assigned.map((a) => a.function_id));

        const rows = functionsList.map((f) => {
            const checkbox = el('input', { type: 'checkbox' });
            checkbox.checked = assignedIds.has(f.id);
            checkbox.addEventListener('change', async () => {
                if (checkbox.checked) {
                    await createRecord('member_functions', { member_id: memberSelect.value, function_id: f.id });
                } else {
                    await deleteWhere('member_functions', { member_id: memberSelect.value, function_id: f.id });
                }
            });
            return el('div', { class: 'field-row', style: 'align-items:center;' }, [checkbox, el('span', {}, f.name)]);
        });

        list.append(...rows);
    }

    memberSelect.addEventListener('change', refresh);
}

/**
 * Note : la création d'un membre insère uniquement la fiche RP (table
 * `members`). Le compte de connexion (auth.users) doit être créé au
 * préalable dans Supabase Auth, puis son UUID renseigné manuellement pour
 * l'instant (voir README, section "compte fondateur"). Une évolution future
 * pourra brancher une Edge Function admin pour automatiser cette étape.
 */
