'use client';

import { ReactNode } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: number;
}

export default function Modal({ isOpen, onClose, title, children, footer, maxWidth = 520 }: ModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent style={{ maxWidth: `min(${maxWidth}px, calc(100% - 2rem))`, display: 'flex', flexDirection: 'column', maxHeight: '85vh' }} className="p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <DialogTitle className="text-base font-semibold">{title}</DialogTitle>
        </DialogHeader>
        <div className="px-6 py-5 overflow-y-auto flex-1 min-h-0">
          {children}
        </div>
        {footer && (
          <DialogFooter className="px-6 py-4 border-t bg-muted/30 shrink-0">
            {footer}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
