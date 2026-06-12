import { Router, Response, Request } from 'express';
import { supabaseAdmin } from '../lib/supabase';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { ownerOrTeamLeader, ownerOrTeamLeaderOrSales } from '../middleware/roleCheck';
import multer from 'multer';

const router = Router({ mergeParams: true });

// Use memory storage - we'll upload directly to Supabase Storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB limit
});

// POST /api/tasks/:taskId/attachments — Upload attachment (owner only)
router.post('/', authMiddleware, ownerOrTeamLeaderOrSales, upload.single('file'), async (req: AuthRequest, res: Response): Promise<void> => {
  const { taskId } = req.params;

  if (!req.file) {
    res.status(400).json({ error: 'No file provided' });
    return;
  }

  try {
    const file = req.file;
    const fileExt = file.originalname.split('.').pop();
    const storagePath = `tasks/${taskId}/${Date.now()}_${file.originalname}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabaseAdmin.storage
      .from('attachments')
      .upload(storagePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (uploadError) {
      res.status(500).json({ error: uploadError.message });
      return;
    }

    // Get public URL
    const { data: urlData } = supabaseAdmin.storage
      .from('attachments')
      .getPublicUrl(storagePath);

    // Save record to DB
    const { data, error: dbError } = await supabaseAdmin
      .from('attachments')
      .insert({
        task_id: taskId,
        filename: file.originalname,
        storage_path: storagePath,
        public_url: urlData.publicUrl,
        mimetype: file.mimetype,
        size: file.size,
      })
      .select()
      .single();

    if (dbError) {
      // Cleanup storage
      await supabaseAdmin.storage.from('attachments').remove([storagePath]);
      res.status(500).json({ error: dbError.message });
      return;
    }

    res.status(201).json({ attachment: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to upload attachment' });
  }
});

// DELETE /api/attachments/:id — Delete an attachment (admin or task creator)
router.delete('/:attachmentId', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const { attachmentId } = req.params;

  try {
    const { data: attachment, error: fetchError } = await supabaseAdmin
      .from('attachments')
      .select('*, task:tasks(creator_id)')
      .eq('id', attachmentId)
      .single();

    if (fetchError || !attachment) {
      res.status(404).json({ error: 'Attachment not found' });
      return;
    }

    const admin = ['owner', 'team_leader', 'moderation', 'account_manager'].includes(req.user!.role);
    const isCreator = attachment.task?.creator_id === req.user!.id;

    if (!admin && !isCreator) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // Remove from storage
    await supabaseAdmin.storage.from('attachments').remove([attachment.storage_path]);

    // Remove from DB
    const { error: deleteError } = await supabaseAdmin
      .from('attachments')
      .delete()
      .eq('id', attachmentId);

    if (deleteError) {
      res.status(500).json({ error: deleteError.message });
      return;
    }

    res.json({ message: 'Attachment deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete attachment' });
  }
});

export default router;
