/**
 * meetingReports.js - Application "Table" (comptes-rendus de réunion)
 * Une ligne = les remarques d'un membre pour une réunion donnée (date,
 * membre, grade figé au moment de la réunion, remarques).
 */
import { el } from '../../utils/dom.js';
import { listRecords } from '../../services/dataService.js';
import { renderCrudApp } from './crudEngine.js';
import { formatDate, formatDateTime } from '../../utils/format.js';

export async function mountMeetingReportsApp(container) {
    const { data: members } = await listRecords('v_members_full', { orderBy: { column: 'rp_name', ascending: true } });

    renderCrudApp(container, {
        moduleKey: 'meetings',
        table: 'v_meeting_reports_full',
        baseTable: 'meeting_reports',
        titleField: 'member_name',
        searchColumns: ['member_name', 'remarks'],
        orderBy: { column: 'meeting_date', ascending: false },
        emptyLabel: 'Aucun compte-rendu pour le moment. Ajoutez la première ligne avec "+ Ajouter".',
        columns: [
            { key: 'meeting_date', label: 'Réunion du', render: (r) => formatDate(r.meeting_date) },
            { key: 'member_name', label: 'Membre' },
            { key: 'grade_snapshot', label: 'Grade (à la date)' },
            { key: 'chapter_name', label: 'Chapter' },
            { key: 'remarks', label: 'Remarques' },
            { key: 'created_at', label: 'Ajouté le', render: (r) => formatDateTime(r.created_at) },
        ],
        fields: [
            { key: 'meeting_date', label: 'Date de la réunion', type: 'date', required: true },
            { key: 'member_id', label: 'Membre', type: 'select', required: true, options: members.map((m) => ({ value: m.id, label: m.rp_name })) },
            { key: 'remarks', label: 'Remarques', type: 'textarea' },
        ],
    });

    return container;
}
