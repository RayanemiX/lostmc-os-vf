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
    const autoRefreshBtn = el('button', { id: 'auto-refresh-toggle' }, '🔄');
    const clock = el('div', { id: 'taskbar-clock' }, [el('div', { class: 'clock-time' }, '--:--'), el('div', { class: 'clock-date' }, '')]);

    const taskbar = el('div', { id: 'taskbar' }, [
        startButton,
        openWindowsBar,
        el('div', { id: 'taskbar-right' }, [notifBell, autoRefreshBtn, clock]),
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

    setupAutoRefresh(autoRefreshBtn);

    requestAnimationFrame(() => desktop.classList.add('visible'));

    return desktop;
}

// Applications externes : ne dépendent d'aucune permission Supabase, toujours visibles,
// ouvrent le site externe de gestion Bar/Mécano dans une fenêtre intégrée au bureau (iframe).
const EXTERNAL_APPS = [
    { key: 'bar', label: 'Bar', icon: '🍺', url: 'https://hannibalgta.github.io/MCLOSTBARMECANO/' },
    { key: 'mecano', label: 'Atelier Mécanique', icon: '🔧', url: 'https://hannibalgta.github.io/MCLOSTBARMECANO/' },
];

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

    EXTERNAL_APPS.forEach((app) => {
        const icon = el('div', { class: 'desktop-icon external' }, [
            el('div', { class: 'icon-glyph' }, app.icon),
            el('div', { class: 'icon-label' }, app.label),
        ]);
        icon.addEventListener('dblclick', () => openExternalApp(app));
        container.append(icon);
    });
}

function openExternalApp(app) {
    const iframe = el('iframe', {
        src: app.url,
        title: app.label,
        allow: 'clipboard-write; fullscreen',
    });
    const margin = 40;
    const width = Math.max(700, window.innerWidth - margin * 2);
    const height = Math.max(480, window.innerHeight - margin * 2 - 52); // 52 = hauteur barre des tâches
    WM.openWindow({
        appKey: `external-${app.key}`,
        title: app.label,
        icon: app.icon,
        content: iframe,
        bodyClass: 'no-padding',
        width,
        height,
        left: margin,
        top: margin,
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

/* ---------- Actualisation automatique ---------- */
const AUTO_REFRESH_ENABLED_KEY = 'lostmc_auto_refresh_enabled';
const AUTO_REFRESH_INTERVAL_KEY = 'lostmc_auto_refresh_interval_min';
const AUTO_REFRESH_DEFAULT_MIN = 5;
let autoRefreshTimer = null;

function getAutoRefreshInterval() {
    return parseInt(localStorage.getItem(AUTO_REFRESH_INTERVAL_KEY), 10) || AUTO_REFRESH_DEFAULT_MIN;
}

function setupAutoRefresh(button) {
    const enabled = localStorage.getItem(AUTO_REFRESH_ENABLED_KEY) === '1';
    applyAutoRefreshState(button, enabled, getAutoRefreshInterval());

    button.addEventListener('click', () => {
        const nowEnabled = localStorage.getItem(AUTO_REFRESH_ENABLED_KEY) !== '1';
        localStorage.setItem(AUTO_REFRESH_ENABLED_KEY, nowEnabled ? '1' : '0');
        const intervalMin = getAutoRefreshInterval();
        applyAutoRefreshState(button, nowEnabled, intervalMin);
        showToast({
            title: 'Actualisation automatique',
            message: nowEnabled ? `Activée (toutes les ${intervalMin} min)` : 'Désactivée',
        });
    });

    button.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const current = getAutoRefreshInterval();
        const isEnabled = localStorage.getItem(AUTO_REFRESH_ENABLED_KEY) === '1';
        const options = [1, 2, 5, 10, 15].map((min) => ({
            label: `Toutes les ${min} min${isEnabled && min === current ? ' ✓' : ''}`,
            icon: '⏱️',
            onClick: () => {
                localStorage.setItem(AUTO_REFRESH_INTERVAL_KEY, String(min));
                localStorage.setItem(AUTO_REFRESH_ENABLED_KEY, '1');
                applyAutoRefreshState(button, true, min);
                showToast({ title: 'Actualisation automatique', message: `Activée (toutes les ${min} min)` });
            },
        }));
        options.push({
            label: 'Désactiver',
            icon: '⏹️',
            onClick: () => {
                localStorage.setItem(AUTO_REFRESH_ENABLED_KEY, '0');
                applyAutoRefreshState(button, false, current);
                showToast({ title: 'Actualisation automatique', message: 'Désactivée' });
            },
        });
        showContextMenu(e, options);
    });
}

function applyAutoRefreshState(button, enabled, intervalMin) {
    button.classList.toggle('active', enabled);
    button.title = enabled
        ? `Actualisation automatique activée (toutes les ${intervalMin} min) — clic droit pour changer l'intervalle`
        : "Actualisation automatique désactivée — clic pour activer, clic droit pour choisir un intervalle";
    if (autoRefreshTimer) {
        clearInterval(autoRefreshTimer);
        autoRefreshTimer = null;
    }
    if (enabled) {
        autoRefreshTimer = setInterval(() => location.reload(), intervalMin * 60 * 1000);
    }
}
