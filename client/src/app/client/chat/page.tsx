'use client';

import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/lib/auth';
import { useLanguage } from '@/lib/i18n';
import { clientChatApi, request } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, Send, MessageSquare, ShieldAlert, Sparkles } from 'lucide-react';

interface PortalData {
  client: {
    id: string;
    name: string;
    company: string;
  };
}

interface Message {
  id: string;
  client_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  sender: {
    id: string;
    name: string;
    email: string;
    avatar_url: string | null;
    role: string;
  };
}

export default function ClientPortalChatPage() {
  const { user } = useAuth();
  const { t, locale } = useLanguage();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // State
  const [clientId, setClientId] = useState<string | null>(null);
  const [clientName, setClientName] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  
  // Loading states
  const [loadingPortal, setLoadingPortal] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  // 1. Fetch Client Profile details on mount to get client_id
  useEffect(() => {
    request<PortalData>('/clients/portal/data')
      .then((res: PortalData) => {
        if (res.client?.id) {
          setClientId(res.client.id);
          setClientName(res.client.name);
        } else {
          setError('Failed to resolve client identity profile.');
        }
      })
      .catch((err: any) => {
        setError(err.message || 'Failed to load client details');
      })
      .finally(() => {
        setLoadingPortal(false);
      });
  }, []);

  // 2. Load and Poll messages once clientId is obtained
  useEffect(() => {
    if (!clientId) return;

    fetchMessages(clientId, false);

    const interval = setInterval(() => {
      fetchMessages(clientId, true);
    }, 3000);

    return () => clearInterval(interval);
  }, [clientId]);

  // Scroll to bottom when messages update
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchMessages = async (id: string, isSilent = false) => {
    if (!isSilent) setLoadingMessages(true);
    try {
      const res = await clientChatApi.listMessages(id);
      setMessages(res.messages || []);
    } catch (err) {
      console.error('Failed to load portal chat messages:', err);
    } finally {
      if (!isSilent) setLoadingMessages(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId || !newMessage.trim() || sending) return;

    const text = newMessage.trim();
    setNewMessage('');
    setSending(true);

    try {
      const res = await clientChatApi.sendMessage(clientId, text);
      setMessages(prev => [...prev, res.message]);
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setSending(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const formatMessageTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString(locale === 'ar' ? 'ar-EG' : 'en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  if (loadingPortal) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[300px]">
        <Loader2 className="size-8 text-[#1D61E7] animate-spin mb-2" />
        <span className="text-xs text-slate-500 font-mono uppercase tracking-widest">{t('common.loading')}</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-center select-none font-sans">
        <div className="max-w-md bg-rose-50 border border-rose-200 text-rose-600 rounded-2xl p-6 flex flex-col items-center gap-3">
          <ShieldAlert className="size-10 text-rose-500 shrink-0" />
          <h2 className="text-sm font-bold uppercase tracking-wider">Error Encountered</h2>
          <p className="text-xs text-rose-600/90 leading-relaxed font-semibold">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 text-[#0F172A] text-start font-sans" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="border-b border-[#E2E8F0] pb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-xl font-extrabold uppercase tracking-widest text-[#0F172A] font-mono flex items-center gap-2">
            <Sparkles className="size-5 text-indigo-500 shrink-0" /> {locale === 'ar' ? 'الدردشة المباشرة' : 'Direct Agency Chat'}
          </h1>
          <p className="text-[10px] text-[#64748B] uppercase tracking-wider font-semibold mt-1">
            {locale === 'ar' ? 'تواصل مباشرة مع فريق الإدارة وقادة حسابك' : 'Message directly with our management, team leaders, and account managers'}
          </p>
        </div>
      </div>

      {/* Main Chat Container */}
      <div className="flex flex-col h-[calc(100vh-230px)] border border-[#E2E8F0] bg-white rounded-2xl overflow-hidden shadow-xs">
        {/* Chat Header info */}
        <div className="px-5 py-4 border-b border-[#E2E8F0] bg-[#F8FAFC]/50 flex items-center gap-3">
          <div className="size-9 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
            <MessageSquare className="size-4.5" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-[#0F172A] leading-snug">{locale === 'ar' ? 'فريق إدارة سوقلي' : 'Sawaqly Support Team'}</h3>
            <p className="text-[9px] text-[#64748B] font-mono font-extrabold uppercase tracking-wider mt-0.5">
              {locale === 'ar' ? 'الرد عادة في بضع دقائق' : 'Replies in a few minutes'}
            </p>
          </div>
        </div>

        {/* Message Thread Scroll Area */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50/15">
          {loadingMessages ? (
            <div className="flex flex-col items-center justify-center h-full gap-2">
              <Loader2 className="size-6 animate-spin text-[#1D61E7]" />
              <span className="text-[10px] text-[#64748B] uppercase tracking-widest font-mono">{t('common.loading')}</span>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center p-8">
              <div className="size-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                <MessageSquare className="size-5" />
              </div>
              <div>
                <h4 className="font-bold text-xs text-slate-800">{locale === 'ar' ? 'أهلاً بك في الدردشة!' : 'Welcome to Support Chat!'}</h4>
                <p className="text-[11px] text-muted-foreground mt-1 max-w-[280px] leading-relaxed">
                  {locale === 'ar' ? 'اكتب أول رسالة لبدء التحدث مع فريق إدارة حسابك.' : 'Send your first message to start talking with our account managers and agency leadership.'}
                </p>
              </div>
            </div>
          ) : (
            messages.map(msg => {
              const isMe = msg.sender_id === user?.id;
              const isClientSender = msg.sender.role === 'client';
              
              return (
                <div
                  key={msg.id}
                  className={`flex gap-3 max-w-[75%] ${isMe ? 'ml-auto flex-row-reverse text-end' : 'mr-auto flex-row text-start'}`}
                >
                  <Avatar className="size-8 border shrink-0">
                    {msg.sender.avatar_url && (
                      <AvatarImage src={msg.sender.avatar_url} alt={msg.sender.name} />
                    )}
                    <AvatarFallback className="bg-slate-200 text-slate-700 text-[10px] font-bold">
                      {getInitials(msg.sender.name)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="space-y-1">
                    <div className={`flex items-center gap-1.5 flex-wrap ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <span className="text-[10px] font-bold text-slate-800">{msg.sender.name}</span>
                      {!isClientSender && (
                        <Badge variant="outline" className="text-[8px] px-1.5 py-0 bg-slate-100 text-slate-700 capitalize font-semibold border-slate-200">
                          {msg.sender.role === 'owner' ? 'Admin' : msg.sender.role === 'team_leader' ? 'Leader' : 'Account Manager'}
                        </Badge>
                      )}
                    </div>

                    <div className={`p-3 rounded-2xl text-xs break-words shadow-2xs ${
                      isMe
                        ? 'bg-indigo-600 text-white rounded-tr-none'
                        : 'bg-white border border-[#E2E8F0] text-slate-800 rounded-tl-none'
                    }`}>
                      <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                      <span className={`text-[8px] block mt-1.5 font-semibold ${isMe ? 'text-indigo-200' : 'text-slate-400'}`}>
                        {formatMessageTime(msg.created_at)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <form onSubmit={handleSendMessage} className="p-4 border-t border-[#E2E8F0] bg-white flex gap-3 items-center">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={locale === 'ar' ? 'اكتب رسالة هنا...' : 'Type message here...'}
            className="flex-1 text-xs h-10 px-4"
          />
          <Button type="submit" disabled={!newMessage.trim() || sending} className="h-10 px-5 flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm">
            {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            <span className="text-xs font-bold uppercase tracking-wider font-mono">{locale === 'ar' ? 'إرسال' : 'Send'}</span>
          </Button>
        </form>
      </div>
    </div>
  );
}
