/**
 * armory.js - Application "Armurerie"
 * Catalogue d'armes + gestion des recettes de craft (matériaux nécessaires).
 * La quantité fabricable est calculée côté SQL (fonction craftable_quantity)
 * et exposée via la vue v_weapons_full.
 */
import { el } from '../../utils/dom.js';
import { listRecords, createRecord, deleteRecord } from '../../services/dataService.js';
import { renderCrudApp } from './crudEngine.js';
import { can } from '../../services/permissionsService.js';
import { formatAmount } from '../../utils/format.js';

export async function mountArmoryApp(container) {
    const listContainer = el('div');
    const recipeContainer = el('div', { style: 'margin-top:24px; padding-top:16px; border-top:1px solid var(--color-border);' });
    container.append(listContainer, recipeContainer);

    renderCrudApp(listContainer, {
        moduleKey: 'armory',
        table: 'v_weapons_full',
        baseTable: 'weapons',
        titleField: 'name',
        searchColumns: ['name'],
        orderBy: { column: 'name', ascending: true },
        emptyLabel: 'Aucune arme au catalogue pour le moment.',
        columns: [
            { key: 'photo_url', label: '', render: (r) => `<span class="avatar-thumb" style="background-image:url('${r.photo_url || ''}'); border-radius:4px;"></span>` },
            { key: 'name', label: 'Nom' },
            { key: 'stock_quantity', label: 'Stock' },
            { key: 'craftable_quantity', label: 'Fabricables', render: (r) => `<strong>${r.craftable_quantity}</strong>` },
            { key: 'value', label: 'Valeur', render: (r) => formatAmount(r.value) },
            { key: 'sale_price', label: 'Prix de vente', render: (r) => formatAmount(r.sale_price) },
            { key: 'required_level', label: 'Niveau requis' },
        ],
        fields: [
            { key: 'name', label: 'Nom de l\'arme', required: true },
            { key: 'photo_url', label: 'URL photo' },
            { key: 'stock_quantity', label: 'Stock actuel', type: 'number' },
            { key: 'value', label: 'Valeur estimée ($)', type: 'number' },
            { key: 'sale_price', label: 'Prix de vente ($)', type: 'number' },
            { key: 'required_level', label: 'Niveau requis', type: 'number' },
            { key: 'description', label: 'Description', type: 'textarea' },
        ],
    });

    await renderRecipeManager(recipeContainer);
    return container;
}

async function renderRecipeManager(container) {
    if (!can('armory', 'edit')) return;

    const [{ data: weapons }, { data: categories }] = await Promise.all([
        listRecords('weapons', { orderBy: { column: 'name', ascending: true } }),
        listRecords('stock_categories', { orderBy: { column: 'name', ascending: true } }),
    ]);

    container.innerHTML = '';
    container.append(el('h4', {}, '🧪 Recettes de craft'));

    const weaponSelect = el('select', {}, [
        el('option', { value: '' }, 'Choisir une arme'),
        ...weapons.map((w) => el('option', { value: w.id }, w.name)),
    ]);
    const recipeList = el('div', { style: 'margin-top:12px;' });
    container.append(el('div', { class: 'field-row' }, [weaponSelect]), recipeList);

    async function refreshRecipeList() {
        recipeList.innerHTML = '';
        if (!weaponSelect.value) return;

        const { data: recipes } = await listRecords('weapon_recipes', { filters: { weapon_id: weaponSelect.value } });
        const categoryName = (id) => categories.find((c) => c.id === id)?.name || '?';

        const table = el('table', { class: 'app-table' }, [
            el('thead', {}, [el('tr', {}, ['Matériau', 'Quantité nécessaire', ''].map((h) => el('th', {}, h)))]),
            el('tbody', {}, recipes.map((r) => el('tr', {}, [
                el('td', {}, categoryName(r.category_id)),
                el('td', {}, String(r.quantity_needed)),
                el('td', { class: 'row-actions' }, [
                    el('button', { onclick: async () => { await deleteRecord('weapon_recipes', r.id); refreshRecipeList(); } }, '🗑️'),
                ]),
            ]))),
        ]);

        const categorySelect = el('select', {}, categories.map((c) => el('option', { value: c.id }, c.name)));
        const qtyInput = el('input', { type: 'number', min: '1', value: '1' });
        const addBtn = el('button', { class: 'btn btn-primary', onclick: async () => {
            await createRecord('weapon_recipes', {
                weapon_id: weaponSelect.value,
                category_id: categorySelect.value,
                quantity_needed: Number(qtyInput.value),
            });
            refreshRecipeList();
        } }, '+ Ajouter un matériau');

        recipeList.append(table, el('div', { class: 'field-row', style: 'margin-top:10px;' }, [categorySelect, qtyInput, addBtn]));
    }

    weaponSelect.addEventListener('change', refreshRecipeList);
}
