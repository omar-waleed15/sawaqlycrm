'use client';

import { useEffect, useState, useRef, FormEvent, KeyboardEvent } from 'react';
import { useAuth } from '@/lib/auth';
import { useLanguage } from '@/lib/i18n';
import { chatApi } from '@/lib/api';
import { ChatMessage } from '@/types';
import { formatCairoDateTime } from '@/lib/dateUtils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Send, Clock, AlertCircle } from 'lucide-react';

function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function timeUntilExpiry(createdAt: string, t: any): string {
  const expiresAt = new Date(createdAt).getTime() + 24 * 60 * 60 * 1000;
  const now = Date.now();
  const diff = expiresAt - now;
  if (diff <= 0) return t('chat.expiring');
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) return t('chat.timeLeft', { hours, mins });
  return t('chat.minsLeft', { mins });
}

export default function GlobalChatPage() {
  const { user } = useAuth();
  const { t, locale, dir } = useLanguage();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [nowTime, setNowTime] = useState<number>(Date.now());

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom helper
  const scrollToBottom = (behavior: 'auto' | 'smooth' = 'auto') => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  // Fetch messages
  const loadMessages = async (isFirstLoad = false) => {
    try {
      const data = await chatApi.list();
      setMessages(data.messages);
      setError(null);
      if (isFirstLoad) {
        setTimeout(() => scrollToBottom('auto'), 50);
      }
      localStorage.setItem('last_read_chat_time', new Date().toISOString());
    } catch (err: any) {
      console.error('Failed to load chat messages:', err);
      setError('Failed to load chat messages');
    } finally {
      if (isFirstLoad) setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    loadMessages(true);
  }, []);

  // Polling for updates every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      loadMessages();
      setNowTime(Date.now());
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // Scroll to bottom when message list changes (e.g. when sending a message)
  useEffect(() => {
    scrollToBottom('smooth');
  }, [messages.length]);

  // Handle post message
  const handlePostMessage = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (!messageText.trim() || sending) return;

    setSending(true);
    const content = messageText.trim();
    setMessageText('');

    try {
      const data = await chatApi.create(content);
      setMessages(prev => [...prev, data.message]);
      textareaRef.current?.focus();
    } catch (err: any) {
      console.error('Failed to send message:', err);
      // Put message text back in case of failure
      setMessageText(content);
    } finally {
      setSending(false);
    }
  };

  // Handle keypress inside textarea (Enter sends message, Shift+Enter adds newline)
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handlePostMessage();
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh]">
        <Loader2 className="size-8 animate-spin text-indigo-600 mb-2" />
        <p className="text-sm text-muted-foreground">{t('chat.loading')}</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 flex flex-col h-[calc(100vh-6rem)] md:h-[calc(100vh-2rem)]">
      <Card className="flex flex-col flex-1 overflow-hidden shadow-md border-border bg-card">
        {/* Header */}
        <CardHeader className="py-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <span className="size-3 rounded-full bg-green-500 animate-pulse" />
              {t('chat.title')}
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">{t('chat.subtitle')}</p>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-amber-700 font-semibold bg-amber-50 border border-amber-200 rounded-full px-3 py-1.5 self-start sm:self-center">
            <Clock className="size-4 shrink-0" />
            <span>{t('chat.messagesExpire')}</span>
          </div>
        </CardHeader>

        {/* Messages Body */}
        <CardContent 
          ref={scrollRef} 
          className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50 dark:bg-zinc-950/20"
        >
          {error && (
            <div className="flex items-center gap-2 p-3 text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-lg">
              <AlertCircle className="size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[40vh] text-center p-6">
              <div className="size-12 rounded-full bg-muted flex items-center justify-center mb-3">
                <Send className="size-5 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-foreground text-sm">{t('chat.noMessages')}</h3>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg) => {
                const isMe = msg.user_id === user?.id;
                const userRole = msg.user?.role || 'member';

                // Assign roles clean colors
                let roleColor = 'bg-slate-100 text-slate-700 border-slate-200';
                if (userRole === 'owner') roleColor = 'bg-rose-100 text-rose-700 border-rose-200';
                else if (userRole === 'team_leader') roleColor = 'bg-blue-100 text-blue-700 border-blue-200';
                else if (userRole === 'moderation') roleColor = 'bg-amber-100 text-amber-700 border-amber-200';
                else if (userRole === 'account_manager') roleColor = 'bg-purple-100 text-purple-700 border-purple-200';
                else if (userRole === 'sales') roleColor = 'bg-emerald-100 text-emerald-700 border-emerald-200';

                return (
                  <div
                    key={msg.id}
                    className={`flex items-start gap-2.5 ${isMe ? 'flex-row-reverse' : ''}`}
                  >
                    {/* User Avatar */}
                    <Avatar className="size-9 shrink-0 border border-border">
                      <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-violet-600 text-white text-xs font-bold">
                        {msg.user ? getInitials(msg.user.name) : '?'}
                      </AvatarFallback>
                    </Avatar>

                    {/* Message Details */}
                    <div className={`flex flex-col max-w-[75%] ${isMe ? 'items-end' : 'items-start'}`}>
                      {/* User Header */}
                      <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                        <span className="text-xs font-bold text-foreground">
                          {msg.user?.name || t('common.unknown')}
                        </span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full border font-semibold uppercase ${roleColor}`}>
                          {t(`role.${userRole}`)}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-medium">
                          {formatCairoDateTime(msg.created_at, locale, { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      {/* Message Bubble */}
                      <div
                        className={`text-sm leading-relaxed rounded-2xl px-4 py-2.5 whitespace-pre-wrap ${
                          isMe
                            ? 'bg-indigo-600 text-white rounded-tr-none'
                            : 'bg-white border border-border text-foreground rounded-tl-none dark:bg-zinc-900'
                        }`}
                      >
                        {msg.content}
                      </div>

                      {/* Expiry Clock */}
                      <div className="flex items-center gap-1 mt-1 text-[9px] text-muted-foreground font-medium">
                        <Clock className="size-2.5 shrink-0" />
                        <span>{timeUntilExpiry(msg.created_at, t)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>

        {/* Input Form Footer */}
        <div className="p-4 border-t border-border bg-card shrink-0">
          <form onSubmit={handlePostMessage} className="flex gap-2 items-end">
            <div className="flex-1">
              <Textarea
                ref={textareaRef}
                placeholder={t('chat.placeholder')}
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={2}
                className="resize-none min-h-[50px] max-h-[120px] focus-visible:ring-1 focus-visible:ring-indigo-500 rounded-xl"
              />
            </div>
            <Button
              type="submit"
              disabled={sending || !messageText.trim()}
              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl size-11 flex items-center justify-center p-0 shrink-0"
              title={t('chat.send')}
            >
              {sending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className={`size-4 transform ${dir === 'rtl' ? 'rotate-180' : ''}`} />
              )}
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
}
