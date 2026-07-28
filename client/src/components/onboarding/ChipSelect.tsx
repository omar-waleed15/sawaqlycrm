'use client';

import { useState } from 'react';
import { Plus, X, Check } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface ChipSelectProps {
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  allowCustom?: boolean;
  customPlaceholder?: string;
  className?: string;
}

export default function ChipSelect({
  options,
  selected = [],
  onChange,
  allowCustom = true,
  customPlaceholder = 'Add custom item...',
  className = '',
}: ChipSelectProps) {
  const [customInput, setCustomInput] = useState('');
  const [showInput, setShowInput] = useState(false);

  const toggleOption = (option: string) => {
    if (selected.includes(option)) {
      onChange(selected.filter((item) => item !== option));
    } else {
      onChange([...selected, option]);
    }
  };

  const handleAddCustom = () => {
    const trimmed = customInput.trim();
    if (trimmed && !selected.includes(trimmed)) {
      onChange([...selected, trimmed]);
      setCustomInput('');
      setShowInput(false);
    }
  };

  // Combine default options with any selected custom items
  const allOptions = Array.from(new Set([...options, ...selected]));

  return (
    <div className={`flex flex-wrap gap-2 items-center ${className}`}>
      {allOptions.map((option) => {
        const isSelected = selected.includes(option);
        return (
          <button
            key={option}
            type="button"
            onClick={() => toggleOption(option)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all shadow-2xs border ${
              isSelected
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-indigo-100 dark:shadow-none'
                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-indigo-300 hover:bg-indigo-50/50 dark:hover:bg-slate-800'
            }`}
          >
            {isSelected && <Check className="size-3.5 shrink-0" />}
            <span>{option}</span>
          </button>
        );
      })}

      {allowCustom && (
        <>
          {showInput ? (
            <div className="inline-flex items-center gap-1">
              <Input
                type="text"
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddCustom();
                  }
                  if (e.key === 'Escape') {
                    setShowInput(false);
                  }
                }}
                placeholder={customPlaceholder}
                className="h-8 text-xs w-44 rounded-full px-3"
                autoFocus
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 rounded-full text-xs px-3"
                onClick={handleAddCustom}
              >
                Add
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-8 size-8 rounded-full text-slate-400"
                onClick={() => setShowInput(false)}
              >
                <X className="size-3.5" />
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowInput(true)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border border-dashed border-slate-300 dark:border-slate-700 text-slate-500 hover:text-indigo-600 hover:border-indigo-400 transition-colors"
            >
              <Plus className="size-3.5" />
              <span>Add Custom</span>
            </button>
          )}
        </>
      )}
    </div>
  );
}
