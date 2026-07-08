/**
 * planning.js - Application "Planning"
 * V1 : vue calendrier mensuelle (aperçu visuel) + liste complète des
 * événements avec CRUD (création, modification, suppression) via le moteur
 * générique. Les vues Semaine/Jour et le glisser-déposer entre jours sont
 * de bons candidats pour une itération suivante (la structure de données
 * planning_events le permet déjà : starts_at / ends_at en timestamptz).
 */
import { el } from '../../utils/dom.js';
import { listRecords } from '../../services/dataService.js';
import { renderCrudApp } from './crudEngine.js';
import { formatDateTime } from '../../utils/format.js';

export async function mountPlanningApp(container) {
    const calendarContainer = el('div');
    const listContainer = el('div', { style: 'margin-top:24px; padding-top:16px; border-top:1px solid var(--color-border);' });
    container.append(calendarContainer, listContainer);

    const { data: eventTypes } = await listRecords('event_types');
    const typeColor = (key) => eventTypes.find((t) => t.key === key)?.color || '#8a0303';
    const typeLabel = (key) => eventTypes.find((t) => t.key === key)?.label || key;

    let currentMonth = new Date();
    currentMonth.setDate(1);

    async function renderCalendar() {
        calendarContainer.innerHTML = '';

        const monthStart = new Date(currentMonth);
        const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);

        const { data: events } = await listRecords('planning_events', {
            orderBy: { column: 'starts_at', ascending: true },
        });
        const monthEvents = events.filter((e) => {
            const d = new Date(e.starts_at);
            return d >= monthStart && d <= monthEnd;
        });

        const header = el('div', { class: 'app-toolbar' }, [
            el('button', { class: 'btn btn-ghost', onclick: () => { currentMonth.setMonth(currentMonth.getMonth() - 1); renderCalendar(); } }, '←'),
            el('h3', { style: 'flex:1; text-align:center; margin:0;' }, currentMonth.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })),
            el('button', { class: 'btn btn-ghost', onclick: () => { currentMonth.setMonth(currentMonth.getMonth() + 1); renderCalendar(); } }, '→'),
        ]);

        const firstWeekday = (monthStart.getDay() + 6) % 7; // lundi = 0
        const daysInMonth = monthEnd.getDate();

        const grid = el('div', { style: 'display:grid; grid-template-columns:repeat(7,1fr); gap:6px;' });
        ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].forEach((d) =>
            grid.append(el('div', { style: 'text-align:center; font-size:0.75rem; color:var(--color-text-dim); padding-bottom:4px;' }, d))
        );
        for (let i = 0; i < firstWeekday; i++) grid.append(el('div', {}));

        for (let day = 1; day <= daysInMonth; day++) {
            const dayDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
            const dayEvents = monthEvents.filter((e) => new Date(e.starts_at).getDate() === day);

            grid.append(el('div', {
                style: 'min-height:70px; border:1px solid var(--color-border); border-radius:6px; padding:6px; font-size:0.75rem;',
            }, [
                el('div', {}, String(day)),
                ...dayEvents.slice(0, 3).map((e) => el('div', {
                    title: e.title,
                    style: `background:${typeColor(e.event_type)}; color:#fff; border-radius:3px; padding:1px 4px; margin-top:3px; font-size:0.68rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;`,
                }, e.title)),
            ]));
        }

        calendarContainer.append(header, grid);
    }

    await renderCalendar();

    renderCrudApp(listContainer, {
        moduleKey: 'planning',
        table: 'planning_events',
        titleField: 'title',
        searchColumns: ['title', 'location'],
        orderBy: { column: 'starts_at', ascending: true },
        emptyLabel: 'Aucun événement planifié.',
        filters: [
            { key: 'event_type', label: 'Tous les types', options: eventTypes.map((t) => ({ value: t.key, label: t.label })) },
        ],
        columns: [
            { key: 'title', label: 'Titre' },
            { key: 'event_type', label: 'Type', render: (r) => `<span class="badge" style="border-color:${typeColor(r.event_type)}">${typeLabel(r.event_type)}</span>` },
            { key: 'starts_at', label: 'Début', render: (r) => formatDateTime(r.starts_at) },
            { key: 'ends_at', label: 'Fin', render: (r) => (r.ends_at ? formatDateTime(r.ends_at) : '—') },
            { key: 'location', label: 'Lieu' },
        ],
        fields: [
            { key: 'title', label: 'Titre', required: true },
            { key: 'event_type', label: 'Type', type: 'select', required: true, options: eventTypes.map((t) => ({ value: t.key, label: t.label })) },
            { key: 'starts_at', label: 'Début', type: 'datetime-local', required: true },
            { key: 'ends_at', label: 'Fin', type: 'datetime-local' },
            { key: 'location', label: 'Lieu' },
            { key: 'description', label: 'Description', type: 'textarea' },
        ],
    });

    return container;
}
