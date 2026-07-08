'use client';

import { useState, useEffect } from 'react';
import { Client, SalesCallLog } from '@/types';
import { useAuth } from '@/lib/auth';
import { salesApi, clientsApi } from '@/lib/api';
import { useLanguage } from '@/lib/i18n';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { formatCairoDate } from '@/lib/dateUtils';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  MoreVertical,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronUp,
  Mail,
  Phone,
  MapPin,
  Calendar,
  MessageSquare,
  Loader2,
  User,
  CheckCircle2,
} from 'lucide-react';

interface PotentialClientCardProps {
  client: Client;
  locale: string;
  t: any;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onEditClick: (client: Client) => void;
  onDeleteClick: (clientId: string, clientName: string) => void;
  onCloseWonClick: (client: Client) => void;
  onUpdate: () => void;
}

const PIPELINE_STAGE_CONFIG: Record<string, { labelKey: string; color: string; border: string; bg: string }> = {
  new_lead:          { labelKey: 'sales.newLead',          color: 'text-slate-600 dark:text-slate-300',      border: 'border-slate-200 dark:border-slate-700', bg: 'bg-slate-50 dark:bg-slate-900/30' },
  contacted:         { labelKey: 'sales.contacted',         color: 'text-blue-600 dark:text-blue-400',         border: 'border-blue-200 dark:border-blue-900/40', bg: 'bg-blue-50 dark:bg-blue-950/20' },
  meeting_scheduled: { labelKey: 'sales.meetingScheduled',   color: 'text-indigo-600 dark:text-indigo-400',     border: 'border-indigo-200 dark:border-indigo-900/40', bg: 'bg-indigo-50 dark:bg-indigo-950/20' },
  meeting_done:      { labelKey: 'sales.meetingDone',       color: 'text-purple-600 dark:text-purple-400',     border: 'border-purple-200 dark:border-purple-900/40', bg: 'bg-purple-50 dark:bg-purple-950/20' },
  lost:              { labelKey: 'sales.lost',              color: 'text-rose-600 dark:text-rose-400',         border: 'border-rose-200 dark:border-rose-900/40', bg: 'bg-rose-50 dark:bg-rose-950/20' },
};

export default function PotentialClientCard({
  client,
  locale,
  t,
  isExpanded,
  onToggleExpand,
  onEditClick,
  onDeleteClick,
  onCloseWonClick,
  onUpdate,
}: PotentialClientCardProps) {
  const { user } = useAuth();
  const isAdmin = !!(user && ['owner', 'team_leader', 'account_manager'].includes(user.role));

  const [logs, setLogs] = useState<SalesCallLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Call form states
  const [outcome, setOutcome] = useState<string>('contacted');
  const [notes, setNotes] = useState('');
  const [meetingDate, setMeetingDate] = useState('');
  const [submittingLog, setSubmittingLog] = useState(false);
  const [logError, setLogError] = useState('');

  const currentStage = client.pipeline_stage || 'new_lead';
  const stageCfg = PIPELINE_STAGE_CONFIG[currentStage] || PIPELINE_STAGE_CONFIG.new_lead;

  // Fetch logs on expand
  useEffect(() => {
    if (isExpanded) {
      fetchLogs();
    }
  }, [isExpanded]);

  const fetchLogs = async () => {
    try {
      setLoadingLogs(true);
      const res = await salesApi.getLead(client.id);
      setLogs(res.callLogs || []);
    } catch (err) {
      console.error('Failed to fetch call logs', err);
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleStageChange = async (newStage: string) => {
    try {
      await clientsApi.update(client.id, { pipeline_stage: newStage } as any);
      onUpdate();
    } catch (err) {
      alert('Failed to update stage');
    }
  };

  const handleAddLogSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!outcome) {
      setLogError('Outcome is required');
      return;
    }
    try {
      setSubmittingLog(true);
      setLogError('');
      const payload: any = {
        outcome,
        notes: notes.trim() || undefined,
      };
      if (outcome === 'meeting_scheduled' && meetingDate) {
        payload.meeting_date = meetingDate;
      }

      await salesApi.logCall(client.id, payload);
      setNotes('');
      setMeetingDate('');
      fetchLogs();
      onUpdate();
    } catch (err: any) {
      setLogError(err.message || 'Failed to save log');
    } finally {
      setSubmittingLog(false);
    }
  };

  const formatDateLabel = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    return formatCairoDate(dateStr, locale);
  };

  return (
    <Card className="transition-all duration-200 hover:shadow-md slide-up flex flex-col bg-card border border-border/80 rounded-xl overflow-hidden text-start">
      <CardContent className="p-5 flex flex-col gap-4">
        {/* Header Row: Avatar, Name & Options */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="size-11 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-extrabold text-sm shrink-0 shadow-xs">
              {client.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground leading-snug truncate max-w-[200px]" title={client.name}>
                {client.name}
              </h3>
              <p className="text-xs text-muted-foreground truncate max-w-[200px]" title={client.company || t('clients.privateClient')}>
                {client.company || t('clients.privateClient')}
              </p>
            </div>
          </div>

          {/* More Actions Dropdown */}
          <div className="flex items-center gap-1.5 shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 p-0 text-muted-foreground/70 hover:text-foreground hover:bg-muted rounded-full shrink-0"
                  >
                    <MoreVertical className="size-4" />
                  </Button>
                }
              />
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEditClick(client)}>
                  <Pencil className="size-3.5 mr-2 rtl:ml-2 rtl:mr-0 text-muted-foreground" />
                  {t('common.edit')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-rose-600 focus:text-rose-600 focus:bg-rose-50 dark:focus:bg-rose-950/20"
                  onClick={() => onDeleteClick(client.id, client.name)}
                >
                  <Trash2 className="size-3.5 mr-2 rtl:ml-2 rtl:mr-0" />
                  {t('common.delete')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Stage & Sales Rep Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-muted/30 border border-border/40 rounded-lg p-3">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {t('clients.stageCol') || 'Pipeline Stage'}
            </span>
            {isAdmin ? (
              <Badge className={cn("h-7 px-2.5 text-xs font-bold rounded-md border w-[150px] justify-center flex items-center shadow-xs", stageCfg.color, stageCfg.border, stageCfg.bg)}>
                {t(stageCfg.labelKey) || currentStage}
              </Badge>
            ) : (
              <Select value={currentStage} onValueChange={val => handleStageChange(val || 'new_lead')}>
                <SelectTrigger className={cn("h-7 px-2.5 text-xs font-semibold rounded-md border w-[150px] bg-card", stageCfg.color, stageCfg.border)}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new_lead">{t('sales.newLead')}</SelectItem>
                  <SelectItem value="contacted">{t('sales.contacted')}</SelectItem>
                  <SelectItem value="meeting_scheduled">{t('sales.meetingScheduled')}</SelectItem>
                  <SelectItem value="meeting_done">{t('sales.meetingDone')}</SelectItem>
                  <SelectItem value="lost">{t('sales.lost')}</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="flex flex-col gap-0.5 text-right rtl:text-left">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {t('clients.salesRepCol') || 'Sales Representative'}
            </span>
            <span className="text-xs font-bold text-foreground flex items-center gap-1.5 justify-end">
              <User className="size-3.5 text-indigo-500" />
              {client.sales_rep?.name || <span className="italic font-normal text-muted-foreground/60">{t('common.unassigned')}</span>}
            </span>
          </div>
        </div>

        {/* Contact Info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
          {client.email && (
            <div className="flex items-center gap-2 text-muted-foreground min-w-0">
              <Mail className="size-3.5 shrink-0 text-indigo-500/80" />
              <span className="truncate" title={client.email}>{client.email}</span>
            </div>
          )}
          {client.phone && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Phone className="size-3.5 shrink-0 text-indigo-500/80" />
              <span>{client.phone}</span>
            </div>
          )}
          {client.address && (
            <div className="flex items-start gap-2 text-muted-foreground col-span-1 sm:col-span-2">
              <MapPin className="size-3.5 shrink-0 text-indigo-500/80 mt-0.5" />
              <span className="line-clamp-2 leading-tight" title={client.address}>{client.address}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-muted-foreground col-span-1 sm:col-span-2">
            <Calendar className="size-3.5 shrink-0 text-indigo-500/80" />
            <span>
              {t('clients.createdDate') || 'Date Added'}:{' '}
              <strong className="text-foreground/90 font-semibold">{formatDateLabel(client.created_at)}</strong>
            </span>
          </div>
        </div>

        {/* Expand / Collapse Button & Close Won Action */}
        <div className="flex items-center justify-between border-t border-border/60 pt-3.5 mt-1 gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleExpand}
            className="text-xs font-semibold text-muted-foreground hover:text-foreground shrink-0 h-8 px-2.5"
          >
            {isExpanded ? (
              <><ChevronUp className="size-4 mr-1.5 rtl:ml-1.5 rtl:mr-0" /> {t('common.less') || 'Show Less'}</>
            ) : (
              <><ChevronDown className="size-4 mr-1.5 rtl:ml-1.5 rtl:mr-0" /> {t('common.more') || 'Show Logs & Activity'}</>
            )}
          </Button>

          {!isAdmin && (
            <Button
              size="sm"
              onClick={() => onCloseWonClick(client)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-8 text-xs shrink-0 px-3 flex items-center gap-1.5 shadow-sm"
            >
              <CheckCircle2 className="size-3.5" />
              {t('sales.closeWon') || 'Close Won'}
            </Button>
          )}
        </div>

        {/* Expanded Logs and Logger Form */}
        {isExpanded && (
          <div className="border-t border-border/50 pt-4 flex flex-col gap-5 slide-down">
            {/* Timeline of Call Logs */}
            <div className="flex flex-col gap-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <MessageSquare className="size-3.5 text-indigo-500" />
                {t('sales.callLogs') || 'Activity Logs'}
              </h4>

              {loadingLogs ? (
                <div className="flex justify-center items-center py-6">
                  <Loader2 className="size-5 animate-spin text-muted-foreground" />
                </div>
              ) : logs.length === 0 ? (
                <div className="text-xs text-muted-foreground italic bg-muted/20 border border-border/30 rounded-lg p-3 text-center">
                  {t('sales.noCallLogs') || 'No sales activity logged yet.'}
                </div>
              ) : (
                <div className="relative pl-4 border-l border-border/80 flex flex-col gap-4 ml-1.5 mt-2 text-xs">
                  {logs.map((log) => {
                    const logCfg = PIPELINE_STAGE_CONFIG[log.outcome] || PIPELINE_STAGE_CONFIG.new_lead;
                    return (
                      <div key={log.id} className="relative flex flex-col gap-1">
                        {/* Bullet point indicator */}
                        <span className="absolute -left-[21px] top-1 size-2.5 rounded-full bg-indigo-500 border border-background" />

                        <div className="flex items-center justify-between gap-3">
                          <span className={cn("inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold border", logCfg?.color, logCfg?.border, logCfg?.bg)}>
                            {t(logCfg?.labelKey || log.outcome)}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {formatDateLabel(log.call_date)}
                          </span>
                        </div>

                        {log.notes && (
                          <p className="text-muted-foreground text-xs bg-muted/20 border rounded-lg p-2 mt-1 leading-relaxed whitespace-pre-line">
                            {log.notes}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Logger Form */}
            {!isAdmin && (
              <form onSubmit={handleAddLogSubmit} className="flex flex-col gap-3.5 bg-muted/10 border rounded-xl p-4 text-start">
                <h4 className="text-xs font-bold text-foreground">
                  📝 {t('sales.logCallOutcome') || 'Log New Call / Interaction'}
                </h4>

                {logError && (
                  <div className="bg-destructive/10 border border-destructive/30 text-destructive text-[11px] px-2.5 py-1.5 rounded-md">
                    {logError}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <Label htmlFor={`outcome-${client.id}`} className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      {t('sales.callOutcome') || 'Call Outcome'}
                    </Label>
                    <Select value={outcome} onValueChange={val => setOutcome(val || 'contacted')}>
                      <SelectTrigger id={`outcome-${client.id}`} className="h-9 bg-card">
                        <SelectValue placeholder="Select outcome..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="new_lead">{t('sales.newLead')}</SelectItem>
                        <SelectItem value="contacted">{t('sales.contacted')}</SelectItem>
                        <SelectItem value="meeting_scheduled">{t('sales.meetingScheduled')}</SelectItem>
                        <SelectItem value="meeting_done">{t('sales.meetingDone')}</SelectItem>
                        <SelectItem value="lost">{t('sales.lost')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {outcome === 'meeting_scheduled' && (
                    <div className="flex flex-col gap-1 slide-down">
                      <Label htmlFor={`meet-date-${client.id}`} className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                        {t('sales.meetingDate') || 'Meeting Date'}
                      </Label>
                      <Input
                        id={`meet-date-${client.id}`}
                        type="datetime-local"
                        value={meetingDate}
                        onChange={e => setMeetingDate(e.target.value)}
                        required
                        className="h-9"
                      />
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-1">
                  <Label htmlFor={`notes-${client.id}`} className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    {t('sales.notes') || 'Notes'}
                  </Label>
                  <Textarea
                    id={`notes-${client.id}`}
                    placeholder="Summarize call details, negotiations, or comments..."
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    rows={2}
                    className="bg-card resize-none"
                  />
                </div>

                <div className="flex justify-end">
                  <Button
                    type="submit"
                    size="sm"
                    disabled={submittingLog}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-8 text-xs px-3"
                  >
                    {submittingLog ? (
                      <><Loader2 className="size-3.5 animate-spin mr-1.5" /> {t('common.loading')}</>
                    ) : (
                      t('common.save')
                    )}
                  </Button>
                </div>
              </form>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
