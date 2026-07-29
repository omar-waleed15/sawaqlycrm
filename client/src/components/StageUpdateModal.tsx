'use client';

import { useState, useEffect } from 'react';
import { Client, User } from '@/types';
import { salesApi, usersApi } from '@/lib/api';
import { useLanguage } from '@/lib/i18n';
import Modal from '@/components/Modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toCairoISOString, getCairoTodayString } from '@/lib/dateUtils';
import { Calendar, Users, MapPin, Loader2, CheckCircle2, MessageSquare } from 'lucide-react';

interface StageUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: Client | null;
  targetStage: string | null;
  onSuccess: () => void;
}

const STAGE_LABELS: Record<string, { en: string; ar: string; icon: string }> = {
  new_lead:          { en: 'New Lead',          ar: 'عميل جديد',       icon: '✨' },
  contacted:         { en: 'Contacted',         ar: 'تم التواصل',      icon: '📞' },
  no_answer:         { en: 'No Answer',         ar: 'لا يوجد رد',      icon: '📵' },
  meeting_scheduled: { en: 'Meeting Scheduled', ar: 'اجتماع مجدول',    icon: '📅' },
  meeting_done:      { en: 'Meeting Done',      ar: 'اجتماع مكتمل',    icon: '✅' },
  negotiation:       { en: 'Negotiation',       ar: 'تفاوض',          icon: '🤝' },
  won:               { en: 'Close Won',         ar: 'مكسوب',          icon: '🟢' },
  lost:              { en: 'Lost',              ar: 'خسارة',          icon: '🔴' },
};

export default function StageUpdateModal({
  isOpen,
  onClose,
  client,
  targetStage,
  onSuccess,
}: StageUpdateModalProps) {
  const { t, locale } = useLanguage();
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Meeting specific fields
  const [meetingDate, setMeetingDate] = useState('');
  const [meetingAttendees, setMeetingAttendees] = useState<string[]>([]);
  const [meetingNotes, setMeetingNotes] = useState('');
  const [teamMembers, setTeamMembers] = useState<User[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  // Common log notes
  const [notes, setNotes] = useState('');

  const isMeetingScheduled = targetStage === 'meeting_scheduled';

  useEffect(() => {
    if (isOpen) {
      setErrorMsg('');
      setNotes('');
      setMeetingDate('');
      setMeetingAttendees([]);
      setMeetingNotes('');

      if (isMeetingScheduled && teamMembers.length === 0) {
        setLoadingMembers(true);
        usersApi.list()
          .then(res => {
            setTeamMembers((res.users || []).filter((u: User) => u.role !== 'client'));
          })
          .catch(() => {})
          .finally(() => setLoadingMembers(false));
      }
    }
  }, [isOpen, targetStage, isMeetingScheduled]);

  if (!isOpen || !client || !targetStage) return null;

  const stageInfo = STAGE_LABELS[targetStage] || { en: targetStage, ar: targetStage, icon: '📌' };
  const stageName = locale === 'ar' ? stageInfo.ar : stageInfo.en;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isMeetingScheduled && !meetingDate) {
      setErrorMsg(locale === 'ar' ? 'يرجى تحديد تاريخ ووقت الاجتماع' : 'Please select meeting date & time');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');

    try {
      const payload: any = {
        outcome: targetStage,
        notes: notes.trim() || undefined,
      };

      if (isMeetingScheduled) {
        payload.meeting_date = toCairoISOString(meetingDate);
        if (meetingAttendees.length > 0) payload.meeting_attendees = meetingAttendees;
        if (meetingNotes.trim()) payload.meeting_notes = meetingNotes.trim();
      }

      await salesApi.logCall(client.id, payload);
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update stage');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${stageInfo.icon} ${locale === 'ar' ? `تحديث المرحلة إلى: ${stageName}` : `Update Stage to: ${stageName}`}`}
      maxWidth={isMeetingScheduled ? 560 : 480}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {errorMsg && (
          <div className="bg-destructive/10 border border-destructive/30 text-destructive text-xs p-3 rounded-lg font-medium">
            {errorMsg}
          </div>
        )}

        {/* Client context header */}
        <div className="bg-muted/40 border p-3 rounded-xl flex items-center justify-between text-xs">
          <div>
            <span className="text-muted-foreground">{locale === 'ar' ? 'العميل: ' : 'Client: '}</span>
            <strong className="font-bold text-foreground">{client.name}</strong>
            {client.company && <span className="text-muted-foreground"> ({client.company})</span>}
          </div>
          <Badge variant="outline" className="text-[10px] font-bold">
            {stageInfo.icon} {stageName}
          </Badge>
        </div>

        {/* Meeting Scheduler Section (if targetStage === 'meeting_scheduled') */}
        {isMeetingScheduled && (
          <div className="flex flex-col gap-3.5 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 p-3.5 rounded-xl">
            <h4 className="text-xs font-bold text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
              <Calendar className="size-4 text-indigo-600" />
              {locale === 'ar' ? 'تفاصيل الاجتماع المجدول' : 'Scheduled Meeting Details'}
            </h4>

            {/* Date & Time */}
            <div className="flex flex-col gap-1">
              <Label htmlFor="meet-datetime" className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                📅 {locale === 'ar' ? 'تاريخ ووقت الاجتماع' : 'Meeting Date & Time'} *
              </Label>
              <Input
                id="meet-datetime"
                type="datetime-local"
                min={`${getCairoTodayString()}T00:00`}
                value={meetingDate}
                onChange={e => setMeetingDate(e.target.value)}
                required
                className="h-9 text-xs bg-background"
              />
            </div>

            {/* Team Attendees Selection */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <Users className="size-3 text-indigo-500" />
                {locale === 'ar' ? 'دعوة أعضاء الفريق للاجتماع' : 'Invite Team Members'}
              </Label>
              {loadingMembers ? (
                <div className="flex justify-center py-2">
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5 p-2 rounded-lg border bg-background min-h-[38px] max-h-[100px] overflow-y-auto items-center">
                  {teamMembers.map(member => {
                    const isSelected = meetingAttendees.includes(member.id);
                    return (
                      <Badge
                        key={member.id}
                        variant={isSelected ? "default" : "outline"}
                        className={`cursor-pointer text-[11px] py-1 transition-all ${
                          isSelected ? "bg-indigo-600 text-white font-bold shadow-xs" : "hover:bg-muted text-muted-foreground"
                        }`}
                        onClick={() => {
                          setMeetingAttendees(prev =>
                            isSelected ? prev.filter(id => id !== member.id) : [...prev, member.id]
                          );
                        }}
                      >
                        {isSelected ? "✓ " : "+ "} {member.name}
                      </Badge>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Location & Agenda Notes */}
            <div className="flex flex-col gap-1">
              <Label htmlFor="meet-location" className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <MapPin className="size-3 text-indigo-500" />
                {locale === 'ar' ? 'المكان أو ملاحظات التحضير' : 'Location / Prep Notes'}
              </Label>
              <Input
                id="meet-location"
                type="text"
                placeholder={locale === 'ar' ? 'مثال: مقر العميل في المعادي / اجتماع أونلاين' : 'e.g. Client Office / Online Zoom link'}
                value={meetingNotes}
                onChange={e => setMeetingNotes(e.target.value)}
                className="h-8 text-xs bg-background"
              />
            </div>
          </div>
        )}

        {/* Activity Log Notes */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="stage-log-notes" className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <MessageSquare className="size-3 text-indigo-500" />
            {locale === 'ar' ? 'ملاحظات وتفاصيل التغيير (تُحفظ في السجل)' : 'Activity Log Notes (Saved in Call Logs)'}
          </Label>
          <Textarea
            id="stage-log-notes"
            placeholder={locale === 'ar' ? 'اكتب ملاحظات حول هذا التحديث ليتم حفظها في سجل المكالمات...' : 'Add notes regarding this stage update to save in call logs...'}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            className="text-xs resize-none bg-card"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={submitting}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" size="sm" disabled={submitting} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4">
            {submitting ? <Loader2 className="size-3.5 animate-spin mr-1.5" /> : <CheckCircle2 className="size-3.5 mr-1.5" />}
            {locale === 'ar' ? 'حفظ وتحديث المرحلة' : 'Save & Update Stage'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
