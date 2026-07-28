'use client';

import { useRef, useEffect } from 'react';
import { Bold, Italic, List, ListOrdered, Undo, Redo, RemoveFormatting } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: string;
  className?: string;
}

export default function RichTextEditor({
  value = '',
  onChange,
  placeholder = 'Write notes here...',
  minHeight = '120px',
  className = '',
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || '';
    }
  }, [value]);

  const handleExecCommand = (command: string, value: string | undefined = undefined) => {
    document.execCommand(command, false, value);
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  return (
    <div className={`border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-transparent transition-all ${className}`}>
      {/* Formatting Toolbar */}
      <div className="flex items-center gap-1 px-3 py-1.5 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-7 text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-700 rounded"
          onClick={() => handleExecCommand('bold')}
          title="Bold (Ctrl+B)"
        >
          <Bold className="size-3.5" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-7 text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-700 rounded"
          onClick={() => handleExecCommand('italic')}
          title="Italic (Ctrl+I)"
        >
          <Italic className="size-3.5" />
        </Button>
        <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 mx-1" />
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-7 text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-700 rounded"
          onClick={() => handleExecCommand('insertUnorderedList')}
          title="Bullet List"
        >
          <List className="size-3.5" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-7 text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-700 rounded"
          onClick={() => handleExecCommand('insertOrderedList')}
          title="Numbered List"
        >
          <ListOrdered className="size-3.5" />
        </Button>
        <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 mx-1" />
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-7 text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-700 rounded"
          onClick={() => handleExecCommand('removeFormat')}
          title="Clear Formatting"
        >
          <RemoveFormatting className="size-3.5" />
        </Button>
      </div>

      {/* Editor Content Area */}
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        style={{ minHeight }}
        data-placeholder={placeholder}
        className="p-3 text-sm text-slate-800 dark:text-slate-100 focus:outline-none leading-relaxed overflow-y-auto prose dark:prose-invert prose-sm max-w-none empty:before:content-[attr(data-placeholder)] empty:before:text-slate-400 empty:before:pointer-events-none"
      />
    </div>
  );
}
