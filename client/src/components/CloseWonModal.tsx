'use client';

import { useState, useEffect } from 'react';
import { Client } from '@/types';
import { salesApi } from '@/lib/api';
import Modal from '@/components/Modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';

interface CloseWonModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: Client | null;
  t: any;
  locale: string;
  onSuccess: () => void;
}

export default function CloseWonModal({
  isOpen,
  onClose,
  client,
  t,
  locale,
  onSuccess,
}: CloseWonModalProps) {
  const [contractName, setContractName] = useState('');
  const [amount, setAmount] = useState('');
  const [isRecurring, setIsRecurring] = useState('recurring'); // 'recurring' | 'one_time'
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [startDate, setStartDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (client) {
      setContractName(`${client.company || client.name} - ${t('clients.contractValueKPI') || 'Contract'}`);
      setAmount('');
      setIsRecurring('recurring');
      setBillingCycle('monthly');
      setStartDate(new Date().toISOString().split('T')[0]);
      setErrorMsg('');
    }
  }, [client, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client) return;

    if (!contractName) {
      setErrorMsg('Contract name is required');
      return;
    }

    if (!amount || Number(amount) <= 0) {
      setErrorMsg('Valid contract amount is required');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg('');
      await salesApi.closeWon(client.id, {
        name: contractName,
        amount: Number(amount),
        is_recurring: isRecurring === 'recurring',
        billing_cycle: isRecurring === 'recurring' ? billingCycle : 'one_time',
        start_date: startDate || undefined,
      } as any);

      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to close won');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${t('sales.closeWon') || 'Close Won Deal'}: ${client?.name}`}
      maxWidth={520}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-start">
        {errorMsg && (
          <div className="bg-destructive/10 border border-destructive/30 text-destructive text-xs p-2.5 rounded-md">
            {errorMsg}
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="contract_name">{t('clients.contractName') || 'Contract / Deal Name'} *</Label>
          <Input
            id="contract_name"
            placeholder="e.g. Annual Marketing Package"
            value={contractName}
            onChange={e => setContractName(e.target.value)}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="contract_amount">{t('clients.valueCol') || 'Contract Value ($)'} *</Label>
            <Input
              id="contract_amount"
              type="number"
              min="1"
              placeholder="e.g. 1500"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="contract_start">{t('finance.startDate') || 'Start Date'}</Label>
            <Input
              id="contract_start"
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="recurring_type">{t('finance.transactionType') || 'Payment Scheme'}</Label>
            <Select value={isRecurring} onValueChange={val => setIsRecurring(val || 'recurring')}>
              <SelectTrigger id="recurring_type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recurring">🔁 {t('finance.recurring') || 'Recurring'}</SelectItem>
                <SelectItem value="one_time">💵 {t('finance.oneTime') || 'One Time'}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isRecurring === 'recurring' && (
            <div className="flex flex-col gap-1.5 slide-down">
              <Label htmlFor="billing_cycle">{t('finance.billingCycle') || 'Billing Cycle'}</Label>
              <Select value={billingCycle} onValueChange={val => setBillingCycle(val || 'monthly')}>
                <SelectTrigger id="billing_cycle">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">{t('finance.monthly') || 'Monthly'}</SelectItem>
                  <SelectItem value="quarterly">{t('finance.quarterly') || 'Quarterly'}</SelectItem>
                  <SelectItem value="yearly">{t('finance.yearly') || 'Yearly'}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-3 border-t mt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold" disabled={submitting}>
            {submitting ? (
              <><Loader2 className="size-4 animate-spin mr-1.5" /> {t('common.loading')}</>
            ) : (
              t('common.confirm') || 'Confirm & Close Won'
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
