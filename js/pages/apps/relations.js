/**
 * relations.js - Application "Relationnel"
 * Gestion des MC, gangs, organisations, entreprises, police, gouvernement.
 */
import { el } from '../../utils/dom.js';
import { listRecords, createRecord } from '../../services/dataService.js';
import { renderCrudApp } from './crudEngine.js';
import { can } from '../../services/permissionsService.js';
import { formatDateTime } from '../../utils/format.js';

const TYPES = [
    { value: 'mc', label: 'MC' }, { value: 'gang', label: 'Gang' },
    { value: 'organisation', label: 'Organisation' }, { value: 'entreprise', label: 'Entreprise' },
    { value: 'police', label: 'Police' }, { value: 'gouvernement', label: 'Gouvernement' }, { value: 'autre', label: 'Autre' },
];
const STATUSES = [
    { value: 'allie', label: 'Allié' }, { value: 'neutre', label: 'Neutre' },
    { value: 'en_guerre', label: 'En guerre' }, { value: 'danger', label: 'Danger' },
];

export async function mountRelationsApp(container) {
    const listContainer = el('div');
    const historyContainer = el('div', { style: 'margin-top:24px; padding-top:16px; border-top:1px solid var(--color-border);' });
    container.append(listContainer, historyContainer);

    renderCrudApp(listContainer, {
        moduleKey: 'relations',
        table: 'relations',
        titleField: 'name',
        searchColumns: ['name'],
        orderBy: { column: 'name', ascending: true },
        emptyLabel: 'Aucune relation enregistrée.',
        filters: [
            { key: 'type', label: 'Tous les types', options: TYPES },
            { key: 'status', label: 'Tous les statuts', options: STATUSES },
        ],
        columns: [
            { key: 'name', label: 'Nom' },
            { key: 'type', label: 'Type', render: (r) => TYPES.find((t) => t.value === r.type)?.label || r.type },
            { key: 'status', label: 'Statut', render: (r) => `<span class="status-pill status-${r.status}">${STATUSES.find((s) => s.value === r.status)?.label || r.status}</span>` },
            { key: 'description', label: 'Description' },
        ],
        fields: [
            { key: 'name', label: 'Nom', required: true },
            { key: 'type', label: 'Type', type: 'select', required: true, options: TYPES },
            { key: 'status', label: 'Statut', type: 'select', required: true, options: STATUSES },
            { key: 'description', label: 'Description', type: 'textarea' },
        ],
    });

    if (can('relations', 'view')) {
        await renderHistoryPanel(historyContainer);
    }

    return container;
}

async function renderHistoryPanel(container) {
    const { data: relations } = await listRecords('relations', { orderBy: { column: 'name', ascending: true } });

    container.innerHTML = '';
    container.append(el('h4', {}, '📜 Historique des relations'));

    const relationSelect = el('select', {}, [
        el('option', { value: '' }, 'Choisir une relation'),
        ...relations.map((r) => el('option', { value: r.id }, r.name)),
    ]);
    const historyList = el('div', { style: 'margin-top:12px;' });
    container.append(el('div', { class: 'field-row' }, [relationSelect]), historyList);

    async function refresh() {
        historyList.innerHTML = '';
        if (!relationSelect.value) return;

        const { data: history } = await listRecords('relation_history', {
            filters: { relation_id: relationSelect.value },
            orderBy: { column: 'created_at', ascending: false },
        });

        historyList.append(...history.map((h) => el('div', { style: 'padding:8px 0; border-bottom:1px solid var(--color-border); font-size:0.85rem;' }, [
            el('strong', {}, h.event),
            el('div', { style: 'color:var(--color-text-dim); font-size:0.78rem;' }, `${formatDateTime(h.created_at)}${h.comment ? ' — ' + h.comment : ''}`),
        ])));

        if (can('relations', 'edit')) {
            const eventInput = el('input', { type: 'text', placeholder: 'Nouvel événement (ex: Accord de paix signé)' });
            const addBtn = el('button', { class: 'btn btn-primary', onclick: async () => {
                if (!eventInput.value) return;
                await createRecord('relation_history', { relation_id: relationSelect.value, event: eventInput.value });
                refresh();
            } }, '+ Ajouter');
            historyList.append(el('div', { class: 'field-row', style: 'margin-top:10px;' }, [eventInput, addBtn]));
        }
    }

    relationSelect.addEventListener('change', refresh);
}
