"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const supabase_1 = require("../lib/supabase");
const auth_1 = require("../middleware/auth");
const roleCheck_1 = require("../middleware/roleCheck");
const multer_1 = __importDefault(require("multer"));
const router = (0, express_1.Router)({ mergeParams: true });
// Use memory storage - we'll upload directly to Supabase Storage
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 20 * 1024 * 1024 }, // 20MB limit
});
// POST /api/tasks/:taskId/attachments — Upload attachment (owner only)
router.post('/', auth_1.authMiddleware, roleCheck_1.ownerOrTeamLeaderOrSales, upload.single('file'), async (req, res) => {
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
        const { error: uploadError } = await supabase_1.supabaseAdmin.storage
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
        const { data: urlData } = supabase_1.supabaseAdmin.storage
            .from('attachments')
            .getPublicUrl(storagePath);
        // Save record to DB
        const { data, error: dbError } = await supabase_1.supabaseAdmin
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
            await supabase_1.supabaseAdmin.storage.from('attachments').remove([storagePath]);
            res.status(500).json({ error: dbError.message });
            return;
        }
        res.status(201).json({ attachment: data });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to upload attachment' });
    }
});
// DELETE /api/attachments/:id — Delete an attachment (admin or task creator)
router.delete('/:attachmentId', auth_1.authMiddleware, async (req, res) => {
    const { attachmentId } = req.params;
    try {
        const { data: attachment, error: fetchError } = await supabase_1.supabaseAdmin
            .from('attachments')
            .select('*, task:tasks(creator_id)')
            .eq('id', attachmentId)
            .single();
        if (fetchError || !attachment) {
            res.status(404).json({ error: 'Attachment not found' });
            return;
        }
        const admin = ['owner', 'team_leader', 'moderation', 'account_manager'].includes(req.user.role);
        const isCreator = attachment.task?.creator_id === req.user.id;
        if (!admin && !isCreator) {
            res.status(403).json({ error: 'Access denied' });
            return;
        }
        // Remove from storage
        await supabase_1.supabaseAdmin.storage.from('attachments').remove([attachment.storage_path]);
        // Remove from DB
        const { error: deleteError } = await supabase_1.supabaseAdmin
            .from('attachments')
            .delete()
            .eq('id', attachmentId);
        if (deleteError) {
            res.status(500).json({ error: deleteError.message });
            return;
        }
        res.json({ message: 'Attachment deleted successfully' });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to delete attachment' });
    }
});
exports.default = router;
