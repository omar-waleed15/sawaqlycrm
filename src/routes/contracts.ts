import { Router, Response } from 'express';
import { supabaseAdmin } from '../lib/supabase';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { ownerOrSales } from '../middleware/roleCheck';

const router = Router();

// GET /api/contracts/finance-stats — Get overview stats for dashboard
router.get('/finance-stats', authMiddleware, ownerOrSales, async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    // 1. Total Clients
    const { count: totalClients, error: clientsError } = await supabaseAdmin
      .from('clients')
      .select('*', { count: 'exact', head: true });

    if (clientsError) {
      res.status(500).json({ error: clientsError.message });
      return;
    }

    // 2. Active Projects
    const { count: activeProjects, error: projectsError } = await supabaseAdmin
      .from('projects')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');

    if (projectsError) {
      res.status(500).json({ error: projectsError.message });
      return;
    }

    // 3. Get all active RECURRING contracts for MRR (Monthly Recurring Revenue) calculations
    const { data: activeContracts, error: contractsError } = await supabaseAdmin
      .from('contracts')
      .select('amount, billing_cycle, is_recurring')
      .eq('status', 'active');

    if (contractsError) {
      res.status(500).json({ error: contractsError.message });
      return;
    }

    let monthlyRevenue = 0;
    if (activeContracts) {
      activeContracts.forEach(c => {
        // Only include recurring contracts in MRR
        if (!c.is_recurring) return;
        const amount = Number(c.amount) || 0;
        if (c.billing_cycle === 'monthly') {
          monthlyRevenue += amount;
        } else if (c.billing_cycle === 'quarterly') {
          monthlyRevenue += amount / 3;
        } else if (c.billing_cycle === 'yearly') {
          monthlyRevenue += amount / 12;
        }
      });
    }

    // 4. Count upcoming renewals in the next 30 days
    const today = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(today.getDate() + 30);

    const todayStr = today.toISOString().split('T')[0];
    const thirtyDaysStr = thirtyDaysFromNow.toISOString().split('T')[0];

    const { count: upcomingRenewalsCount, error: renewalError } = await supabaseAdmin
      .from('contracts')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active')
      .gte('renewal_date', todayStr)
      .lte('renewal_date', thirtyDaysStr);

    if (renewalError) {
      res.status(500).json({ error: renewalError.message });
      return;
    }

    let totalExpensesThisMonth = 0;
    try {
      const start = `${todayStr.substring(0, 7)}-01`;
      const year = today.getFullYear();
      const month = today.getMonth() + 1;
      const nextMonth = month === 12 ? 1 : month + 1;
      const nextYear = month === 12 ? year + 1 : year;
      const nextMonthStr = nextMonth < 10 ? `0${nextMonth}` : nextMonth;
      const end = `${nextYear}-${nextMonthStr}-01`;

      const { data: expenses, error: expError } = await supabaseAdmin
        .from('expenses')
        .select('amount')
        .gte('date', start)
        .lt('date', end);

      const { data: salaries, error: salError } = await supabaseAdmin
        .from('salaries')
        .select('amount')
        .eq('month', start);

      if (!expError && !salError) {
        const totalSalaries = (salaries || []).reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
        const totalOther = (expenses || []).reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
        totalExpensesThisMonth = totalSalaries + totalOther;
      }
    } catch (e) {
      console.warn("Failed to fetch expenses/salaries stats (migration might not be applied yet):", e);
    }

    res.json({
      stats: {
        totalClients: totalClients || 0,
        activeProjects: activeProjects || 0,
        monthlyRevenue: Math.round(monthlyRevenue * 100) / 100, // round to 2 decimals
        upcomingRenewalsCount: upcomingRenewalsCount || 0,
        totalExpensesThisMonth: Math.round(totalExpensesThisMonth * 100) / 100,
        netProfitThisMonth: Math.round((monthlyRevenue - totalExpensesThisMonth) * 100) / 100,
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to calculate finance stats' });
  }
});

// GET /api/contracts — List all contracts (with client, project, and installment details)
router.get('/', authMiddleware, ownerOrSales, async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { data, error } = await supabaseAdmin
      .from('contracts')
      .select(`
        *,
        client:clients(id, name, company, email, phone, status),
        project:projects(id, name, status, budget),
        installments:contract_installments(id, amount, due_date, paid, note, created_at)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    // Sort installments by due_date
    const contracts = (data || []).map((c: any) => ({
      ...c,
      installments: (c.installments || []).sort((a: any, b: any) =>
        new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
      ),
    }));

    res.json({ contracts });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch contracts' });
  }
});

// POST /api/contracts — Create a new contract
router.post('/', authMiddleware, ownerOrSales, async (req: AuthRequest, res: Response): Promise<void> => {
  const { client_id, project_id, name, amount, is_recurring, billing_cycle, status, start_date, renewal_date, installments } = req.body;

  if (!name || !client_id || !amount || !billing_cycle) {
    res.status(400).json({ error: 'Contract name, Client, Amount, and Billing Cycle are required' });
    return;
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('contracts')
      .insert({
        client_id,
        project_id: project_id || null,
        name,
        amount: Number(amount),
        is_recurring: is_recurring !== false,
        billing_cycle,
        status: status || 'active',
        start_date: start_date || null,
        renewal_date: renewal_date || null,
      })
      .select()
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    // Save installments if provided (only for one-time contracts)
    if (!is_recurring && Array.isArray(installments) && installments.length > 0) {
      const rows = installments.map((inst: any) => ({
        contract_id: data.id,
        amount: Number(inst.amount),
        due_date: inst.due_date,
        note: inst.note || null,
        paid: false,
      }));
      await supabaseAdmin.from('contract_installments').insert(rows);
    }

    // Refetch with all relations
    const { data: contractDetails } = await supabaseAdmin
      .from('contracts')
      .select(`
        *,
        client:clients(id, name, company, email, phone, status),
        project:projects(id, name, status, budget),
        installments:contract_installments(id, amount, due_date, paid, note, created_at)
      `)
      .eq('id', data.id)
      .single();

    res.status(201).json({ contract: contractDetails || data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create contract' });
  }
});

// PUT /api/contracts/:id — Update a contract
router.put('/:id', authMiddleware, ownerOrSales, async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { client_id, project_id, name, amount, is_recurring, billing_cycle, status, start_date, renewal_date, installments } = req.body;

  try {
    const updates: Record<string, any> = {};
    if (client_id !== undefined) updates.client_id = client_id;
    if (project_id !== undefined) updates.project_id = project_id || null;
    if (name !== undefined) updates.name = name;
    if (amount !== undefined) updates.amount = Number(amount);
    if (is_recurring !== undefined) updates.is_recurring = is_recurring;
    if (billing_cycle !== undefined) updates.billing_cycle = billing_cycle;
    if (status !== undefined) updates.status = status;
    if (start_date !== undefined) updates.start_date = start_date || null;
    if (renewal_date !== undefined) updates.renewal_date = renewal_date || null;

    const { data, error } = await supabaseAdmin
      .from('contracts')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    // Replace installments if provided
    if (Array.isArray(installments)) {
      // Delete old installments
      await supabaseAdmin.from('contract_installments').delete().eq('contract_id', id);
      // Insert new ones
      if (installments.length > 0) {
        const rows = installments.map((inst: any) => ({
          contract_id: id,
          amount: Number(inst.amount),
          due_date: inst.due_date,
          note: inst.note || null,
          paid: inst.paid || false,
        }));
        await supabaseAdmin.from('contract_installments').insert(rows);
      }
    }

    // Refetch with all relations
    const { data: contractDetails } = await supabaseAdmin
      .from('contracts')
      .select(`
        *,
        client:clients(id, name, company, email, phone, status),
        project:projects(id, name, status, budget),
        installments:contract_installments(id, amount, due_date, paid, note, created_at)
      `)
      .eq('id', data.id)
      .single();

    res.json({ contract: contractDetails || data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update contract' });
  }
});

// PATCH /api/contracts/:id/installments/:iid/paid — Toggle installment paid status
router.patch('/:id/installments/:iid/paid', authMiddleware, ownerOrSales, async (req: AuthRequest, res: Response): Promise<void> => {
  const { iid } = req.params;
  const { paid } = req.body;

  try {
    const { data, error } = await supabaseAdmin
      .from('contract_installments')
      .update({ paid: Boolean(paid) })
      .eq('id', iid)
      .select()
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ installment: data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update installment' });
  }
});

// DELETE /api/contracts/:id — Delete a contract
router.delete('/:id', authMiddleware, ownerOrSales, async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;

  try {
    const { error } = await supabaseAdmin
      .from('contracts')
      .delete()
      .eq('id', id);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ message: 'Contract deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete contract' });
  }
});

export default router;
