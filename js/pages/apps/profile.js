/**
 * profile.js - Application "Mon Profil" (commune à tous).
 * Affiche la fiche du membre connecté (grade, fonctions, date d'entrée...)
 * et permet d'éditer les champs non sensibles (avatar, téléphone, discord)
 * grâce à la policy members_update_self (voir 12_dashboard_profile_modules.sql).
 */
import { el } from '../../utils/dom.js';
import { supabase } from '../../services/supabaseClient.js';
import { listRecords, updateRecord } from '../../services/dataService.js';
import { formatDate, formatDateTime } from '../../utils/format.js';

export async function mountProfileApp(container) {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase.from('v_members_full').select('*').eq('id', user.id).single();
    const { data: history } = await listRecords('member_history', {
        filters: { member_id: user.id },
        orderBy: { column: 'created_at', ascending: false },
    });

    container.innerHTML = '';

    const avatarInput = el('input', { type: 'text', value: profile.avatar_url || '', placeholder: 'URL de la photo' });
    const phoneInput = el('input', { type: 'text', value: profile.phone || '', placeholder: 'Téléphone' });
    const discordInput = el('input', { type: 'text', value: profile.discord || '', placeholder: 'Discord' });
    const msg = el('div', { class: 'login-error' });

    const saveBtn = el('button', { class: 'btn btn-primary', onclick: async () => {
        const { error } = await updateRecord('members', user.id, {
            avatar_url: avatarInput.value || null,
            phone: phoneInput.value || null,
            discord: discordInput.value || null,
        });
        msg.textContent = error ? 'Erreur lors de la sauvegarde.' : 'Profil mis à jour.';
        msg.style.color = error ? '' : '#6fcf73';
    } }, 'Enregistrer');

    const header = el('div', { style: 'display:flex; gap:20px; align-items:center; margin-bottom:20px;' }, [
        el('div', { class: 'login-avatar', style: profile.avatar_url ? `background-image:url('${profile.avatar_url}')` : '' }),
        el('div', {}, [
            el('h2', {}, profile.rp_name),
            el('div', { style: 'color:var(--color-text-dim);' }, `${profile.grade_name || 'Sans grade'}${profile.function_names ? ' • ' + profile.function_names : ''}`),
            el('div', { class: 'badge' }, profile.matricule),
        ]),
    ]);

    const infoGrid = el('div', { class: 'app-stats-row' }, [
        el('div', { class: 'stat-card' }, [el('div', { class: 'stat-label' }, "Date d'entrée"), el('div', { class: 'stat-value' }, formatDate(profile.entry_date))]),
        el('div', { class: 'stat-card' }, [el('div', { class: 'stat-label' }, 'Chapter'), el('div', { class: 'stat-value' }, profile.chapter_name || '—')]),
        el('div', { class: 'stat-card' }, [el('div', { class: 'stat-label' }, 'Statut'), el('div', { class: 'stat-value' }, profile.status)]),
    ]);

    const editForm = el('div', { style: 'margin-top:20px;' }, [
        el('h4', {}, 'Modifier mes informations'),
        el('form', { class: 'app-form', onsubmit: (e) => e.preventDefault() }, [
            el('div', { class: 'field-row' }, [
                el('div', { class: 'field' }, [el('label', {}, 'Photo (URL)'), avatarInput]),
                el('div', { class: 'field' }, [el('label', {}, 'Téléphone'), phoneInput]),
                el('div', { class: 'field' }, [el('label', {}, 'Discord'), discordInput]),
            ]),
            msg,
            el('div', { class: 'form-actions' }, [saveBtn]),
        ]),
    ]);

    const historySection = el('div', { style: 'margin-top:20px;' }, [
        el('h4', {}, '📜 Mon historique'),
        history.length
            ? el('div', {}, history.map((h) => el('div', { style: 'padding:8px 0; border-bottom:1px solid var(--color-border); font-size:0.85rem;' }, [
                el('strong', {}, h.event_type), el('div', { style: 'color:var(--color-text-dim); font-size:0.78rem;' }, `${formatDateTime(h.created_at)}${h.comment ? ' — ' + h.comment : ''}`),
            ])))
            : el('div', { class: 'app-empty-state' }, 'Aucun historique pour le moment.'),
    ]);

    container.append(header, infoGrid, editForm, historySection);
}
