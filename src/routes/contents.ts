import { Router, Response } from 'express';
import { supabaseAdmin } from '../lib/supabase';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import multer from 'multer';

const router = Router();

const dashboardUserOnly = (req: AuthRequest, res: Response, next: any) => {
  if (!req.user || req.user.role === 'client' || req.user.role === 'sales' || req.user.role === 'member') {
    res.status(403).json({ error: 'Access denied. Authorized roles only.' });
    return;
  }
  next();
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit (for videos)
});

// GET /api/contents — Fetch all content items
router.get('/', authMiddleware, dashboardUserOnly, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { client_id } = req.query;

    let query = supabaseAdmin
      .from('contents')
      .select('*, client:clients(id, name, company)');

    if (client_id) {
      query = query.eq('client_id', client_id);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ contents: data || [] });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch content items' });
  }
});

// POST /api/contents — Create a new content item
router.post('/', authMiddleware, dashboardUserOnly, async (req: AuthRequest, res: Response): Promise<void> => {
  const { client_id, title, caption, description, content_type, sound, drive_link, status, media_urls, platform, scheduled_date } = req.body;

  if (!content_type) {
    res.status(400).json({ error: 'Content type is required' });
    return;
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('contents')
      .insert({
        client_id: client_id || null,
        title: title || null,
        caption: caption || null,
        description: description || null,
        content_type,
        sound: sound || null,
        drive_link: drive_link || null,
        status: status || 'draft',
        media_urls: media_urls || [],
        platform: platform || null,
        scheduled_date: scheduled_date || null,
      })
      .select('*, client:clients(id, name, company)')
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.status(201).json({ content: data });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to create content item' });
  }
});

// PUT /api/contents/:id — Update a content item
router.put('/:id', authMiddleware, dashboardUserOnly, async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { client_id, title, caption, description, content_type, sound, drive_link, status, media_urls, platform, scheduled_date } = req.body;

  try {
    const updates: Record<string, any> = { updated_at: new Date().toISOString() };
    if (client_id !== undefined) updates.client_id = client_id || null;
    if (title !== undefined) updates.title = title || null;
    if (caption !== undefined) updates.caption = caption || null;
    if (description !== undefined) updates.description = description || null;
    if (content_type !== undefined) updates.content_type = content_type;
    if (sound !== undefined) updates.sound = sound || null;
    if (drive_link !== undefined) updates.drive_link = drive_link || null;
    if (status !== undefined) updates.status = status;
    if (media_urls !== undefined) updates.media_urls = media_urls;
    if (platform !== undefined) updates.platform = platform || null;
    if (scheduled_date !== undefined) updates.scheduled_date = scheduled_date || null;

    const { data, error } = await supabaseAdmin
      .from('contents')
      .update(updates)
      .eq('id', id)
      .select('*, client:clients(id, name, company)')
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ content: data });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to update content item' });
  }
});

// DELETE /api/contents/:id — Delete a content item
router.delete('/:id', authMiddleware, dashboardUserOnly, async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;

  try {
    const { error } = await supabaseAdmin
      .from('contents')
      .delete()
      .eq('id', id);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ message: 'Content item deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to delete content item' });
  }
});

// POST /api/contents/upload — Upload multiple files to Supabase Storage
router.post('/upload', authMiddleware, dashboardUserOnly, upload.array('files', 10), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      res.status(400).json({ error: 'No files provided' });
      return;
    }

    const publicUrls: string[] = [];

    for (const file of files) {
      const storagePath = `contents/${Date.now()}_${file.originalname}`;

      const { error: uploadError } = await supabaseAdmin.storage
        .from('attachments')
        .upload(storagePath, file.buffer, {
          contentType: file.mimetype,
          upsert: false,
        });

      if (uploadError) {
        res.status(500).json({ error: `Upload error for ${file.originalname}: ${uploadError.message}` });
        return;
      }

      const { data: urlData } = supabaseAdmin.storage
        .from('attachments')
        .getPublicUrl(storagePath);

      publicUrls.push(urlData.publicUrl);
    }

    res.status(201).json({ public_urls: publicUrls });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to upload files' });
  }
});

export default router;
