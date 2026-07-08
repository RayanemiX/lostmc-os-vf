/**
 * crudEngine.js
 * Moteur générique qui rend une application "liste + recherche + filtres +
 * formulaire d'ajout/édition" à partir d'une simple configuration déclarative.
 * Toutes les applications (Membres, Trésorerie, Stock, Armurerie, Formations,
 * Planning, Relationnel) l'utilisent pour éviter de dupliquer la plomberie.
 */
import { el, qsa, debounce } from '../../utils/dom.js';
import { listRecords, createRecord, updateRecord, deleteRecord } from '../../services/dataService.js';
import { can } from '../../services/permissionsService.js';
import { showContextMenu } from '../../components/contextMenu.js';

/**
 * @param {HTMLElement} container
 * @param {object} config voir js/pages/apps/*.js pour des exemples concrets
 */
function canDo(config, action) {
    if (config.bypassPermissionCheck) return true;
    return can(config.moduleKey, action);
}

export function renderCrudApp(container, config) {
    const state = { data: [], searchTerm: '', filters: {}, editingId: null };

    const listView = el('div', { class: 'crud-list-view' });
    const formView = el('div', { class: 'crud-form-view hidden' });
    container.append(listView, formView);

    async function reload() {
        const { data } = await listRecords(config.table, {
            search: config.searchColumns ? { columns: config.searchColumns, term: state.searchTerm } : null,
            filters: state.filters,
            orderBy: config.orderBy,
        });
        state.data = data;
        renderList();
    }

    function renderList() {
        listView.innerHTML = '';
        listView.append(buildToolbar(), config.statsRenderer ? buildStats() : null, buildTable());
    }

    function buildToolbar() {
        const search = el('input', {
            class: 'search-input',
            type: 'text',
            placeholder: 'Rechercher...',
            oninput: debounce((e) => { state.searchTerm = e.target.value; reload(); }, 300),
        });

        const filterEls = (config.filters || []).map((f) => {
            const select = el('select', {
                onchange: (e) => { state.filters[f.key] = e.target.value; reload(); },
            }, [
                el('option', { value: '' }, f.label),
                ...f.options.map((o) => el('option', { value: o.value }, o.label)),
            ]);
            return select;
        });

        const addBtn = canDo(config, 'create')
            ? el('button', { class: 'btn btn-primary', onclick: () => openForm(null) }, '+ Ajouter')
            : null;

        return el('div', { class: 'app-toolbar' }, config.searchColumns ? [search, ...filterEls, addBtn] : [...filterEls, addBtn]);
    }

    function buildStats() {
        return el('div', { class: 'app-stats-row' }, config.statsRenderer(state.data));
    }

    function buildTable() {
        if (!state.data.length) {
            return el('div', { class: 'app-empty-state' }, config.emptyLabel || 'Aucune donnée pour le moment.');
        }

        const canEdit = canDo(config, 'edit');
        const canDelete = canDo(config, 'delete');

        const thead = el('thead', {}, [
            el('tr', {}, [...config.columns.map((c) => el('th', {}, c.label)), (canEdit || canDelete) ? el('th', {}) : null]),
        ]);

        const tbody = el('tbody', {}, state.data.map((row) => {
            const cells = config.columns.map((c) => el('td', { html: c.render ? c.render(row) : (row[c.key] ?? '—') }));
            const actions = (canEdit || canDelete) ? el('td', { class: 'row-actions' }, [
                canEdit ? el('button', { title: 'Modifier', onclick: () => openForm(row) }, '✏️') : null,
                canDelete ? el('button', { title: 'Supprimer', onclick: () => confirmDelete(row) }, '🗑️') : null,
            ]) : null;

            const tr = el('tr', {
                oncontextmenu: (e) => showContextMenu(e, [
                    canEdit ? { label: 'Modifier', icon: '✏️', onClick: () => openForm(row) } : null,
                    canDelete ? { label: 'Supprimer', icon: '🗑️', danger: true, onClick: () => confirmDelete(row) } : null,
                ].filter(Boolean)),
            }, [...cells, actions]);
            return tr;
        }));

        return el('table', { class: 'app-table' }, [thead, tbody]);
    }

    async function confirmDelete(row) {
        if (!confirm(`Supprimer "${row[config.titleField] || 'cet élément'}" ? Cette action est irréversible.`)) return;
        await deleteRecord(config.baseTable || config.table, row[config.idField || 'id']);
        reload();
    }

    function openForm(record) {
        state.editingId = record ? record[config.idField || 'id'] : null;
        listView.classList.add('hidden');
        formView.classList.remove('hidden');
        formView.innerHTML = '';
        formView.append(buildForm(record));
    }

    function closeForm() {
        formView.classList.add('hidden');
        listView.classList.remove('hidden');
        reload();
    }

    function buildForm(record) {
        const values = { ...(config.defaultValues || {}), ...(record || {}) };
        const inputs = {};

        const fieldRows = config.fields.map((f) => {
            let input;
            if (f.type === 'select') {
                input = el('select', { required: f.required }, [
                    el('option', { value: '' }, '—'),
                    ...f.options.map((o) => el('option', { value: o.value }, o.label)),
                ]);
                // On fixe la valeur via la propriété JS (fiable) plutôt que
                // via l'attribut HTML "selected" par option (qui posait un
                // bug d'affichage : le dernier <option selected="false">
                // du DOM l'emportait toujours visuellement).
                input.value = values[f.key] ?? '';
            } else if (f.type === 'textarea') {
                input = el('textarea', { rows: 3, required: f.required }, values[f.key] || '');
            } else {
                input = el('input', {
                    type: f.type || 'text',
                    required: f.required,
                    step: f.type === 'number' ? 'any' : undefined,
                    value: values[f.key] ?? '',
                });
            }
            inputs[f.key] = input;
            return el('div', { class: 'field' }, [el('label', {}, f.label), input]);
        });

        const form = el('form', { class: 'app-form' }, [
            el('div', { class: 'field-row' }, fieldRows),
            el('div', { class: 'form-actions' }, [
                el('button', { type: 'button', class: 'btn btn-ghost', onclick: closeForm }, 'Annuler'),
                el('button', { type: 'submit', class: 'btn btn-primary' }, record ? 'Enregistrer' : 'Créer'),
            ]),
        ]);

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const payload = {};
            for (const f of config.fields) {
                let val = inputs[f.key].value;
                if (f.type === 'number') val = val === '' ? null : Number(val);
                payload[f.key] = val === '' ? null : val;
            }
            if (config.beforeSave) Object.assign(payload, config.beforeSave(payload, record));

            if (record) {
                await updateRecord(config.baseTable || config.table, record[config.idField || 'id'], payload);
            } else {
                await createRecord(config.baseTable || config.table, payload);
            }
            closeForm();
        });

        return form;
    }

    reload();
    return { reload };
}
