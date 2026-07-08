/**
 * treasury.js - Application "Trésorerie" (inclut la gestion des Stocks,
 * comme demandé dans le cahier des charges : même application, deux onglets).
 * Accessible aux grades ayant la permission sur les modules 'treasury' / 'stock'.
 */
import { el } from '../../utils/dom.js';
import { listRecords, createRecord } from '../../services/dataService.js';
import { renderCrudApp } from './crudEngine.js';
import { can } from '../../services/permissionsService.js';
import { formatAmount, formatDateTime } from '../../utils/format.js';

export async function mountTreasuryApp(container, memberProfile) {
    const tabs = el('div', { class: 'app-toolbar' }, [
        el('button', { class: 'btn btn-ghost', id: 'tab-treasury' }, '💰 Trésorerie'),
        el('button', { class: 'btn btn-ghost', id: 'tab-stock' }, '📦 Stocks'),
    ]);
    const body = el('div', {});
    container.append(tabs, body);

    async function showTreasury() {
        body.innerHTML = '';

        renderCrudApp(body, {
            moduleKey: 'treasury',
            table: 'v_treasury_full',
            baseTable: 'treasury_transactions',
            titleField: 'comment',
            orderBy: { column: 'created_at', ascending: false },
            emptyLabel: 'Aucune transaction enregistrée.',
            statsRenderer: (data) => [
                el('div', { class: 'stat-card' }, [
                    el('div', { class: 'stat-label' }, 'Solde actuel'),
                    el('div', { class: 'stat-value' }, formatAmount(data[0]?.balance_after ?? 0)),
                ]),
            ],
            filters: [
                { key: 'type', label: 'Tous types', options: [{ value: 'entree', label: 'Entrées' }, { value: 'sortie', label: 'Sorties' }] },
            ],
            columns: [
                { key: 'created_at', label: 'Date', render: (r) => formatDateTime(r.created_at) },
                { key: 'type', label: 'Type', render: (r) => `<span class="${r.type === 'entree' ? 'amount-in' : 'amount-out'}">${r.type === 'entree' ? 'Entrée' : 'Sortie'}</span>` },
                { key: 'amount', label: 'Montant', render: (r) => `<span class="${r.type === 'entree' ? 'amount-in' : 'amount-out'}">${r.type === 'entree' ? '+' : '-'}${formatAmount(r.amount)}</span>` },
                { key: 'category', label: 'Catégorie' },
                { key: 'member_name', label: 'Effectué par' },
                { key: 'comment', label: 'Commentaire' },
                { key: 'balance_after', label: 'Solde après', render: (r) => formatAmount(r.balance_after) },
            ],
            fields: [
                { key: 'type', label: 'Type', type: 'select', required: true, options: [
                    { value: 'entree', label: 'Entrée' }, { value: 'sortie', label: 'Sortie' },
                ] },
                { key: 'amount', label: 'Montant ($)', type: 'number', required: true },
                { key: 'category', label: 'Catégorie' },
                { key: 'comment', label: 'Commentaire', type: 'textarea' },
            ],
            beforeSave: () => ({ member_id: memberProfile?.id || null }),
        });
    }

    async function showStock() {
        body.innerHTML = '';
        const canCreate = can('stock', 'create');

        const { data: overview } = await listRecords('v_stock_overview', { orderBy: { column: 'name', ascending: true } });

        const table = el('table', { class: 'app-table' }, [
            el('thead', {}, [el('tr', {}, ['Matériau', 'Quantité actuelle', 'Seuil d\'alerte', 'État'].map((h) => el('th', {}, h)))]),
            el('tbody', {}, overview.map((row) => el('tr', {}, [
                el('td', {}, row.name),
                el('td', {}, `${row.current_quantity} ${row.unit || ''}`),
                el('td', {}, String(row.low_stock_alert)),
                el('td', {}, row.is_low
                    ? el('span', { class: 'status-pill status-danger' }, 'Stock faible')
                    : el('span', { class: 'status-pill status-actif' }, 'OK')),
            ]))),
        ]);

        const stats = el('div', { class: 'app-stats-row' }, overview.map((row) => el('div', { class: `stat-card${row.is_low ? ' danger' : ''}` }, [
            el('div', { class: 'stat-label' }, row.name),
            el('div', { class: 'stat-value' }, String(row.current_quantity)),
        ])));

        const movementForm = canCreate ? buildMovementForm(overview, showStock) : null;

        body.append(stats, table, movementForm);
    }

    function buildMovementForm(categories, onSaved) {
        const categorySelect = el('select', { required: true }, [
            el('option', { value: '' }, 'Choisir un matériau'),
            ...categories.map((c) => el('option', { value: c.category_id }, c.name)),
        ]);
        const typeSelect = el('select', {}, [
            el('option', { value: 'entree' }, 'Entrée'),
            el('option', { value: 'sortie' }, 'Sortie'),
        ]);
        const qtyInput = el('input', { type: 'number', min: '1', placeholder: 'Quantité', required: true });
        const commentInput = el('input', { type: 'text', placeholder: 'Commentaire (optionnel)' });
        const submitBtn = el('button', { class: 'btn btn-primary', type: 'submit' }, 'Enregistrer le mouvement');

        const form = el('form', { class: 'app-form', style: 'margin-top:16px;' }, [
            el('h4', {}, 'Nouveau mouvement de stock'),
            el('div', { class: 'field-row' }, [categorySelect, typeSelect, qtyInput, commentInput]),
            el('div', { class: 'form-actions' }, [submitBtn]),
        ]);

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await createRecord('stock_movements', {
                category_id: categorySelect.value,
                type: typeSelect.value,
                quantity: Number(qtyInput.value),
                comment: commentInput.value || null,
            });
            onSaved();
        });

        return form;
    }

    tabs.querySelector('#tab-treasury').addEventListener('click', showTreasury);
    tabs.querySelector('#tab-stock').addEventListener('click', showStock);

    showTreasury();
    return container;
}
