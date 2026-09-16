'use client';

import { X, Download, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ImageLightboxModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string | null;
  title?: string;
}

export default function ImageLightboxModal({
  isOpen,
  onClose,
  imageUrl,
  title,
}: ImageLightboxModalProps) {
  if (!isOpen || !imageUrl) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative max-w-5xl max-h-[90vh] w-full flex flex-col items-center justify-center bg-card border border-border rounded-2xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="w-full flex items-center justify-between px-5 py-3 border-b border-border bg-muted/40">
          <span className="text-sm font-semibold text-foreground truncate max-w-md">
            {title || 'Image Preview'}
          </span>
          <div className="flex items-center gap-2">
            <a
              href={imageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex"
            >
              <Button size="icon" variant="ghost" className="size-8" title="Open in new tab">
                <ExternalLink className="size-4" />
              </Button>
            </a>
            <a
              href={imageUrl}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex"
            >
              <Button size="icon" variant="ghost" className="size-8" title="Download">
                <Download className="size-4" />
              </Button>
            </a>
            <Button size="icon" variant="ghost" className="size-8" onClick={onClose}>
              <X className="size-4" />
            </Button>
          </div>
        </div>

        {/* Content Image */}
        <div className="p-4 flex items-center justify-center overflow-auto max-h-[calc(90vh-60px)] w-full bg-black/10 dark:bg-black/40">
          <img
            src={imageUrl}
            alt={title || 'Screenshot'}
            className="max-h-[80vh] w-auto object-contain rounded-lg shadow-md transition-transform"
          />
        </div>
      </div>
    </div>
  );
}
