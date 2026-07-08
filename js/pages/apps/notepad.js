/**
 * notepad.js - Application "Bloc-notes" (commune, mais 100% privée : chaque
 * membre ne voit que ses propres notes, imposé par la RLS côté Supabase,
 * pas seulement par l'interface).
 */
import { el } from '../../utils/dom.js';
import { renderCrudApp } from './crudEngine.js';
import { formatDateTime } from '../../utils/format.js';

export async function mountNotepadApp(container, memberProfile) {
    renderCrudApp(container, {
        moduleKey: 'notepad',
        bypassPermissionCheck: true,
        table: 'personal_notes',
        titleField: 'title',
        searchColumns: ['title', 'content'],
        orderBy: { column: 'updated_at', ascending: false },
        emptyLabel: 'Aucune note pour le moment. Ajoutez-en une avec "+ Ajouter".',
        columns: [
            { key: 'title', label: 'Titre' },
            { key: 'content', label: 'Aperçu', render: (r) => (r.content || '').slice(0, 80) + ((r.content || '').length > 80 ? '…' : '') },
            { key: 'updated_at', label: 'Modifiée le', render: (r) => formatDateTime(r.updated_at) },
        ],
        fields: [
            { key: 'title', label: 'Titre', required: true },
            { key: 'content', label: 'Contenu', type: 'textarea' },
        ],
        beforeSave: () => ({ member_id: memberProfile?.id || null }),
    });

    return container;
}
