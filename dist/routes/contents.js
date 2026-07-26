"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const supabase_1 = require("../lib/supabase");
const auth_1 = require("../middleware/auth");
const multer_1 = __importDefault(require("multer"));
const router = (0, express_1.Router)();
const dashboardUserOnly = (req, res, next) => {
    if (!req.user || req.user.role === 'client' || req.user.role === 'sales' || req.user.role === 'member' || req.user.role === 'graphic_designer' || req.user.role === 'video_editor' || req.user.role === 'reel_maker') {
        res.status(403).json({ error: 'Access denied. Authorized roles only.' });
        return;
    }
    next();
};
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit (for videos)
});
// GET /api/contents — Fetch all content items
router.get('/', auth_1.authMiddleware, dashboardUserOnly, async (req, res) => {
    try {
        const { client_id } = req.query;
        let query = supabase_1.supabaseAdmin
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
    }
    catch (err) {
        res.status(500).json({ error: err.message || 'Failed to fetch content items' });
    }
});
// POST /api/contents — Create a new content item
router.post('/', auth_1.authMiddleware, dashboardUserOnly, async (req, res) => {
    const { client_id, title, caption, description, content_type, sound, drive_link, media_urls, platform, scheduled_date } = req.body;
    if (!content_type) {
        res.status(400).json({ error: 'Content type is required' });
        return;
    }
    try {
        const { data, error } = await supabase_1.supabaseAdmin
            .from('contents')
            .insert({
            client_id: client_id || null,
            title: title || null,
            caption: caption || null,
            description: description || null,
            content_type,
            sound: sound || null,
            drive_link: drive_link || null,
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
    }
    catch (err) {
        res.status(500).json({ error: err.message || 'Failed to create content item' });
    }
});
// PUT /api/contents/:id — Update a content item
router.put('/:id', auth_1.authMiddleware, dashboardUserOnly, async (req, res) => {
    const { id } = req.params;
    const { client_id, title, caption, description, content_type, sound, drive_link, media_urls, platform, scheduled_date } = req.body;
    try {
        const updates = { updated_at: new Date().toISOString() };
        if (client_id !== undefined)
            updates.client_id = client_id || null;
        if (title !== undefined)
            updates.title = title || null;
        if (caption !== undefined)
            updates.caption = caption || null;
        if (description !== undefined)
            updates.description = description || null;
        if (content_type !== undefined)
            updates.content_type = content_type;
        if (sound !== undefined)
            updates.sound = sound || null;
        if (drive_link !== undefined)
            updates.drive_link = drive_link || null;
        if (media_urls !== undefined)
            updates.media_urls = media_urls;
        if (platform !== undefined)
            updates.platform = platform || null;
        if (scheduled_date !== undefined)
            updates.scheduled_date = scheduled_date || null;
        const { data, error } = await supabase_1.supabaseAdmin
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
    }
    catch (err) {
        res.status(500).json({ error: err.message || 'Failed to update content item' });
    }
});
// DELETE /api/contents/:id — Delete a content item
router.delete('/:id', auth_1.authMiddleware, dashboardUserOnly, async (req, res) => {
    const { id } = req.params;
    try {
        const { error } = await supabase_1.supabaseAdmin
            .from('contents')
            .delete()
            .eq('id', id);
        if (error) {
            res.status(500).json({ error: error.message });
            return;
        }
        res.json({ message: 'Content item deleted successfully' });
    }
    catch (err) {
        res.status(500).json({ error: err.message || 'Failed to delete content item' });
    }
});
// POST /api/contents/upload — Upload multiple files to Supabase Storage
router.post('/upload', auth_1.authMiddleware, dashboardUserOnly, upload.array('files', 10), async (req, res) => {
    try {
        const files = req.files;
        if (!files || files.length === 0) {
            res.status(400).json({ error: 'No files provided' });
            return;
        }
        const publicUrls = [];
        for (const file of files) {
            const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
            const storagePath = `contents/${Date.now()}_${sanitizedName}`;
            const { error: uploadError } = await supabase_1.supabaseAdmin.storage
                .from('attachments')
                .upload(storagePath, file.buffer, {
                contentType: file.mimetype || 'application/octet-stream',
                upsert: false,
            });
            if (uploadError) {
                res.status(500).json({ error: `Upload error for ${file.originalname}: ${uploadError.message}` });
                return;
            }
            const { data: urlData } = supabase_1.supabaseAdmin.storage
                .from('attachments')
                .getPublicUrl(storagePath);
            publicUrls.push(urlData.publicUrl);
        }
        res.status(201).json({ public_urls: publicUrls });
    }
    catch (err) {
        res.status(500).json({ error: err.message || 'Failed to upload files' });
    }
});
exports.default = router;
