/**
 * trainings.js - Application "Formations" (accessible à tous les membres connectés).
 */
import { el } from '../../utils/dom.js';
import { listRecords, createRecord } from '../../services/dataService.js';
import { renderCrudApp } from './crudEngine.js';
import { can } from '../../services/permissionsService.js';
import { formatDate } from '../../utils/format.js';

export async function mountTrainingsApp(container) {
    const listContainer = el('div');
    const attendanceContainer = el('div', { style: 'margin-top:24px; padding-top:16px; border-top:1px solid var(--color-border);' });
    container.append(listContainer, attendanceContainer);

    const { data: members } = await listRecords('v_members_full', { orderBy: { column: 'rp_name', ascending: true } });

    renderCrudApp(listContainer, {
        moduleKey: 'trainings',
        table: 'v_trainings_full',
        baseTable: 'trainings',
        titleField: 'title',
        searchColumns: ['title', 'location'],
        orderBy: { column: 'training_date', ascending: false },
        emptyLabel: 'Aucune formation planifiée.',
        columns: [
            { key: 'title', label: 'Titre' },
            { key: 'training_date', label: 'Date', render: (r) => formatDate(r.training_date) },
            { key: 'training_time', label: 'Heure', render: (r) => r.training_time || '—' },
            { key: 'location', label: 'Lieu' },
            { key: 'responsible_name', label: 'Responsable' },
            { key: 'present_count', label: 'Présents' },
            { key: 'absent_count', label: 'Absents' },
        ],
        fields: [
            { key: 'title', label: 'Titre', required: true },
            { key: 'training_date', label: 'Date', type: 'date', required: true },
            { key: 'training_time', label: 'Heure', type: 'time' },
            { key: 'location', label: 'Lieu' },
            { key: 'responsible_id', label: 'Responsable', type: 'select', options: members.map((m) => ({ value: m.id, label: m.rp_name })) },
            { key: 'report', label: 'Compte rendu', type: 'textarea' },
        ],
    });

    if (can('trainings', 'edit')) {
        await renderAttendanceManager(attendanceContainer, members);
    }

    return container;
}

async function renderAttendanceManager(container, members) {
    const { data: trainings } = await listRecords('trainings', { orderBy: { column: 'training_date', ascending: false } });

    container.innerHTML = '';
    container.append(el('h4', {}, '✅ Présences'));

    const trainingSelect = el('select', {}, [
        el('option', { value: '' }, 'Choisir une formation'),
        ...trainings.map((t) => el('option', { value: t.id }, `${t.title} (${t.training_date})`)),
    ]);
    const attendanceList = el('div', { style: 'margin-top:12px;' });
    container.append(el('div', { class: 'field-row' }, [trainingSelect]), attendanceList);

    async function refresh() {
        attendanceList.innerHTML = '';
        if (!trainingSelect.value) return;

        const { data: existing } = await listRecords('training_attendance', { filters: { training_id: trainingSelect.value } });
        const attendanceMap = new Map(existing.map((a) => [a.member_id, a.present]));

        const rows = members.map((m) => {
            const checkbox = el('input', { type: 'checkbox' });
            checkbox.checked = !!attendanceMap.get(m.id);
            checkbox.addEventListener('change', async () => {
                await createRecord('training_attendance', {
                    training_id: trainingSelect.value,
                    member_id: m.id,
                    present: checkbox.checked,
                }).catch(() => {});
            });
            return el('div', { class: 'field-row', style: 'align-items:center;' }, [checkbox, el('span', {}, m.rp_name)]);
        });

        attendanceList.append(...rows);
    }

    trainingSelect.addEventListener('change', refresh);
}
