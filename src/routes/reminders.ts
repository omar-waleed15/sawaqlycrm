import { Router, Response } from 'express';
import { supabaseAdmin } from '../lib/supabase';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { sendWebhookNotification } from '../lib/webhook';

const router = Router();

// GET /api/reminders — List all reminders related to the current user (sent or received)
router.get('/', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { data, error } = await supabaseAdmin
      .from('reminders')
      .select(`
        *,
        sender:profiles!sender_id(name, avatar_url),
        receiver:profiles!receiver_id(name, avatar_url)
      `)
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .order('created_at', { ascending: false });

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ reminders: data || [] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch reminders' });
  }
});

// POST /api/reminders — Create new reminders (supports single receiver_id or receiver_ids array)
router.post('/', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const { receiver_id, receiver_ids, content } = req.body;
  const senderId = req.user?.id;

  if (!senderId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const idsToInsert: string[] = [];
  if (Array.isArray(receiver_ids)) {
    idsToInsert.push(...receiver_ids);
  } else if (receiver_id) {
    idsToInsert.push(receiver_id);
  }

  if (idsToInsert.length === 0 || !content?.trim()) {
    res.status(400).json({ error: 'Recipient(s) and content are required' });
    return;
  }

  try {
    const rows = idsToInsert.map(rId => ({
      sender_id: senderId,
      receiver_id: rId,
      content: content.trim(),
    }));

    const { data, error } = await supabaseAdmin
      .from('reminders')
      .insert(rows)
      .select(`
        *,
        sender:profiles!sender_id(id, name, email, phone, avatar_url),
        receiver:profiles!receiver_id(id, name, email, phone, avatar_url)
      `);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    // Dispatch webhook notifications in the background
    if (data && data.length > 0) {
      const sender = {
        id: req.user!.id,
        name: req.user!.name,
        email: req.user!.email,
      };

      for (const r of data) {
        if (r.receiver) {
          sendWebhookNotification({
            type: 'reminder',
            action: 'created',
            reminder: {
              id: r.id,
              content: r.content,
            },
            sender,
            receiver: {
              id: r.receiver.id,
              name: r.receiver.name,
              email: r.receiver.email,
              phone: r.receiver.phone,
            },
          }).catch(err => console.error('Failed to dispatch webhook:', err));
        }
      }
    }

    res.status(201).json({ reminders: data || [] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create reminders' });
  }
});

// PUT /api/reminders/:id/read — Mark reminder as read (receiver only)
router.put('/:id/read', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const userId = req.user?.id;

  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('reminders')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id)
      .eq('receiver_id', userId) // Security: only receiver can update read status
      .select(`
        *,
        sender:profiles!sender_id(name, avatar_url),
        receiver:profiles!receiver_id(name, avatar_url)
      `)
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ reminder: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update reminder' });
  }
});

// PUT /api/reminders/:id/done — Mark reminder as completed (receiver only)
router.put('/:id/done', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const userId = req.user?.id;

  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('reminders')
      .update({ completed_at: new Date().toISOString() })
      .eq('id', id)
      .eq('receiver_id', userId) // Security: only receiver can update completed status
      .select(`
        *,
        sender:profiles!sender_id(name, avatar_url),
        receiver:profiles!receiver_id(name, avatar_url)
      `)
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ reminder: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update reminder' });
  }
});

// DELETE /api/reminders/:id — Delete/retract a reminder (sender only)
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const userId = req.user?.id;

  if (!userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const { error } = await supabaseAdmin
      .from('reminders')
      .delete()
      .eq('id', id)
      .eq('sender_id', userId); // Security: only sender can delete

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ message: 'Reminder deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete reminder' });
  }
});

export default router;
