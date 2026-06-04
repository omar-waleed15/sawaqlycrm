"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const supabase_1 = require("../lib/supabase");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// POST /api/auth/login
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        res.status(400).json({ error: 'Email and password are required' });
        return;
    }
    try {
        const { data, error } = await supabase_1.supabaseAdmin.auth.signInWithPassword({
            email,
            password,
        });
        if (error || !data.user || !data.session) {
            res.status(401).json({ error: 'Invalid email or password' });
            return;
        }
        // Fetch profile
        const { data: profile, error: profileError } = await supabase_1.supabaseAdmin
            .from('profiles')
            .select('*')
            .eq('id', data.user.id)
            .single();
        if (profileError || !profile) {
            res.status(404).json({ error: 'User profile not found' });
            return;
        }
        res.json({
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
            user: {
                id: profile.id,
                name: profile.name,
                email: profile.email,
                role: profile.role,
                avatar_url: profile.avatar_url,
            },
        });
    }
    catch (err) {
        res.status(500).json({ error: 'Login failed' });
    }
});
// GET /api/auth/me
router.get('/me', auth_1.authMiddleware, async (req, res) => {
    res.json({ user: req.user });
});
// POST /api/auth/logout
router.post('/logout', auth_1.authMiddleware, async (_req, res) => {
    res.json({ message: 'Logged out successfully' });
});
exports.default = router;
