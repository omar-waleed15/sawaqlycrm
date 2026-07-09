'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { contentIdeasApi, tasksApi, usersApi } from '@/lib/api';
import { ContentIdea, ContentRating, User } from '@/types';
import Modal from '@/components/Modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useLanguage } from '@/lib/i18n';
import { formatCairoDate, getCairoTodayString } from '@/lib/dateUtils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  Loader2,
  Trash2,
  Edit,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  ArrowRight,
} from 'lucide-react';

const CONTENT_TYPES = ['post', 'story', 'reel', 'photos', 'video', 'carousel', 'other'];

const RATING_CONFIG: Record<ContentRating, { labelKey: string; emoji: string; badgeVariant: 'default' | 'secondary' | 'destructive'; colorClass: string; bgClass: string; borderClass: string }> = {
  good:   { labelKey: 'ideas.good',   emoji: '🟢', badgeVariant: 'default',     colorClass: 'text-green-600 dark:text-green-400',   bgClass: 'bg-green-50 dark:bg-green-950/20', borderClass: 'border-green-200 dark:border-green-900/50' },
  medium: { labelKey: 'ideas.medium', emoji: '🟡', badgeVariant: 'secondary',   colorClass: 'text-yellow-600 dark:text-yellow-400', bgClass: 'bg-yellow-50 dark:bg-yellow-950/20', borderClass: 'border-yellow-200 dark:border-yellow-900/50' },
  bad:    { labelKey: 'ideas.bad',    emoji: '🔴', badgeVariant: 'destructive', colorClass: 'text-red-600 dark:text-red-400',     bgClass: 'bg-red-50 dark:bg-red-950/20', borderClass: 'border-red-200 dark:border-red-900/50' },
};

const CONTENT_TYPE_ICONS: Record<string, string> = {
  post: '📝', story: '📖', reel: '🎬', photos: '📸', video: '🎥', carousel: '🎠', other: '✨',
};

const PRIORITY_OPTIONS = [
  { value: 'low',    labelKey: 'priority.low',    emoji: '🟢' },
  { value: 'medium', labelKey: 'priority.medium', emoji: '🟡' },
  { value: 'high',   labelKey: 'priority.high',   emoji: '🟠' },
  { value: 'urgent', labelKey: 'priority.urgent', emoji: '🔴' },
];

const emptyForm = {
  title: '',
  description: '',
  content_type: '',
  drive_link: '',
  content_description: '',
  rating: 'medium' as ContentRating,
};

const emptyPushForm = {
  assignee_ids: [] as string[],
  assignee_picker_id: '',
  due_date: '',
  priority: 'medium',
};

export default function IdeasPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { t, locale } = useLanguage();

  // Redirect unauthorized users
  useEffect(() => {
    if (user && user.role !== 'owner' && user.role !== 'team_leader' && user.role !== 'moderation' && user.role !== 'account_manager' && user.role !== 'content_creator') {
      router.replace('/dashboard');
    }
  }, [user, router]);

  const canPushToTask = user?.role === 'owner' || user?.role === 'team_leader' || user?.role === 'moderation' || user?.role === 'account_manager' || user?.role === 'sales';

  const [ideas, setIdeas] = useState<ContentIdea[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterRating, setFilterRating] = useState<ContentRating | 'all'>('all');
  const [filterType, setFilterType] = useState('all');

  const [users, setUsers] = useState<User[]>([]);

  // Idea create/edit modal
  const [showModal, setShowModal] = useState(false);
  const [editingIdea, setEditingIdea] = useState<ContentIdea | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<ContentIdea | null>(null);
  const [deleting, setDeleting] = useState(false);

  // View detail
  const [viewIdea, setViewIdea] = useState<ContentIdea | null>(null);

  // Push to Task modal
  const [pushTarget, setPushTarget] = useState<ContentIdea | null>(null);
  const [pushForm, setPushForm] = useState({ ...emptyPushForm });
  const [pushing, setPushing] = useState(false);
  const [pushError, setPushError] = useState('');
  const [pushSuccess, setPushSuccess] = useState(false);

  // Fetch ideas
  const fetchIdeas = useCallback(async () => {
    try {
      const { ideas: data } = await contentIdeasApi.list();
      setIdeas(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch users for assignee picker
  const fetchUsers = useCallback(async () => {
    try {
      const { users: data } = await usersApi.list();
      setUsers((data || []).filter((u: any) => u.role !== 'client'));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => { fetchIdeas(); fetchUsers(); }, [fetchIdeas, fetchUsers]);

  const openCreate = () => {
    setEditingIdea(null);
    setForm({ ...emptyForm });
    setError('');
    setShowModal(true);
  };

  const openEdit = (idea: ContentIdea) => {
    setEditingIdea(idea);
    setForm({
      title: idea.title,
      description: idea.description || '',
      content_type: idea.content_type || '',
      drive_link: idea.drive_link || '',
      content_description: idea.content_description || '',
      rating: idea.rating,
    });
    setError('');
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingIdea(null);
    setError('');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) { setError('Title is required'); return; }
    setSaving(true);
    setError('');
    try {
      if (editingIdea) {
        const { idea } = await contentIdeasApi.update(editingIdea.id, form);
        setIdeas(prev => prev.map(i => i.id === idea.id ? idea : i));
      } else {
        const { idea } = await contentIdeasApi.create(form);
        setIdeas(prev => [idea, ...prev]);
      }
      closeModal();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await contentIdeasApi.delete(deleteTarget.id);
      setIdeas(prev => prev.filter(i => i.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch {
      // ignore
    } finally {
      setDeleting(false);
    }
  };

  const cycleRating = async (idea: ContentIdea) => {
    const order: ContentRating[] = ['good', 'medium', 'bad'];
    const next = order[(order.indexOf(idea.rating) + 1) % order.length];
    setIdeas(prev => prev.map(i => i.id === idea.id ? { ...i, rating: next } : i));
    try {
      await contentIdeasApi.update(idea.id, { rating: next });
    } catch {
      setIdeas(prev => prev.map(i => i.id === idea.id ? idea : i));
    }
  };

  const openPush = (idea: ContentIdea) => {
    setPushTarget(idea);
    setPushForm({
      assignee_ids: [],
      assignee_picker_id: '',
      due_date: '',
      priority: 'medium',
    });
    setPushError('');
    setPushSuccess(false);
  };

  const closePush = () => {
    setPushTarget(null);
    setPushError('');
    setPushSuccess(false);
  };

  const addPushAssignee = () => {
    const { assignee_picker_id, assignee_ids } = pushForm;
    if (assignee_picker_id && !assignee_ids.includes(assignee_picker_id)) {
      setPushForm(prev => ({
        ...prev,
        assignee_ids: [...prev.assignee_ids, assignee_picker_id],
        assignee_picker_id: '',
      }));
    }
  };

  const removePushAssignee = (uid: string) => {
    setPushForm(prev => ({
      ...prev,
      assignee_ids: prev.assignee_ids.filter(id => id !== uid),
    }));
  };

  const handlePushToTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pushTarget) return;
    if (pushForm.assignee_ids.length === 0) { setPushError('Please assign at least one member to this task'); return; }
    if (!pushForm.due_date)    { setPushError('Please set a deadline for the task'); return; }

    setPushing(true);
    setPushError('');
    try {
      await tasksApi.create({
        title: pushTarget.title,
        description: pushTarget.description || undefined,
        priority: pushForm.priority as 'low' | 'medium' | 'high' | 'urgent',
        due_date: pushForm.due_date,
        assignee_ids: pushForm.assignee_ids,
        drive_link: pushTarget.drive_link || undefined,
        content_type: pushTarget.content_type || undefined,
        content_description: pushTarget.content_description || undefined,
      });
      setPushSuccess(true);
    } catch (err: unknown) {
      setPushError(err instanceof Error ? err.message : 'Failed to create task');
    } finally {
      setPushing(false);
    }
  };

  const filtered = ideas.filter(i => {
    if (filterRating !== 'all' && i.rating !== filterRating) return false;
    if (filterType !== 'all' && i.content_type !== filterType) return false;
    return true;
  });

  const countByRating = (r: ContentRating) => ideas.filter(i => i.rating === r).length;

  return (
    <div className="page-container fade-in">
      {/* Header */}
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-header-title">{t('ideas.title')}</h1>
          <p className="page-header-subtitle">{t('ideas.subtitle')}</p>
        </div>
        <Button onClick={openCreate} className="gap-1.5">
          <Plus className="size-4" /> {t('ideas.newIdea')}
        </Button>
      </div>

      {/* Rating stat cards / filters */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {(['good', 'medium', 'bad'] as ContentRating[]).map(r => {
          const cfg = RATING_CONFIG[r];
          const active = filterRating === r;
          const dotColor = r === 'good' ? 'bg-green-500' : r === 'medium' ? 'bg-yellow-500' : 'bg-red-500';
          return (
            <button
              key={r}
              onClick={() => setFilterRating(active ? 'all' : r)}
              className={`flex flex-col p-4 rounded-xl border text-start transition-all ${
                active
                  ? 'bg-primary/5 border-primary ring-1 ring-primary/20'
                  : 'bg-card border-border hover:bg-muted/10'
              }`}
            >
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium mb-1">
                <span className={`size-2 rounded-full ${dotColor}`} />
                {t(cfg.labelKey)} {t('ideas.title')}
              </div>
              <div className="text-2xl font-bold text-foreground">{countByRating(r)}</div>
            </button>
          );
        })}
        <button
          onClick={() => setFilterRating('all')}
          className={`flex flex-col p-4 rounded-xl border text-start transition-all ${
            filterRating === 'all'
              ? 'bg-primary/5 border-primary ring-1 ring-primary/20'
              : 'bg-card border-border hover:bg-muted/10'
          }`}
        >
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium mb-1">
            <span className="size-2 rounded-full bg-indigo-500" />
            {t('ideas.allConcepts')}
          </div>
          <div className="text-2xl font-bold text-foreground">{ideas.length}</div>
        </button>
      </div>

      {/* Content-type pill filters */}
      <div className="flex gap-2 flex-wrap mb-6 items-center text-start">
        <span className="text-xs text-muted-foreground font-medium mr-1 rtl:ml-1 rtl:mr-0">{t('ideas.types')}</span>
        {['all', ...CONTENT_TYPES].map(type => {
          const active = filterType === type;
          return (
            <Button
              key={type}
              variant={active ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterType(type)}
              className="h-8 text-xs font-medium rounded-full"
            >
              {type === 'all'
                ? t('ideas.allTypes')
                : `${CONTENT_TYPE_ICONS[type] || '✨'} ${t('contentType.' + type)}`}
            </Button>
          );
        })}
      </div>

      {/* Ideas grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[250px] gap-3">
          <Loader2 className="size-8 text-primary animate-spin" />
          <p className="text-sm text-muted-foreground">{t('ideas.loadingIdeas')}</p>
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed py-16 text-center max-w-lg mx-auto mt-4">
          <CardContent className="flex flex-col items-center">
            <div className="size-12 rounded-full bg-muted flex items-center justify-center text-xl mb-4">💡</div>
            <h3 className="font-semibold text-base mb-1">{t('ideas.noIdeas')}</h3>
            <p className="text-xs text-muted-foreground mb-4" dangerouslySetInnerHTML={{ __html: t('ideas.noIdeasHint') }} />
            <Button onClick={openCreate} size="sm" className="gap-1">
              <Plus className="size-4" /> {t('ideas.createIdea')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filtered.map(idea => {
            const cfg = RATING_CONFIG[idea.rating];
            return (
              <Card
                key={idea.id}
                className="flex flex-col h-full hover:shadow-md transition-all duration-200"
              >
                <CardContent className="p-6 flex flex-col h-full gap-4">
                  {/* Top row: Title on left, Rating on right */}
                  <div className="flex items-start justify-between gap-4">
                    <h3
                      className="font-bold text-base hover:text-primary transition-colors cursor-pointer leading-snug line-clamp-2 flex-1 text-start"
                      onClick={() => setViewIdea(idea)}
                    >
                      {idea.title}
                    </h3>
                    <button
                      onClick={() => cycleRating(idea)}
                      className={`text-[10px] font-bold py-0.5 px-2 rounded-full border transition-colors hover:opacity-80 flex items-center gap-1 shrink-0 ${cfg.bgClass} ${cfg.colorClass} ${cfg.borderClass}`}
                      title="Click to cycle rating"
                    >
                      {cfg.emoji} {t(cfg.labelKey)}
                    </button>
                  </div>

                  {/* Type tag under title/rating row */}
                  {idea.content_type && (
                    <div className="flex items-center">
                      <Badge variant="outline" className="text-[10px] py-0.5 px-2 font-semibold">
                        {CONTENT_TYPE_ICONS[idea.content_type] || '✨'} {t('contentType.' + idea.content_type)}
                      </Badge>
                    </div>
                  )}

                  {/* Description */}
                  {idea.description && (
                    <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed mt-0.5 text-start">
                      {idea.description}
                    </p>
                  )}

                  {/* Drive link */}
                  {idea.drive_link && (
                    <a
                      href={idea.drive_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-700 font-semibold mt-auto text-start"
                    >
                      📁 {t('ideas.driveAsset')} ↗
                    </a>
                  )}

                  <div className="h-px bg-border my-1 mt-auto" />

                  {/* Push to Task button */}
                  {canPushToTask && (
                    <Button
                      onClick={() => openPush(idea)}
                      className="w-full text-xs font-semibold gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white"
                      size="sm"
                    >
                      🚀 {t('ideas.pushToTask')}
                    </Button>
                  )}

                  {/* Footer: date + action buttons */}
                  <div className="flex items-center justify-between mt-1 text-[11px] text-muted-foreground">
                    <span>
                      {formatCairoDate(idea.created_at, locale, { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setViewIdea(idea)}
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        title={t('ideas.viewDetails')}
                      >
                        <FileText className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(idea)}
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        title={t('ideas.editIdeaBtn')}
                      >
                        <Edit className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteTarget(idea)}
                        className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        title={t('ideas.deleteIdea')}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={closeModal}
        title={editingIdea ? t('ideas.editIdea') : t('ideas.newContentIdea')}
      >
        <form onSubmit={handleSave} className="flex flex-col gap-4 text-start">
          {error && (
            <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm px-3 py-2 rounded-md">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="idea-title">{t('ideas.ideaTitle')} *</Label>
            <Input
              id="idea-title"
              type="text"
              placeholder="e.g. Behind the scenes reel for launch week"
              value={form.title}
              onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="idea-description">{t('ideas.ideaDescription')}</Label>
            <Textarea
              id="idea-description"
              placeholder="Brief overview of the idea…"
              value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="idea-content-type">{t('ideas.ideaContentType')}</Label>
              <Select
                value={form.content_type}
                onValueChange={v => setForm(p => ({ ...p, content_type: v || '' }))}
              >
                <SelectTrigger id="idea-content-type">
                  <SelectValue placeholder={t('ideas.selectType')} />
                </SelectTrigger>
                <SelectContent>
                  {CONTENT_TYPES.map(tTask => (
                    <SelectItem key={tTask} value={tTask}>
                      {CONTENT_TYPE_ICONS[tTask]} {t('contentType.' + tTask)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>{t('ideas.rating')}</Label>
              <div className="flex gap-2">
                {(['good', 'medium', 'bad'] as ContentRating[]).map(r => {
                  const cfg = RATING_CONFIG[r];
                  const isSelected = form.rating === r;
                  return (
                    <Button
                      key={r}
                      type="button"
                      variant={isSelected ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setForm(p => ({ ...p, rating: r }))}
                      className={`flex-1 text-xs gap-1.5 font-bold h-9 ${
                        isSelected
                          ? r === 'good' ? 'bg-green-600 hover:bg-green-700 text-white' : r === 'bad' ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-yellow-500 hover:bg-yellow-600 text-white'
                          : ''
                      }`}
                    >
                      <span>{cfg.emoji}</span>
                      <span>{t(cfg.labelKey)}</span>
                    </Button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="idea-drive-link">📁 {t('ideas.driveLink')}</Label>
            <Input
              id="idea-drive-link"
              type="url"
              placeholder="https://drive.google.com/…"
              value={form.drive_link}
              onChange={e => setForm(p => ({ ...p, drive_link: e.target.value }))}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="idea-content-description">{t('ideas.contentDescription')}</Label>
            <Textarea
              id="idea-content-description"
              placeholder="Detailed notes on caption, visual style, sizing, hashtags, reference guidelines…"
              value={form.content_description}
              onChange={e => setForm(p => ({ ...p, content_description: e.target.value }))}
              rows={4}
            />
          </div>

          <div className="flex gap-3 justify-end pt-2 border-t mt-2">
            <Button type="button" variant="outline" onClick={closeModal}>{t('common.cancel')}</Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="mr-2 size-4 animate-spin rtl:ml-2 rtl:mr-0" /> : null}
              {editingIdea ? t('common.saveChanges') : t('ideas.createIdea')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* View Detail Modal */}
      <Modal
        isOpen={!!viewIdea}
        onClose={() => setViewIdea(null)}
        title={t('ideas.ideaDetails')}
      >
        {viewIdea && (
          <div className="flex flex-col gap-4 text-start">
            <div className="flex items-center gap-3 flex-wrap">
              {viewIdea.content_type && (
                <Badge variant="outline" className="text-xs py-0.5 px-2 font-semibold">
                  {CONTENT_TYPE_ICONS[viewIdea.content_type] || '✨'} {t('contentType.' + viewIdea.content_type)}
                </Badge>
              )}
              <Badge
                variant={RATING_CONFIG[viewIdea.rating].badgeVariant}
                className="text-xs py-0.5 px-2"
              >
                {RATING_CONFIG[viewIdea.rating].emoji} {t(RATING_CONFIG[viewIdea.rating].labelKey)}
              </Badge>
            </div>

            <div>
              <h2 className="text-lg font-bold text-foreground leading-snug">{viewIdea.title}</h2>
              <p className="text-[11px] text-muted-foreground mt-1">
                {t('ideas.createdOn')} {formatCairoDate(viewIdea.created_at, locale, { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>

            {viewIdea.description && (
              <div className="bg-muted/40 p-3 rounded-lg border">
                <div className="text-xs font-semibold text-muted-foreground mb-1">📋 {t('ideas.overview')}</div>
                <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">{viewIdea.description}</p>
              </div>
            )}

            {viewIdea.content_description && (
              <div className="bg-muted/40 p-3 rounded-lg border">
                <div className="text-xs font-semibold text-muted-foreground mb-1">📝 {t('ideas.executionDetails')}</div>
                <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">{viewIdea.content_description}</p>
              </div>
            )}

            {viewIdea.drive_link && (
              <div className="bg-muted/40 p-3 rounded-lg border">
                <div className="text-xs font-semibold text-muted-foreground mb-1">📁 {t('ideas.driveAssetLabel')}</div>
                <a
                  href={viewIdea.drive_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-700 font-bold"
                >
                  {t('ideas.openDrive')} ↗
                </a>
              </div>
            )}

            <div className="flex gap-3 justify-end pt-3 border-t mt-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setViewIdea(null); openPush(viewIdea); }}
                className="text-xs font-semibold gap-1.5 text-indigo-600 border-indigo-200 hover:bg-indigo-50"
              >
                🚀 {t('ideas.pushToTask')}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => { setViewIdea(null); openEdit(viewIdea); }}
                className="text-xs font-semibold"
              >
                {t('common.edit')}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => { setViewIdea(null); setDeleteTarget(viewIdea); }}
                className="h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Push to Task Modal */}
      <Modal
        isOpen={!!pushTarget}
        onClose={closePush}
        title={`🚀 ${t('ideas.pushIdeaToTask')}`}
      >
        {pushTarget && (
          <div className="text-start">
            {pushSuccess ? (
              <div className="text-center py-6 flex flex-col items-center justify-center">
                <CheckCircle2 className="size-12 text-green-500 mb-3" />
                <h3 className="font-bold text-base mb-1">{t('ideas.taskCreated')}</h3>
                <p className="text-xs text-muted-foreground max-w-xs mb-5">
                  <strong>&ldquo;{pushTarget.title}&rdquo;</strong> {t('ideas.taskCreatedDesc').replace('{title}', '')}
                </p>
                <div className="flex gap-3 justify-center">
                  <Button variant="outline" size="sm" onClick={closePush}>{t('common.close')}</Button>
                  <Button size="sm" onClick={() => { closePush(); router.push('/dashboard/tasks'); }} className="gap-1">
                    {t('ideas.goToBoard')} <ArrowRight className="size-3.5 rtl:rotate-180" />
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handlePushToTask} className="flex flex-col gap-4">
                <div className="bg-indigo-50/50 border border-indigo-100 p-3 rounded-lg text-xs leading-relaxed text-indigo-950">
                  <div className="flex gap-1.5 flex-wrap mb-1.5">
                    {pushTarget.content_type && (
                      <Badge variant="outline" className="text-[9px] py-0 px-1.5 font-semibold bg-white">
                        {CONTENT_TYPE_ICONS[pushTarget.content_type] || '✨'} {t('contentType.' + pushTarget.content_type)}
                      </Badge>
                    )}
                    <Badge variant="secondary" className="text-[9px] py-0 px-1.5 bg-white">
                      {t('ideas.rating')}: {t(RATING_CONFIG[pushTarget.rating].labelKey)}
                    </Badge>
                  </div>
                  <div className="font-bold">&ldquo;{pushTarget.title}&rdquo;</div>
                  {pushTarget.description && <div className="text-muted-foreground mt-0.5">{pushTarget.description}</div>}
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="push-assignee">👥 {t('ideas.assignTo')} *</Label>
                  <div className="flex gap-2">
                    <Select
                      value={pushForm.assignee_picker_id}
                      onValueChange={v => setPushForm(p => ({ ...p, assignee_picker_id: v || '' }))}
                    >
                      <SelectTrigger id="push-assignee" className="flex-1">
                        <SelectValue placeholder={t('ideas.selectTeamMember')} />
                      </SelectTrigger>
                      <SelectContent>
                        {users
                          .filter(u => !pushForm.assignee_ids.includes(u.id))
                          .map(u => (
                            <SelectItem key={u.id} value={u.id}>
                              {u.name} — {u.role === 'owner' ? t('role.owner') : u.role === 'team_leader' ? t('role.team_leader') : u.role === 'sales' ? t('role.sales') : t('role.member')}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <Button type="button" onClick={addPushAssignee} variant="outline" className="shrink-0">
                      {t('common.add')}
                    </Button>
                  </div>
                  
                  {/* Selected Assignees Chips */}
                  {pushForm.assignee_ids.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-1">
                      {pushForm.assignee_ids.map(uid => {
                        const member = users.find(u => u.id === uid);
                        return (
                          <div key={uid} className="flex items-center gap-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs px-2.5 py-1 rounded-full font-medium">
                            <span>{member?.name || 'Unknown'}</span>
                            <button
                              type="button"
                              onClick={() => removePushAssignee(uid)}
                              className="text-indigo-400 hover:text-indigo-600 transition-colors text-[10px] ml-0.5 rtl:mr-0.5 rtl:ml-0"
                            >
                              ✕
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="push-due-date">📅 {t('ideas.deadline')} *</Label>
                  <Input
                    id="push-due-date"
                    type="date"
                    value={pushForm.due_date}
                    min={getCairoTodayString()}
                    onChange={e => setPushForm(p => ({ ...p, due_date: e.target.value }))}
                    required
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label>⚡ {t('ideas.priorityLabel')}</Label>
                  <div className="grid grid-cols-4 gap-2">
                    {PRIORITY_OPTIONS.map(opt => {
                      const isSelected = pushForm.priority === opt.value;
                      return (
                        <Button
                          key={opt.value}
                          type="button"
                          variant={isSelected ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setPushForm(p => ({ ...p, priority: opt.value }))}
                          className="text-xs"
                        >
                          {t(opt.labelKey)}
                        </Button>
                      );
                    })}
                  </div>
                </div>

                {pushError && (
                  <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm px-3 py-2 rounded-md">
                    {pushError}
                  </div>
                )}

                <div className="flex gap-3 justify-end pt-2 border-t mt-2">
                  <Button type="button" variant="outline" onClick={closePush}>{t('common.cancel')}</Button>
                  <Button type="submit" disabled={pushing} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                    {pushing ? <Loader2 className="mr-2 size-4 animate-spin rtl:ml-2 rtl:mr-0" /> : null}
                    🚀 {t('ideas.pushTask')}
                  </Button>
                </div>
              </form>
            )}
          </div>
        )}
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title={t('ideas.deleteIdea')}
      >
        {deleteTarget && (
          <div className="flex flex-col gap-4 text-center py-2">
            <div className="size-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto text-xl mb-1">
              <AlertTriangle className="size-6" />
            </div>
            <div>
              <h3 className="font-bold text-base mb-1 text-foreground">{t('common.yes')}</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
                {t('ideas.deleteConfirm')}
              </p>
            </div>
            <div className="flex gap-3 justify-center mt-3 pt-2 border-t">
              <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}>{t('common.cancel')}</Button>
              <Button type="button" variant="destructive" onClick={handleDelete} disabled={deleting}>
                {deleting ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                {t('ideas.deleteIdea')}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
