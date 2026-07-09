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

export default function ContentHubPage() {
  const { user } = useAuth();
  const { t, locale } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State
  const [contents, setContents] = useState<ContentItem[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
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
      setClients(clientsRes.clients || []);
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
      scheduled_date: item.scheduled_date ? item.scheduled_date.substring(0, 10) : '',
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
    const matchesSearch =
      !searchQuery ||
      item.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.caption?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesType = typeFilter === 'all' || item.content_type === typeFilter;
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    const matchesClient = clientFilter === 'all' || item.client_id === clientFilter;
    const matchesPlatform = platformFilter === 'all' || item.platform === platformFilter;

    return matchesSearch && matchesType && matchesStatus && matchesClient && matchesPlatform;
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

      {/* Stats Summary Widgets */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
        <div className="bg-card border rounded-xl p-4 shadow-xs">
          <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">{t('contentHub.total')}</div>
          <div className="text-xl font-extrabold mt-1">{contents.length}</div>
        </div>
        <div className="bg-card border rounded-xl p-4 shadow-xs">
          <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">{t('contentHub.status.published')}</div>
          <div className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">
            {contents.filter(c => c.status === 'published').length}
          </div>
        </div>
        <div className="bg-card border rounded-xl p-4 shadow-xs">
          <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">{t('contentHub.status.draft')}</div>
          <div className="text-xl font-extrabold text-amber-500 mt-1">
            {contents.filter(c => c.status === 'draft').length}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-card border rounded-xl p-4 shadow-sm mt-6 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="w-full md:w-1/3">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search caption, title, descriptions..."
            className="w-full text-xs"
          />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full md:w-auto">
          {/* Client Filter */}
          <Select value={clientFilter} onValueChange={(val) => setClientFilter(val || 'all')}>
            <SelectTrigger className="text-xs h-9 bg-background">
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
            <SelectTrigger className="text-xs h-9 bg-background">
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
            <SelectTrigger className="text-xs h-9 bg-background">
              <SelectValue placeholder="All Platforms" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('contentHub.platform.all')}</SelectItem>
              <SelectItem value="tiktok">{t('contentHub.platform.tiktok')}</SelectItem>
              <SelectItem value="instagram">{t('contentHub.platform.instagram')}</SelectItem>
              <SelectItem value="facebook">{t('contentHub.platform.facebook')}</SelectItem>
            </SelectContent>
          </Select>

          {/* Status Filter */}
          <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val || 'all')}>
            <SelectTrigger className="text-xs h-9 bg-background">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="draft">{t('contentHub.status.draft')}</SelectItem>
              <SelectItem value="published">{t('contentHub.status.published')}</SelectItem>
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
            <ContentCard key={item.id} item={item} onEdit={handleOpenEdit} onDelete={handleDeleteItem} onToggleStatus={handleToggleStatus} t={t} />
          ))}
        </div>
      )}

      {/* Create / Edit Modal Dialog */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-2xl text-start max-h-[90vh] overflow-y-auto">
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
              <div className="flex flex-col gap-1.5">
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

              {/* Status Selector */}
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-semibold">{t('contentHub.fields.status')}</Label>
                <Select
                  value={formData.status}
                  onValueChange={(val) => setFormData(prev => ({ ...prev, status: (val || 'draft') as any }))}
                >
                  <SelectTrigger className="text-xs h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">{t('contentHub.status.draft')}</SelectItem>
                    <SelectItem value="published">{t('contentHub.status.published')}</SelectItem>
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
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="scheduledDate" className="text-xs font-semibold">{t('contentHub.fields.scheduledDate')}</Label>
              <Input
                id="scheduledDate"
                type="date"
                value={formData.scheduled_date}
                onChange={(e) => setFormData(prev => ({ ...prev, scheduled_date: e.target.value }))}
                className="text-xs h-9"
              />
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
  onToggleStatus,
  t
}: {
  item: ContentItem;
  onEdit: (item: ContentItem) => void;
  onDelete: (id: string) => void;
  onToggleStatus: (item: ContentItem) => void;
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

  return (
    <div className="bg-card border rounded-2xl shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow h-full">
      {/* Media Carousel / Preview Frame */}
      <div className="relative aspect-video bg-slate-900 border-b overflow-hidden flex items-center justify-center group select-none">
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
              className="absolute left-2 top-1/2 -translate-y-1/2 size-7 bg-black/40 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/60 z-10"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              onClick={nextMedia}
              className="absolute right-2 top-1/2 -translate-y-1/2 size-7 bg-black/40 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/60 z-10"
            >
              <ChevronRight className="size-4" />
            </button>
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-black/50 text-[9px] text-white font-bold rounded-full font-mono">
              {activeMediaIndex + 1} / {mediaUrls.length}
            </div>
          </>
        )}

        {/* Badges Overlay */}
        <div className="absolute top-2 left-2 flex flex-col gap-1 items-start z-10">
          <Badge className="bg-black/60 hover:bg-black/75 text-white backdrop-blur-xs font-bold text-[9px] border-0 py-0.5 px-2 capitalize">
            {item.content_type}
          </Badge>
          {item.platform && item.platform !== 'none' && (
            <Badge className={`border-0 py-0.5 px-2 text-[9px] font-bold text-white uppercase tracking-wider ${
              item.platform === 'tiktok' ? 'bg-[#ff0050]' :
              item.platform === 'instagram' ? 'bg-gradient-to-tr from-[#fdf497] via-[#fd5949] to-[#d6249f]' :
              'bg-[#1877f2]'
            }`}>
              {t(`contentHub.platform.${item.platform}`)}
            </Badge>
          )}
          {item.status === 'published' ? (
            <Badge className="bg-emerald-500 text-white border-0 py-0.5 px-2 text-[9px] font-bold">
              {t('contentHub.status.published')}
            </Badge>
          ) : (
            <Badge className="bg-slate-500 text-white border-0 py-0.5 px-2 text-[9px] font-bold">
              {t('contentHub.status.draft')}
            </Badge>
          )}
        </div>
      </div>

      {/* Card Details */}
      <div className="p-4 flex-1 flex flex-col gap-3">
        {/* Client Tag */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 max-w-[70%]">
            <span className="size-2 rounded-full bg-indigo-500 shrink-0" />
            <span className="text-[10px] font-extrabold text-indigo-600 truncate uppercase tracking-wider dark:text-indigo-400">
              {item.client?.name || t('contentHub.noClient')}
            </span>
          </div>
          <span className="text-[10px] text-muted-foreground/60 font-mono">
            {item.created_at ? new Date(item.created_at).toLocaleDateString(locale) : ''}
          </span>
        </div>

        {/* Content Description */}
        <div className="flex-1 text-start">
          {item.title && <h3 className="font-bold text-xs text-foreground line-clamp-1 mb-1">{item.title}</h3>}
          {item.caption && (
            <p className="text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed font-normal line-clamp-3">
              {item.caption}
            </p>
          )}
          {item.description && (
            <div className="mt-2.5 bg-muted/30 border border-border/40 rounded-lg p-2.5 text-[10px] text-muted-foreground leading-relaxed italic">
              {item.description}
            </div>
          )}
        </div>

        {/* Music Sound Badges */}
        {(item.sound || item.drive_link) && (
          <div className="flex flex-wrap gap-1.5 pt-2 border-t border-border/40">
            {item.sound && (
              <div className="flex items-center gap-1 bg-amber-50 border border-amber-200 text-amber-800 dark:bg-amber-950/20 dark:border-amber-900/40 dark:text-amber-400 rounded-md py-0.5 px-2 text-[9px] font-bold">
                <Music className="size-2.5 shrink-0 text-amber-500" />
                <span className="truncate max-w-[120px]">{item.sound}</span>
              </div>
            )}
            {item.drive_link && (
              <a
                href={item.drive_link}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 bg-sky-50 border border-sky-200 text-sky-800 dark:bg-sky-950/20 dark:border-sky-900/40 dark:text-sky-400 rounded-md py-0.5 px-2 text-[9px] font-bold hover:bg-sky-100 transition-colors"
              >
                <ExternalLink className="size-2.5 shrink-0 text-sky-500" />
                <span>{t('contentHub.openDrive')}</span>
              </a>
            )}
          </div>
        )}
      </div>

      {/* Card Actions Footer */}
      <div className="px-4 py-3 bg-muted/15 border-t flex items-center justify-between gap-2 shrink-0">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onToggleStatus(item)}
          className={`h-7 px-2.5 text-[10px] font-bold flex items-center gap-1 transition-colors ${
            item.status === 'published'
              ? 'border-amber-200 bg-amber-50/50 hover:bg-amber-100 hover:text-amber-900 text-amber-800'
              : 'border-emerald-200 bg-emerald-50/50 hover:bg-emerald-100 hover:text-emerald-900 text-emerald-800'
          }`}
        >
          <CheckCircle className="size-3" />
          {item.status === 'published' ? t('contentHub.actions.markDraft') : t('contentHub.actions.markPublished')}
        </Button>
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onEdit(item)}
            className="size-7 text-muted-foreground hover:text-slate-800 hover:bg-slate-100 rounded-md"
            title="Edit Content"
          >
            <Edit2 className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDelete(item.id)}
            className="size-7 text-muted-foreground hover:text-rose-600 hover:bg-rose-50 rounded-md"
            title="Delete Content"
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
