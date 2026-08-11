import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pbijeyaujtguhltqdwbe.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBiaWpleWF1anRndWhsdHFkd2JlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0MzMwNjcsImV4cCI6MjEwMjAwOTA2N30.6a-fj7s9aLwmjRiNkXPXNR6hlPhFXyv3Piy-4-L6MVg';

export const supabaseBrowser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

let channel: any = null;

export function initRealtimeSubscriptions() {
  if (typeof window === 'undefined') return () => {};
  if (channel) return () => {};

  channel = supabaseBrowser
    .channel('crm-realtime-channel')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'tasks' },
      (payload) => {
        if (payload.eventType === 'INSERT') {
          window.dispatchEvent(new CustomEvent('app-task-created', { detail: payload.new }));
        } else if (payload.eventType === 'UPDATE') {
          window.dispatchEvent(new CustomEvent('app-task-updated', { detail: payload.new }));
        } else if (payload.eventType === 'DELETE') {
          window.dispatchEvent(new CustomEvent('app-task-deleted', { detail: payload.old }));
        }
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'reminders' },
      (payload) => {
        window.dispatchEvent(new CustomEvent('app-reminder-changed', { detail: payload }));
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'global_messages' },
      (payload) => {
        window.dispatchEvent(new CustomEvent('app-global-message', { detail: payload }));
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'client_messages' },
      (payload) => {
        window.dispatchEvent(new CustomEvent('app-client-message', { detail: payload }));
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'comments' },
      (payload) => {
        window.dispatchEvent(new CustomEvent('app-comment-changed', { detail: payload }));
      }
    )
    .subscribe();

  return () => {
    if (channel) {
      supabaseBrowser.removeChannel(channel);
      channel = null;
    }
  };
}
