import { Router, Response } from 'express';
import { supabaseAdmin } from '../lib/supabase';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { ownerOnly } from '../middleware/roleCheck';

const router = Router();

// GET /api/users — List all team members (owner, team leader, sales)
router.get('/', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.user || !['owner', 'team_leader', 'sales', 'moderation', 'account_manager'].includes(req.user.role)) {
    res.status(403).json({ error: 'Access denied.' });
    return;
  }
  try {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('id, name, email, role, avatar_url, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ users: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// GET /api/users/performance — Get performance stats for team members (owner only)
router.get('/performance', authMiddleware, ownerOnly, async (req: AuthRequest, res: Response): Promise<void> => {
  const { startDate, endDate } = req.query;

  try {
    const sDate = startDate ? String(startDate) : undefined;
    const eDate = endDate ? String(endDate) : undefined;
    const currentMonthStr = new Date().toISOString().substring(0, 7);

    // 1. Fetch profiles
    const profilesPromise = supabaseAdmin
      .from('profiles')
      .select('id, name, email, role, avatar_url, created_at')
      .order('created_at', { ascending: false });

    // 2. Fetch task assignees within the date window
    let assigneesQuery = supabaseAdmin
      .from('task_assignees')
      .select('user_id, status, rating, assigned_at, total_time_spent');
    if (sDate) assigneesQuery = assigneesQuery.gte('assigned_at', sDate);
    if (eDate) assigneesQuery = assigneesQuery.lte('assigned_at', eDate);

    // 3. Fetch clients (leads) within the date window
    let clientsQuery = supabaseAdmin
      .from('clients')
      .select('sales_rep_id, created_at, pipeline_stage');
    if (sDate) clientsQuery = clientsQuery.gte('created_at', sDate);
    if (eDate) clientsQuery = clientsQuery.lte('created_at', eDate);

    // 4. Fetch call logs within the date window
    let callsQuery = supabaseAdmin
      .from('sales_call_logs')
      .select('sales_rep_id, call_date');
    if (sDate) callsQuery = callsQuery.gte('call_date', sDate);
    if (eDate) callsQuery = callsQuery.lte('call_date', eDate);

    // 5. Fetch contracts within the date window
    let contractsQuery = supabaseAdmin
      .from('contracts')
      .select('sales_rep_id, amount, created_at');
    if (sDate) contractsQuery = contractsQuery.gte('created_at', sDate);
    if (eDate) contractsQuery = contractsQuery.lte('created_at', eDate);

    // 6. Fetch task targets for the current month
    const targetsPromise = supabaseAdmin
      .from('task_targets')
      .select('user_id, target_tasks')
      .eq('month', currentMonthStr);

    // 7. Fetch sales targets for the current month
    const salesTargetsPromise = supabaseAdmin
      .from('sales_targets')
      .select('user_id, target_amount')
      .eq('month', currentMonthStr);

    const [
      { data: profiles, error: profilesErr },
      { data: assignees, error: assigneesErr },
      { data: clients, error: clientsErr },
      { data: calls, error: callsErr },
      { data: contracts, error: contractsErr },
      { data: targets, error: targetsErr },
      { data: salesTargets, error: salesTargetsErr }
    ] = await Promise.all([
      profilesPromise,
      assigneesQuery,
      clientsQuery,
      callsQuery,
      contractsQuery,
      targetsPromise,
      salesTargetsPromise
    ]);

    if (profilesErr) throw profilesErr;
    if (assigneesErr) throw assigneesErr;
    if (clientsErr) throw clientsErr;
    if (callsErr) throw callsErr;
    if (contractsErr) throw contractsErr;
    if (targetsErr) throw targetsErr;
    if (salesTargetsErr) throw salesTargetsErr;

    const targetMap = new Map<string, number>((targets || []).map(t => [t.user_id, t.target_tasks]));
    const salesTargetMap = new Map<string, number>((salesTargets || []).map(t => [t.user_id, Number(t.target_amount)]));

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
  } catch (err: any) {
    console.error('Failed to compile performance stats:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch performance data' });
  }
});

// POST /api/users — Create a new team member (owner only)
router.post('/', authMiddleware, ownerOnly, async (req: AuthRequest, res: Response): Promise<void> => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password) {
    res.status(400).json({ error: 'Name, email, and password are required' });
    return;
  }

  const validRoles = ['owner', 'team_leader', 'sales', 'member', 'moderation', 'account_manager'];
  const userRole = validRoles.includes(role) ? role : 'member';

  try {
    // Create user in Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError || !authData.user) {
      res.status(400).json({ error: authError?.message || 'Failed to create user' });
      return;
    }

    // Insert profile
    const { data: profile, error: profileError } = await supabaseAdmin
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
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      res.status(500).json({ error: profileError.message });
      return;
    }

    res.status(201).json({ user: profile });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// PUT /api/users/:id — Update user (owner only)
router.put('/:id', authMiddleware, ownerOnly, async (req: AuthRequest, res: Response): Promise<void> => {
  const id = req.params.id as string;
  const { name, role, email, password } = req.body;

  try {
    // 1. Update Supabase Auth if email or password is provided
    const authUpdates: any = {};
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
      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(id, authUpdates);
      if (authError) {
        res.status(400).json({ error: authError.message });
        return;
      }
    }

    // 2. Update profiles table
    const updates: Record<string, string> = {};
    if (name) updates.name = name;
    if (role && ['owner', 'team_leader', 'sales', 'member', 'moderation', 'account_manager'].includes(role)) updates.role = role;
    if (email) updates.email = email;

    if (Object.keys(updates).length > 0) {
      const { data, error } = await supabaseAdmin
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
    } else {
      // Just fetch the profile to return if no profile updates were requested
      const { data, error } = await supabaseAdmin
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
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to update user' });
  }
});

// DELETE /api/users/:id — Remove a team member (owner only)
router.delete('/:id', authMiddleware, ownerOnly, async (req: AuthRequest, res: Response): Promise<void> => {
  const id = req.params.id as string;

  try {
    // Delete from Supabase Auth (cascades to profiles via DB trigger)
    const { error } = await supabaseAdmin.auth.admin.deleteUser(id);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

export default router;
