/**
 * bar.js - Application "Bar"
 * Totalement indépendante de la trésorerie/stock principaux. Visible
 * uniquement par les membres ayant la permission 'view' sur le module 'bar'
 * (accordée via une fonction comme "Barman"/"Gérant Bar", ou un grade).
 */
import { el } from '../../utils/dom.js';
import { listRecords, createRecord } from '../../services/dataService.js';
import { renderCrudApp } from './crudEngine.js';
import { can } from '../../services/permissionsService.js';
import { formatAmount, formatDateTime } from '../../utils/format.js';

const TABS = [
    { key: 'treasury', label: '💰 Trésorerie' },
    { key: 'stock', label: '📦 Stock' },
    { key: 'invoices', label: '🧾 Factures' },
    { key: 'catalog', label: '🍹 Catalogue' },
];

export async function mountBarApp(container, memberProfile) {
    const tabs = el('div', { class: 'app-toolbar' }, TABS.map((t) =>
        el('button', { class: 'btn btn-ghost', onclick: () => show(t.key) }, t.label)
    ));
    const body = el('div');
    container.append(tabs, body);

    async function show(key) {
        body.innerHTML = '';
        if (key === 'treasury') return renderTreasury(body, memberProfile);
        if (key === 'stock') return renderStock(body);
        if (key === 'invoices') return renderInvoices(body, memberProfile);
        if (key === 'catalog') return renderCatalog(body);
    }

    show('treasury');
    return container;
}

async function renderTreasury(body, memberProfile) {
    renderCrudApp(body, {
        moduleKey: 'bar',
        table: 'v_bar_treasury_full',
        baseTable: 'bar_treasury_transactions',
        titleField: 'comment',
        orderBy: { column: 'created_at', ascending: false },
        emptyLabel: 'Aucune transaction du bar enregistrée.',
        statsRenderer: (data) => [
            el('div', { class: 'stat-card' }, [el('div', { class: 'stat-label' }, 'Solde du bar'), el('div', { class: 'stat-value' }, formatAmount(data[0]?.balance_after ?? 0))]),
        ],
        filters: [{ key: 'type', label: 'Tous types', options: [{ value: 'entree', label: 'Entrées' }, { value: 'sortie', label: 'Sorties' }] }],
        columns: [
            { key: 'created_at', label: 'Date', render: (r) => formatDateTime(r.created_at) },
            { key: 'type', label: 'Type', render: (r) => `<span class="${r.type === 'entree' ? 'amount-in' : 'amount-out'}">${r.type === 'entree' ? 'Entrée' : 'Sortie'}</span>` },
            { key: 'amount', label: 'Montant', render: (r) => `<span class="${r.type === 'entree' ? 'amount-in' : 'amount-out'}">${r.type === 'entree' ? '+' : '-'}${formatAmount(r.amount)}</span>` },
            { key: 'member_name', label: 'Effectué par' },
            { key: 'comment', label: 'Commentaire' },
            { key: 'balance_after', label: 'Solde après', render: (r) => formatAmount(r.balance_after) },
        ],
        fields: [
            { key: 'type', label: 'Type', type: 'select', required: true, options: [{ value: 'entree', label: 'Entrée' }, { value: 'sortie', label: 'Sortie' }] },
            { key: 'amount', label: 'Montant ($)', type: 'number', required: true },
            { key: 'comment', label: 'Commentaire', type: 'textarea' },
        ],
        beforeSave: () => ({ member_id: memberProfile?.id || null }),
    });
}

async function renderStock(body) {
    const canCreate = can('bar', 'create');
    const { data: overview } = await listRecords('v_bar_stock_overview', { orderBy: { column: 'name', ascending: true } });

    const stats = el('div', { class: 'app-stats-row' }, overview.map((row) => el('div', { class: `stat-card${row.is_low ? ' danger' : ''}` }, [
        el('div', { class: 'stat-label' }, row.name), el('div', { class: 'stat-value' }, String(row.current_quantity)),
    ])));

    const table = el('table', { class: 'app-table' }, [
        el('thead', {}, [el('tr', {}, ['Produit', 'Quantité', 'Seuil', 'État'].map((h) => el('th', {}, h)))]),
        el('tbody', {}, overview.map((row) => el('tr', {}, [
            el('td', {}, row.name), el('td', {}, `${row.current_quantity} ${row.unit || ''}`), el('td', {}, String(row.low_stock_alert)),
            el('td', {}, row.is_low ? el('span', { class: 'status-pill status-danger' }, 'Faible') : el('span', { class: 'status-pill status-actif' }, 'OK')),
        ]))),
    ]);

    body.append(stats, table);

    if (canCreate) {
        const categorySelect = el('select', {}, overview.map((c) => el('option', { value: c.category_id }, c.name)));
        const typeSelect = el('select', {}, [el('option', { value: 'entree' }, 'Entrée'), el('option', { value: 'sortie' }, 'Sortie')]);
        const qtyInput = el('input', { type: 'number', min: '1', placeholder: 'Quantité' });
        const commentInput = el('input', { type: 'text', placeholder: 'Commentaire' });
        const btn = el('button', { class: 'btn btn-primary', onclick: async () => {
            await createRecord('bar_stock_movements', { category_id: categorySelect.value, type: typeSelect.value, quantity: Number(qtyInput.value), comment: commentInput.value || null });
            body.innerHTML = '';
            renderStock(body);
        } }, '+ Mouvement');
        body.append(el('form', { class: 'app-form', style: 'margin-top:16px;' }, [
            el('h4', {}, 'Nouveau mouvement'),
            el('div', { class: 'field-row' }, [categorySelect, typeSelect, qtyInput, commentInput, btn]),
        ]));
    }
}

async function renderInvoices(body, memberProfile) {
    renderCrudApp(body, {
        moduleKey: 'bar',
        table: 'bar_invoices',
        titleField: 'client_name',
        searchColumns: ['client_name'],
        orderBy: { column: 'created_at', ascending: false },
        emptyLabel: 'Aucune facture pour le moment.',
        filters: [{ key: 'status', label: 'Tous statuts', options: [{ value: 'en_attente', label: 'En attente' }, { value: 'payee', label: 'Payée' }, { value: 'annulee', label: 'Annulée' }] }],
        columns: [
            { key: 'client_name', label: 'Client' },
            { key: 'amount', label: 'Montant', render: (r) => formatAmount(r.amount) },
            { key: 'status', label: 'Statut', render: (r) => `<span class="status-pill status-${r.status === 'payee' ? 'actif' : r.status === 'annulee' ? 'exclu' : 'en_conge'}">${r.status}</span>` },
            { key: 'created_at', label: 'Date', render: (r) => formatDateTime(r.created_at) },
        ],
        fields: [
            { key: 'client_name', label: 'Nom du client', required: true },
            { key: 'amount', label: 'Montant ($)', type: 'number', required: true },
            { key: 'status', label: 'Statut', type: 'select', options: [{ value: 'en_attente', label: 'En attente' }, { value: 'payee', label: 'Payée' }, { value: 'annulee', label: 'Annulée' }] },
            { key: 'comment', label: 'Commentaire', type: 'textarea' },
        ],
        beforeSave: () => ({ member_id: memberProfile?.id || null }),
    });
}

async function renderCatalog(body) {
    renderCrudApp(body, {
        moduleKey: 'bar',
        table: 'bar_catalog',
        titleField: 'name',
        searchColumns: ['name'],
        orderBy: { column: 'name', ascending: true },
        emptyLabel: 'Aucune boisson au catalogue.',
        columns: [
            { key: 'name', label: 'Nom' },
            { key: 'price', label: 'Prix', render: (r) => formatAmount(r.price) },
            { key: 'is_available', label: 'Disponible', render: (r) => (r.is_available ? '✅' : '❌') },
        ],
        fields: [
            { key: 'name', label: 'Nom de la boisson', required: true },
            { key: 'price', label: 'Prix ($)', type: 'number', required: true },
            { key: 'is_available', label: 'Disponible', type: 'select', options: [{ value: 'true', label: 'Oui' }, { value: 'false', label: 'Non' }] },
        ],
        beforeSave: (payload) => ({ is_available: payload.is_available === 'true' || payload.is_available === true }),
    });
}
