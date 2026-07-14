import { Router, Response } from 'express';
import { supabaseAdmin } from '../lib/supabase';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/notes — List all personal notes for the authenticated user
router.get('/', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { data, error } = await supabaseAdmin
      .from('personal_notes')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ notes: data || [] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch personal notes' });
  }
});

// POST /api/notes — Create a new personal note or todo list
router.post('/', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { title, content = '', type = 'text', todo_items = [] } = req.body;

    if (!title || !title.trim()) {
      res.status(400).json({ error: 'Title is required' });
      return;
    }

    const { data, error } = await supabaseAdmin
      .from('personal_notes')
      .insert({
        user_id: userId,
        title: title.trim(),
        content: content,
        type: type,
        todo_items: todo_items,
      })
      .select()
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.status(201).json({ note: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create personal note' });
  }
});

// PUT /api/notes/:id — Update a personal note or checklist
router.put('/:id', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const { title, content, todo_items } = req.body;

    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (title !== undefined) updateData.title = title.trim();
    if (content !== undefined) updateData.content = content;
    if (todo_items !== undefined) updateData.todo_items = todo_items;

    const { data, error } = await supabaseAdmin
      .from('personal_notes')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ note: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update personal note' });
  }
});

// DELETE /api/notes/:id — Delete a personal note
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;

    const { error } = await supabaseAdmin
      .from('personal_notes')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete personal note' });
  }
});

export default router;
