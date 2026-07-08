/**
 * notificationsService.js
 * Charge les notifications (via v_my_notifications), les marque comme lues,
 * et s'abonne en temps réel aux nouvelles notifications (Supabase Realtime)
 * pour déclencher un toast + le point rouge sur la cloche de la barre des tâches.
 */
import { supabase } from './supabaseClient.js';

export async function fetchNotifications() {
    const { data, error } = await supabase
        .from('v_my_notifications')
        .select('*')
        .limit(50);
    if (error) console.error('Erreur fetchNotifications :', error);
    return data || [];
}

export async function markAsRead(id) {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
}

export async function markAllAsRead() {
    const notifs = await fetchNotifications();
    const unreadIds = notifs.filter((n) => !n.is_read).map((n) => n.id);
    if (unreadIds.length) {
        await supabase.from('notifications').update({ is_read: true }).in('id', unreadIds);
    }
}

/**
 * S'abonne aux nouvelles lignes de la table notifications.
 * @param {(payload: object) => void} onNewNotification
 * @returns {() => void} fonction de désabonnement
 */
export function subscribeToNotifications(onNewNotification) {
    const channel = supabase
        .channel('realtime-notifications')
        .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'notifications' },
            (payload) => onNewNotification(payload.new)
        )
        .subscribe();

    return () => supabase.removeChannel(channel);
}
