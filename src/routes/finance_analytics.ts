import { Router, Response } from 'express';
import { supabaseAdmin } from '../lib/supabase';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { ownerOnly, ownerOrSales } from '../middleware/roleCheck';

const router = Router();

router.get('/', authMiddleware, ownerOrSales, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const today = new Date();
    const currentMonth = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}`;
    const currentMonthFirst = `${currentMonth}-01`;

    // ── 1. Fetch all data ────────────────────────────────────────────────────
    const [contractsRes, expensesRes, salariesRes, clientsRes] = await Promise.all([
      supabaseAdmin.from('contracts').select('*, installments:contract_installments(*), client:clients(*)'),
      supabaseAdmin.from('expenses').select('*'),
      supabaseAdmin.from('salaries').select('*, user:profiles!salaries_user_id_fkey(id, name, email, role)'),
      supabaseAdmin.from('clients').select('*').eq('pipeline_stage', 'won'),
    ]);

    if (contractsRes.error || expensesRes.error || salariesRes.error || clientsRes.error) {
      console.error('Analytics Fetch Error:', {
        contracts: contractsRes.error?.message,
        expenses: expensesRes.error?.message,
        salaries: salariesRes.error?.message,
        clients: clientsRes.error?.message,
      });
      const firstError = contractsRes.error?.message || expensesRes.error?.message || salariesRes.error?.message || clientsRes.error?.message;
      res.status(500).json({ error: firstError || 'Failed to fetch analytics data' });
      return;
    }

    // Fetch salary installments separately to avoid schema cache issues
    const allSalaries = salariesRes.data || [];
    const salaryIds = allSalaries.map((s: any) => s.id);
    let salaryInstallmentsMap: Record<string, any[]> = {};
    if (salaryIds.length > 0) {
      const { data: instData, error: instError } = await supabaseAdmin
        .from('salary_installments')
        .select('*')
        .in('salary_id', salaryIds);
      if (!instError) {
        (instData || []).forEach((inst: any) => {
          if (!salaryInstallmentsMap[inst.salary_id]) salaryInstallmentsMap[inst.salary_id] = [];
          salaryInstallmentsMap[inst.salary_id].push(inst);
        });
      }
    }

    const contracts = contractsRes.data || [];
    const expenses = expensesRes.data || [];
    const wonClients = clientsRes.data || [];

    // ── 2. Build month ranges ────────────────────────────────────────────────
    const last12Months: string[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      last12Months.push(`${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`);
    }

    const next6Months: string[] = [];
    for (let i = 1; i <= 6; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
      next6Months.push(`${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`);
    }

    // ── 3. Monthly buckets ───────────────────────────────────────────────────
    const monthlyData: Record<string, any> = {};
    for (const m of last12Months) {
      monthlyData[m] = {
        month: m,
        revenue: 0,
        collectedRevenue: 0,
        expenses: 0,
        salaries: 0,
        // dynamic category buckets built below
        categoryBreakdown: {} as Record<string, number>,
      };
    }

    const projections: Record<string, any> = {};
    for (const m of next6Months) {
      projections[m] = {
        month: m,
        projectedRevenue: 0,
        projectedRecurringRevenue: 0,
        projectedExpenses: 0,
        projectedSalaries: 0,
        projectedAdsExpenses: 0,
      };
    }

    // ── 4. Contracts → revenue ───────────────────────────────────────────────
    // MRR: recurring revenue from active contracts (what we earn each month right now)
    let mrr = 0;
    contracts.forEach((contract: any) => {
      if (contract.status !== 'active' && contract.status !== 'completed') return;

      const startMonth = contract.start_date ? contract.start_date.substring(0, 7) : null;
      const endMonth = contract.renewal_date ? contract.renewal_date.substring(0, 7) : null;

      if (contract.is_recurring) {
        let monthlyVal = 0;
        if (contract.billing_cycle === 'monthly') monthlyVal = Number(contract.amount);
        else if (contract.billing_cycle === 'quarterly') monthlyVal = Number(contract.amount) / 3;
        else if (contract.billing_cycle === 'yearly') monthlyVal = Number(contract.amount) / 12;

        // Count toward MRR only if still active this month
        if (contract.status === 'active' && (!endMonth || endMonth >= currentMonth) && (!startMonth || startMonth <= currentMonth)) {
          mrr += monthlyVal;
        }

        last12Months.forEach(m => {
          if ((!startMonth || m >= startMonth) && (!endMonth || m <= endMonth)) {
            monthlyData[m].revenue += monthlyVal;
            monthlyData[m].collectedRevenue += monthlyVal; // Assume recurring is collected
          }
        });

        next6Months.forEach(m => {
          if ((!endMonth || m <= endMonth) && (!startMonth || m >= startMonth)) {
            projections[m].projectedRevenue += monthlyVal;
            projections[m].projectedRecurringRevenue += monthlyVal;
          }
        });
      } else {
        // One-time: distribute by installments
        (contract.installments || []).forEach((inst: any) => {
          if (!inst.due_date) return;
          const instMonth = inst.due_date.substring(0, 7);
          const amt = Number(inst.amount);

          if (monthlyData[instMonth]) {
            monthlyData[instMonth].revenue += amt;
            if (inst.paid) monthlyData[instMonth].collectedRevenue += amt;
          } else if (projections[instMonth]) {
            projections[instMonth].projectedRevenue += amt;
          }
        });
      }
    });

    // ── 5. Expenses → monthly buckets ────────────────────────────────────────
    // Collect all unique expense categories dynamically
    const allCategoryTotals: Record<string, number> = {};

    expenses.forEach((exp: any) => {
      if (exp.category === 'salary') return; // Handled via salaries table
      const expMonth = exp.date ? exp.date.substring(0, 7) : null;
      if (!expMonth) return;

      const amt = Number(exp.amount);
      const cat = exp.category || 'other';

      // LTM bucket
      if (monthlyData[expMonth]) {
        monthlyData[expMonth].expenses += amt;
        monthlyData[expMonth].categoryBreakdown[cat] = (monthlyData[expMonth].categoryBreakdown[cat] || 0) + amt;
        allCategoryTotals[cat] = (allCategoryTotals[cat] || 0) + amt;
      }

      // Recurring expense projections
      if (exp.is_recurring) {
        let monthlyExpVal = amt;
        if (exp.recurrence === 'yearly') monthlyExpVal = amt / 12;
        next6Months.forEach(m => {
          if (m > expMonth) {
            projections[m].projectedExpenses += monthlyExpVal;
            if (cat === 'ads') {
              projections[m].projectedAdsExpenses += monthlyExpVal;
            }
          }
        });
      }
    });

    // ── 6. Salaries → monthly buckets ────────────────────────────────────────
    // Current month salary total
    let currentMonthSalaryTotal = 0;

    allSalaries.forEach((sal: any) => {
      const amt = Number(sal.amount);
      const salMonth = sal.month ? sal.month.substring(0, 7) : null;
      if (!salMonth) return;

      if (sal.is_recurring) {
        if (monthlyData[salMonth]) {
          monthlyData[salMonth].expenses += amt;
          monthlyData[salMonth].salaries += amt;
          allCategoryTotals['salaries'] = (allCategoryTotals['salaries'] || 0) + amt;
        }

        // Count toward current month salary if this is a recurring record for current month
        if (salMonth === currentMonth) {
          currentMonthSalaryTotal += amt;
        }

        // Project salaries into future (recurring)
        next6Months.forEach(m => {
          projections[m].projectedExpenses += amt;
          projections[m].projectedSalaries += amt;
        });
      } else {
        // One-time salary: installments
        const installments = salaryInstallmentsMap[sal.id] || [];
        installments.forEach((inst: any) => {
          if (!inst.due_date) return;
          const instMonth = inst.due_date.substring(0, 7);
          const instAmt = Number(inst.amount);

          if (monthlyData[instMonth]) {
            monthlyData[instMonth].expenses += instAmt;
            monthlyData[instMonth].salaries += instAmt;
            allCategoryTotals['salaries'] = (allCategoryTotals['salaries'] || 0) + instAmt;
            if (instMonth === currentMonth) currentMonthSalaryTotal += instAmt;
          } else if (projections[instMonth]) {
            projections[instMonth].projectedExpenses += instAmt;
            projections[instMonth].projectedSalaries += instAmt;
          }
        });
      }
    });

    // ── 7. Compute net profit per month ──────────────────────────────────────
    for (const m of last12Months) {
      monthlyData[m].netProfit = monthlyData[m].revenue - monthlyData[m].expenses;
      monthlyData[m].profitMargin = monthlyData[m].revenue > 0
        ? Math.round((monthlyData[m].netProfit / monthlyData[m].revenue) * 1000) / 10
        : 0;
    }

    for (const m of next6Months) {
      projections[m].projectedNet = projections[m].projectedRevenue - projections[m].projectedExpenses;
    }

    // ── 8. Current Month Snapshot ────────────────────────────────────────────
    // Revenue: MRR + any one-time installments due this month
    let currentRevenue = mrr;
    contracts.forEach((contract: any) => {
      if (contract.status !== 'active' || contract.is_recurring) return;
      (contract.installments || []).forEach((inst: any) => {
        if (!inst.due_date) return;
        if (inst.due_date.substring(0, 7) === currentMonth) {
          currentRevenue += Number(inst.amount);
        }
      });
    });

    // Expenses this month: logged expenses + salaries for this month
    let currentGeneralExpenses = 0;
    const currentMonthExpCategoryBreakdown: Record<string, number> = {};

    expenses.forEach((exp: any) => {
      if (exp.category === 'salary') return;
      const expMonth = exp.date ? exp.date.substring(0, 7) : null;
      if (expMonth !== currentMonth) return;
      const amt = Number(exp.amount);
      currentGeneralExpenses += amt;
      const cat = exp.category || 'other';
      currentMonthExpCategoryBreakdown[cat] = (currentMonthExpCategoryBreakdown[cat] || 0) + amt;
    });

    // Also include recurring expenses from previous months that are still recurring
    // (already counted above via monthly data, but for "current" we use actual logged expenses for that month)
    const currentTotalExpenses = currentGeneralExpenses + currentMonthSalaryTotal;
    const currentProfit = currentRevenue - currentTotalExpenses;
    const currentMargin = currentRevenue > 0 ? Math.round((currentProfit / currentRevenue) * 1000) / 10 : 0;

    // ── 9. LTM metrics ───────────────────────────────────────────────────────
    const ltmRevenue = last12Months.reduce((sum, m) => sum + monthlyData[m].revenue, 0);
    const ltmExpenses = last12Months.reduce((sum, m) => sum + monthlyData[m].expenses, 0);
    const ltmNetProfit = ltmRevenue - ltmExpenses;
    const ltmMargin = ltmRevenue > 0 ? Math.round((ltmNetProfit / ltmRevenue) * 1000) / 10 : 0;

    // Burn rate: 3-month rolling average of expenses
    const last3 = last12Months.slice(-3);
    const burnRate = last3.reduce((sum, m) => sum + monthlyData[m].expenses, 0) / 3;

    // ── 10. Receivables Aging ────────────────────────────────────────────────
    const aging: any = { current: [], overdue1_30: [], overdue31_60: [], overdue61_90: [], overdue90Plus: [], totalOverdue: 0, totalOutstanding: 0 };
    const todayMs = today.getTime();

    contracts.forEach((contract: any) => {
      if (contract.status !== 'active') return;
      (contract.installments || []).forEach((inst: any) => {
        if (inst.paid || !inst.due_date) return;
        const due = new Date(inst.due_date);
        const diffDays = Math.ceil((todayMs - due.getTime()) / (1000 * 60 * 60 * 24));
        const amt = Number(inst.amount);
        const record = {
          installmentId: inst.id,
          contractId: contract.id,
          contractName: contract.name,
          clientName: contract.client?.name || 'Unknown',
          company: contract.client?.company || '',
          amount: amt,
          dueDate: inst.due_date,
          daysOverdue: diffDays,
        };
        aging.totalOutstanding += amt;
        if (diffDays <= 0) {
          aging.current.push(record);
        } else {
          aging.totalOverdue += amt;
          if (diffDays <= 30) aging.overdue1_30.push(record);
          else if (diffDays <= 60) aging.overdue31_60.push(record);
          else if (diffDays <= 90) aging.overdue61_90.push(record);
          else aging.overdue90Plus.push(record);
        }
      });
    });

    const sortByDays = (a: any, b: any) => b.daysOverdue - a.daysOverdue;
    aging.overdue1_30.sort(sortByDays);
    aging.overdue31_60.sort(sortByDays);
    aging.overdue61_90.sort(sortByDays);
    aging.overdue90Plus.sort(sortByDays);

    // ── 11. Top Clients by revenue ───────────────────────────────────────────
    const clientRevenueMap: Record<string, any> = {};
    contracts.forEach((contract: any) => {
      if (contract.status !== 'active') return;
      const client = contract.client;
      if (!client) return;
      if (!clientRevenueMap[client.id]) {
        clientRevenueMap[client.id] = { id: client.id, name: client.name, company: client.company || '', totalRevenue: 0, activeContractsCount: 0 };
      }
      let annualVal = Number(contract.amount);
      if (contract.billing_cycle === 'monthly') annualVal *= 12;
      else if (contract.billing_cycle === 'quarterly') annualVal *= 4;
      clientRevenueMap[client.id].totalRevenue += annualVal;
      clientRevenueMap[client.id].activeContractsCount += 1;
    });
    const topClients = Object.values(clientRevenueMap).sort((a: any, b: any) => b.totalRevenue - a.totalRevenue).slice(0, 5);

    // ── 12. Dynamic Expense Category Totals (LTM) ────────────────────────────
    // Build sorted list of categories by total spend
    const expenseCategoryList = Object.entries(allCategoryTotals)
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([key, value]) => ({ key, value }));

    // ── 13. Response ─────────────────────────────────────────────────────────
    res.json({
      currentMonth: {
        month: currentMonth,
        revenue: Math.round(currentRevenue * 100) / 100,
        expenses: Math.round(currentTotalExpenses * 100) / 100,
        salaries: Math.round(currentMonthSalaryTotal * 100) / 100,
        generalExpenses: Math.round(currentGeneralExpenses * 100) / 100,
        profit: Math.round(currentProfit * 100) / 100,
        profitMargin: currentMargin,
        expenseBreakdown: Object.entries(currentMonthExpCategoryBreakdown)
          .sort((a, b) => b[1] - a[1])
          .map(([key, value]) => ({ key, value: Math.round(value * 100) / 100 })),
      },
      monthlyData: Object.values(monthlyData).map((d: any) => ({
        ...d,
        revenue: Math.round(d.revenue * 100) / 100,
        collectedRevenue: Math.round(d.collectedRevenue * 100) / 100,
        expenses: Math.round(d.expenses * 100) / 100,
        salaries: Math.round(d.salaries * 100) / 100,
        netProfit: Math.round(d.netProfit * 100) / 100,
      })),
      projections: Object.values(projections).map((p: any) => ({
        ...p,
        projectedRevenue: Math.round(p.projectedRevenue * 100) / 100,
        projectedRecurringRevenue: Math.round(p.projectedRecurringRevenue * 100) / 100,
        projectedExpenses: Math.round(p.projectedExpenses * 100) / 100,
        projectedNet: Math.round(p.projectedNet * 100) / 100,
        projectedAdsExpenses: Math.round(p.projectedAdsExpenses * 100) / 100,
      })),
      expenseCategoryList,
      receivablesAging: aging,
      topClients,
      kpis: {
        mrr: Math.round(mrr * 100) / 100,
        activeClients: wonClients.length,
        burnRate: Math.round(burnRate * 100) / 100,
        outstandingReceivables: Math.round(aging.totalOutstanding * 100) / 100,
        overdueReceivables: Math.round(aging.totalOverdue * 100) / 100,
        ltmRevenue: Math.round(ltmRevenue * 100) / 100,
        ltmExpenses: Math.round(ltmExpenses * 100) / 100,
        ltmNetProfit: Math.round(ltmNetProfit * 100) / 100,
        ltmMargin,
      },
    });
  } catch (err) {
    console.error('Failed to compile finance analytics:', err);
    res.status(500).json({ error: 'Internal server error calculating analytics' });
  }
});

const formatLocalYYYYMMDD = (date: Date) => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const parseLocalDate = (dateStr: string): Date => {
  const [yyyy, mm, dd] = dateStr.split('-').map(Number);
  return new Date(yyyy, mm - 1, dd);
};

// GET /api/finance-analytics/custom-report — Get custom financial reports (owner only)
router.get('/custom-report', authMiddleware, ownerOnly, async (req: AuthRequest, res: Response): Promise<void> => {
  const { startDate, endDate } = req.query;

  if (!startDate || !endDate) {
    res.status(400).json({ error: 'startDate and endDate query parameters are required' });
    return;
  }

  try {
    const sDate = String(startDate);
    const eDate = String(endDate);

    const startMs = new Date(sDate).getTime();
    const endMs = new Date(eDate).getTime();

    // Fetch in parallel
    const [contractsRes, installmentsRes, expensesRes, salariesRes, salaryInstallmentsRes] = await Promise.all([
      supabaseAdmin.from('contracts').select('*, client:clients(name, company)'),
      supabaseAdmin.from('contract_installments').select('*, contract:contracts(name, is_recurring, client:clients(name, company))').gte('due_date', sDate).lte('due_date', eDate),
      supabaseAdmin.from('expenses').select('*').gte('date', sDate).lte('date', eDate),
      supabaseAdmin.from('salaries').select('*, user:profiles!salaries_user_id_fkey(name)').gte('month', sDate).lte('month', eDate),
      supabaseAdmin.from('salary_installments').select('*, salary:salaries(user:profiles!salaries_user_id_fkey(name))').gte('due_date', sDate).lte('due_date', eDate),
    ]);

    if (contractsRes.error) throw contractsRes.error;
    if (installmentsRes.error) throw installmentsRes.error;
    if (expensesRes.error) throw expensesRes.error;
    if (salariesRes.error) throw salariesRes.error;
    if (salaryInstallmentsRes.error) throw salaryInstallmentsRes.error;

    const lineItems: any[] = [];

    // 1. Process Contracts (Recurring) - Occurrence Basis
    (contractsRes.data || []).forEach((c: any) => {
      if (!c.is_recurring) return; // One-time contracts are handled via installments
      if (c.status !== 'active' && c.status !== 'completed') return;
      if (!c.start_date) return;

      const contractStart = parseLocalDate(c.start_date);
      
      // If the contract is no longer active, its last billing date is renewal_date
      const contractEnd = (c.status === 'expired' || c.status === 'cancelled' || c.status === 'completed') && c.renewal_date
        ? parseLocalDate(c.renewal_date)
        : parseLocalDate(eDate);

      let currentBillingDate = new Date(contractStart);
      let iterations = 0;

      while (currentBillingDate <= contractEnd && iterations < 500) {
        iterations++;
        const billingDateStr = formatLocalYYYYMMDD(currentBillingDate);

        // Check if the billing date falls inside the selected range
        if (billingDateStr >= sDate && billingDateStr <= eDate) {
          lineItems.push({
            id: `contract-recurring-${c.id}-${billingDateStr}`,
            name: `${c.name} (${c.client?.company || c.client?.name || 'Client'})`,
            category: 'recurring_contracts',
            type: 'income',
            amount: Number(c.amount),
            date: billingDateStr,
            status: 'active',
            notes: `Billing cycle payment triggered on ${billingDateStr}`
          });
        }

        // Advance to next cycle
        if (c.billing_cycle === 'monthly') {
          currentBillingDate.setMonth(currentBillingDate.getMonth() + 1);
        } else if (c.billing_cycle === 'quarterly') {
          currentBillingDate.setMonth(currentBillingDate.getMonth() + 3);
        } else if (c.billing_cycle === 'yearly') {
          currentBillingDate.setFullYear(currentBillingDate.getFullYear() + 1);
        } else {
          break; // Safety fallback
        }
      }
    });

    // 2. Process Contract Installments (One-Time)
    (installmentsRes.data || []).forEach((inst: any) => {
      // If the contract is recurring, it's already counted in the recurring section
      if (inst.contract?.is_recurring) return;

      lineItems.push({
        id: `contract-one-time-${inst.id}`,
        name: `${inst.contract?.name || 'Contract'} - Installment (${inst.contract?.client?.company || inst.contract?.client?.name || 'Client'})`,
        category: 'one_time_contracts',
        type: 'income',
        amount: Number(inst.amount),
        date: inst.due_date,
        status: inst.paid ? 'paid' : 'unpaid'
      });
    });

    // 3. Process Expenses
    (expensesRes.data || []).forEach((exp: any) => {
      if (exp.category === 'salary') return; // Handled below

      lineItems.push({
        id: `expense-${exp.id}`,
        name: exp.title,
        category: exp.category || 'other',
        type: 'expense',
        amount: Number(exp.amount),
        date: exp.date,
        status: 'paid'
      });
    });

    // 4. Process Salaries (Recurring)
    (salariesRes.data || []).forEach((sal: any) => {
      if (!sal.is_recurring) return; // Handled via installments

      lineItems.push({
        id: `salary-recurring-${sal.id}`,
        name: `Salary - ${sal.user?.name || 'Team Member'} (${sal.month.substring(0, 7)})`,
        category: 'salaries',
        type: 'expense',
        amount: Number(sal.amount),
        date: sal.month,
        status: sal.paid ? 'paid' : 'unpaid'
      });
    });

    // 5. Process Salary Installments (One-Time)
    (salaryInstallmentsRes.data || []).forEach((inst: any) => {
      lineItems.push({
        id: `salary-one-time-${inst.id}`,
        name: `Salary Installment - ${inst.salary?.user?.name || 'Team Member'}`,
        category: 'salaries',
        type: 'expense',
        amount: Number(inst.amount),
        date: inst.due_date,
        status: inst.paid ? 'paid' : 'unpaid'
      });
    });

    // Sort by date descending
    lineItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    res.json({ lineItems });
  } catch (err: any) {
    console.error('Failed to compile custom report:', err);
    res.status(500).json({ error: err.message || 'Failed to generate custom financial report' });
  }
});

export default router;
