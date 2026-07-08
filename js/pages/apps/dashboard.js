/**
 * dashboard.js - Application "Tableau de bord" (commune à tous les membres).
 * Vue d'ensemble : nombre de membres, argent du club, alertes de stock,
 * évènements à venir, dernières notifications.
 */
import { el } from '../../utils/dom.js';
import { listRecords, callRpc } from '../../services/dataService.js';
import { fetchNotifications } from '../../services/notificationsService.js';
import { can } from '../../services/permissionsService.js';
import { formatAmount, formatDateTime, timeAgo } from '../../utils/format.js';

export async function mountDashboardApp(container) {
    container.innerHTML = '';
    container.append(el('div', { class: 'app-empty-state', id: 'dash-loading' }, 'Chargement du tableau de bord...'));

    const [membersRes, balanceRes, stockRes, eventsRes, notifsRes] = await Promise.all([
        can('members', 'view') ? listRecords('members') : Promise.resolve({ data: [] }),
        can('treasury', 'view') ? callRpc('get_treasury_balance') : Promise.resolve({ data: null }),
        can('stock', 'view') ? listRecords('v_stock_overview') : Promise.resolve({ data: [] }),
        listRecords('planning_events', { orderBy: { column: 'starts_at', ascending: true } }),
        fetchNotifications(),
    ]);

    const activeMembers = (membersRes.data || []).filter((m) => m.status === 'actif').length;
    const lowStockCount = (stockRes.data || []).filter((s) => s.is_low).length;
    const upcomingEvents = (eventsRes.data || []).filter((e) => new Date(e.starts_at) >= new Date()).slice(0, 5);

    container.innerHTML = '';

    const stats = el('div', { class: 'app-stats-row' }, [
        el('div', { class: 'stat-card' }, [el('div', { class: 'stat-label' }, 'Membres actifs'), el('div', { class: 'stat-value' }, String(activeMembers))]),
        can('treasury', 'view') ? el('div', { class: 'stat-card' }, [el('div', { class: 'stat-label' }, 'Argent du club'), el('div', { class: 'stat-value' }, formatAmount(balanceRes.data))]) : null,
        can('stock', 'view') ? el('div', { class: `stat-card${lowStockCount ? ' danger' : ''}` }, [el('div', { class: 'stat-label' }, 'Alertes stock'), el('div', { class: 'stat-value' }, String(lowStockCount))]) : null,
        el('div', { class: 'stat-card' }, [el('div', { class: 'stat-label' }, 'Évènements à venir'), el('div', { class: 'stat-value' }, String(upcomingEvents.length))]),
    ].filter(Boolean));

    const columns = el('div', { style: 'display:flex; gap:20px; margin-top:20px; flex-wrap:wrap;' }, [
        el('div', { style: 'flex:1; min-width:280px;' }, [
            el('h4', {}, '📅 Prochains évènements'),
            upcomingEvents.length
                ? el('div', {}, upcomingEvents.map((e) => el('div', { style: 'padding:8px 0; border-bottom:1px solid var(--color-border);' }, [
                    el('strong', {}, e.title),
                    el('div', { style: 'font-size:0.78rem; color:var(--color-text-dim);' }, formatDateTime(e.starts_at)),
                ])))
                : el('div', { class: 'app-empty-state' }, 'Rien de prévu prochainement.'),
        ]),
        el('div', { style: 'flex:1; min-width:280px;' }, [
            el('h4', {}, '🔔 Dernières activités'),
            notifsRes.length
                ? el('div', {}, notifsRes.slice(0, 8).map((n) => el('div', { style: 'padding:8px 0; border-bottom:1px solid var(--color-border);' }, [
                    el('strong', {}, n.title),
                    el('div', { style: 'font-size:0.78rem; color:var(--color-text-dim);' }, `${n.message || ''} — ${timeAgo(n.created_at)}`),
                ])))
                : el('div', { class: 'app-empty-state' }, 'Aucune activité récente.'),
        ]),
    ]);

    container.append(stats, columns);
}
