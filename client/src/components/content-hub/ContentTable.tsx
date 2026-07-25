'use client';

import { useState } from 'react';
import { useLanguage } from '@/lib/i18n';
import { formatCairoDateTime } from '@/lib/dateUtils';
import { ContentItem } from '@/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Film,
  Music,
  ExternalLink,
  Edit2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Eye,
  Layers,
  Calendar as CalendarIcon,
  Copy,
  Check,
  FileText,
  FolderOpen,
  Sparkles,
  User as UserIcon,
  Maximize2,
  Link as LinkIcon,
  Download,
  X
} from 'lucide-react';

interface ContentTableProps {
  items: ContentItem[];
  onEdit?: (item: ContentItem) => void;
  onDelete?: (id: string) => void;
  showClientColumn?: boolean;
  canManage?: boolean;
}

function TikTokIcon({ className = "size-3.5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 1 1-5.2-1.74 2.89 2.89 0 0 1 2.31-2.83V7.63a6.34 6.34 0 1 0 5.44 6.26V9.87a8.28 8.28 0 0 0 4.67 1.43v-3.46a4.83 4.83 0 0 1-.8-.15z"/>
    </svg>
  );
}

function InstagramIcon({ className = "size-3.5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5"/>
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>
    </svg>
  );
}

function FacebookIcon({ className = "size-3.5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
  );
}

export function ContentTable({
  items,
  onEdit,
  onDelete,
  showClientColumn = true,
  canManage = true,
}: ContentTableProps) {
  const { t, locale } = useLanguage();

  // Lightbox Media Viewer State
  const [activeMediaItem, setActiveMediaItem] = useState<ContentItem | null>(null);
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);

  // Copy status state
  const [copiedCaption, setCopiedCaption] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  const handleCopyCaption = (captionText: string) => {
    if (!captionText) return;
    navigator.clipboard.writeText(captionText);
    setCopiedCaption(captionText);
    setTimeout(() => setCopiedCaption(null), 2000);
  };

  const handleCopyLink = (linkUrl: string) => {
    if (!linkUrl) return;
    navigator.clipboard.writeText(linkUrl);
    setCopiedLink(linkUrl);
    setTimeout(() => setCopiedLink(null), 2000);
  };

  const formatExternalUrl = (urlStr: string) => {
    if (!urlStr) return '';
    const trimmed = urlStr.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }
    return `https://${trimmed}`;
  };

  const isLinkUrl = (str: string) => {
    if (!str) return false;
    const lower = str.trim().toLowerCase();
    return (
      lower.startsWith('http') ||
      lower.startsWith('www.') ||
      lower.includes('.com') ||
      lower.includes('.co') ||
      lower.includes('.net') ||
      lower.includes('.org') ||
      lower.includes('/') ||
      lower.includes('tiktok') ||
      lower.includes('instagram') ||
      lower.includes('spotify')
    );
  };

  const isVideoUrl = (urlStr?: string) => {
    if (!urlStr) return false;
    const cleanUrl = urlStr.split('?')[0].toLowerCase();
    return (
      cleanUrl.endsWith('.mp4') ||
      cleanUrl.endsWith('.webm') ||
      cleanUrl.endsWith('.mov') ||
      cleanUrl.endsWith('.m4v') ||
      cleanUrl.endsWith('.mkv') ||
      cleanUrl.endsWith('.avi') ||
      cleanUrl.includes('/video/') ||
      cleanUrl.includes('video_') ||
      cleanUrl.includes('video')
    );
  };

  const openMediaLightbox = (item: ContentItem, index = 0) => {
    if (item.media_urls && item.media_urls.length > 0) {
      setActiveMediaItem(item);
      setActiveMediaIndex(index);
    }
  };

  const nextMedia = () => {
    if (!activeMediaItem?.media_urls) return;
    setActiveMediaIndex((prev) => (prev + 1) % activeMediaItem.media_urls!.length);
  };

  const prevMedia = () => {
    if (!activeMediaItem?.media_urls) return;
    setActiveMediaIndex(
      (prev) => (prev - 1 + activeMediaItem.media_urls!.length) % activeMediaItem.media_urls!.length
    );
  };

  const renderPlatformIcons = (platformStr?: string) => {
    if (!platformStr || platformStr === 'none') {
      return (
        <span className="text-[10px] text-muted-foreground/60 italic font-medium">
          {t('contentHub.platform.none') || 'No Platform'}
        </span>
      );
    }

    const platforms = platformStr
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);

    if (platforms.length === 0) {
      return (
        <span className="text-[10px] text-muted-foreground/60 italic font-medium">
          {t('contentHub.platform.none') || 'No Platform'}
        </span>
      );
    }

    const formattedNames = platforms
      .map((p) => {
        const translation = t(`contentHub.platform.${p.toLowerCase()}`);
        if (translation && !translation.startsWith('contentHub.')) return translation;
        return p.charAt(0).toUpperCase() + p.slice(1);
      })
      .join(', ');

    return (
      <div className="flex items-center gap-1 shrink-0" title={formattedNames}>
        {platforms.map((p, i) => {
          switch (p.toLowerCase()) {
            case 'tiktok':
              return (
                <span key={i} className="text-slate-900 dark:text-slate-100 p-1 rounded-md bg-slate-100 dark:bg-slate-800/80 hover:scale-110 transition-transform inline-flex" title="TikTok">
                  <TikTokIcon className="size-3.5" />
                </span>
              );
            case 'instagram':
              return (
                <span key={i} className="text-pink-600 dark:text-pink-400 p-1 rounded-md bg-pink-50 dark:bg-pink-950/40 hover:scale-110 transition-transform inline-flex" title="Instagram">
                  <InstagramIcon className="size-3.5" />
                </span>
              );
            case 'facebook':
              return (
                <span key={i} className="text-blue-600 dark:text-blue-400 p-1 rounded-md bg-blue-50 dark:bg-blue-950/40 hover:scale-110 transition-transform inline-flex" title="Facebook">
                  <FacebookIcon className="size-3.5" />
                </span>
              );
            default:
              return (
                <span key={i} className="text-slate-600 dark:text-slate-400 text-[10px] font-bold">
                  {p}
                </span>
              );
          }
        })}
      </div>
    );
  };

  const currentMediaUrl = activeMediaItem?.media_urls?.[activeMediaIndex];
  const isVideo = currentMediaUrl?.toLowerCase().endsWith('.mp4');

  return (
    <div className="w-full min-w-0 max-w-full bg-card border border-slate-200 dark:border-slate-800/80 rounded-2xl shadow-xs overflow-hidden">
      <div className="w-full min-w-0 max-w-full overflow-x-auto touch-pan-x">
        <Table className="w-full min-w-[760px] border-collapse text-start text-[11px]">
            <TableHeader className="bg-slate-50/80 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800">
              <TableRow className="hover:bg-transparent border-b border-slate-200 dark:border-slate-800">
                <TableHead className="w-12 py-2 px-2.5 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  {t('contentHub.table.media') || 'Media'}
                </TableHead>
                <TableHead className="py-2 px-2.5 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  {t('contentHub.fields.title') || 'Title'}
                </TableHead>
                <TableHead className="py-2 px-2.5 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  {t('contentHub.fields.contentType') || 'Type'}
                </TableHead>
                {showClientColumn && (
                  <TableHead className="py-2 px-2.5 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {t('contentHub.table.client') || 'Client'}
                  </TableHead>
                )}
                <TableHead className="py-2 px-2.5 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  {t('contentHub.table.platform') || 'Platform'}
                </TableHead>
                <TableHead className="py-2 px-2.5 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  {t('contentHub.table.scheduled') || 'Scheduled Date'}
                </TableHead>
                <TableHead className="py-2 px-2.5 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  {t('contentHub.table.caption') || 'Caption'}
                </TableHead>
                <TableHead className="py-2 px-2.5 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  {t('contentHub.table.links') || 'Links & Audio'}
                </TableHead>
                {canManage && (
                  <TableHead className="w-16 py-2 px-2.5 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-end">
                    {t('contentHub.table.actions') || 'Actions'}
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {items.map((item) => {
                const mediaCount = item.media_urls?.length || 0;
                const firstMedia = item.media_urls?.[0];
                const isFirstVideo = isVideoUrl(firstMedia);

                return (
                  <TableRow
                    key={item.id}
                    className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors group text-start align-middle cursor-pointer"
                    onClick={() => openMediaLightbox(item)}
                  >
                    <TableCell className="py-2 px-2.5" onClick={(e) => e.stopPropagation()}>
                      {mediaCount > 0 ? (
                        <div
                          onClick={() => openMediaLightbox(item)}
                          className="relative size-9 rounded-md overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-950 flex items-center justify-center cursor-pointer group/media hover:ring-2 hover:ring-indigo-500 transition-all shrink-0 shadow-2xs"
                          title={t('contentHub.viewMedia') || 'Click to view media'}
                        >
                          {isFirstVideo ? (
                            <div className="size-full bg-slate-900 flex items-center justify-center text-white relative">
                              <video
                                src={firstMedia?.includes('#t=') ? firstMedia : `${firstMedia}#t=0.001`}
                                preload="metadata"
                                muted
                                playsInline
                                className="size-full object-cover opacity-90"
                              />
                              <Film className="absolute size-3 text-white drop-shadow-md" />
                            </div>
                          ) : (
                            <img
                              src={firstMedia}
                              alt={item.title || ''}
                              className="size-full object-cover group-hover/media:scale-105 transition-transform duration-200"
                            />
                          )}

                          {mediaCount > 1 && (
                            <div className="absolute top-0.5 right-0.5 bg-slate-900/80 text-[7px] font-bold text-white px-1 py-0.2 rounded flex items-center gap-0.5">
                              <Layers className="size-2" />
                              <span>{mediaCount}</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="size-9 rounded-md border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center justify-center text-slate-400 shrink-0">
                          <Film className="size-3.5" />
                        </div>
                      )}
                    </TableCell>

                    <TableCell className="py-2 px-2.5 font-bold text-foreground max-w-[140px]">
                      <span className="truncate block font-mono text-xs" title={item.title || ''}>
                        {item.title || 'Untitled Content'}
                      </span>
                    </TableCell>

                    <TableCell className="py-2 px-2.5">
                      <Badge variant="outline" className="text-[9px] uppercase font-mono font-bold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-300 border-indigo-200/80 dark:border-indigo-800/80 shrink-0">
                        {item.content_type}
                      </Badge>
                    </TableCell>

                    {showClientColumn && (
                      <TableCell className="py-2 px-2.5 font-medium text-slate-600 dark:text-slate-300 max-w-[120px]">
                        <div className="flex items-center gap-1">
                          <UserIcon className="size-3 text-slate-400 shrink-0" />
                          <span className="truncate">{item.client?.name || '—'}</span>
                        </div>
                      </TableCell>
                    )}

                    <TableCell className="py-2 px-2.5">
                      {renderPlatformIcons(item.platform)}
                    </TableCell>

                    <TableCell className="py-2 px-2.5 font-mono text-slate-600 dark:text-slate-400 text-[10px] font-bold">
                      {item.scheduled_date
                        ? formatCairoDateTime(item.scheduled_date, locale)
                        : <span className="text-slate-400 italic text-[10px] font-light">—</span>
                      }
                    </TableCell>

                    <TableCell className="py-2 px-2.5" onClick={(e) => e.stopPropagation()}>
                      {item.caption ? (
                        <div className="flex items-center gap-1.5 max-w-[180px]">
                          <Popover>
                            <PopoverTrigger
                              onClick={(e) => e.stopPropagation()}
                              className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-0.5 cursor-pointer select-none w-fit"
                            >
                              <span>Full caption</span>
                              <ChevronRight className="size-2.5" />
                            </PopoverTrigger>
                            <PopoverContent
                              onClick={(e) => e.stopPropagation()}
                              className="w-80 p-3 bg-card border shadow-xl rounded-xl text-xs space-y-2.5 z-[170]"
                            >
                              <div className="flex items-center justify-between border-b pb-1.5">
                                <h5 className="font-bold text-foreground text-xs flex items-center gap-1.5">
                                  <FileText className="size-3.5 text-indigo-600 dark:text-indigo-400" /> Full Caption
                                </h5>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleCopyCaption(item.caption!)}
                                  className="h-6 text-[10px] gap-1 px-2 font-bold text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-900"
                                >
                                  {copiedCaption === item.caption ? (
                                    <Check className="size-3 text-emerald-600" />
                                  ) : (
                                    <Copy className="size-3" />
                                  )}
                                  <span>{copiedCaption === item.caption ? 'Copied' : 'Copy'}</span>
                                </Button>
                              </div>
                              <div className="p-2.5 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-800 dark:text-slate-200 leading-relaxed font-sans text-xs max-h-60 overflow-y-auto whitespace-pre-wrap select-text">
                                {item.caption}
                              </div>
                            </PopoverContent>
                          </Popover>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic text-[10px] font-light">—</span>
                      )}
                    </TableCell>

                    <TableCell className="py-2 px-2.5" onClick={(e) => e.stopPropagation()}>
                      {(item.sound || item.drive_link) ? (
                        <Popover>
                          <PopoverTrigger
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1.5 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/80 rounded-md py-1 px-2.5 text-[10px] font-bold hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors cursor-pointer select-none shadow-2xs"
                            title="View Attached Links"
                          >
                            <LinkIcon className="size-3 shrink-0" />
                            <span>Links</span>
                            {((item.drive_link ? 1 : 0) + (item.sound ? 1 : 0)) > 1 && (
                              <span className="bg-indigo-600 text-white text-[8px] rounded-full size-3.5 flex items-center justify-center font-mono shrink-0">
                                2
                              </span>
                            )}
                          </PopoverTrigger>
                          <PopoverContent
                            onClick={(e) => e.stopPropagation()}
                            className="w-72 p-3 bg-card border shadow-xl rounded-xl text-xs space-y-2.5 z-[170]"
                          >
                            <div className="flex items-center justify-between border-b pb-1.5">
                              <h5 className="font-bold text-foreground text-xs flex items-center gap-1.5">
                                <LinkIcon className="size-3.5 text-indigo-600 dark:text-indigo-400" /> Attached Links
                              </h5>
                            </div>

                            <div className="space-y-2">
                              {item.drive_link && (
                                <div className="p-2.5 bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-200/70 dark:border-indigo-900/70 rounded-lg space-y-1.5 text-[11px]">
                                  <span className="font-semibold text-indigo-950 dark:text-indigo-200 block text-[10px] uppercase tracking-wider flex items-center gap-1">
                                    <FolderOpen className="size-3 text-indigo-600 dark:text-indigo-400" /> Google Drive Link
                                  </span>
                                  <div className="flex items-center gap-2">
                                    <a
                                      href={item.drive_link}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-[#1D61E7] dark:text-indigo-400 hover:underline truncate flex-1 font-mono text-[10px]"
                                    >
                                      {item.drive_link}
                                    </a>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleCopyLink(item.drive_link!)}
                                      className="h-7 text-[10px] gap-1 px-2 font-bold border-indigo-200 dark:border-indigo-900 text-[#1D61E7] dark:text-indigo-400"
                                    >
                                      {copiedLink === item.drive_link ? (
                                        <Check className="size-3 text-emerald-600" />
                                      ) : (
                                        <Copy className="size-3" />
                                      )}
                                      <span>{copiedLink === item.drive_link ? 'Copied' : 'Copy'}</span>
                                    </Button>
                                  </div>
                                </div>
                              )}

                              {item.sound && (
                                <div className="p-2.5 bg-purple-50/60 dark:bg-purple-950/40 border border-purple-200/70 dark:border-purple-900/70 rounded-lg space-y-1.5 text-[11px]">
                                  <span className="font-semibold text-purple-950 dark:text-purple-200 block text-[10px] uppercase tracking-wider flex items-center gap-1">
                                    <Music className="size-3 text-purple-600 dark:text-purple-400" /> Audio Track
                                  </span>
                                  <div className="flex items-center justify-between gap-2">
                                    <a
                                      href={item.sound.startsWith('http') ? item.sound : `https://www.google.com/search?q=${encodeURIComponent(item.sound)}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-purple-700 dark:text-purple-300 font-mono text-[10px] truncate flex items-center gap-1 hover:underline"
                                    >
                                      <ExternalLink className="size-3 shrink-0 text-purple-500" />
                                      <span>Open Sound</span>
                                    </a>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleCopyLink(item.sound!)}
                                      className="h-7 text-[10px] gap-1 px-2 font-bold border-purple-200 dark:border-purple-900 text-purple-700 dark:text-purple-300"
                                    >
                                      {copiedLink === item.sound ? (
                                        <Check className="size-3 text-emerald-600" />
                                      ) : (
                                        <Copy className="size-3" />
                                      )}
                                      <span>{copiedLink === item.sound ? 'Copied' : 'Copy'}</span>
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </PopoverContent>
                        </Popover>
                      ) : (
                        <span className="text-slate-400 italic text-[10px]">—</span>
                      )}
                    </TableCell>

                    {canManage && (
                      <TableCell className="py-2 px-2.5 text-end whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-0.5">
                          {onEdit && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => onEdit(item)}
                              className="size-6 text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                              title={t('contentHub.edit') || 'Edit'}
                            >
                              <Edit2 className="size-3" />
                            </Button>
                          )}
                          {onDelete && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => onDelete(item.id)}
                              className="size-6 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="size-3" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

      {/* Interactive Media Lightbox Modal (Optimized for 9:16 & 16:9 media) */}
      {activeMediaItem && (() => {
        const currentMediaUrl = activeMediaItem.media_urls?.[activeMediaIndex] || '';
        const isVideo = isVideoUrl(currentMediaUrl);

        return (
          <Dialog open={!!activeMediaItem} onOpenChange={() => setActiveMediaItem(null)}>
            <DialogContent showCloseButton={false} className="sm:max-w-md max-h-[92vh] w-[95vw] p-0 overflow-hidden bg-card border border-border shadow-2xl rounded-2xl flex flex-col">
              {/* Header */}
              <DialogHeader className="p-3 bg-card text-card-foreground flex flex-row items-center justify-between gap-2 border-b border-border shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <Badge variant="outline" className="text-[9px] uppercase font-mono font-bold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-300 border-indigo-200/80 dark:border-indigo-800/80 shrink-0">
                    {activeMediaItem.content_type}
                  </Badge>
                  <DialogTitle className="text-xs font-bold text-foreground truncate max-w-[160px]">
                    {activeMediaItem.title || t('contentHub.untitled') || 'Untitled Content'}
                  </DialogTitle>
                </div>
                
                <div className="flex items-center gap-1.5 shrink-0">
                  {isVideo && (
                    <a
                      href={formatExternalUrl(currentMediaUrl)}
                      download
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[9px] py-1 px-2.5 rounded-md transition-colors shadow-2xs"
                      title="Download Video File"
                    >
                      <Download className="size-2.5" />
                      <span>Download Video</span>
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => setActiveMediaItem(null)}
                    className="size-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                    title="Close"
                  >
                    <X className="size-4" />
                    <span className="sr-only">Close</span>
                  </button>
                </div>
              </DialogHeader>

              {/* Video / Image Stage: Adaptive layout for 9:16 & 16:9 video resolution */}
              <div className="relative w-full max-h-[58vh] bg-slate-950 flex items-center justify-center overflow-hidden">
                {isVideo ? (
                  <video
                    src={currentMediaUrl}
                    controls
                    autoPlay
                    preload="auto"
                    playsInline
                    className="w-full max-h-[58vh] object-contain"
                  />
                ) : (
                  <img
                    src={currentMediaUrl}
                    alt=""
                    className="w-full max-h-[58vh] object-contain"
                  />
                )}

                {/* Multi-file Navigation */}
                {activeMediaItem.media_urls && activeMediaItem.media_urls.length > 1 && (
                  <>
                    <button
                      onClick={prevMedia}
                      className="absolute left-2 top-1/2 -translate-y-1/2 size-8 bg-slate-900/70 hover:bg-slate-900 text-white rounded-full flex items-center justify-center backdrop-blur-xs transition-colors cursor-pointer"
                    >
                      <ChevronLeft className="size-4" />
                    </button>
                    <button
                      onClick={nextMedia}
                      className="absolute right-2 top-1/2 -translate-y-1/2 size-8 bg-slate-900/70 hover:bg-slate-900 text-white rounded-full flex items-center justify-center backdrop-blur-xs transition-colors cursor-pointer"
                    >
                      <ChevronRight className="size-4" />
                    </button>
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-2.5 py-0.5 bg-slate-900/80 backdrop-blur-xs text-[9px] font-mono font-bold rounded-full text-slate-200">
                      {activeMediaIndex + 1} / {activeMediaItem.media_urls.length}
                    </div>
                  </>
                )}
              </div>
            </DialogContent>
          </Dialog>
        );
      })()}
    </div>
  );
}
