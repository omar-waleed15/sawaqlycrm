import { Router, Response } from 'express';
import { supabaseAdmin } from '../lib/supabase';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// Staff role restriction helper
const staffOnly = (req: AuthRequest, res: Response, next: any) => {
  const role = req.user!.role;
  if (role !== 'owner' && role !== 'team_leader' && role !== 'account_manager') {
    res.status(403).json({ error: 'Access denied. Staff only.' });
    return;
  }
  next();
};

// GET /api/client-chat/rooms — List all available client chat rooms (Staff only)
router.get('/rooms', authMiddleware, staffOnly, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // 1. Fetch all clients who have a linked user account (user_id is not null)
    const { data: clients, error: clientsErr } = await supabaseAdmin
      .from('clients')
      .select('id, name, company, user_id, profiles!clients_user_id_fkey(avatar_url, email)')
      .not('user_id', 'is', null);

    if (clientsErr) {
      res.status(500).json({ error: clientsErr.message });
      return;
    }

    // 2. Fetch the latest message for each client room to show last message in panel
    const rooms = await Promise.all((clients || []).map(async (client: any) => {
      const { data: lastMsg, error: msgErr } = await supabaseAdmin
        .from('client_messages')
        .select('content, created_at')
        .eq('client_id', client.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      return {
        id: client.id,
        name: client.name,
        company: client.company,
        user_id: client.user_id,
        avatar_url: client.profiles?.avatar_url || null,
        lastMessage: lastMsg || null
      };
    }));

    // Sort rooms: those with messages first (by latest message date), then by name
    rooms.sort((a, b) => {
      const aTime = a.lastMessage ? new Date(a.lastMessage.created_at).getTime() : 0;
      const bTime = b.lastMessage ? new Date(b.lastMessage.created_at).getTime() : 0;
      if (aTime !== bTime) return bTime - aTime;
      return a.name.localeCompare(b.name);
    });

    res.json({ rooms });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch active chat rooms' });
  }
});

// GET /api/client-chat/rooms/:client_id/messages — Get messages for a client room
router.get('/rooms/:client_id/messages', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const { client_id } = req.params;
  const userId = req.user!.id;
  const role = req.user!.role;

  try {
    // If the caller is a client, verify that they are opening their own room
    if (role === 'client') {
      const { data: client, error: clientErr } = await supabaseAdmin
        .from('clients')
        .select('id')
        .eq('id', client_id)
        .eq('user_id', userId)
        .maybeSingle();

      if (clientErr || !client) {
        res.status(403).json({ error: 'Access denied. You can only view your own chat room.' });
        return;
      }
    } else if (role !== 'owner' && role !== 'team_leader' && role !== 'account_manager') {
      res.status(403).json({ error: 'Access denied. Unauthorized role.' });
      return;
    }

    // Fetch messages in chronological order
    const { data: messages, error: messagesErr } = await supabaseAdmin
      .from('client_messages')
      .select('*, sender:profiles(id, name, email, avatar_url, role)')
      .eq('client_id', client_id)
      .order('created_at', { ascending: true });

    if (messagesErr) {
      res.status(500).json({ error: messagesErr.message });
      return;
    }

    res.json({ messages: messages || [] });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch messages' });
  }
});

// POST /api/client-chat/rooms/:client_id/messages — Post a new message
router.post('/rooms/:client_id/messages', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const { client_id } = req.params;
  const { content } = req.body;
  const userId = req.user!.id;
  const role = req.user!.role;

  if (!content || !content.trim()) {
    res.status(400).json({ error: 'Message content is required' });
    return;
  }

  try {
    // Check permission
    if (role === 'client') {
      const { data: client, error: clientErr } = await supabaseAdmin
        .from('clients')
        .select('id')
        .eq('id', client_id)
        .eq('user_id', userId)
        .maybeSingle();

      if (clientErr || !client) {
        res.status(403).json({ error: 'Access denied. You can only send messages to your own chat room.' });
        return;
      }
    } else if (role !== 'owner' && role !== 'team_leader' && role !== 'account_manager') {
      res.status(403).json({ error: 'Access denied. Unauthorized role.' });
      return;
    }

    // Insert message
    const { data: message, error: insertErr } = await supabaseAdmin
      .from('client_messages')
      .insert({
        client_id,
        sender_id: userId,
        content: content.trim()
      })
      .select('*, sender:profiles(id, name, email, avatar_url, role)')
      .single();

    if (insertErr) {
      res.status(500).json({ error: insertErr.message });
      return;
    }

    res.status(201).json({ message });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to post message' });
  }
});

export default router;
