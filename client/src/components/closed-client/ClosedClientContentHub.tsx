'use client';

import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/lib/auth';
import { useLanguage } from '@/lib/i18n';
import { contentsApi } from '@/lib/api';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { formatCairoDateTime, getCairoDateParts } from '@/lib/dateUtils';
import { ar as arLocale } from 'date-fns/locale/ar';
import { cn } from '@/lib/utils';
import {
  Plus,
  Loader2,
  Trash2,
  Edit2,
  Music,
  ExternalLink,
  Upload,
  Film,
  X,
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Search,
  BookOpen
} from 'lucide-react';

interface ClosedClientContentHubProps {
  clientId: string;
  client: Client;
}

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

export default function ClosedClientContentHub({ clientId, client }: ClosedClientContentHubProps) {
  const { user } = useAuth();
  const { t, locale } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canManage = user && ['owner', 'team_leader', 'account_manager', 'content_creator'].includes(user.role);

  // State
  const [contents, setContents] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [platformFilter, setPlatformFilter] = useState('all');

  // Dialog / Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ContentItem | null>(null);
  
  // Form State
  const [formData, setFormData] = useState({
    title: '',
    client_id: clientId,
    content_type: 'post' as 'post' | 'photo' | 'reel' | 'story',
    platform: '',
    scheduled_date: '',
    caption: '',
    description: '',
    sound: '',
    drive_link: '',
    status: 'draft' as 'draft' | 'published',
  });

  // Selected Media Upload State
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [filePreviews, setFilePreviews] = useState<{ url: string; type: string; name: string }[]>([]);
  const [uploadedUrls, setUploadedUrls] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [tempScheduledDate, setTempScheduledDate] = useState('');

  const parsedDateTime = parseScheduledDate(tempScheduledDate);

  // Sync temp date
  useEffect(() => {
    if (isDatePickerOpen) {
      setTempScheduledDate(formData.scheduled_date || '');
    }
  }, [isDatePickerOpen, formData.scheduled_date]);

  // Fetch content list
  const fetchContents = async () => {
    setLoading(true);
    try {
      const res = await contentsApi.list({ client_id: clientId });
      setContents(res.contents || []);
    } catch (err) {
      console.error('Failed to load Content Hub pieces:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (clientId) {
      fetchContents();
    }
  }, [clientId]);

  // Handle open create modal
  const handleOpenCreate = () => {
    setEditingItem(null);
    setFormData({
      title: '',
      client_id: clientId,
      content_type: 'post',
      platform: 'facebook',
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

  // Handle open edit modal
  const handleOpenEdit = (item: ContentItem) => {
    setEditingItem(item);
    setFormData({
      title: item.title || '',
      client_id: item.client_id || clientId,
      content_type: item.content_type,
      platform: item.platform || 'facebook',
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

  // Handle file select
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

  // Remove preview file
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
    if (!confirm(t('contentHub.deleteConfirm') || 'Are you sure you want to delete this content piece?')) return;
    try {
      await contentsApi.delete(id);
      setContents(prev => prev.filter(c => c.id !== id));
    } catch (err) {
      console.error('Failed to delete content item:', err);
    }
  };

  // Form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage) return;

    setIsSaving(true);
    setFormError('');

    try {
      let finalMediaUrls = [...uploadedUrls];

      // Upload if any selected
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
        client_id: clientId,
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
        const res = await contentsApi.update(editingItem.id, payload);
        setContents(prev => prev.map(c => c.id === editingItem.id ? res.content : c));
      } else {
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

  // Filters logic
  const filteredContents = contents.filter(item => {
    const displayTitle = item.title || t('contentHub.untitled') || 'Untitled';
    const matchesSearch =
      !searchQuery ||
      displayTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.caption || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.description || '').toLowerCase().includes(searchQuery.toLowerCase());

    const matchesType = typeFilter === 'all' || item.content_type === typeFilter;
    const matchesPlatform = platformFilter === 'all' || item.platform === platformFilter;

    return matchesSearch && matchesType && matchesPlatform;
  });

  return (
    <div className="flex flex-col gap-6 text-start fade-in pb-6">
      
      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4 border rounded-xl bg-card">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground size-4 rtl:left-auto rtl:right-3" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={locale === 'ar' ? 'بحث عن العنوان، الوصف...' : 'Search title, caption, note...'}
            className="pl-9 rtl:pl-3 rtl:pr-9 text-xs"
          />
        </div>

        {/* Filters and Add Button */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Type Filter */}
          <Select value={typeFilter} onValueChange={(val) => setTypeFilter(val || 'all')}>
            <SelectTrigger className="text-xs h-9 bg-background flex gap-1 items-center min-w-[120px]">
              <span className="text-muted-foreground font-semibold shrink-0">{locale === 'ar' ? 'النوع:' : 'Type:'}</span>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{locale === 'ar' ? 'الكل' : 'All Types'}</SelectItem>
              <SelectItem value="post">Post</SelectItem>
              <SelectItem value="reel">Reel</SelectItem>
              <SelectItem value="story">Story</SelectItem>
              <SelectItem value="photo">Photo</SelectItem>
            </SelectContent>
          </Select>

          {/* Platform Filter */}
          <Select value={platformFilter} onValueChange={(val) => setPlatformFilter(val || 'all')}>
            <SelectTrigger className="text-xs h-9 bg-background flex gap-1 items-center min-w-[140px]">
              <span className="text-muted-foreground font-semibold shrink-0">{locale === 'ar' ? 'المنصة:' : 'Platform:'}</span>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{locale === 'ar' ? 'الكل' : 'All Platforms'}</SelectItem>
              <SelectItem value="facebook">Facebook</SelectItem>
              <SelectItem value="instagram">Instagram</SelectItem>
              <SelectItem value="tiktok">TikTok</SelectItem>
              <SelectItem value="snapchat">Snapchat</SelectItem>
            </SelectContent>
          </Select>

          {/* Add Button */}
          {canManage && (
            <Button onClick={handleOpenCreate} className="gap-1.5 h-9 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-bold">
              <Plus className="size-4" /> {locale === 'ar' ? 'إضافة محتوى' : 'Add Content'}
            </Button>
          )}
        </div>
      </div>

      {/* Grid of Content Cards */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredContents.length === 0 ? (
        <div className="text-center py-16 border border-dashed rounded-xl bg-card text-muted-foreground">
          <BookOpen className="size-10 mx-auto text-muted-foreground/45 mb-3" />
          <p className="text-xs font-semibold">{t('contentHub.noContent') || 'No content pieces found.'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredContents.map(item => (
            <div key={item.id} className="bg-card border border-slate-200 dark:border-slate-800/60 rounded-2xl shadow-xs overflow-hidden flex flex-col hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 h-full">
              
              {/* Card Header */}
              <div className="p-3 border-b border-slate-100 dark:border-slate-800/60 flex items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-900/10">
                <h3 className="font-bold text-xs text-slate-850 dark:text-slate-100 truncate max-w-[65%] text-start" title={item.title || ''}>
                  {item.title || t('contentHub.untitled') || 'Untitled'}
                </h3>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold shrink-0 flex items-center gap-1 bg-slate-150/80 dark:bg-slate-800/60 px-2 py-0.5 rounded-md">
                  📅 {item.scheduled_date 
                    ? formatCairoDateTime(item.scheduled_date, locale) 
                    : (item.created_at ? new Date(item.created_at).toLocaleDateString(locale) : '')}
                </span>
              </div>

              {/* Media Carousel */}
              <MediaCarousel mediaUrls={item.media_urls} content_type={item.content_type} platform={item.platform} />

              {/* Card Details */}
              <div className="p-3 flex-1 flex flex-col gap-2.5">
                {item.caption && (
                  <p className="text-[11px] text-slate-650 dark:text-slate-400 leading-relaxed text-start line-clamp-3">
                    {item.caption}
                  </p>
                )}

                {item.description && (
                  <div className="border-l-2 border-slate-350 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/10 py-1.5 px-2.5 rounded-r-lg text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed text-start italic">
                    {item.description}
                  </div>
                )}

                {/* Attachments & Actions */}
                <div className="mt-auto pt-2 flex flex-col gap-2 border-t border-slate-100 dark:border-slate-800/60">
                  {/* Tags */}
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

                  {/* Footer Row */}
                  <div className="flex items-center justify-between gap-3 pt-1">
                    <span className={cn(
                      "inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold shrink-0",
                      item.status === 'published'
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400"
                        : "bg-amber-100 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400"
                    )}>
                      {item.status === 'published' ? (locale === 'ar' ? 'تم النشر' : 'Published') : (locale === 'ar' ? 'مسودة' : 'Draft')}
                    </span>

                    {/* Actions */}
                    {canManage && (
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenEdit(item)}
                          className="size-7 text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteItem(item.id)}
                          className="size-7 text-slate-400 hover:text-rose-600 hover:bg-rose-50/50 dark:hover:bg-rose-950/20 rounded-md transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

              </div>

            </div>
          ))}
        </div>
      )}

      {/* CREATE / EDIT MODAL */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl text-start max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">
              {editingItem ? (locale === 'ar' ? 'تعديل قطعة المحتوى' : 'Edit Content Piece') : (locale === 'ar' ? 'إضافة قطعة محتوى جديدة' : 'Add Content Piece')}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">
            {formError && (
              <div className="bg-destructive/10 border border-destructive/30 text-destructive text-xs p-2.5 rounded-md font-semibold">
                {formError}
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="title" className="text-xs font-semibold">{locale === 'ar' ? 'العنوان' : 'Title'}</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder={locale === 'ar' ? 'أدخل عنوان المحتوى...' : 'e.g. Summer Promo Post'}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="content_type" className="text-xs font-semibold">{locale === 'ar' ? 'نوع المحتوى' : 'Content Type'}</Label>
                <Select
                  value={formData.content_type}
                  onValueChange={(val) => setFormData({ ...formData, content_type: (val || 'post') as any })}
                >
                  <SelectTrigger id="content_type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="post">Post</SelectItem>
                    <SelectItem value="reel">Reel</SelectItem>
                    <SelectItem value="story">Story</SelectItem>
                    <SelectItem value="photo">Photo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="platform" className="text-xs font-semibold">{locale === 'ar' ? 'المنصة' : 'Platform'}</Label>
                <Select
                  value={formData.platform || 'facebook'}
                  onValueChange={(val) => setFormData({ ...formData, platform: val || '' })}
                >
                  <SelectTrigger id="platform">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="facebook">Facebook</SelectItem>
                    <SelectItem value="instagram">Instagram</SelectItem>
                    <SelectItem value="tiktok">TikTok</SelectItem>
                    <SelectItem value="snapchat">Snapchat</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Scheduled Publish Date */}
            <div className="flex flex-col gap-1.5 text-start w-full">
              <Label className="text-xs font-semibold">{locale === 'ar' ? 'تاريخ النشر المجدول' : 'Scheduled Date & Time'}</Label>
              <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
                <PopoverTrigger
                  className={cn(
                    "flex items-center w-full text-xs h-9 justify-start text-left font-normal bg-background hover:bg-muted/50 border border-input rounded-lg px-3 shadow-2xs cursor-pointer select-none gap-2",
                    !formData.scheduled_date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="size-4 text-slate-400 shrink-0" />
                  {formData.scheduled_date ? (
                    formatCairoDateTime(formData.scheduled_date, locale)
                  ) : (
                    <span>{locale === 'ar' ? 'اختر التاريخ والوقت (توقيت القاهرة)...' : 'Pick publish date & time (Cairo time)...'}</span>
                  )}
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 z-[200]" align="start">
                  <div className="flex flex-col">
                    <Calendar
                      mode="single"
                      selected={parsedDateTime.date}
                      onSelect={(day) => {
                        const updated = buildCairoDateTime(day, parsedDateTime.hour, parsedDateTime.minute, parsedDateTime.ampm);
                        setTempScheduledDate(updated);
                      }}
                      locale={locale === 'ar' ? arLocale : undefined}
                      className="rounded-t-xl"
                    />
                    
                    {/* Time Pickers */}
                    <div className="p-3 border-t flex items-center justify-between gap-4 bg-slate-50/50">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">{locale === 'ar' ? 'الوقت' : 'Cairo Time'}</span>
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

                        {/* AM/PM toggle */}
                        <div className="flex items-center border rounded-lg bg-background overflow-hidden p-0.5 h-8 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              const updated = buildCairoDateTime(parsedDateTime.date, parsedDateTime.hour, parsedDateTime.minute, 'AM');
                              setTempScheduledDate(updated);
                            }}
                            className={cn(
                              "text-[10px] font-bold h-full px-2 rounded-md cursor-pointer transition-colors",
                              parsedDateTime.ampm === 'AM'
                                ? "bg-indigo-600 text-white"
                                : "text-slate-650 hover:bg-slate-100"
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
                              "text-[10px] font-bold h-full px-2 rounded-md cursor-pointer transition-colors",
                              parsedDateTime.ampm === 'PM'
                                ? "bg-indigo-600 text-white"
                                : "text-slate-650 hover:bg-slate-100"
                            )}
                          >
                            PM
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* OK / Cancel actions */}
                    <div className="p-2 border-t bg-slate-50 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setIsDatePickerOpen(false)}
                        className="px-3 h-7 text-[10px] font-bold text-slate-650 hover:bg-slate-200 border rounded-md cursor-pointer"
                      >
                        {locale === 'ar' ? 'إلغاء' : 'Cancel'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setFormData(prev => ({ ...prev, scheduled_date: tempScheduledDate }));
                          setIsDatePickerOpen(false);
                        }}
                        className="px-3.5 h-7 text-[10px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-md cursor-pointer"
                      >
                        {locale === 'ar' ? 'موافق' : 'OK'}
                      </button>
                    </div>

                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="caption" className="text-xs font-semibold">{locale === 'ar' ? 'التعليق (Caption)' : 'Caption'}</Label>
              <Textarea
                id="caption"
                rows={3}
                value={formData.caption}
                onChange={(e) => setFormData({ ...formData, caption: e.target.value })}
                placeholder={locale === 'ar' ? 'أدخل تعليق المنشور هنا...' : 'Write post caption...'}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="description" className="text-xs font-semibold">{locale === 'ar' ? 'ملاحظات فريق العمل' : 'Internal Staff Notes'}</Label>
              <Textarea
                id="description"
                rows={2}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder={locale === 'ar' ? 'ملاحظات وتوجيهات للمصمم أو كاتب المحتوى...' : 'Notes for design directions, content concepts...'}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="sound" className="text-xs font-semibold">{locale === 'ar' ? 'الصوت المقترح' : 'Suggested Sound/Audio'}</Label>
                <Input
                  id="sound"
                  value={formData.sound}
                  onChange={(e) => setFormData({ ...formData, sound: e.target.value })}
                  placeholder="e.g. Trending audio link/name"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="drive_link" className="text-xs font-semibold">{locale === 'ar' ? 'رابط جوجل درايف' : 'Google Drive Link'}</Label>
                <Input
                  id="drive_link"
                  type="url"
                  value={formData.drive_link}
                  onChange={(e) => setFormData({ ...formData, drive_link: e.target.value })}
                  placeholder="https://drive.google.com/..."
                />
              </div>
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

            {/* Media Upload Block */}
            <div className="flex flex-col gap-2">
              <Label className="text-xs font-semibold">{locale === 'ar' ? 'ملفات الوسائط' : 'Media Files'}</Label>
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed rounded-xl p-5 text-center cursor-pointer hover:bg-muted/10 transition-colors flex flex-col items-center justify-center gap-1.5"
              >
                <Upload className="size-5 text-slate-400" />
                <span className="text-xs font-bold text-slate-700">{locale === 'ar' ? 'اضغط أو اسحب الملفات هنا لتحميلها' : 'Click or drag files here to upload'}</span>
                <span className="text-[9px] text-muted-foreground">{locale === 'ar' ? 'الحد الأقصى لحجم الفيديو: 50 ميغابايت' : 'Images or videos (Max 50MB per video)'}</span>
              </div>

              {/* Upload Previews */}
              {(uploadedUrls.length > 0 || filePreviews.length > 0) && (
                <div className="grid grid-cols-4 gap-3 mt-2 max-h-[140px] overflow-y-auto p-2 bg-muted/20 border rounded-lg">
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
                          className="absolute top-1 right-1 size-5 bg-destructive rounded-full flex items-center justify-center text-white hover:bg-destructive/90"
                        >
                          <X className="size-3" />
                        </button>
                      </div>
                    );
                  })}

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

            <DialogFooter className="mt-4 pt-4 border-t gap-2 flex flex-row justify-end">
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} disabled={isSaving}>
                {locale === 'ar' ? 'إلغاء' : 'Cancel'}
              </Button>
              <Button type="submit" disabled={isSaving} className="bg-indigo-600 hover:bg-indigo-700 text-white min-w-[90px] font-bold">
                {isSaving ? (
                  <>
                    <Loader2 className="size-3 animate-spin shrink-0 mr-1.5 rtl:ml-1.5" />
                    {isUploading ? (locale === 'ar' ? 'جاري الرفع...' : 'Uploading...') : (locale === 'ar' ? 'جاري الحفظ...' : 'Saving...')}
                  </>
                ) : (
                  locale === 'ar' ? 'حفظ' : 'Save'
                )}
              </Button>
            </DialogFooter>

          </form>
        </DialogContent>
      </Dialog>

    </div>
  );
}

function MediaCarousel({ mediaUrls, content_type, platform }: { mediaUrls?: string[]; content_type: string; platform?: string }) {
  const { t } = useLanguage();
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);
  const mUrls = mediaUrls || [];
  const hasMultipleMedia = mUrls.length > 1;

  const currentMediaUrl = mUrls[activeMediaIndex];
  const isVideo = currentMediaUrl?.toLowerCase().endsWith('.mp4');

  const nextMedia = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveMediaIndex(prev => (prev + 1) % mUrls.length);
  };

  const prevMedia = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveMediaIndex(prev => (prev - 1 + mUrls.length) % mUrls.length);
  };

  return (
    <div className="relative aspect-video bg-slate-950 border-b border-slate-100 dark:border-slate-800/60 overflow-hidden flex items-center justify-center group select-none">
      {mUrls.length > 0 ? (
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
            alt=""
          />
        )
      ) : (
        <div className="flex flex-col items-center justify-center text-slate-500 gap-1.5 py-12">
          <Film className="size-7 opacity-40 animate-pulse" />
          <span className="text-[10px]">{t('contentHub.noContent') || 'No Media'}</span>
        </div>
      )}

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
            {activeMediaIndex + 1} / {mUrls.length}
          </div>
        </>
      )}

      <div className="absolute top-2 left-2 flex flex-col gap-1 items-start z-10">
        <Badge className="bg-slate-900/70 hover:bg-slate-900/80 text-white backdrop-blur-xs font-bold text-[9px] border-0 py-0.5 px-2 capitalize">
          {content_type}
        </Badge>
        {platform && platform !== 'none' && (
          <Badge className="bg-slate-800/80 hover:bg-slate-800/90 border-0 py-0.5 px-2 text-[9px] font-bold text-white uppercase tracking-wider">
            {t(`contentHub.platform.${platform}`) || platform}
          </Badge>
        )}
      </div>

    </div>
  );
}
