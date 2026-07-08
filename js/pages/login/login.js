/**
 * login.js
 * Écran de connexion façon Windows : grand avatar, nom du membre, mot de
 * passe. L'avatar et le nom se mettent à jour en direct pendant la saisie
 * (aperçu non sensible via get_login_preview), la connexion réelle passe
 * par authService.login().
 */
import { el, qs, debounce } from '../../utils/dom.js';
import { login, fetchLoginPreview } from '../../services/authService.js';

export function buildLoginScreen(wallpaperUrl) {
    const screen = el('div', {
        id: 'login-screen',
        style: wallpaperUrl ? `background-image:url('${wallpaperUrl}')` : '',
    });

    const clock = el('div', { class: 'login-clock' }, [
        el('div', { class: 'time' }, '--:--'),
        el('div', { class: 'date' }, ''),
    ]);
    updateClock(clock);
    setInterval(() => updateClock(clock), 1000 * 30);

    const avatar = el('div', { class: 'login-avatar' }, '👤');
    const nameLabel = el('div', { class: 'login-name' }, 'LOST MC');
    const usernameInput = el('input', { type: 'text', placeholder: 'Identifiant', autocomplete: 'username' });
    const passwordInput = el('input', { type: 'password', placeholder: 'Mot de passe', autocomplete: 'current-password' });
    const errorEl = el('div', { class: 'login-error' }, '');
    const submitBtn = el('button', { class: 'btn btn-primary', type: 'submit' }, 'Connexion');

    const form = el('form', { class: 'login-form' }, [usernameInput, passwordInput, submitBtn]);

    const card = el('div', { class: 'login-card' }, [
        avatar,
        nameLabel,
        form,
        errorEl,
        el('div', { class: 'login-hint' }, 'Utilisez votre identifiant et mot de passe LOST MC.'),
    ]);

    screen.append(clock, card, el('div', { class: 'login-club-name' }, 'L O S T   M C'));

    const updatePreview = debounce(async () => {
        const preview = await fetchLoginPreview(usernameInput.value.trim());
        if (preview) {
            nameLabel.textContent = preview.rp_name;
            avatar.textContent = '';
            avatar.style.backgroundImage = preview.avatar_url ? `url('${preview.avatar_url}')` : '';
            if (!preview.avatar_url) avatar.textContent = preview.rp_name.charAt(0).toUpperCase();
        } else {
            nameLabel.textContent = 'LOST MC';
            avatar.textContent = '👤';
            avatar.style.backgroundImage = '';
        }
    }, 400);

    usernameInput.addEventListener('input', updatePreview);

    let onLoginSuccess = () => {};
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        errorEl.textContent = '';
        submitBtn.textContent = 'Connexion...';
        submitBtn.disabled = true;

        const result = await login(usernameInput.value.trim(), passwordInput.value);

        submitBtn.textContent = 'Connexion';
        submitBtn.disabled = false;

        if (!result.success) {
            errorEl.textContent = result.error;
            screen.querySelector('.login-card').classList.add('boot-flicker');
            return;
        }
        onLoginSuccess(result.member);
    });

    return {
        el: screen,
        show: () => requestAnimationFrame(() => screen.classList.add('visible')),
        onSuccess: (cb) => { onLoginSuccess = cb; },
        focusUsername: () => usernameInput.focus(),
    };
}

function updateClock(clockEl) {
    const now = new Date();
    clockEl.querySelector('.time').textContent = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    clockEl.querySelector('.date').textContent = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}
