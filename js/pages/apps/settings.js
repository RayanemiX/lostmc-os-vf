/**
 * settings.js - Application "Paramètres"
 * Cœur de l'évolutivité du système : c'est ici que l'utilisateur crée ses
 * propres grades, réordonne la hiérarchie, définit les permissions par
 * grade/module, gère les chapters/catégories de stock/types d'événements,
 * personnalise l'apparence, et change son mot de passe. Rien n'est en dur.
 */
import { el } from '../../utils/dom.js';
import { listRecords, createRecord, updateRecord, deleteRecord } from '../../services/dataService.js';
import { supabase } from '../../services/supabaseClient.js';
import { getAllModules } from '../../services/permissionsService.js';
import { renderCrudApp } from './crudEngine.js';

const TABS = [
    { key: 'general', label: '🎨 Apparence' },
    { key: 'grades', label: '🎖️ Grades Lost' },
    { key: 'functions', label: '🧰 Fonctions (Barman, Mécano...)' },
    { key: 'permissions', label: '🔐 Permissions' },
    { key: 'categories', label: '🗂️ Catégories' },
    { key: 'security', label: '🔑 Sécurité' },
];

export async function mountSettingsApp(container) {
    const tabBar = el('div', { class: 'app-toolbar' }, TABS.map((t) =>
        el('button', { class: 'btn btn-ghost', onclick: () => showTab(t.key) }, t.label)
    ));
    const body = el('div');
    container.append(tabBar, body);

    async function showTab(key) {
        body.innerHTML = '';
        if (key === 'general') return renderGeneral(body);
        if (key === 'grades') return renderGrades(body);
        if (key === 'functions') return renderFunctions(body);
        if (key === 'permissions') return renderPermissions(body);
        if (key === 'categories') return renderCategories(body);
        if (key === 'security') return renderSecurity(body);
    }

    showTab('general');
    return container;
}

/* ---------------------------------------------------------------- */
async function renderGeneral(container) {
    const { data } = await supabase.from('club_settings').select('*').eq('id', 1).single();

    const nameInput = el('input', { type: 'text', value: data?.club_name || 'LOST MC' });
    const logoInput = el('input', { type: 'text', value: data?.logo_url || '', placeholder: 'URL du logo' });
    const wallpaperInput = el('input', { type: 'text', value: data?.wallpaper_url || '', placeholder: "URL du fond d'écran" });
    const primaryInput = el('input', { type: 'color', value: data?.primary_color || '#8a0303' });
    const secondaryInput = el('input', { type: 'color', value: data?.secondary_color || '#1a1a1a' });
    const bgInput = el('input', { type: 'color', value: data?.background_color || '#0a0a0a' });
    const accentInput = el('input', { type: 'color', value: data?.accent_color || '#f5f5f5' });

    const saveBtn = el('button', { class: 'btn btn-primary' }, 'Enregistrer');
    saveBtn.addEventListener('click', async () => {
        await updateRecord('club_settings', 1, {
            club_name: nameInput.value,
            logo_url: logoInput.value || null,
            wallpaper_url: wallpaperInput.value || null,
            primary_color: primaryInput.value,
            secondary_color: secondaryInput.value,
            background_color: bgInput.value,
            accent_color: accentInput.value,
        });
        applyThemeVariables({ primaryInput, secondaryInput, bgInput, accentInput });
        alert('Paramètres enregistrés. Rechargez la page pour tout appliquer partout.');
    });

    container.append(el('form', { class: 'app-form' }, [
        el('div', { class: 'field-row' }, [
            el('div', { class: 'field' }, [el('label', {}, 'Nom du club'), nameInput]),
            el('div', { class: 'field' }, [el('label', {}, 'URL du logo'), logoInput]),
            el('div', { class: 'field' }, [el('label', {}, "URL du fond d'écran"), wallpaperInput]),
        ]),
        el('div', { class: 'field-row' }, [
            el('div', { class: 'field' }, [el('label', {}, 'Couleur principale'), primaryInput]),
            el('div', { class: 'field' }, [el('label', {}, 'Couleur secondaire'), secondaryInput]),
            el('div', { class: 'field' }, [el('label', {}, 'Fond'), bgInput]),
            el('div', { class: 'field' }, [el('label', {}, 'Texte / accent'), accentInput]),
        ]),
        el('div', { class: 'form-actions' }, [saveBtn]),
    ]));
}

function applyThemeVariables({ primaryInput, secondaryInput, bgInput, accentInput }) {
    document.documentElement.style.setProperty('--color-accent', primaryInput.value);
    document.documentElement.style.setProperty('--color-surface', secondaryInput.value);
    document.documentElement.style.setProperty('--color-bg', bgInput.value);
    document.documentElement.style.setProperty('--color-text', accentInput.value);
}

/* ---------------------------------------------------------------- */
async function renderFunctions(container) {
    container.append(el('p', { style: 'color:var(--color-text-dim); font-size:0.85rem; margin-bottom:12px;' },
        'Les fonctions sont des rôles secondaires cumulables (ex: Barman, Mécanicien, Gérant Bar). Un membre peut en avoir plusieurs en plus de son grade principal. Assignez-les depuis Dossiers Membres, et donnez-leur des permissions dans l\'onglet Permissions.'));

    renderCrudApp(container, {
        moduleKey: 'settings',
        table: 'functions',
        titleField: 'name',
        searchColumns: ['name'],
        orderBy: { column: 'name', ascending: true },
        emptyLabel: 'Aucune fonction créée. Ajoutez-en une (ex: Barman, Mécanicien, Gérant Bar).',
        columns: [
            { key: 'name', label: 'Nom de la fonction' },
            { key: 'description', label: 'Description' },
        ],
        fields: [
            { key: 'name', label: 'Nom de la fonction', required: true },
            { key: 'color', label: 'Couleur du badge', type: 'color' },
            { key: 'description', label: 'Description', type: 'textarea' },
        ],
    });
}

/* ---------------------------------------------------------------- */
async function renderGrades(container) {
    renderCrudApp(container, {
        moduleKey: 'settings',
        table: 'grades',
        titleField: 'name',
        searchColumns: ['name'],
        orderBy: { column: 'hierarchy_order', ascending: true },
        emptyLabel: 'Aucun grade créé. Commencez par créer votre premier grade (ex: Président, ordre 1).',
        columns: [
            { key: 'hierarchy_order', label: 'Ordre' },
            { key: 'name', label: 'Nom du grade' },
            { key: 'is_staff', label: 'Bureau', render: (r) => (r.is_staff ? '✅' : '—') },
            { key: 'description', label: 'Description' },
        ],
        fields: [
            { key: 'name', label: 'Nom du grade', required: true },
            { key: 'hierarchy_order', label: 'Ordre hiérarchique (1 = le plus haut)', type: 'number', required: true },
            { key: 'color', label: 'Couleur du badge', type: 'color' },
            { key: 'is_staff', label: 'Fait partie du bureau ?', type: 'select', options: [{ value: 'true', label: 'Oui' }, { value: 'false', label: 'Non' }] },
            { key: 'wallpaper_url', label: "Fond d'écran de ce grade (URL image, laisser vide = fond du club)" },
            { key: 'description', label: 'Description', type: 'textarea' },
        ],
        beforeSave: (payload) => ({ is_staff: payload.is_staff === 'true' }),
    });
}

/* ---------------------------------------------------------------- */
async function renderPermissions(container) {
    const [{ data: grades }, { data: functionsList }, modules, { data: existingPerms }] = await Promise.all([
        listRecords('grades', { orderBy: { column: 'hierarchy_order', ascending: true } }),
        listRecords('functions', { orderBy: { column: 'name', ascending: true } }),
        Promise.resolve(getAllModules()),
        listRecords('permissions'),
    ]);

    if (!grades.length && !functionsList.length) {
        container.append(el('div', { class: 'app-empty-state' }, 'Créez d\'abord un grade ou une fonction.'));
        return;
    }

    const permMap = new Map(existingPerms.map((p) => [`${p.grade_id || p.function_id}:${p.module_key}`, p]));

    let targetType = 'grade'; // 'grade' | 'function'
    const typeToggle = el('div', { class: 'app-toolbar' }, [
        el('button', { class: 'btn btn-primary', onclick: () => { targetType = 'grade'; refreshOptions(); } }, '🎖️ Grade Lost'),
        el('button', { class: 'btn btn-ghost', onclick: () => { targetType = 'function'; refreshOptions(); } }, '🧰 Fonction (Barman, Mécano...)'),
    ]);

    const targetSelect = el('select', {});
    const grid = el('div', { style: 'margin-top:16px;' });
    container.append(typeToggle, el('div', { class: 'field-row' }, [targetSelect]), grid);

    function refreshOptions() {
        const list = targetType === 'grade' ? grades : functionsList;
        targetSelect.innerHTML = '';
        list.forEach((item) => targetSelect.append(el('option', { value: item.id }, item.name)));
        buildGrid();
    }

    function buildGrid() {
        grid.innerHTML = '';
        const targetId = targetSelect.value;
        if (!targetId) return;

        const table = el('table', { class: 'app-table' }, [
            el('thead', {}, [el('tr', {}, ['Module', 'Voir', 'Créer', 'Modifier', 'Supprimer', 'Gérer'].map((h) => el('th', {}, h)))]),
            el('tbody', {}, modules.map((m) => {
                const key = `${targetId}:${m.key}`;
                const existing = permMap.get(key) || {};
                const checks = {};
                ['can_view', 'can_create', 'can_edit', 'can_delete', 'can_manage'].forEach((field) => {
                    checks[field] = el('input', { type: 'checkbox' });
                    checks[field].checked = !!existing[field];
                });

                async function save() {
                    const payload = {
                        grade_id: targetType === 'grade' ? targetId : null,
                        function_id: targetType === 'function' ? targetId : null,
                        module_key: m.key,
                        can_view: checks.can_view.checked,
                        can_create: checks.can_create.checked,
                        can_edit: checks.can_edit.checked,
                        can_delete: checks.can_delete.checked,
                        can_manage: checks.can_manage.checked,
                    };
                    if (existing.id) {
                        await updateRecord('permissions', existing.id, payload);
                    } else {
                        const { data } = await createRecord('permissions', payload);
                        if (data) permMap.set(key, data);
                    }
                }
                Object.values(checks).forEach((c) => c.addEventListener('change', save));

                return el('tr', {}, [
                    el('td', {}, `${m.icon || ''} ${m.label}${m.is_common ? ' (commun)' : ''}`),
                    ...Object.values(checks).map((c) => el('td', {}, [c])),
                ]);
            })),
        ]);

        grid.append(table);
    }

    targetSelect.addEventListener('change', buildGrid);
    refreshOptions();
}

/* ---------------------------------------------------------------- */
async function renderCategories(container) {
    const tabs = el('div', { class: 'app-toolbar' }, [
        el('button', { class: 'btn btn-ghost', onclick: () => renderSubList('chapters', ['name', 'city']) }, 'Chapters'),
        el('button', { class: 'btn btn-ghost', onclick: () => renderSubList('stock_categories', ['name', 'unit', 'low_stock_alert']) }, 'Matériaux (Stock)'),
        el('button', { class: 'btn btn-ghost', onclick: () => renderSubList('event_types', ['label', 'color'], 'key') }, "Types d'événements"),
    ]);
    const sub = el('div');
    container.append(tabs, sub);

    function renderSubList(table, fieldKeys) {
        sub.innerHTML = '';
        const fieldsConfig = {
            chapters: [{ key: 'name', label: 'Nom', required: true }, { key: 'city', label: 'Ville' }, { key: 'description', label: 'Description', type: 'textarea' }],
            stock_categories: [{ key: 'name', label: 'Nom', required: true }, { key: 'unit', label: 'Unité' }, { key: 'low_stock_alert', label: "Seuil d'alerte", type: 'number' }],
            event_types: [{ key: 'key', label: 'Clé technique (sans espace)', required: true }, { key: 'label', label: 'Libellé', required: true }, { key: 'color', label: 'Couleur', type: 'color' }],
        };
        renderCrudApp(sub, {
            moduleKey: 'settings',
            table,
            idField: table === 'event_types' ? 'key' : 'id',
            titleField: fieldKeys[0],
            orderBy: { column: fieldKeys[0], ascending: true },
            emptyLabel: 'Aucun élément pour le moment.',
            columns: fieldKeys.map((k) => ({ key: k, label: k })),
            fields: fieldsConfig[table],
        });
    }

    renderSubList('chapters', ['name', 'city']);
}

/* ---------------------------------------------------------------- */
async function renderSecurity(container) {
    const passInput = el('input', { type: 'password', placeholder: 'Nouveau mot de passe' });
    const confirmInput = el('input', { type: 'password', placeholder: 'Confirmer le mot de passe' });
    const msg = el('div', { class: 'login-error' });
    const saveBtn = el('button', { class: 'btn btn-primary' }, 'Changer le mot de passe');

    saveBtn.addEventListener('click', async () => {
        msg.textContent = '';
        if (passInput.value.length < 8) { msg.textContent = 'Le mot de passe doit faire au moins 8 caractères.'; return; }
        if (passInput.value !== confirmInput.value) { msg.textContent = 'Les mots de passe ne correspondent pas.'; return; }

        const { error } = await supabase.auth.updateUser({ password: passInput.value });
        msg.textContent = error ? "Erreur lors du changement de mot de passe." : 'Mot de passe modifié avec succès.';
        msg.style.color = error ? '' : '#6fcf73';
    });

    container.append(el('form', { class: 'app-form', style: 'max-width:360px;' }, [
        el('div', { class: 'field' }, [el('label', {}, 'Nouveau mot de passe'), passInput]),
        el('div', { class: 'field' }, [el('label', {}, 'Confirmation'), confirmInput]),
        msg,
        el('div', { class: 'form-actions' }, [saveBtn]),
    ]));
}
