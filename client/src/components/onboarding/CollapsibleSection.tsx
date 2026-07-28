'use client';

import { useState, ReactNode } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface CollapsibleSectionProps {
  title: string;
  subtitle?: string;
  icon?: React.ElementType;
  defaultOpen?: boolean;
  badge?: ReactNode;
  children: ReactNode;
  className?: string;
}

export default function CollapsibleSection({
  title,
  subtitle,
  icon: Icon,
  defaultOpen = true,
  badge,
  children,
  className = '',
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Card className={`border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden transition-all ${className}`}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsOpen(!isOpen);
          }
        }}
        className="w-full px-6 py-4 flex items-center justify-between bg-white dark:bg-slate-900 hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors text-left cursor-pointer select-none"
      >
        <div className="flex items-center gap-3">
          {Icon && (
            <div className="size-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <Icon className="size-4.5" />
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">{title}</h3>
              {badge}
            </div>
            {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>}
          </div>
        </div>
        <div className="size-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center shrink-0 transition-transform duration-200">
          {isOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </div>
      </div>

      {isOpen && (
        <CardContent className="px-6 py-5 pt-2 border-t border-slate-100 dark:border-slate-800/60 bg-white dark:bg-slate-900">
          {children}
        </CardContent>
      )}
    </Card>
  );
}
