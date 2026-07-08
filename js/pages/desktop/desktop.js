/**
 * desktop.js
 * Construit le bureau une fois le membre connecté : icônes des applications
 * autorisées, barre des tâches (horloge, notifications, fenêtres ouvertes),
 * menu démarrer. Toute la liste d'applications visible dépend uniquement
 * des permissions chargées depuis Supabase (aucun menu figé dans le code).
 */
import { el, qs } from '../../utils/dom.js';
import { getVisibleModules } from '../../services/permissionsService.js';
import { logout } from '../../services/authService.js';
import { fetchNotifications, markAllAsRead, subscribeToNotifications } from '../../services/notificationsService.js';
import { showToast } from '../../components/toast.js';
import { showContextMenu } from '../../components/contextMenu.js';
import { timeAgo } from '../../utils/format.js';
import * as WM from '../../components/windowManager.js';
import { APP_REGISTRY } from '../apps/appRegistry.js';

export function buildDesktop({ wallpaperUrl, clubName, memberProfile }) {
    const desktop = el('div', { id: 'desktop', style: wallpaperUrl ? `background-image:url('${wallpaperUrl}')` : '' });

    const icons = el('div', { id: 'desktop-icons' });
    desktop.append(icons);

    const startButton = el('button', { id: 'start-button' }, [el('span', {}, '🦅'), el('span', {}, clubName || 'LOST MC')]);
    const openWindowsBar = el('div', { id: 'taskbar-open-windows' });
    const notifBell = el('button', { id: 'notif-bell' }, '🔔');
    const clock = el('div', { id: 'taskbar-clock' }, [el('div', { class: 'clock-time' }, '--:--'), el('div', { class: 'clock-date' }, '')]);

    const taskbar = el('div', { id: 'taskbar' }, [
        startButton,
        openWindowsBar,
        el('div', { id: 'taskbar-right' }, [notifBell, clock]),
    ]);

    const startMenu = buildStartMenu(memberProfile);
    const notifPanel = el('div', { id: 'notif-panel' });

    document.body.append(desktop, taskbar, startMenu, notifPanel);

    populateIcons(icons, memberProfile);
    updateClock(clock);
    setInterval(() => updateClock(clock), 1000 * 30);

    startButton.addEventListener('click', () => {
        startMenu.classList.toggle('open');
        startButton.classList.toggle('active');
        notifPanel.classList.remove('open');
    });

    notifBell.addEventListener('click', async () => {
        notifPanel.classList.toggle('open');
        startMenu.classList.remove('open');
        if (notifPanel.classList.contains('open')) {
            await renderNotifPanel(notifPanel, notifBell);
        }
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('#start-menu') && !e.target.closest('#start-button')) {
            startMenu.classList.remove('open');
            startButton.classList.remove('active');
        }
        if (!e.target.closest('#notif-panel') && !e.target.closest('#notif-bell')) {
            notifPanel.classList.remove('open');
        }
    });

    desktop.addEventListener('contextmenu', (e) => {
        if (e.target !== desktop) return;
        showContextMenu(e, [
            { label: 'Actualiser', icon: '🔄', onClick: () => location.reload() },
        ]);
    });

    WM.onWindowListChange((windows) => renderTaskbarWindows(openWindowsBar, windows));

    refreshNotifBadge(notifBell);
    subscribeToNotifications((notif) => {
        showToast({ title: notif.title, message: notif.message });
        refreshNotifBadge(notifBell);
    });

    requestAnimationFrame(() => desktop.classList.add('visible'));

    return desktop;
}

function populateIcons(container, memberProfile) {
    const modules = getVisibleModules();
    container.innerHTML = '';
    modules.forEach((mod) => {
        const icon = el('div', { class: 'desktop-icon' }, [
            el('div', { class: 'icon-glyph' }, mod.icon || '🗔'),
            el('div', { class: 'icon-label' }, mod.label),
        ]);
        icon.addEventListener('dblclick', () => openApp(mod, memberProfile));
        container.append(icon);
    });
}

export function openApp(mod, memberProfile) {
    const appDef = APP_REGISTRY[mod.key];
    if (!appDef) return;

    const content = el('div', { class: 'app-container' });
    WM.openWindow({
        appKey: mod.key,
        title: mod.label,
        icon: mod.icon,
        content,
        width: appDef.width,
        height: appDef.height,
    });
    appDef.mount(content, memberProfile);
}

function buildStartMenu(memberProfile) {
    const modules = getVisibleModules();

    const header = el('div', { class: 'start-header' }, [
        el('div', { class: 'start-avatar', style: memberProfile?.avatar_url ? `background-image:url('${memberProfile.avatar_url}')` : '' }),
        el('div', {}, [
            el('div', {}, memberProfile?.rp_name || 'Membre'),
            el('div', { class: 'start-grade' }, memberProfile?.grade_name || 'Sans grade'),
        ]),
    ]);

    const appsList = el('div', { class: 'start-menu-apps' }, modules.map((mod) =>
        el('div', { class: 'start-menu-app', onclick: () => openApp(mod, memberProfile) }, [
            el('span', {}, mod.icon || '🗔'), el('span', {}, mod.label),
        ])
    ));

    const footer = el('div', { class: 'start-menu-footer' }, [
        el('span', { style: 'font-size:0.75rem; color:var(--color-text-dim);' }, `Matricule ${memberProfile?.matricule || '—'}`),
        el('button', { class: 'btn btn-ghost', onclick: async () => { await logout(); location.reload(); } }, '⏻ Déconnexion'),
    ]);

    return el('div', { id: 'start-menu' }, [header, appsList, footer]);
}

async function renderNotifPanel(panel, bell) {
    const notifs = await fetchNotifications();
    panel.innerHTML = '';

    if (!notifs.length) {
        panel.append(el('div', { class: 'notif-empty' }, 'Aucune notification.'));
        return;
    }

    panel.append(...notifs.map((n) => el('div', { class: 'notif-item' }, [
        el('div', { class: 'notif-title' }, n.title),
        el('div', { class: 'notif-message' }, n.message || ''),
        el('div', { class: 'notif-time' }, timeAgo(n.created_at)),
    ])));

    await markAllAsRead();
    refreshNotifBadge(bell);
}

async function refreshNotifBadge(bell) {
    const notifs = await fetchNotifications();
    const hasUnread = notifs.some((n) => !n.is_read);
    bell.querySelector('.notif-dot')?.remove();
    if (hasUnread) bell.append(el('span', { class: 'notif-dot' }));
}

function renderTaskbarWindows(container, windows) {
    container.innerHTML = '';
    windows.forEach((w) => {
        const item = el('div', { class: `taskbar-item${w.el.classList.contains('focused') ? ' focused' : ''}` }, [
            el('span', {}, w.icon || '🗔'), el('span', {}, w.title),
        ]);
        item.addEventListener('click', () => {
            if (w.el.classList.contains('minimized')) WM.restoreWindow(w.id);
            else WM.focusWindow(w.id);
        });
        container.append(item);
    });
}

function updateClock(clockEl) {
    const now = new Date();
    clockEl.querySelector('.clock-time').textContent = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    clockEl.querySelector('.clock-date').textContent = now.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
