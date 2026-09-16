'use client';

import { useState } from 'react';
import { useLanguage } from '@/lib/i18n';
import Modal from '@/components/Modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { salariesApi } from '@/lib/api';

interface FinancialActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  salaryId: string;
  type: 'advance' | 'penalty' | 'bonus';
  memberName: string;
  onSaved: () => void;
}

export default function FinancialActionModal({
  isOpen,
  onClose,
  salaryId,
  type,
  memberName,
  onSaved,
}: FinancialActionModalProps) {
  const { t } = useLanguage();

  const [amount, setAmount] = useState<number | ''>('');
  const [notes, setNotes] = useState<string>('');
  const [date, setDate] = useState<string>(new Date().toISOString().substring(0, 10));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const title =
    type === 'advance'
      ? `${t('profile.addAdvance')} — ${memberName}`
      : type === 'penalty'
      ? `${t('profile.addDeduction')} — ${memberName}`
      : `${t('profile.addBonus')} — ${memberName}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) {
      setError('Please enter a valid positive amount');
      return;
    }

    setSaving(true);
    setError('');

    try {
      if (type === 'advance') {
        await salariesApi.createAdvance(salaryId, {
          amount: Number(amount),
          notes: notes.trim() || undefined,
          date: date || undefined,
        });
      } else if (type === 'penalty') {
        await salariesApi.createPenalty(salaryId, {
          amount: Number(amount),
          notes: notes.trim() || undefined,
        });
      } else if (type === 'bonus') {
        await salariesApi.createBonus(salaryId, {
          amount: Number(amount),
          notes: notes.trim() || undefined,
        });
      }

      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save record');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <form onSubmit={handleSubmit} className="space-y-4 text-start">
        {error && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs font-semibold">
            {error}
          </div>
        )}

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">{t('profile.amount')} ($ / EGP)</Label>
            <Input
              type="number"
              min="1"
              step="any"
              required
              placeholder="e.g. 500"
              value={amount}
              onChange={e => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
              className="h-9 text-xs"
            />
          </div>

          {type === 'advance' && (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{t('profile.date')}</Label>
              <Input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">{t('profile.notes')}</Label>
            <Textarea
              rows={3}
              placeholder={
                type === 'advance'
                  ? 'Reason for advance or repayment notes...'
                  : type === 'penalty'
                  ? 'Violation reason, late penalty details, or disciplinary notes...'
                  : 'Bonus description or incentive reason...'
              }
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="text-xs resize-none"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="h-9 text-xs"
          >
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            disabled={saving}
            size="sm"
            className="h-9 text-xs bg-[#1D61E7] hover:bg-[#1553c7] text-white"
          >
            {saving ? t('common.loading') : t('common.save')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
