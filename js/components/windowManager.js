/**
 * windowManager.js
 * Gère le cycle de vie de toutes les fenêtres applicatives : création,
 * drag & drop, redimensionnement, minimisation, fermeture, gestion du focus
 * et synchronisation avec la barre des tâches.
 */
import { el, qs } from '../utils/dom.js';

let zCounter = 10;
const openWindows = new Map(); // id -> { el, appKey, title }
const desktopEl = () => qs('#desktop');
const taskbarWindowsEl = () => qs('#taskbar-open-windows');

let onWindowsChanged = () => {};
export function onWindowListChange(cb) { onWindowsChanged = cb; }

function notifyChange() {
    onWindowsChanged(Array.from(openWindows.values()));
}

/**
 * Ouvre une nouvelle fenêtre (ou remet le focus si déjà ouverte pour appKey).
 * @param {object} opts { appKey, title, icon, content: HTMLElement, width, height }
 */
export function openWindow(opts) {
    const existingId = [...openWindows.entries()].find(([, w]) => w.appKey === opts.appKey)?.[0];
    if (existingId) {
        restoreWindow(existingId);
        focusWindow(existingId);
        return existingId;
    }

    const id = `win-${opts.appKey}-${Date.now()}`;
    const width = opts.width || 760;
    const height = opts.height || 520;
    const offset = (openWindows.size % 6) * 24;

    const body = el('div', { class: opts.bodyClass ? `window-body ${opts.bodyClass}` : 'window-body' }, [opts.content]);

    const windowEl = el('div', {
        class: 'window',
        style: `width:${width}px; height:${height}px; left:${120 + offset}px; top:${70 + offset}px;`,
        'data-window-id': id,
    }, [
        el('div', { class: 'window-titlebar' }, [
            el('span', { class: 'window-icon' }, opts.icon || '🗔'),
            el('span', { class: 'window-title' }, opts.title),
            el('div', { class: 'window-controls' }, [
                el('button', { class: 'btn-minimize', title: 'Réduire', onclick: () => minimizeWindow(id) }, '—'),
                el('button', { class: 'btn-close', title: 'Fermer', onclick: () => closeWindow(id) }, '✕'),
            ]),
        ]),
        body,
        el('div', { class: 'window-resize-handle' }),
    ]);

    desktopEl().appendChild(windowEl);
    makeDraggable(windowEl);
    makeResizable(windowEl);
    windowEl.addEventListener('mousedown', () => focusWindow(id));

    openWindows.set(id, { el: windowEl, appKey: opts.appKey, title: opts.title, icon: opts.icon });
    focusWindow(id);
    notifyChange();
    return id;
}

export function focusWindow(id) {
    const w = openWindows.get(id);
    if (!w) return;
    qs('.window.focused')?.classList.remove('focused');
    w.el.style.zIndex = ++zCounter;
    w.el.classList.add('focused');
    w.el.classList.remove('minimized');
    notifyChange();
}

export function minimizeWindow(id) {
    const w = openWindows.get(id);
    if (!w) return;
    w.el.classList.add('minimized');
    notifyChange();
}

export function restoreWindow(id) {
    const w = openWindows.get(id);
    if (!w) return;
    w.el.classList.remove('minimized');
    focusWindow(id);
}

export function closeWindow(id) {
    const w = openWindows.get(id);
    if (!w) return;
    w.el.classList.add('closing');
    setTimeout(() => {
        w.el.remove();
        openWindows.delete(id);
        notifyChange();
    }, 160);
}

export function getOpenWindows() {
    return Array.from(openWindows.entries()).map(([id, w]) => ({ id, ...w }));
}

/* ---------------------------------------------------------------- */
function makeDraggable(windowEl) {
    const titlebar = qs('.window-titlebar', windowEl);
    let startX, startY, startLeft, startTop, dragging = false;

    titlebar.addEventListener('mousedown', (e) => {
        if (e.target.closest('.window-controls')) return;
        dragging = true;
        startX = e.clientX; startY = e.clientY;
        startLeft = windowEl.offsetLeft; startTop = windowEl.offsetTop;
        document.body.style.userSelect = 'none';
    });

    window.addEventListener('mousemove', (e) => {
        if (!dragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        windowEl.style.left = `${Math.max(0, startLeft + dx)}px`;
        windowEl.style.top = `${Math.max(0, startTop + dy)}px`;
    });

    window.addEventListener('mouseup', () => {
        dragging = false;
        document.body.style.userSelect = '';
    });
}

function makeResizable(windowEl) {
    const handle = qs('.window-resize-handle', windowEl);
    let startX, startY, startW, startH, resizing = false;

    handle.addEventListener('mousedown', (e) => {
        resizing = true;
        startX = e.clientX; startY = e.clientY;
        startW = windowEl.offsetWidth; startH = windowEl.offsetHeight;
        e.stopPropagation();
    });

    window.addEventListener('mousemove', (e) => {
        if (!resizing) return;
        windowEl.style.width = `${Math.max(380, startW + (e.clientX - startX))}px`;
        windowEl.style.height = `${Math.max(260, startH + (e.clientY - startY))}px`;
    });

    window.addEventListener('mouseup', () => { resizing = false; });
}
