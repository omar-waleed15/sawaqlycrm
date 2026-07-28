import { Router, Response } from 'express';
import { supabaseAdmin } from '../lib/supabase';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { ownerOnly, ownerOrSales } from '../middleware/roleCheck';

const router = Router();

// GET /api/sales/dashboard — Fetch personal sales stats, targets, call logs, phone list, historical deals
router.get('/dashboard', authMiddleware, ownerOrSales, async (req: AuthRequest, res: Response): Promise<void> => {
  const isOwner = req.user!.role === 'owner' || req.user!.role === 'team_leader';
  let userId = req.user!.id;
  const filterUserId = req.query.userId && typeof req.query.userId === 'string' ? req.query.userId : null;

  if (isOwner && filterUserId && filterUserId !== 'all') {
    userId = filterUserId;
  }
  const today = new Date();
  const currentMonth = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}`;

  try {
    // 1. Fetch sales target for current month
    const { data: targetData } = await supabaseAdmin
      .from('sales_targets')
      .select('*')
      .eq('user_id', userId)
      .eq('month', currentMonth)
      .maybeSingle();

    // 2. Fetch clients associated with this rep (or all clients for owner without explicit userId filter)
    let clientsQuery = supabaseAdmin
      .from('clients')
      .select('*');

    if (isOwner && (!filterUserId || filterUserId === 'all')) {
      // Owner/TL viewing overall agency dashboard: fetch all clients/leads
    } else {
      // Fetch leads assigned to this rep OR unassigned leads
      clientsQuery = clientsQuery.or(`sales_rep_id.eq.${userId},sales_rep_id.is.null`);
    }

    const { data: clients, error: clientsErr } = await clientsQuery.order('created_at', { ascending: false });

    if (clientsErr) {
      res.status(500).json({ error: clientsErr.message });
      return;
    }

    // 3. Fetch contracts associated with this rep
    let contractsQuery = supabaseAdmin
      .from('contracts')
      .select('*, installments:contract_installments(*)');

    if (!isOwner || (filterUserId && filterUserId !== 'all')) {
      contractsQuery = contractsQuery.eq('sales_rep_id', userId);
    }

    const { data: contracts, error: contractsErr } = await contractsQuery;

    if (contractsErr) {
      res.status(500).json({ error: contractsErr.message });
      return;
    }

    // 4. Fetch call logs
    let callLogsQuery = supabaseAdmin
      .from('sales_call_logs')
      .select('*, client:clients(id, name, company)');

    if (!isOwner || (filterUserId && filterUserId !== 'all')) {
      callLogsQuery = callLogsQuery.or(`sales_rep_id.eq.${userId},sales_rep_id.is.null`);
    }

    const { data: callLogs } = await callLogsQuery.order('call_date', { ascending: false });

    // ── Compute achievements ────────────────────────────────────────────────
    let mrr = 0;
    let collectedRevenue = 0;
    
    (contracts || []).forEach((c: any) => {
      if (c.status !== 'active') return;
      const amount = Number(c.amount) || 0;

      if (c.is_recurring) {
        // Compute MRR contribution
        if (c.billing_cycle === 'monthly') mrr += amount;
        else if (c.billing_cycle === 'quarterly') mrr += amount / 3;
        else if (c.billing_cycle === 'yearly') mrr += amount / 12;

        // For simplicity: assume recurring revenue is fully collected for the months active
        collectedRevenue += amount;
      } else {
        // One-time: count only paid installments
        (c.installments || []).forEach((inst: any) => {
          if (inst.paid) {
            collectedRevenue += Number(inst.amount) || 0;
          }
        });
      }
    });

    const activeLeads = (clients || []).filter(c => c.pipeline_stage !== 'won');
    const historicalDeals = (clients || []).filter(c => c.pipeline_stage === 'won');
    const totalDealsWon = (clients || []).filter(c => c.pipeline_stage === 'won').length;
    const totalMeetingsDone = (clients || []).filter(c => c.pipeline_stage === 'meeting_done').length;

    res.json({
      target: targetData || null,
      achievements: {
        mrr: Math.round(mrr * 100) / 100,
        totalDealsWon,
        totalMeetingsDone,
        collectedRevenue: Math.round(collectedRevenue * 100) / 100,
      },
      phoneList: activeLeads,
      historicalDeals,
      callLogs: callLogs || [],
    });
  } catch (err) {
    console.error('Failed to compile sales dashboard stats:', err);
    res.status(500).json({ error: 'Internal server error calculating sales stats' });
  }
});

// POST /api/sales/target — Set or update target for sales rep (owner only)
router.post('/target', authMiddleware, ownerOnly, async (req: AuthRequest, res: Response): Promise<void> => {
  const { user_id, target_amount, month } = req.body;

  if (!user_id || target_amount === undefined || !month) {
    res.status(400).json({ error: 'user_id, target_amount, and month (YYYY-MM) are required' });
    return;
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('sales_targets')
      .upsert(
        { user_id, target_amount: Number(target_amount), month },
        { onConflict: 'user_id,month' }
      )
      .select()
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ target: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to set target' });
  }
});

// GET /api/sales/target/:userId/:month — Fetch target for a specific user and month (owner or self)
router.get('/target/:userId/:month', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const { userId, month } = req.params;
  const callerId = req.user!.id;
  const callerRole = req.user!.role;

  if (callerRole !== 'owner' && callerId !== userId) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('sales_targets')
      .select('*')
      .eq('user_id', userId)
      .eq('month', month)
      .maybeSingle();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ target: data || null });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch target' });
  }
});

// POST /api/sales/leads — Add a new prospective lead / deal (owner or sales)
router.post('/leads', authMiddleware, ownerOrSales, async (req: AuthRequest, res: Response): Promise<void> => {
  const body = req.body;
  const salesRepId = req.user!.id;

  try {
    if (Array.isArray(body)) {
      // Validate all items
      for (const item of body) {
        if (!item.name || !item.phone) {
          res.status(400).json({ error: 'Each lead in the list must have a name and phone number' });
          return;
        }
      }

      const insertData = body.map(item => ({
        name: item.name,
        company: item.company || null,
        email: item.email || null,
        address: item.address || null,
        phone: item.phone,
        status: 'active',
        pipeline_stage: item.pipeline_stage || 'new_lead',
        sales_rep_id: salesRepId,
      }));

      const { data, error } = await supabaseAdmin
        .from('clients')
        .insert(insertData)
        .select();

      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }

      res.status(201).json({ leads: data });
      return;
    }

    const { name, company, email, address, phone, pipeline_stage } = body;

    if (!name || !phone) {
      res.status(400).json({ error: 'Lead name and phone number are required' });
      return;
    }

    const { data, error } = await supabaseAdmin
      .from('clients')
      .insert({
        name,
        company: company || null,
        email: email || null,
        address: address || null,
        phone,
        status: 'active',
        pipeline_stage: pipeline_stage || 'new_lead',
        sales_rep_id: salesRepId,
      })
      .select()
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.status(201).json({ lead: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create lead(s)' });
  }
});

// GET /api/sales/leads/:leadId — Get a single lead with their details and call logs (owner or sales)
router.get('/leads/:leadId', authMiddleware, ownerOrSales, async (req: AuthRequest, res: Response): Promise<void> => {
  const { leadId } = req.params;
  const salesRepId = req.user!.id;

  try {
    const { data: lead, error: fetchErr } = await supabaseAdmin
      .from('clients')
      .select('*')
      .eq('id', leadId)
      .single();

    if (fetchErr || !lead) {
      res.status(404).json({ error: 'Lead not found' });
      return;
    }

    if (req.user!.role !== 'owner' && lead.sales_rep_id !== salesRepId && lead.sales_rep_id !== null) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // Fetch call logs for this lead
    const { data: callLogs } = await supabaseAdmin
      .from('sales_call_logs')
      .select('*')
      .eq('client_id', leadId)
      .order('call_date', { ascending: false });

    res.json({ lead, callLogs: callLogs || [] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch lead details' });
  }
});

// POST /api/sales/leads/:leadId/calls — Log a call outcome and comments (owner or sales)
router.post('/leads/:leadId/calls', authMiddleware, ownerOrSales, async (req: AuthRequest, res: Response): Promise<void> => {
  const { leadId } = req.params;
  const { notes, outcome, meeting_date, meeting_attendees, meeting_notes } = req.body;
  const salesRepId = req.user!.id;

  if (!outcome) {
    res.status(400).json({ error: 'Call outcome is required' });
    return;
  }

  try {
    // 1. Verify lead belongs to sales rep or is unassigned (or caller is owner)
    const { data: lead, error: fetchErr } = await supabaseAdmin
      .from('clients')
      .select('*')
      .eq('id', leadId)
      .single();

    if (fetchErr || !lead) {
      res.status(404).json({ error: 'Lead not found' });
      return;
    }

    if (req.user!.role !== 'owner' && lead.sales_rep_id !== salesRepId && lead.sales_rep_id !== null) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // 2. Insert call log
    const { error: logErr } = await supabaseAdmin
      .from('sales_call_logs')
      .insert({
        client_id: leadId,
        sales_rep_id: salesRepId,
        notes: notes || null,
        outcome,
      });

    if (logErr) {
      res.status(500).json({ error: logErr.message });
      return;
    }

    // 3. Update client stage & meeting_date if scheduled, and auto-assign sales_rep_id if unassigned
    const updates: Record<string, any> = { pipeline_stage: outcome };
    if (outcome === 'meeting_scheduled') {
      if (meeting_date) updates.meeting_date = meeting_date;
      if (Array.isArray(meeting_attendees)) updates.meeting_attendees = meeting_attendees;
      if (meeting_notes !== undefined) updates.meeting_notes = meeting_notes || null;
    }

    if (!lead.sales_rep_id) {
      updates.sales_rep_id = salesRepId;
    }

    const { data: updatedLead, error: updateErr } = await supabaseAdmin
      .from('clients')
      .update(updates)
      .eq('id', leadId)
      .select()
      .single();

    if (updateErr) {
      res.status(500).json({ error: updateErr.message });
      return;
    }

    // 4. Auto-generate Reminder for each invited team member
    if (outcome === 'meeting_scheduled' && Array.isArray(meeting_attendees) && meeting_attendees.length > 0) {
      const senderName = req.user?.name || 'A team member';
      const meetingDateFormatted = meeting_date ? new Date(meeting_date).toLocaleString('en-US', { timeZone: 'Africa/Cairo', dateStyle: 'medium', timeStyle: 'short' }) : 'Scheduled Date';
      const reminderText = `📅 Meeting Attendance Request: You are invited by ${senderName} to attend an in-person client meeting with "${lead.name}" on ${meetingDateFormatted}.${meeting_notes ? ` Notes/Location: ${meeting_notes}` : ''}`;

      const reminderRows = meeting_attendees.map((attendeeId: string) => ({
        sender_id: salesRepId,
        receiver_id: attendeeId,
        content: reminderText,
      }));

      try {
        await supabaseAdmin.from('reminders').insert(reminderRows);
      } catch (remErr) {
        console.error('Failed to auto-create meeting reminders:', remErr);
      }
    }

    res.json({ lead: updatedLead });
  } catch (err) {
    res.status(500).json({ error: 'Failed to log call' });
  }
});

// POST /api/sales/leads/:leadId/close-won — Close a deal (contract creation is optional)
router.post('/leads/:leadId/close-won', authMiddleware, ownerOrSales, async (req: AuthRequest, res: Response): Promise<void> => {
  const { leadId } = req.params;
  const { name, amount, is_recurring, billing_cycle, start_date, renewal_date, tasks } = req.body;
  const salesRepId = req.user!.id;

  try {
    // 1. Fetch lead & verify ownership
    const { data: lead, error: fetchErr } = await supabaseAdmin
      .from('clients')
      .select('*')
      .eq('id', leadId)
      .single();

    if (fetchErr || !lead) {
      res.status(404).json({ error: 'Lead not found' });
      return;
    }

    if (req.user!.role !== 'owner' && lead.sales_rep_id !== salesRepId && lead.sales_rep_id !== null) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // 2. Update client pipeline_stage to 'won', status to 'active', and sales_rep_id if not set
    const { error: updateErr } = await supabaseAdmin
      .from('clients')
      .update({
        pipeline_stage: 'won',
        status: 'active',
        sales_rep_id: lead.sales_rep_id || salesRepId,
      })
      .eq('id', leadId);

    if (updateErr) {
      res.status(500).json({ error: updateErr.message });
      return;
    }

    // 3. Create Contract (OPTIONAL: only if contract name and amount are provided)
    let contract: any = null;
    if (name && amount && Number(amount) > 0) {
      const { data: contractData, error: contractErr } = await supabaseAdmin
        .from('contracts')
        .insert({
          client_id: leadId,
          name,
          amount: Number(amount),
          is_recurring: is_recurring !== false,
          billing_cycle: is_recurring !== false ? (billing_cycle || 'monthly') : 'one_time',
          status: 'active',
          start_date: start_date || new Date().toISOString().split('T')[0],
          renewal_date: is_recurring !== false ? (renewal_date || null) : null,
          sales_rep_id: salesRepId,
        })
        .select()
        .single();

      if (!contractErr) {
        contract = contractData;
      }
    }

    // 4. Create tasks (OPTIONAL: only if tasks are provided)
    const createdTasks: any[] = [];
    if (Array.isArray(tasks) && tasks.length > 0) {
      for (const t of tasks) {
        const { data: task, error: taskErr } = await supabaseAdmin
          .from('tasks')
          .insert({
            title: t.title,
            description: t.description || null,
            priority: t.priority || 'medium',
            status: 'todo',
            due_date: t.dueDate || null,
            content_type: t.contentType || null,
            content_description: t.contentDescription || null,
            drive_link: t.driveLink || null,
            creator_id: salesRepId,
            client_id: leadId,
          })
          .select()
          .single();

        if (!taskErr && task) {
          const assigneesToInsert = (Array.isArray(t.assigneeIds) && t.assigneeIds.length > 0)
            ? t.assigneeIds
            : [salesRepId];

          for (const uid of assigneesToInsert) {
            await supabaseAdmin
              .from('task_assignees')
              .insert({ task_id: task.id, user_id: uid, status: 'todo' });
          }

          createdTasks.push(task);
        }
      }
    }

    res.status(201).json({
      message: 'Deal closed successfully!',
      contract,
      tasks: createdTasks,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to close deal' });
  }
});

// GET /api/sales/calendar-events — Fetch meetings, call logs, contracts for Sales Calendar
router.get('/calendar-events', authMiddleware, ownerOrSales, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const isOwner = req.user!.role === 'owner' || req.user!.role === 'team_leader';
    let targetUserId = req.user!.id;
    if (isOwner && req.query.userId && typeof req.query.userId === 'string' && req.query.userId !== 'all') {
      targetUserId = req.query.userId;
    }

    // 1. Fetch meetings (clients with meeting_date)
    let meetingsQuery = supabaseAdmin
      .from('clients')
      .select('*')
      .not('meeting_date', 'is', null);

    if (!isOwner || (req.query.userId && req.query.userId !== 'all')) {
      meetingsQuery = meetingsQuery.or(`sales_rep_id.eq.${targetUserId},meeting_attendees.cs.{${targetUserId}}`);
    }

    const { data: meetings, error: meetingsErr } = await meetingsQuery.order('meeting_date', { ascending: true });
    if (meetingsErr) { res.status(500).json({ error: meetingsErr.message }); return; }

    // 2. Fetch call logs
    let callsQuery = supabaseAdmin
      .from('sales_call_logs')
      .select('*, client:clients(id, name, company, phone, pipeline_stage)')
      .order('call_date', { ascending: false });

    if (!isOwner || (req.query.userId && req.query.userId !== 'all')) {
      callsQuery = callsQuery.eq('sales_rep_id', targetUserId);
    }

    const { data: callLogs, error: callsErr } = await callsQuery;
    if (callsErr) { res.status(500).json({ error: callsErr.message }); return; }

    // 3. Fetch contracts (Only for owner/team_leader; hidden for sales reps)
    let contracts: any[] = [];
    if (isOwner) {
      let contractsQuery = supabaseAdmin
        .from('contracts')
        .select('*, client:clients(id, name, company)')
        .order('created_at', { ascending: false });

      if (req.query.userId && req.query.userId !== 'all') {
        contractsQuery = contractsQuery.eq('sales_rep_id', targetUserId);
      }
      const { data: contractsData } = await contractsQuery;
      contracts = contractsData || [];
    }

    // 4. Fetch sales reps list for owner/TL filter dropdown
    let salesReps: any[] = [];
    if (isOwner) {
      const { data: reps } = await supabaseAdmin
        .from('profiles')
        .select('id, name, email, role, avatar_url')
        .in('role', ['sales', 'owner', 'team_leader']);
      salesReps = reps || [];
    }

    res.json({
      meetings: meetings || [],
      callLogs: callLogs || [],
      contracts,
      salesReps
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch sales calendar events' });
  }
});

export default router;
