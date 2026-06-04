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
      <DialogContent style={{ maxWidth }} className="p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle className="text-base font-semibold">{title}</DialogTitle>
        </DialogHeader>
        <div className="px-6 py-5">
          {children}
        </div>
        {footer && (
          <DialogFooter className="px-6 py-4 border-t bg-muted/30">
            {footer}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
