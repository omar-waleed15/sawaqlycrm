'use client';

import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/lib/auth';
import { useLanguage } from '@/lib/i18n';
import { contentsApi, clientsApi } from '@/lib/api';
import { ContentItem, Client } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { formatCairoDateTime, getCairoDateParts } from '@/lib/dateUtils';
import { ar } from 'date-fns/locale/ar';
import { cn } from '@/lib/utils';
import { ContentTable } from '@/components/content-hub/ContentTable';
import {
  Plus,
  Loader2,
  Trash2,
  Edit2,
  Music,
  ExternalLink,
  Upload,
  Globe,
  Film,
  X,
  ChevronLeft,
  ChevronRight,
  Eye,
  CheckCircle,
  FileText,
  AlertCircle,
  Calendar as CalendarIcon
} from 'lucide-react';

const parseScheduledDate = (dateStr: string | undefined) => {
  if (!dateStr) {
    return {
      date: undefined,
      hour: '12',
      minute: '00',
      ampm: 'AM'
    };
  }
  try {
    const parts = getCairoDateParts(dateStr);
    const cairoDate = new Date(parts.year, parts.month - 1, parts.day);
    
    let h12 = parts.hour;
    let ampm = 'AM';
    if (h12 >= 12) {
      ampm = 'PM';
      if (h12 > 12) h12 -= 12;
    }
    if (h12 === 0) h12 = 12;
    
    return {
      date: cairoDate,
      hour: String(h12),
      minute: String(parts.minute).padStart(2, '0'),
      ampm
    };
  } catch (e) {
    return { date: undefined, hour: '12', minute: '00', ampm: 'AM' };
  }
};

const buildCairoDateTime = (
  date: Date | undefined,
  hour: string,
  minute: string,
  ampm: string
): string => {
  if (!date) return '';
  
  let h = parseInt(hour, 10);
  const m = parseInt(minute, 10);
  
  if (ampm === 'PM' && h !== 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  const offsetFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Cairo',
    timeZoneName: 'longOffset'
  });
  const offsetPart = offsetFormatter.formatToParts(new Date(year, date.getMonth(), date.getDate(), h, m))
    .find(p => p.type === 'timeZoneName')?.value;
  
  let offset = '+02:00';
  if (offsetPart) {
    const match = offsetPart.match(/GMT([+-]\d+)/);
    if (match) {
      offset = match[1].padStart(3, '0') + ':00';
    } else if (offsetPart.includes('GMT')) {
      offset = '+00:00';
    }
  }
  
  return `${year}-${month}-${day}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00${offset}`;
};

export default function ContentHubPage() {
  const { user } = useAuth();
  const { t, locale } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dialogContentRef = useRef<HTMLDivElement>(null);

  // State
  const [contents, setContents] = useState<ContentItem[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [clientFilter, setClientFilter] = useState('all');
  const [platformFilter, setPlatformFilter] = useState('all');

  // Dialog / Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ContentItem | null>(null);
  
  // Form State
  const [formData, setFormData] = useState({
    title: '',
    client_id: '',
    content_type: 'post' as 'post' | 'photo' | 'reel' | 'story',
    platform: '',
    scheduled_date: '',
    caption: '',
    description: '',
    sound: '',
    drive_link: '',
  });

  // Selected Media Upload State (local file list & upload status)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [filePreviews, setFilePreviews] = useState<{ url: string; type: string; name: string }[]>([]);
  const [uploadedUrls, setUploadedUrls] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [tempScheduledDate, setTempScheduledDate] = useState('');

  const parsedDateTime = parseScheduledDate(tempScheduledDate);

  // Sync temp state when picker opens
  useEffect(() => {
    if (isDatePickerOpen) {
      setTempScheduledDate(formData.scheduled_date || '');
    }
  }, [isDatePickerOpen, formData.scheduled_date]);

  // Fetch initial data
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [contentsRes, clientsRes] = await Promise.all([
        contentsApi.list(),
        clientsApi.list()
      ]);
      setContents(contentsRes.contents || []);
      setClients((clientsRes.clients || []).filter(c => c.pipeline_stage === 'won'));
    } catch (err) {
      console.error('Error fetching data for Content Hub:', err);
    } finally {
      setLoading(false);
    }
  };

  // Handle opening modal for creating
  const handleOpenCreate = () => {
    setEditingItem(null);
    setFormData({
      title: '',
      client_id: '',
      content_type: 'post',
      platform: '',
      scheduled_date: '',
      caption: '',
      description: '',
      sound: '',
      drive_link: '',
    });
    setSelectedFiles([]);
    setFilePreviews([]);
    setUploadedUrls([]);
    setFormError('');
    setIsModalOpen(true);
  };

  // Handle opening modal for editing
  const handleOpenEdit = (item: ContentItem) => {
    setEditingItem(item);
    setFormData({
      title: item.title || '',
      client_id: item.client_id || '',
      content_type: item.content_type,
      platform: item.platform || '',
      scheduled_date: item.scheduled_date || '',
      caption: item.caption || '',
      description: item.description || '',
      sound: item.sound || '',
      drive_link: item.drive_link || '',
    });
    setSelectedFiles([]);
    setFilePreviews([]);
    setUploadedUrls(item.media_urls || []);
    setFormError('');
    setIsModalOpen(true);
  };

  // Handle file selection (supporting multi upload)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArr = Array.from(e.target.files);
      setSelectedFiles(prev => [...prev, ...filesArr]);

      const previews = filesArr.map(file => ({
        url: URL.createObjectURL(file),
        type: file.type,
        name: file.name,
      }));
      setFilePreviews(prev => [...prev, ...previews]);
    }
  };

  // Remove preview file before uploading
  const handleRemoveFile = (index: number, isExisting: boolean) => {
    if (isExisting) {
      setUploadedUrls(prev => prev.filter((_, i) => i !== index));
    } else {
      setSelectedFiles(prev => prev.filter((_, i) => i !== index));
      setFilePreviews(prev => prev.filter((_, i) => i !== index));
    }
  };

  // Delete content item
  const handleDeleteItem = async (id: string) => {
    if (!confirm(t('contentHub.deleteConfirm'))) return;
    try {
      await contentsApi.delete(id);
      setContents(prev => prev.filter(c => c.id !== id));
    } catch (err) {
      console.error('Failed to delete content item:', err);
    }
  };

  // Handle submit form (handles uploads first, then saves metadata)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setFormError('');

    try {
      let finalMediaUrls = [...uploadedUrls];

      // Upload files if any selected
      if (selectedFiles.length > 0) {
        setIsUploading(true);
        setUploadProgress(0);
        const formPayload = new FormData();
        selectedFiles.forEach(file => {
          formPayload.append('files', file);
        });

        const uploadRes = await contentsApi.upload(formPayload, (pct) => setUploadProgress(pct));
        finalMediaUrls = [...finalMediaUrls, ...uploadRes.public_urls];
        setIsUploading(false);
      }

      const payload: Partial<ContentItem> = {
        title: formData.title || undefined,
        client_id: formData.client_id || undefined,
        content_type: formData.content_type,
        platform: formData.platform || undefined,
        scheduled_date: formData.scheduled_date || undefined,
        caption: formData.caption || undefined,
        description: formData.description || undefined,
        sound: formData.sound || undefined,
        drive_link: formData.drive_link || undefined,
        media_urls: finalMediaUrls,
      };

      if (editingItem) {
        // Edit Content
        const res = await contentsApi.update(editingItem.id, payload);
        setContents(prev => prev.map(c => c.id === editingItem.id ? res.content : c));
      } else {
        // Create Content
        const res = await contentsApi.create(payload);
        setContents(prev => [res.content, ...prev]);
      }

      setIsModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || 'An error occurred while saving.');
    } finally {
      setIsSaving(false);
      setIsUploading(false);
    }
  };

  // Filter content items
  const filteredContents = contents.filter(item => {
    const displayTitle = item.title || t('contentHub.untitled') || 'Untitled';
    const matchesSearch =
      !searchQuery ||
      displayTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.caption || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.client?.name || '').toLowerCase().includes(searchQuery.toLowerCase());

    const matchesType = typeFilter === 'all' || item.content_type === typeFilter;
    const matchesClient = clientFilter === 'all' || item.client_id === clientFilter;
    const matchesPlatform = platformFilter === 'all' || item.platform === platformFilter;

    return matchesSearch && matchesType && matchesClient && matchesPlatform;
  });

  return (
    <div className="page-container fade-in text-start pb-10 w-full max-w-full overflow-x-hidden">
      {/* Header */}
      <div className="page-header flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="page-header-title">{t('contentHub.title')}</h1>
          <p className="page-header-subtitle">{t('contentHub.subtitle')}</p>
        </div>
        <Button onClick={handleOpenCreate} className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold">
          <Plus className="size-4" /> {t('contentHub.create')}
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div className="mt-6 flex flex-col md:flex-row gap-4 items-center justify-between w-full">
        <div className="w-full md:w-1/3">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search caption, title, descriptions..."
            className="w-full text-xs"
          />
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 flex-1 md:w-auto">
            {/* Client Filter */}
            <Select value={clientFilter} onValueChange={(val) => setClientFilter(val || 'all')}>
              <SelectTrigger className="text-xs h-9 bg-background flex gap-1 items-center justify-start">
                <span className="text-muted-foreground font-medium shrink-0">{locale === 'ar' ? 'العميل:' : 'Client:'}</span>
                <SelectValue placeholder="All Clients" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Clients</SelectItem>
                {clients.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Type Filter */}
            <Select value={typeFilter} onValueChange={(val) => setTypeFilter(val || 'all')}>
              <SelectTrigger className="text-xs h-9 bg-background flex gap-1 items-center justify-start">
                <span className="text-muted-foreground font-medium shrink-0">{locale === 'ar' ? 'النوع:' : 'Type:'}</span>
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="post">Post</SelectItem>
                <SelectItem value="photo">Photo</SelectItem>
                <SelectItem value="reel">Reel</SelectItem>
                <SelectItem value="story">Story</SelectItem>
              </SelectContent>
            </Select>

            {/* Platform Filter */}
            <Select value={platformFilter} onValueChange={(val) => setPlatformFilter(val || 'all')}>
              <SelectTrigger className="text-xs h-9 bg-background flex gap-1 items-center justify-start">
                <span className="text-muted-foreground font-medium shrink-0">{locale === 'ar' ? 'المنصة:' : 'Platform:'}</span>
                <SelectValue placeholder="All Platforms" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('contentHub.platform.all')}</SelectItem>
                <SelectItem value="tiktok">{t('contentHub.platform.tiktok')}</SelectItem>
                <SelectItem value="instagram">{t('contentHub.platform.instagram')}</SelectItem>
                <SelectItem value="facebook">{t('contentHub.platform.facebook')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

        </div>
      </div>

      {/* Main Table Content View */}
      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[300px] mt-10 gap-3">
          <Loader2 className="size-8 text-indigo-600 animate-spin" />
          <p className="text-sm text-muted-foreground">Loading content library...</p>
        </div>
      ) : filteredContents.length === 0 ? (
        <div className="bg-card border rounded-2xl flex flex-col items-center justify-center p-12 text-center min-h-[300px] mt-8">
          <div className="size-12 rounded-full bg-muted flex items-center justify-center mb-4">
            <Film className="size-6 text-muted-foreground" />
          </div>
          <h3 className="font-bold text-sm text-foreground">{t('contentHub.noContent')}</h3>
          <p className="text-xs text-muted-foreground/80 mt-1 max-w-sm">{t('contentHub.noContentDesc')}</p>
        </div>
      ) : (
        <div className="mt-8">
          <ContentTable
            items={filteredContents}
            onEdit={handleOpenEdit}
            onDelete={handleDeleteItem}
            showClientColumn={true}
            canManage={true}
          />
        </div>
      )}

      {/* Create / Edit Modal Dialog */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent ref={dialogContentRef} className="sm:max-w-2xl text-start max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">
              {editingItem ? t('contentHub.edit') : t('contentHub.create')}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Upload photos/videos, link a client, write captions/descriptions, and manage publishing states.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {formError && (
              <div className="bg-destructive/10 border border-destructive/20 text-destructive text-xs p-3 rounded-lg flex items-center gap-2">
                <AlertCircle className="size-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              {/* Title */}
              <div className="flex flex-col gap-1.5 col-span-2">
                <Label htmlFor="title" className="text-xs font-semibold">{t('contentHub.fields.title')}</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder={t('contentHub.fields.titlePlaceholder')}
                  className="text-xs h-9"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Client Selection */}
              <div className="flex flex-col gap-1.5 col-span-2">
                <Label className="text-xs font-semibold">{t('contentHub.fields.client')}</Label>
                <Select
                  value={formData.client_id}
                  onValueChange={(val) => setFormData(prev => ({ ...prev, client_id: val || '' }))}
                >
                  <SelectTrigger className="text-xs h-9">
                    <SelectValue placeholder={t('contentHub.fields.clientSelect')} />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Content Type */}
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-semibold">{t('contentHub.fields.contentType')}</Label>
                <Select
                  value={formData.content_type}
                  onValueChange={(val) => setFormData(prev => ({ ...prev, content_type: (val || 'post') as any }))}
                >
                  <SelectTrigger className="text-xs h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="post">Post</SelectItem>
                    <SelectItem value="photo">Photo</SelectItem>
                    <SelectItem value="reel">Reel</SelectItem>
                    <SelectItem value="story">Story</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Platform Selector (Multi-Select) */}
              <div className="flex flex-col gap-1.5 col-span-2 sm:col-span-1">
                <Label className="text-xs font-semibold">{t('contentHub.fields.platform')}</Label>
                <div className="flex flex-wrap gap-1.5 p-1.5 bg-background border border-input rounded-lg min-h-[36px] items-center">
                  {[
                    { id: 'tiktok', label: t('contentHub.platform.tiktok') || 'TikTok' },
                    { id: 'instagram', label: t('contentHub.platform.instagram') || 'Instagram' },
                    { id: 'facebook', label: t('contentHub.platform.facebook') || 'Facebook' },
                  ].map((p) => {
                    const currentSelected = (formData.platform || '')
                      .split(',')
                      .map(s => s.trim())
                      .filter(Boolean);
                    const isSelected = currentSelected.includes(p.id);

                    const toggle = () => {
                      let nextList: string[];
                      if (isSelected) {
                        nextList = currentSelected.filter(id => id !== p.id);
                      } else {
                        nextList = [...currentSelected, p.id];
                      }
                      setFormData(prev => ({ ...prev, platform: nextList.join(',') }));
                    };

                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={toggle}
                        className={cn(
                          "text-[10px] font-bold px-2 py-0.5 rounded-md border transition-all cursor-pointer select-none",
                          isSelected
                            ? "bg-indigo-600 text-white border-indigo-600 shadow-2xs"
                            : "bg-muted/40 text-muted-foreground border-border hover:bg-muted"
                        )}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Caption */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="caption" className="text-xs font-semibold">{t('contentHub.fields.caption')}</Label>
              <Textarea
                id="caption"
                value={formData.caption}
                onChange={(e) => setFormData(prev => ({ ...prev, caption: e.target.value }))}
                placeholder={t('contentHub.fields.captionPlaceholder')}
                className="text-xs min-h-[80px]"
              />
            </div>


            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Sound */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="sound" className="text-xs font-semibold">{t('contentHub.fields.sound')}</Label>
                <Input
                  id="sound"
                  value={formData.sound}
                  onChange={(e) => setFormData(prev => ({ ...prev, sound: e.target.value }))}
                  placeholder={t('contentHub.fields.soundPlaceholder')}
                  className="text-xs h-9"
                />
              </div>

              {/* Google Drive Link */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="driveLink" className="text-xs font-semibold">{t('contentHub.fields.driveLink')}</Label>
                <Input
                  id="driveLink"
                  value={formData.drive_link}
                  onChange={(e) => setFormData(prev => ({ ...prev, drive_link: e.target.value }))}
                  placeholder={t('contentHub.fields.driveLinkPlaceholder')}
                  className="text-xs h-9"
                />
              </div>
            </div>

            {/* Scheduled Date */}
            <div className="flex flex-col gap-1.5 text-start w-full">
              <Label className="text-xs font-semibold">{t('contentHub.fields.scheduledDate')}</Label>
              <button
                type="button"
                onClick={() => setIsDatePickerOpen(prev => !prev)}
                className={cn(
                  "flex items-center w-full text-xs h-9 justify-start text-left font-normal bg-background hover:bg-muted/50 border border-input rounded-lg px-3 shadow-2xs cursor-pointer select-none gap-2 transition-all",
                  !formData.scheduled_date && "text-muted-foreground",
                  isDatePickerOpen && "ring-2 ring-indigo-500/20 border-indigo-500"
                )}
              >
                <CalendarIcon className="size-4 text-indigo-600 shrink-0" />
                <span className="font-semibold text-foreground">
                  {formData.scheduled_date ? formatCairoDateTime(formData.scheduled_date, locale) : (locale === 'ar' ? 'اختر التاريخ والوقت...' : 'Select date and time...')}
                </span>
                {formData.scheduled_date && (
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      setFormData(prev => ({ ...prev, scheduled_date: '' }));
                    }}
                    className="ml-auto text-[10px] text-muted-foreground hover:text-destructive px-1.5 py-0.5 rounded hover:bg-destructive/10 font-bold"
                  >
                    {locale === 'ar' ? 'مسح' : 'Clear'}
                  </span>
                )}
              </button>

              {isDatePickerOpen && (
                <div className="mt-2 w-full max-w-md mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-lg animate-in fade-in-50 duration-150">
                  {/* Calendar Day Picker */}
                  <Calendar
                    mode="single"
                    selected={parsedDateTime.date}
                    onSelect={(newDate) => {
                      const updated = buildCairoDateTime(newDate, parsedDateTime.hour, parsedDateTime.minute, parsedDateTime.ampm);
                      setTempScheduledDate(updated);
                    }}
                    className="rounded-t-xl w-full"
                    classNames={{
                      root: "w-full p-3 flex flex-col items-center",
                      months: "w-full",
                      month: "w-full flex flex-col gap-4",
                    }}
                    locale={locale === 'ar' ? ar : undefined}
                  />
                  
                  {/* Time Picker Controls */}
                  <div className="p-3 border-t bg-slate-50/50 dark:bg-slate-850 flex items-center justify-between gap-3 flex-wrap">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">
                      {locale === 'ar' ? 'الوقت (القاهرة)' : 'Cairo Time'}
                    </span>
                    
                    <div className="flex items-center gap-1.5">
                      {/* Hour */}
                      <Select
                        value={parsedDateTime.hour}
                        onValueChange={(h) => {
                          const updated = buildCairoDateTime(parsedDateTime.date, h || '12', parsedDateTime.minute, parsedDateTime.ampm);
                          setTempScheduledDate(updated);
                        }}
                      >
                        <SelectTrigger className="text-xs h-8 w-14 bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="max-h-48 z-[210]">
                          {Array.from({ length: 12 }, (_, i) => String(i + 1)).map(h => (
                            <SelectItem key={h} value={h}>{h.padStart(2, '0')}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <span className="text-slate-400 font-bold">:</span>

                      {/* Minute */}
                      <Select
                        value={parsedDateTime.minute}
                        onValueChange={(m) => {
                          const updated = buildCairoDateTime(parsedDateTime.date, parsedDateTime.hour, m || '00', parsedDateTime.ampm);
                          setTempScheduledDate(updated);
                        }}
                      >
                        <SelectTrigger className="text-xs h-8 w-14 bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="max-h-48 z-[210]">
                          {Array.from({ length: 60 }, (_, i) => String(i)).map(m => (
                            <SelectItem key={m} value={m.padStart(2, '0')}>{m.padStart(2, '0')}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {/* AM/PM toggle buttons */}
                      <div className="flex items-center border rounded-lg bg-background overflow-hidden p-0.5 h-8 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            const updated = buildCairoDateTime(parsedDateTime.date, parsedDateTime.hour, parsedDateTime.minute, 'AM');
                            setTempScheduledDate(updated);
                          }}
                          className={cn(
                            "text-[10px] font-bold h-full px-2.5 rounded-md transition-colors cursor-pointer",
                            parsedDateTime.ampm === 'AM'
                              ? "bg-indigo-600 text-white"
                              : "text-slate-600 hover:bg-slate-100"
                          )}
                        >
                          AM
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const updated = buildCairoDateTime(parsedDateTime.date, parsedDateTime.hour, parsedDateTime.minute, 'PM');
                            setTempScheduledDate(updated);
                          }}
                          className={cn(
                            "text-[10px] font-bold h-full px-2.5 rounded-md transition-colors cursor-pointer",
                            parsedDateTime.ampm === 'PM'
                              ? "bg-indigo-600 text-white"
                              : "text-slate-600 hover:bg-slate-100"
                          )}
                        >
                          PM
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* OK / Cancel Action Footer */}
                  <div className="p-2 border-t bg-slate-50/80 dark:bg-slate-900 rounded-b-xl flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsDatePickerOpen(false)}
                      className="px-3 h-7 text-[10px] font-bold text-slate-600 hover:bg-slate-200 border rounded-md cursor-pointer transition-colors"
                    >
                      {locale === 'ar' ? 'إلغاء' : 'Cancel'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFormData(prev => ({ ...prev, scheduled_date: tempScheduledDate || buildCairoDateTime(parsedDateTime.date || new Date(), parsedDateTime.hour, parsedDateTime.minute, parsedDateTime.ampm) }));
                        setIsDatePickerOpen(false);
                      }}
                      className="px-3.5 h-7 text-[10px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-md cursor-pointer transition-colors shadow-2xs"
                    >
                      {locale === 'ar' ? 'تأكيد التاريخ والوقت' : 'Confirm Date & Time'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Hidden file input */}
            <input
              type="file"
              ref={fileInputRef}
              multiple
              accept="image/*,video/*"
              className="hidden"
              onChange={handleFileChange}
            />

            {/* Media Upload Box */}
            <div className="flex flex-col gap-2">
              <Label className="text-xs font-semibold">{t('contentHub.mediaFiles')}</Label>
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed rounded-xl p-6 text-center cursor-pointer hover:bg-muted/10 transition-colors flex flex-col items-center justify-center gap-2"
              >
                <Upload className="size-6 text-slate-400" />
                <span className="text-xs font-bold text-slate-700">{t('contentHub.upload.dragDrop')}</span>
              </div>

              {/* Upload Progress Bar */}
              {isUploading && (
                <div className="p-3 bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 rounded-xl space-y-2 text-start">
                  <div className="flex items-center justify-between text-xs font-bold text-indigo-950 dark:text-indigo-200">
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="size-3.5 animate-spin text-indigo-600 dark:text-indigo-400" />
                      {uploadProgress < 100 ? 'Uploading video & media files...' : 'Processing & finalizing...'}
                    </span>
                    <span className="font-mono text-indigo-600 dark:text-indigo-300">{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-indigo-200/60 dark:bg-indigo-900/60 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-indigo-600 dark:bg-indigo-400 h-full transition-all duration-200 ease-out"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Upload Previews */}
              {(uploadedUrls.length > 0 || filePreviews.length > 0) && (
                <div className="grid grid-cols-4 gap-3 mt-2 max-h-[160px] overflow-y-auto p-1 bg-muted/20 border rounded-lg">
                  {/* Existing media links */}
                  {uploadedUrls.map((url, i) => {
                    const cleanUrl = url.split('?')[0].toLowerCase();
                    const isVideo =
                      cleanUrl.endsWith('.mp4') ||
                      cleanUrl.endsWith('.webm') ||
                      cleanUrl.endsWith('.mov') ||
                      cleanUrl.endsWith('.m4v') ||
                      cleanUrl.endsWith('.mkv') ||
                      cleanUrl.endsWith('.avi') ||
                      cleanUrl.includes('/video/') ||
                      cleanUrl.includes('video');
                    return (
                      <div key={`existing-${i}`} className="relative group border rounded-md overflow-hidden bg-card aspect-video flex items-center justify-center">
                        {isVideo ? (
                          <div className="size-full bg-slate-900 flex items-center justify-center text-white relative">
                            <video
                              src={url.includes('#t=') ? url : `${url}#t=0.001`}
                              preload="metadata"
                              muted
                              playsInline
                              className="size-full object-cover opacity-90"
                            />
                            <Film className="absolute size-4 text-white drop-shadow-md" />
                          </div>
                        ) : (
                          <img src={url} className="size-full object-cover" alt="" />
                        )}
                        <button
                          type="button"
                          onClick={() => handleRemoveFile(i, true)}
                          className="absolute top-1 right-1 size-5 bg-destructive rounded-full flex items-center justify-center text-white hover:bg-destructive/90 transition-opacity"
                        >
                          <X className="size-3" />
                        </button>
                      </div>
                    );
                  })}

                  {/* New previews */}
                  {filePreviews.map((preview, i) => {
                    const isVideo = preview.type.startsWith('video/') || preview.url.includes('video');
                    return (
                      <div key={`preview-${i}`} className="relative group border rounded-md overflow-hidden bg-card aspect-video flex items-center justify-center">
                        {isVideo ? (
                          <div className="size-full bg-slate-900 flex items-center justify-center text-white relative">
                            <video
                              src={preview.url}
                              preload="metadata"
                              muted
                              playsInline
                              className="size-full object-cover opacity-90"
                            />
                            <Film className="absolute size-4 text-white drop-shadow-md" />
                          </div>
                        ) : (
                          <img src={preview.url} className="size-full object-cover" alt="" />
                        )}
                        <button
                          type="button"
                          onClick={() => handleRemoveFile(i, false)}
                          className="absolute top-1 right-1 size-5 bg-destructive rounded-full flex items-center justify-center text-white hover:bg-destructive/90"
                        >
                          <X className="size-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <DialogFooter className="mt-6 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} disabled={isSaving}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving} className="bg-indigo-600 hover:bg-indigo-700 text-white min-w-[90px]">
                {isSaving ? (
                  <>
                    <Loader2 className="size-3 animate-spin shrink-0 mr-1.5" />
                    {isUploading ? t('contentHub.uploading') : t('contentHub.saving')}
                  </>
                ) : (
                  'Save'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}


