"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = void 0;
const supabase_1 = require("../lib/supabase");
const authMiddleware = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'No token provided' });
        return;
    }
    const token = authHeader.split(' ')[1];
    try {
        // Verify the token with Supabase
        const { data: { user }, error } = await supabase_1.supabaseAdmin.auth.getUser(token);
        if (error || !user) {
            res.status(401).json({ error: 'Invalid or expired token' });
            return;
        }
        // Fetch profile from profiles table
        const { data: profile, error: profileError } = await supabase_1.supabaseAdmin
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();
        if (profileError || !profile) {
            res.status(401).json({ error: 'User profile not found' });
            return;
        }
        req.user = {
            id: user.id,
            email: profile.email,
            name: profile.name,
            role: profile.role,
        };
        next();
    }
    catch (err) {
        res.status(401).json({ error: 'Token verification failed' });
    }
};
exports.authMiddleware = authMiddleware;
