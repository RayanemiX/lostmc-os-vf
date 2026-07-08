/**
 * toast.js - petites notifications éphémères en haut à droite de l'écran.
 */
import { el, qs } from '../utils/dom.js';

export function showToast({ title, message, duration = 5000 }) {
    let container = qs('#toast-container');
    if (!container) {
        container = el('div', { id: 'toast-container' });
        document.body.appendChild(container);
    }

    const toast = el('div', { class: 'toast' }, [
        el('div', { class: 'toast-title' }, title),
        el('div', { class: 'toast-message' }, message || ''),
    ]);

    container.appendChild(toast);
    setTimeout(() => toast.remove(), duration);
}
