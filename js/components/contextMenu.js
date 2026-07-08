/**
 * contextMenu.js
 * Menu contextuel générique (clic droit) : bureau, lignes de tableau, icônes.
 */
import { el } from '../utils/dom.js';

let currentMenu = null;

/**
 * @param {MouseEvent} event
 * @param {Array<{label: string, icon?: string, danger?: boolean, onClick?: function, separator?: boolean}>} items
 */
export function showContextMenu(event, items) {
    event.preventDefault();
    closeContextMenu();

    const menu = el('div', {
        class: 'context-menu',
        style: `left:${event.clientX}px; top:${event.clientY}px;`,
    }, items.map((item) => {
        if (item.separator) return el('div', { class: 'context-menu-sep' });
        return el('div', {
            class: `context-menu-item${item.danger ? ' danger' : ''}`,
            onclick: () => { item.onClick?.(); closeContextMenu(); },
        }, [item.icon ? el('span', {}, item.icon) : null, el('span', {}, item.label)]);
    }));

    document.body.appendChild(menu);
    currentMenu = menu;

    setTimeout(() => document.addEventListener('click', closeContextMenu, { once: true }), 0);
}

export function closeContextMenu() {
    currentMenu?.remove();
    currentMenu = null;
}
