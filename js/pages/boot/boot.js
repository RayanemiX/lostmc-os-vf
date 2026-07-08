/**
 * boot.js
 * Anime la séquence de démarrage façon PC : logo, lignes de boot, barre de
 * progression, puis transition vers l'écran de connexion.
 */
import { el, qs } from '../../utils/dom.js';

const BOOT_LINES = [
    'LOST MC BIOS v3.1',
    'Vérification du matériel du clubhouse...',
    'Chargement des modules sécurisés...',
    'Connexion au serveur Supabase...',
    'Bienvenue.',
];

export function runBootSequence(onComplete) {
    const bootScreen = qs('#boot-screen');
    const textEl = qs('.boot-text', bootScreen);
    const progressBar = qs('.boot-progress-bar', bootScreen);

    let i = 0;
    progressBar.style.width = '100%';

    const interval = setInterval(() => {
        textEl.textContent = BOOT_LINES[i];
        textEl.classList.remove('boot-flicker');
        void textEl.offsetWidth; // relance l'animation
        textEl.classList.add('boot-flicker');
        i++;
        if (i >= BOOT_LINES.length) {
            clearInterval(interval);
            setTimeout(() => {
                bootScreen.classList.add('fade-out');
                setTimeout(() => {
                    bootScreen.classList.add('hidden');
                    onComplete?.();
                }, 500);
            }, 500);
        }
    }, 550);
}

export function buildBootScreen(logoUrl) {
    return el('div', { id: 'boot-screen' }, [
        el('img', { class: 'boot-logo', src: logoUrl, alt: 'Lost MC' }),
        el('div', { class: 'boot-text' }, ''),
        el('div', { class: 'boot-progress' }, [el('div', { class: 'boot-progress-bar' })]),
    ]);
}
