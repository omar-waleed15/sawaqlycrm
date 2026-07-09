'use client';

import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/lib/auth';
import { useLanguage } from '@/lib/i18n';
import { clientChatApi, clientsApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Send, Search, Plus, MessageSquare, Building2, PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';

interface ChatRoom {
  id: string;
  name: string;
  company: string;
  user_id: string;
  avatar_url: string | null;
  lastMessage: {
    content: string;
    created_at: string;
  } | null;
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

export default function AdminClientChatPage() {
  const { user } = useAuth();
  const { t, locale } = useLanguage();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // State
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Modals / Selection State
  const [isStartModalOpen, setIsStartModalOpen] = useState(false);
  const [allClients, setAllClients] = useState<any[]>([]);
  const [selectedClientIdToStart, setSelectedClientIdToStart] = useState('');

  // Loading states
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetchRooms();
    fetchClientsForStart();
  }, []);

  useEffect(() => {
    if (!selectedRoom) return;
    fetchMessages(selectedRoom.id, false);
    const interval = setInterval(() => {
      fetchMessages(selectedRoom.id, true);
    }, 3000);
    return () => clearInterval(interval);
  }, [selectedRoom?.id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchRooms = async () => {
    try {
      const res = await clientChatApi.listRooms();
      setRooms(res.rooms || []);
    } catch (err) {
      console.error('Failed to load chat rooms:', err);
    } finally {
      setLoadingRooms(false);
    }
  };

  const fetchClientsForStart = async () => {
    try {
      const res = await clientsApi.list();
      const list = (res.clients || []).filter((c: any) => c.user_id !== null);
      setAllClients(list);
    } catch (err) {
      console.error('Failed to load clients list:', err);
    }
  };

  const fetchMessages = async (clientId: string, isSilent = false) => {
    if (!isSilent) setLoadingMessages(true);
    try {
      const res = await clientChatApi.listMessages(clientId);
      setMessages(res.messages || []);
    } catch (err) {
      console.error('Failed to load messages:', err);
    } finally {
      if (!isSilent) setLoadingMessages(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoom || !newMessage.trim() || sending) return;
    const text = newMessage.trim();
    setNewMessage('');
    setSending(true);
    try {
      const res = await clientChatApi.sendMessage(selectedRoom.id, text);
      setMessages(prev => [...prev, res.message]);
      setRooms(prev =>
        prev.map(r =>
          r.id === selectedRoom.id
            ? { ...r, lastMessage: { content: text, created_at: new Date().toISOString() } }
            : r
        )
      );
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setSending(false);
    }
  };

  const handleStartChat = () => {
    if (!selectedClientIdToStart) return;
    const client = allClients.find(c => c.id === selectedClientIdToStart);
    if (!client) return;
    const existingRoom = rooms.find(r => r.id === client.id);
    if (existingRoom) {
      setSelectedRoom(existingRoom);
    } else {
      const newRoom: ChatRoom = {
        id: client.id,
        name: client.name,
        company: client.company || '',
        user_id: client.user_id,
        avatar_url: null,
        lastMessage: null,
      };
      setRooms(prev => [newRoom, ...prev]);
      setSelectedRoom(newRoom);
    }
    setIsStartModalOpen(false);
    setSelectedClientIdToStart('');
    setSidebarOpen(false);
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

  const filteredRooms = rooms.filter(
    r =>
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.company.toLowerCase().includes(searchQuery.toLowerCase())
  );

  /* ── Shared sidebar content ── */
  const sidebarContent = (
    <>
      <div className="p-4 border-b flex items-center justify-between gap-2 bg-white">
        <h2 className="font-extrabold text-sm uppercase tracking-wider text-slate-800 flex items-center gap-1.5 font-mono truncate">
          <MessageSquare className="size-4 text-indigo-600 shrink-0" /> {t('nav.clientChat') || 'Client Chat'}
        </h2>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsStartModalOpen(true)}
            className="h-7 text-[10px] font-semibold px-1.5 flex items-center gap-0.5 border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 hover:text-indigo-800 shadow-2xs"
          >
            <Plus className="size-3" /> {locale === 'ar' ? 'جديد' : 'New'}
          </Button>
          <button
            onClick={() => setSidebarOpen(false)}
            className="size-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500 md:hidden"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      <div className="p-3 border-b bg-white">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={locale === 'ar' ? 'بحث عن عميل...' : 'Search client...'}
            className="text-xs h-8 pl-8 pr-3"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {loadingRooms ? (
          <div className="flex justify-center items-center py-10">
            <Loader2 className="size-5 animate-spin text-primary" />
          </div>
        ) : filteredRooms.length === 0 ? (
          <div className="text-center py-10 px-4 text-xs text-muted-foreground italic">
            {locale === 'ar' ? 'لا توجد محادثات نشطة' : 'No active chats found'}
          </div>
        ) : (
          filteredRooms.map(room => {
            const active = selectedRoom?.id === room.id;
            return (
              <div
                key={room.id}
                onClick={() => { setSelectedRoom(room); setSidebarOpen(false); }}
                className={`p-3 rounded-xl flex items-center gap-3 cursor-pointer select-none transition-all border ${
                  active
                    ? 'bg-indigo-600/90 text-white border-indigo-600 shadow-md font-semibold'
                    : 'hover:bg-slate-100/80 border-transparent text-slate-700 bg-white'
                }`}
              >
                <Avatar className="size-9 border shrink-0">
                  {room.avatar_url && <AvatarImage src={room.avatar_url} alt={room.name} />}
                  <AvatarFallback className={active ? 'bg-white text-indigo-700 text-xs font-bold' : 'bg-indigo-100 text-indigo-700 text-xs font-bold'}>
                    {getInitials(room.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 overflow-hidden">
                  <div className="flex items-center justify-between gap-1.5">
                    <h4 className="text-xs font-bold truncate leading-snug">{room.name}</h4>
                    {room.lastMessage && (
                      <span className={`text-[9px] ${active ? 'text-indigo-100' : 'text-slate-400'} font-semibold shrink-0`}>
                        {formatMessageTime(room.lastMessage.created_at)}
                      </span>
                    )}
                  </div>
                  {room.company && (
                    <div className={`text-[10px] truncate ${active ? 'text-indigo-200' : 'text-slate-500'} flex items-center gap-0.5 mt-0.5`}>
                      <Building2 className="size-3 shrink-0" /> {room.company}
                    </div>
                  )}
                  {room.lastMessage && (
                    <p className={`text-[11px] truncate mt-1 ${active ? 'text-indigo-100' : 'text-slate-500'}`}>
                      {room.lastMessage.content}
                    </p>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </>
  );

  return (
    <div className="relative flex h-[calc(100vh-16px)] md:h-[calc(100vh-16px)] border rounded-2xl overflow-hidden bg-card shadow-sm text-start font-sans">
      {/* ── Desktop inline sidebar ── */}
      {sidebarOpen && (
        <div className="hidden md:flex w-80 border-r flex-col bg-slate-50/50 shrink-0">
          {sidebarContent}
        </div>
      )}

      {/* ── Mobile overlay sidebar ── */}
      {sidebarOpen && (
        <>
          <div className="fixed inset-0 bg-black/30 z-[160] md:hidden" onClick={() => setSidebarOpen(false)} />
          <div className="fixed inset-y-0 left-0 w-[85%] max-w-xs bg-slate-50 z-[170] flex flex-col shadow-2xl md:hidden animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
        </>
      )}

      {/* ── Main chat panel (always full width) ── */}
      <div className="flex-1 flex flex-col bg-white min-w-0">
        {selectedRoom ? (
          <>
            {/* Header */}
            <div className="px-3 md:px-5 py-3 md:py-4 border-b flex items-center justify-between gap-3 bg-slate-50/40">
              <div className="flex items-center gap-2 md:gap-3">
                <button
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="size-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-600 shrink-0"
                  title={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
                >
                  {sidebarOpen ? <PanelLeftClose className="size-4" /> : <PanelLeftOpen className="size-4" />}
                </button>
                <Avatar className="size-9 md:size-10 border">
                  {selectedRoom.avatar_url && <AvatarImage src={selectedRoom.avatar_url} alt={selectedRoom.name} />}
                  <AvatarFallback className="bg-indigo-100 text-indigo-700 text-sm font-bold">
                    {getInitials(selectedRoom.name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-xs font-bold text-slate-800 leading-snug">{selectedRoom.name}</h3>
                  {selectedRoom.company && (
                    <p className="text-[10px] text-muted-foreground flex items-center gap-0.5 mt-0.5">
                      <Building2 className="size-3 shrink-0" /> {selectedRoom.company}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-4 bg-slate-50/20">
              {loadingMessages ? (
                <div className="flex flex-col items-center justify-center h-full gap-2">
                  <Loader2 className="size-6 animate-spin text-primary" />
                  <span className="text-xs text-muted-foreground">{t('common.loading')}</span>
                </div>
              ) : (
                messages.map(msg => {
                  const isMe = msg.sender_id === user?.id;
                  const isClientSender = msg.sender.role === 'client';
                  return (
                    <div
                      key={msg.id}
                      className={`flex gap-2 md:gap-3 max-w-[90%] md:max-w-[75%] ${isMe ? 'ml-auto flex-row-reverse text-end' : 'mr-auto flex-row text-start'}`}
                    >
                      <Avatar className="size-7 md:size-8 border shrink-0">
                        {msg.sender.avatar_url && <AvatarImage src={msg.sender.avatar_url} alt={msg.sender.name} />}
                        <AvatarFallback className="bg-slate-200 text-slate-700 text-[10px] font-bold">
                          {getInitials(msg.sender.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="space-y-1">
                        <div className={`flex items-center gap-1.5 flex-wrap ${isMe ? 'justify-end' : 'justify-start'}`}>
                          <span className="text-[10px] font-bold text-slate-800">{msg.sender.name}</span>
                          {!isClientSender && (
                            <Badge variant="outline" className="text-[8px] px-1 py-0 bg-slate-100 text-slate-700 capitalize font-semibold border-slate-200">
                              {msg.sender.role === 'owner' ? 'Admin' : msg.sender.role === 'team_leader' ? 'Leader' : 'Account Manager'}
                            </Badge>
                          )}
                        </div>
                        <div className={`p-3 rounded-2xl text-xs break-words shadow-2xs ${
                          isMe ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white border text-slate-800 rounded-tl-none'
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

            {/* Input */}
            <form onSubmit={handleSendMessage} className="p-3 md:p-4 border-t bg-white flex gap-2 md:gap-3 items-center">
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder={locale === 'ar' ? 'اكتب رسالة هنا...' : 'Type message here...'}
                className="flex-1 text-xs h-10 px-4"
              />
              <Button type="submit" disabled={!newMessage.trim() || sending} className="h-10 px-3 md:px-4 flex items-center gap-1.5 shadow-sm">
                {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                <span className="text-xs font-semibold hidden sm:inline">{locale === 'ar' ? 'إرسال' : 'Send'}</span>
              </Button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-8 bg-slate-50/10">
            <div className="size-16 rounded-full bg-slate-100 flex items-center justify-center">
              <MessageSquare className="size-8 text-slate-400 animate-pulse" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-800">{locale === 'ar' ? 'حدد محادثة لبدء الدردشة' : 'Select a conversation to start chatting'}</h3>
              <p className="text-xs text-muted-foreground/80 mt-1 max-w-xs">{locale === 'ar' ? 'اختر عميلاً من القائمة الجانبية أو ابدأ محادثة جديدة' : 'Choose a client from the sidebar or click "Start Chat" to find a client.'}</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => setSidebarOpen(true)} className="mt-2 text-xs font-semibold md:hidden">
              <PanelLeftOpen className="size-4 mr-1.5" />
              {locale === 'ar' ? 'فتح قائمة المحادثات' : 'Open Chat List'}
            </Button>
          </div>
        )}
      </div>

      {/* Start Chat Modal */}
      <Dialog open={isStartModalOpen} onOpenChange={setIsStartModalOpen}>
        <DialogContent className="sm:max-w-md text-start animate-fade-in z-[200]">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">
              {locale === 'ar' ? 'بدء محادثة جديدة مع عميل' : 'Start New Client Chat'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Select a client who has a registered portal account to start a conversation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700">{locale === 'ar' ? 'اختر العميل' : 'Select Client'}</label>
              <Select value={selectedClientIdToStart} onValueChange={(val) => setSelectedClientIdToStart(val || '')}>
                <SelectTrigger className="text-xs h-9">
                  <SelectValue placeholder={locale === 'ar' ? 'اختر عميلاً...' : 'Choose client...'} />
                </SelectTrigger>
                <SelectContent>
                  {allClients.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} {c.company ? `(${c.company})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button size="sm" variant="outline" onClick={() => setIsStartModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button size="sm" onClick={handleStartChat} disabled={!selectedClientIdToStart}>
              {locale === 'ar' ? 'بدء المحادثة' : 'Start Chat'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
