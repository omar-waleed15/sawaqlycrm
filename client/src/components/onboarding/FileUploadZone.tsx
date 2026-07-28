'use client';

import { useState, useRef } from 'react';
import { UploadCloud, FileText, Image as ImageIcon, Film, X, Loader2, ExternalLink, Trash2 } from 'lucide-react';
import { OnboardingUploadedFile } from '@/types';
import { clientOnboardingApi } from '@/lib/api';
import { Button } from '@/components/ui/button';

interface FileUploadZoneProps {
  clientId: string;
  category: string;
  label: string;
  description?: string;
  files?: OnboardingUploadedFile[];
  onFileUploaded: (file: OnboardingUploadedFile) => void;
  onFileDeleted: (storagePath: string) => void;
  acceptedTypes?: string;
  maxFiles?: number;
}

export default function FileUploadZone({
  clientId,
  category,
  label,
  description,
  files = [],
  onFileUploaded,
  onFileDeleted,
  acceptedTypes = '*',
  maxFiles,
}: FileUploadZoneProps) {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const categoryFiles = files.filter((f) => f.category === category);

  const handleUpload = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setError('');

    if (maxFiles && categoryFiles.length >= maxFiles) {
      setError(`Maximum ${maxFiles} file(s) allowed for ${label}`);
      return;
    }

    const fileToUpload = fileList[0];
    setUploading(true);

    try {
      const res = await clientOnboardingApi.uploadAsset(clientId, fileToUpload, category);
      if (res.file) {
        onFileUploaded(res.file);
      }
    } catch (err: any) {
      console.error('Failed to upload file:', err);
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (file: OnboardingUploadedFile) => {
    if (!file.storage_path) return;
    try {
      await clientOnboardingApi.deleteAsset(clientId, file.storage_path);
      onFileDeleted(file.storage_path);
    } catch (err: any) {
      console.error('Failed to delete file:', err);
    }
  };

  const getFileIcon = (file: OnboardingUploadedFile) => {
    const type = file.mimetype || '';
    if (type.startsWith('image/')) return <ImageIcon className="size-4 text-emerald-500 shrink-0" />;
    if (type.startsWith('video/')) return <Film className="size-4 text-purple-500 shrink-0" />;
    return <FileText className="size-4 text-indigo-500 shrink-0" />;
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-slate-800 dark:text-slate-200">{label}</label>
        {description && <span className="text-[11px] text-slate-400">{description}</span>}
      </div>

      {/* Upload Drop Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleUpload(e.dataTransfer.files);
        }}
        onClick={() => fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
          dragOver
            ? 'border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/30'
            : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 hover:bg-slate-100/50 dark:hover:bg-slate-800/50'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={acceptedTypes}
          onChange={(e) => handleUpload(e.target.files)}
          className="hidden"
        />

        {uploading ? (
          <div className="flex items-center gap-2 py-2 text-indigo-600 dark:text-indigo-400 text-xs font-semibold">
            <Loader2 className="size-4 animate-spin" />
            <span>Uploading asset...</span>
          </div>
        ) : (
          <div className="flex items-center gap-3 py-1">
            <div className="size-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <UploadCloud className="size-4" />
            </div>
            <div className="text-left">
              <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">
                Click to upload
              </span>{' '}
              <span className="text-xs text-slate-500">or drag and drop</span>
              <p className="text-[10px] text-slate-400">PNG, JPG, PDF, SVG, WEBP, MP4 (Max 50MB)</p>
            </div>
          </div>
        )}
      </div>

      {error && <p className="text-xs text-rose-500 font-medium">{error}</p>}

      {/* Uploaded File Items */}
      {categoryFiles.length > 0 && (
        <div className="space-y-1.5 pt-1">
          {categoryFiles.map((file, idx) => (
            <div
              key={file.storage_path || idx}
              className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 shadow-2xs text-xs"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {getFileIcon(file)}
                <span className="truncate font-medium text-slate-800 dark:text-slate-200 max-w-[200px] sm:max-w-[300px]">
                  {file.name}
                </span>
                {file.size && (
                  <span className="text-[10px] text-slate-400 font-mono">
                    ({(file.size / 1024 / 1024).toFixed(1)}MB)
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <a
                  href={file.public_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1 text-slate-400 hover:text-indigo-600 rounded transition-colors"
                  title="View file"
                >
                  <ExternalLink className="size-3.5" />
                </a>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(file);
                  }}
                  className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                  title="Delete file"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
