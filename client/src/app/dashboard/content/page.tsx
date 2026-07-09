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
  AlertCircle
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
    status: 'draft' as 'draft' | 'published',
  });

  // Selected Media Upload State (local file list & upload status)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [filePreviews, setFilePreviews] = useState<{ url: string; type: string; name: string }[]>([]);
  const [uploadedUrls, setUploadedUrls] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
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
      status: 'draft',
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
      status: item.status,
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

  // Toggle published status with one click
  const handleToggleStatus = async (item: ContentItem) => {
    const nextStatus = item.status === 'published' ? 'draft' : 'published';
    try {
      const res = await contentsApi.update(item.id, { status: nextStatus });
      setContents(prev => prev.map(c => c.id === item.id ? res.content : c));
    } catch (err) {
      console.error('Failed to toggle status:', err);
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
        const formPayload = new FormData();
        selectedFiles.forEach(file => {
          formPayload.append('files', file);
        });

        const uploadRes = await contentsApi.upload(formPayload);
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
        status: formData.status,
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
    <div className="page-container fade-in text-start pb-10">
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full md:w-auto">
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

      {/* Main Grid View */}
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
          {filteredContents.map(item => (
            <ContentCard key={item.id} item={item} onEdit={handleOpenEdit} onDelete={handleDeleteItem} t={t} />
          ))}
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

              {/* Platform Selector */}
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-semibold">{t('contentHub.fields.platform')}</Label>
                <Select
                  value={formData.platform || 'none'}
                  onValueChange={(val) => setFormData(prev => ({ ...prev, platform: val === 'none' ? '' : (val || '') }))}
                >
                  <SelectTrigger className="text-xs h-9">
                    <SelectValue placeholder={t('contentHub.fields.platformSelect')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('contentHub.platform.none')}</SelectItem>
                    <SelectItem value="tiktok">{t('contentHub.platform.tiktok')}</SelectItem>
                    <SelectItem value="instagram">{t('contentHub.platform.instagram')}</SelectItem>
                    <SelectItem value="facebook">{t('contentHub.platform.facebook')}</SelectItem>
                  </SelectContent>
                </Select>
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

            {/* Description */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="description" className="text-xs font-semibold">{t('contentHub.fields.description')}</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder={t('contentHub.fields.descriptionPlaceholder')}
                className="text-xs min-h-[60px]"
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
              <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
                <PopoverTrigger
                  className={cn(
                    "flex items-center w-full text-xs h-9 justify-start text-left font-normal bg-background hover:bg-muted/50 border border-input rounded-lg px-3 shadow-2xs cursor-pointer select-none",
                    !formData.scheduled_date && "text-muted-foreground"
                  )}
                >
                  📅 {formData.scheduled_date ? formatCairoDateTime(formData.scheduled_date, locale) : (locale === 'ar' ? 'اختر التاريخ والوقت...' : 'Select date and time...')}
                </PopoverTrigger>
                <PopoverContent
                  className="w-80 p-0 z-[200] bg-white border shadow-md rounded-xl animate-fade-in"
                  align="start"
                  container={dialogContentRef}
                >
                  <div className="flex flex-col w-full">
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
                    <div className="p-3 border-t bg-slate-50/50 flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">
                          {locale === 'ar' ? 'الوقت' : 'Time'}
                        </span>
                      </div>
                      
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
                    <div className="p-2 border-t bg-slate-50/80 rounded-b-xl flex items-center justify-end gap-2">
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
                          setFormData(prev => ({ ...prev, scheduled_date: tempScheduledDate }));
                          setIsDatePickerOpen(false);
                        }}
                        className="px-3.5 h-7 text-[10px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-md cursor-pointer transition-colors"
                      >
                        {locale === 'ar' ? 'موافق' : 'OK'}
                      </button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
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
                <span className="text-[10px] text-muted-foreground">{t('contentHub.upload.limitDesc')}</span>
              </div>

              {/* Upload Previews */}
              {(uploadedUrls.length > 0 || filePreviews.length > 0) && (
                <div className="grid grid-cols-4 gap-3 mt-2 max-h-[160px] overflow-y-auto p-1 bg-muted/20 border rounded-lg">
                  {/* Existing media links */}
                  {uploadedUrls.map((url, i) => {
                    const isVideo = url.toLowerCase().endsWith('.mp4');
                    return (
                      <div key={`existing-${i}`} className="relative group border rounded-md overflow-hidden bg-card aspect-video flex items-center justify-center">
                        {isVideo ? (
                          <div className="size-full bg-slate-900 flex items-center justify-center text-white relative">
                            <video src={url} className="size-full object-cover opacity-80" />
                            <Film className="absolute size-4 text-white" />
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
                    const isVideo = preview.type.startsWith('video/');
                    return (
                      <div key={`preview-${i}`} className="relative group border rounded-md overflow-hidden bg-card aspect-video flex items-center justify-center">
                        {isVideo ? (
                          <div className="size-full bg-slate-900 flex items-center justify-center text-white relative">
                            <video src={preview.url} className="size-full object-cover opacity-80" />
                            <Film className="absolute size-4 text-white" />
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

/* Subcomponent for rendering individual content item cards */
function ContentCard({
  item,
  onEdit,
  onDelete,
  t
}: {
  item: ContentItem;
  onEdit: (item: ContentItem) => void;
  onDelete: (id: string) => void;
  t: (key: string) => string;
}) {
  const { locale } = useLanguage();
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);
  const mediaUrls = item.media_urls || [];
  const hasMultipleMedia = mediaUrls.length > 1;

  const currentMediaUrl = mediaUrls[activeMediaIndex];
  const isVideo = currentMediaUrl?.toLowerCase().endsWith('.mp4');

  const nextMedia = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveMediaIndex(prev => (prev + 1) % mediaUrls.length);
  };

  const prevMedia = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveMediaIndex(prev => (prev - 1 + mediaUrls.length) % mediaUrls.length);
  };

  const getInitials = (name: string) => {
    if (!name) return 'C';
    return name.trim().split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();
  };

  return (
    <div className="bg-card border border-slate-200 dark:border-slate-800/60 rounded-2xl shadow-xs overflow-hidden flex flex-col hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 h-full">
      {/* Title & Date Header */}
      <div className="p-3 border-b border-slate-100 dark:border-slate-800/60 flex items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-900/10">
        <h3 className="font-bold text-xs text-slate-800 dark:text-slate-100 truncate max-w-[65%] text-start" title={item.title || ''}>
          {item.title || t('contentHub.untitled') || 'Untitled'}
        </h3>
        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium shrink-0 flex items-center gap-1 bg-slate-150/80 dark:bg-slate-800/60 px-2 py-0.5 rounded-md">
          📅 {item.scheduled_date 
            ? formatCairoDateTime(item.scheduled_date, locale) 
            : (item.created_at ? new Date(item.created_at).toLocaleDateString(locale) : '')}
        </span>
      </div>

      {/* Media Carousel / Preview Frame */}
      <div className="relative aspect-video bg-slate-955 border-b border-slate-100 dark:border-slate-800/60 overflow-hidden flex items-center justify-center group select-none">
        {mediaUrls.length > 0 ? (
          isVideo ? (
            <video
              src={currentMediaUrl}
              controls
              className="w-full h-full object-cover"
            />
          ) : (
            <img
              src={currentMediaUrl}
              className="w-full h-full object-cover"
              alt={item.title || ''}
            />
          )
        ) : (
          <div className="flex flex-col items-center justify-center text-slate-500 gap-1.5 py-12">
            <Film className="size-8 opacity-40" />
            <span className="text-[10px]">{t('contentHub.noContent')}</span>
          </div>
        )}

        {/* Carousel controls */}
        {hasMultipleMedia && (
          <>
            <button
              onClick={prevMedia}
              className="absolute left-2 top-1/2 -translate-y-1/2 size-7 bg-slate-900/40 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-slate-900/60 z-10 cursor-pointer"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              onClick={nextMedia}
              className="absolute right-2 top-1/2 -translate-y-1/2 size-7 bg-slate-900/40 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-slate-900/60 z-10 cursor-pointer"
            >
              <ChevronRight className="size-4" />
            </button>
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-slate-900/60 backdrop-blur-xs text-[9px] text-white font-bold rounded-full font-mono">
              {activeMediaIndex + 1} / {mediaUrls.length}
            </div>
          </>
        )}

        {/* Badges Overlay */}
        <div className="absolute top-2 left-2 flex flex-col gap-1 items-start z-10">
          <Badge className="bg-slate-900/70 hover:bg-slate-900/80 text-white backdrop-blur-xs font-bold text-[9px] border-0 py-0.5 px-2 capitalize">
            {item.content_type}
          </Badge>
          {item.platform && item.platform !== 'none' && (
            <Badge className="bg-slate-800/80 hover:bg-slate-800/90 border-0 py-0.5 px-2 text-[9px] font-bold text-white uppercase tracking-wider">
              {t(`contentHub.platform.${item.platform}`)}
            </Badge>
          )}
        </div>
      </div>

      {/* Card Details */}
      <div className="p-3 flex-1 flex flex-col gap-2.5">
        {/* Content Caption */}
        {item.caption && (
          <p className="text-[11px] text-slate-650 dark:text-slate-400 leading-relaxed font-normal line-clamp-3 text-start">
            {item.caption}
          </p>
        )}

        {/* Staff Notes (Description) */}
        {item.description && (
          <div className="border-l-2 border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/10 py-1.5 px-2.5 rounded-r-lg text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed text-start italic">
            {item.description}
          </div>
        )}

        {/* Bottom Group: Attachments & Client + Actions Row */}
        <div className="mt-auto pt-2 flex flex-col gap-2 border-t border-slate-100 dark:border-slate-800/60">
          {/* Attachment Tags (Music/Sound & Google Drive) */}
          {(item.sound || item.drive_link) && (
            <div className="flex flex-wrap gap-1.5 pb-1">
              {item.sound && (
                <div className="flex items-center gap-1 bg-slate-105 border border-slate-200/40 text-slate-600 dark:bg-slate-850 dark:border-slate-700/60 dark:text-slate-350 rounded-md py-0.5 px-2 text-[9px] font-bold">
                  <Music className="size-2.5 shrink-0 text-slate-500" />
                  <span className="truncate max-w-[120px]">{item.sound}</span>
                </div>
              )}
              {item.drive_link && (
                <a
                  href={item.drive_link}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 bg-slate-105 border border-slate-200/40 text-slate-600 dark:bg-slate-850 dark:border-slate-700/60 dark:text-slate-350 rounded-md py-0.5 px-2 text-[9px] font-bold hover:bg-slate-200 transition-colors"
                >
                  <ExternalLink className="size-2.5 shrink-0 text-slate-500" />
                  <span>{t('contentHub.openDrive')}</span>
                </a>
              )}
            </div>
          )}

          {/* Client Name & Actions Row */}
          <div className="flex items-center justify-between gap-3 pt-1">
            {/* Client Name */}
            <div className="flex items-center gap-2 text-start min-w-0">
              <div className="size-5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center text-[9px] font-bold shrink-0">
                {getInitials(item.client?.name || '')}
              </div>
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-405 truncate" title={item.client?.name || ''}>
                {item.client?.name || t('contentHub.noClient')}
              </span>
            </div>

            {/* Actions Buttons */}
            <div className="flex items-center gap-1 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onEdit(item)}
                className="size-7 text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors"
                title="Edit Content"
              >
                <Edit2 className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onDelete(item.id)}
                className="size-7 text-slate-400 hover:text-rose-600 hover:bg-rose-50/50 dark:hover:bg-rose-950/20 rounded-md transition-colors"
                title="Delete Content"
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
