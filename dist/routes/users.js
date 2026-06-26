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
const router = (0, express_1.Router)();
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit for avatars is plenty
});
// GET /api/users — List all team members (owner, team leader, sales)
router.get('/', auth_1.authMiddleware, async (req, res) => {
    if (!req.user || !['owner', 'team_leader', 'sales', 'moderation', 'account_manager'].includes(req.user.role)) {
        res.status(403).json({ error: 'Access denied.' });
        return;
    }
    try {
        const { data, error } = await supabase_1.supabaseAdmin
            .from('profiles')
            .select('id, name, email, role, avatar_url, created_at')
            .order('created_at', { ascending: false });
        if (error) {
            res.status(500).json({ error: error.message });
            return;
        }
        res.json({ users: data });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});
// GET /api/users/performance — Get performance stats for team members (owner only)
router.get('/performance', auth_1.authMiddleware, roleCheck_1.ownerOnly, async (req, res) => {
    const { startDate, endDate } = req.query;
    try {
        const sDate = startDate ? String(startDate) : undefined;
        const eDate = endDate ? String(endDate) : undefined;
        const currentMonthStr = new Date().toISOString().substring(0, 7);
        // 1. Fetch profiles
        const profilesPromise = supabase_1.supabaseAdmin
            .from('profiles')
            .select('id, name, email, role, avatar_url, created_at')
            .order('created_at', { ascending: false });
        // 2. Fetch task assignees within the date window
        let assigneesQuery = supabase_1.supabaseAdmin
            .from('task_assignees')
            .select('user_id, status, rating, assigned_at, total_time_spent');
        if (sDate)
            assigneesQuery = assigneesQuery.gte('assigned_at', sDate);
        if (eDate)
            assigneesQuery = assigneesQuery.lte('assigned_at', eDate);
        // 3. Fetch clients (leads) within the date window
        let clientsQuery = supabase_1.supabaseAdmin
            .from('clients')
            .select('sales_rep_id, created_at, pipeline_stage');
        if (sDate)
            clientsQuery = clientsQuery.gte('created_at', sDate);
        if (eDate)
            clientsQuery = clientsQuery.lte('created_at', eDate);
        // 4. Fetch call logs within the date window
        let callsQuery = supabase_1.supabaseAdmin
            .from('sales_call_logs')
            .select('sales_rep_id, call_date');
        if (sDate)
            callsQuery = callsQuery.gte('call_date', sDate);
        if (eDate)
            callsQuery = callsQuery.lte('call_date', eDate);
        // 5. Fetch contracts within the date window
        let contractsQuery = supabase_1.supabaseAdmin
            .from('contracts')
            .select('sales_rep_id, amount, created_at');
        if (sDate)
            contractsQuery = contractsQuery.gte('created_at', sDate);
        if (eDate)
            contractsQuery = contractsQuery.lte('created_at', eDate);
        // 6. Fetch task targets for the current month
        const targetsPromise = supabase_1.supabaseAdmin
            .from('task_targets')
            .select('user_id, target_tasks')
            .eq('month', currentMonthStr);
        // 7. Fetch sales targets for the current month
        const salesTargetsPromise = supabase_1.supabaseAdmin
            .from('sales_targets')
            .select('user_id, target_amount')
            .eq('month', currentMonthStr);
        const [{ data: profiles, error: profilesErr }, { data: assignees, error: assigneesErr }, { data: clients, error: clientsErr }, { data: calls, error: callsErr }, { data: contracts, error: contractsErr }, { data: targets, error: targetsErr }, { data: salesTargets, error: salesTargetsErr }] = await Promise.all([
            profilesPromise,
            assigneesQuery,
            clientsQuery,
            callsQuery,
            contractsQuery,
            targetsPromise,
            salesTargetsPromise
        ]);
        if (profilesErr)
            throw profilesErr;
        if (assigneesErr)
            throw assigneesErr;
        if (clientsErr)
            throw clientsErr;
        if (callsErr)
            throw callsErr;
        if (contractsErr)
            throw contractsErr;
        if (targetsErr)
            throw targetsErr;
        if (salesTargetsErr)
            throw salesTargetsErr;
        const targetMap = new Map((targets || []).map(t => [t.user_id, t.target_tasks]));
        const salesTargetMap = new Map((salesTargets || []).map(t => [t.user_id, Number(t.target_amount)]));
        // Map profiles to performance stats
        const performanceData = (profiles || []).map(user => {
            // Aggregate task stats
            const userAssignments = (assignees || []).filter(a => a.user_id === user.id);
            const totalTasks = userAssignments.length;
            const completedTasks = userAssignments.filter(a => a.status === 'completed').length;
            const incompleteTasks = totalTasks - completedTasks;
            const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
            const ratedAssignments = userAssignments.filter(a => a.rating !== null && a.rating !== undefined);
            const averageRating = ratedAssignments.length > 0
                ? Math.round((ratedAssignments.reduce((acc, curr) => acc + (curr.rating || 0), 0) / ratedAssignments.length) * 10) / 10
                : null;
            const completedAssignments = userAssignments.filter(a => a.status === 'completed');
            const averageCompletionTime = completedAssignments.length > 0
                ? Math.round(completedAssignments.reduce((acc, curr) => acc + (curr.total_time_spent || 0), 0) / completedAssignments.length)
                : null;
            // Aggregate sales stats
            const userLeads = (clients || []).filter(c => c.sales_rep_id === user.id);
            const leadsManaged = userLeads.length;
            const userCalls = (calls || []).filter(c => c.sales_rep_id === user.id);
            const callsLogged = userCalls.length;
            const userContracts = (contracts || []).filter(c => c.sales_rep_id === user.id);
            const dealsWon = userContracts.length;
            const closedRevenue = userContracts.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
            const conversionRate = leadsManaged > 0 ? Math.round((dealsWon / leadsManaged) * 100) : 0;
            const meetingsDone = userLeads.filter(c => c.pipeline_stage === 'meeting_done').length;
            return {
                user,
                taskStats: {
                    totalTasks,
                    completedTasks,
                    incompleteTasks,
                    completionRate,
                    averageRating,
                    averageCompletionTime,
                    taskTarget: targetMap.get(user.id) || null
                },
                salesStats: {
                    leadsManaged,
                    callsLogged,
                    dealsWon,
                    closedRevenue,
                    conversionRate,
                    salesTarget: salesTargetMap.get(user.id) || null,
                    meetingsDone
                }
            };
        });
        res.json({ performance: performanceData });
    }
    catch (err) {
        console.error('Failed to compile performance stats:', err);
        res.status(500).json({ error: err.message || 'Failed to fetch performance data' });
    }
});
// PUT /api/users/profile — Update currently authenticated user's profile
router.put('/profile', auth_1.authMiddleware, async (req, res) => {
    if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }
    const { name, avatar_url } = req.body;
    try {
        const updates = {};
        if (name !== undefined)
            updates.name = name;
        if (avatar_url !== undefined)
            updates.avatar_url = avatar_url;
        if (Object.keys(updates).length === 0) {
            res.status(400).json({ error: 'No fields to update' });
            return;
        }
        const { data, error } = await supabase_1.supabaseAdmin
            .from('profiles')
            .update(updates)
            .eq('id', req.user.id)
            .select()
            .single();
        if (error) {
            res.status(500).json({ error: error.message });
            return;
        }
        res.json({ user: data });
    }
    catch (err) {
        res.status(500).json({ error: err.message || 'Failed to update profile' });
    }
});
// POST /api/users/profile/avatar — Upload avatar photo to Supabase storage
router.post('/profile/avatar', auth_1.authMiddleware, upload.single('avatar'), async (req, res) => {
    if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }
    if (!req.file) {
        res.status(400).json({ error: 'No file provided' });
        return;
    }
    try {
        const file = req.file;
        const cleanFilename = file.originalname.replace(/[^a-zA-Z0-9.]/g, '_');
        const storagePath = `avatars/${req.user.id}/${Date.now()}_${cleanFilename}`;
        // Upload to Supabase Storage in attachments bucket
        const { error: uploadError } = await supabase_1.supabaseAdmin.storage
            .from('attachments')
            .upload(storagePath, file.buffer, {
            contentType: file.mimetype,
            upsert: true,
        });
        if (uploadError) {
            res.status(500).json({ error: uploadError.message });
            return;
        }
        // Get public URL
        const { data: urlData } = supabase_1.supabaseAdmin.storage
            .from('attachments')
            .getPublicUrl(storagePath);
        res.json({ publicUrl: urlData.publicUrl });
    }
    catch (err) {
        res.status(500).json({ error: err.message || 'Failed to upload avatar' });
    }
});
// POST /api/users — Create a new team member (owner only)
router.post('/', auth_1.authMiddleware, roleCheck_1.ownerOnly, async (req, res) => {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password) {
        res.status(400).json({ error: 'Name, email, and password are required' });
        return;
    }
    const validRoles = ['owner', 'team_leader', 'sales', 'member', 'moderation', 'account_manager'];
    const userRole = validRoles.includes(role) ? role : 'member';
    try {
        // Create user in Supabase Auth
        const { data: authData, error: authError } = await supabase_1.supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
        });
        if (authError || !authData.user) {
            res.status(400).json({ error: authError?.message || 'Failed to create user' });
            return;
        }
        // Insert profile
        const { data: profile, error: profileError } = await supabase_1.supabaseAdmin
            .from('profiles')
            .insert({
            id: authData.user.id,
            name,
            email,
            role: userRole,
        })
            .select()
            .single();
        if (profileError) {
            // Rollback: delete auth user
            await supabase_1.supabaseAdmin.auth.admin.deleteUser(authData.user.id);
            res.status(500).json({ error: profileError.message });
            return;
        }
        res.status(201).json({ user: profile });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to create user' });
    }
});
// PUT /api/users/:id — Update user (owner only)
router.put('/:id', auth_1.authMiddleware, roleCheck_1.ownerOnly, async (req, res) => {
    const id = req.params.id;
    const { name, role, email, password } = req.body;
    try {
        // 1. Update Supabase Auth if email or password is provided
        const authUpdates = {};
        if (email) {
            authUpdates.email = email;
            authUpdates.email_confirm = true;
        }
        if (password) {
            if (password.length < 6) {
                res.status(400).json({ error: 'Password must be at least 6 characters' });
                return;
            }
            authUpdates.password = password;
        }
        if (Object.keys(authUpdates).length > 0) {
            const { error: authError } = await supabase_1.supabaseAdmin.auth.admin.updateUserById(id, authUpdates);
            if (authError) {
                res.status(400).json({ error: authError.message });
                return;
            }
        }
        // 2. Update profiles table
        const updates = {};
        if (name)
            updates.name = name;
        if (role && ['owner', 'team_leader', 'sales', 'member', 'moderation', 'account_manager'].includes(role))
            updates.role = role;
        if (email)
            updates.email = email;
        if (Object.keys(updates).length > 0) {
            const { data, error } = await supabase_1.supabaseAdmin
                .from('profiles')
                .update(updates)
                .eq('id', id)
                .select()
                .single();
            if (error) {
                res.status(500).json({ error: error.message });
                return;
            }
            res.json({ user: data });
        }
        else {
            // Just fetch the profile to return if no profile updates were requested
            const { data, error } = await supabase_1.supabaseAdmin
                .from('profiles')
                .select('*')
                .eq('id', id)
                .single();
            if (error) {
                res.status(500).json({ error: error.message });
                return;
            }
            res.json({ user: data });
        }
    }
    catch (err) {
        res.status(500).json({ error: err.message || 'Failed to update user' });
    }
});
// DELETE /api/users/:id — Remove a team member (owner only)
router.delete('/:id', auth_1.authMiddleware, roleCheck_1.ownerOnly, async (req, res) => {
    const id = req.params.id;
    try {
        // Delete from Supabase Auth (cascades to profiles via DB trigger)
        const { error } = await supabase_1.supabaseAdmin.auth.admin.deleteUser(id);
        if (error) {
            res.status(500).json({ error: error.message });
            return;
        }
        res.json({ message: 'User deleted successfully' });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to delete user' });
    }
});
exports.default = router;
