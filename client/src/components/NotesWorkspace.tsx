'use client';

import { useState, useEffect, useCallback } from 'react';
import { notesApi } from '@/lib/api';
import { PersonalNote, TodoItem } from '@/types';
import { useLanguage } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import Modal from '@/components/Modal';
import {
  FileText,
  CheckSquare,
  Plus,
  Trash2,
  Loader2,
  Search,
  ClipboardList,
  Calendar,
} from 'lucide-react';

export default function NotesWorkspace() {
  const { t, locale } = useLanguage();
  
  // State
  const [notes, setNotes] = useState<PersonalNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'text' | 'todo'>('all');
  
  // Editor Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<PersonalNote | null>(null);
  const [editorTitle, setEditorTitle] = useState('');
  const [editorContent, setEditorContent] = useState('');
  const [editorTodos, setEditorTodos] = useState<TodoItem[]>([]);
  const [newTodoText, setNewTodoText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Fetch all notes
  const fetchNotes = useCallback(async () => {
    try {
      setLoading(true);
      const data = await notesApi.list();
      setNotes(data.notes || []);
    } catch (err) {
      console.error('Failed to load notes', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  // Open modal for editing
  const handleOpenEdit = (note: PersonalNote) => {
    setEditingNote(note);
    setEditorTitle(note.title || '');
    setEditorContent(note.content || '');
    setEditorTodos(note.todo_items || []);
    setNewTodoText('');
    setError('');
    setIsModalOpen(true);
  };

  // Open modal for creating a new note/checklist
  const handleCreateNote = async (type: 'text' | 'todo') => {
    try {
      setLoading(true);
      const title = type === 'text' 
        ? (locale === 'ar' ? 'ملاحظة جديدة' : 'New Note') 
        : (locale === 'ar' ? 'قائمة مهام جديدة' : 'New Checklist');
      
      const response = await notesApi.create({
        title,
        type,
        content: '',
        todo_items: [],
      });
      
      if (response.note) {
        // Refresh the list
        const data = await notesApi.list();
        setNotes(data.notes || []);
        
        // Immediately open the newly created note in the editor modal
        handleOpenEdit(response.note);
      }
    } catch (err) {
      console.error('Failed to create note', err);
    } finally {
      setLoading(false);
    }
  };

  // Save edits
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingNote) return;
    if (!editorTitle.trim()) {
      setError(locale === 'ar' ? 'العنوان مطلوب' : 'Title is required');
      return;
    }

    try {
      setSaving(true);
      setError('');
      const response = await notesApi.update(editingNote.id, {
        title: editorTitle.trim(),
        content: editorContent,
        todo_items: editorTodos,
      });

      if (response.note) {
        setNotes(prev => prev.map(n => n.id === editingNote.id ? response.note : n));
        setIsModalOpen(false);
        setEditingNote(null);
      }
    } catch (err: any) {
      console.error('Failed to save note', err);
      setError(err.message || (locale === 'ar' ? 'فشل حفظ التعديلات' : 'Failed to save changes'));
    } finally {
      setSaving(false);
    }
  };

  // Delete note
  const handleDeleteNote = async (e: React.MouseEvent, noteId: string) => {
    e.stopPropagation(); // Prevent opening the edit modal
    if (!confirm(locale === 'ar' ? 'هل أنت متأكد من حذف هذه الملاحظة؟' : 'Are you sure you want to delete this note?')) return;
    
    try {
      setLoading(true);
      await notesApi.delete(noteId);
      setNotes(prev => prev.filter(n => n.id !== noteId));
    } catch (err) {
      console.error('Failed to delete note', err);
    } finally {
      setLoading(false);
    }
  };

  // Add todo item in local editor state
  const handleAddTodo = () => {
    if (!newTodoText.trim()) return;
    const newItem: TodoItem = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
      text: newTodoText.trim(),
      completed: false,
    };
    setEditorTodos([...editorTodos, newItem]);
    setNewTodoText('');
  };

  // Toggle todo item in local editor state
  const handleToggleTodo = (todoId: string) => {
    setEditorTodos(prev => prev.map(todo => 
      todo.id === todoId ? { ...todo, completed: !todo.completed } : todo
    ));
  };

  // Delete todo item in local editor state
  const handleDeleteTodo = (todoId: string) => {
    setEditorTodos(prev => prev.filter(todo => todo.id !== todoId));
  };

  // Filter notes
  const filteredNotes = notes.filter(note => {
    const matchesSearch = note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.content.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (filterType === 'text') return matchesSearch && note.type === 'text';
    if (filterType === 'todo') return matchesSearch && note.type === 'todo';
    return matchesSearch;
  });

  return (
    <div className="page-container fade-in flex flex-col gap-6 w-full min-h-[70vh] text-start font-sans">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <ClipboardList className="size-5 text-indigo-500" />
            <span>{locale === 'ar' ? 'مفكرتي الشخصية' : 'Personal Notepad'}</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            {locale === 'ar' 
              ? 'ملاحظاتك وقوائم مهامك الخاصة بك فقط، لن يراها أحد غيرك' 
              : 'Your private notepad and checklist task tracker. Only visible to you.'}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button onClick={() => handleCreateNote('text')} size="sm" className="text-xs gap-1.5 py-4 cursor-pointer">
            <Plus className="size-4" />
            <span>{locale === 'ar' ? 'ملاحظة جديدة' : 'New Note'}</span>
          </Button>
          <Button onClick={() => handleCreateNote('todo')} size="sm" variant="outline" className="text-xs gap-1.5 py-4 border-dashed border-indigo-200 hover:border-indigo-400 cursor-pointer">
            <CheckSquare className="size-4 text-indigo-500" />
            <span>{locale === 'ar' ? 'قائمة مهام' : 'Checklist'}</span>
          </Button>
        </div>
      </div>

      {/* Toolbar / Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between p-4 border rounded-xl bg-card/60 backdrop-blur-md shadow-xs">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <input
            type="text"
            placeholder={locale === 'ar' ? 'بحث في الملاحظات...' : 'Search notes...'}
            className="w-full bg-muted/40 text-xs py-2 pl-9 pr-4 rounded-xl border border-border focus:outline-hidden focus:ring-1 focus:ring-primary font-medium"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Type filter toggles */}
        <div className="flex bg-muted/30 p-0.5 rounded-lg border border-border/40 shrink-0 select-none">
          {[
            { id: 'all', label: locale === 'ar' ? 'الكل' : 'All' },
            { id: 'text', label: locale === 'ar' ? 'ملاحظات' : 'Notes' },
            { id: 'todo', label: locale === 'ar' ? 'قوائم مهام' : 'Checklists' }
          ].map(opt => (
            <button
              key={opt.id}
              onClick={() => setFilterType(opt.id as any)}
              className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                filterType === opt.id 
                  ? 'bg-background text-foreground shadow-xs' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Notes Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 border border-dashed rounded-2xl bg-card/10">
          <Loader2 className="size-8 animate-spin text-primary" />
          <span className="text-xs text-muted-foreground font-semibold">{locale === 'ar' ? 'جاري تحميل الملاحظات...' : 'Loading notes...'}</span>
        </div>
      ) : filteredNotes.length === 0 ? (
        <div className="text-center py-24 text-muted-foreground border border-dashed rounded-2xl bg-card/20 flex flex-col items-center justify-center gap-2">
          <ClipboardList className="size-12 stroke-[1.2] text-muted-foreground/50 mb-2" />
          <h3 className="text-sm font-bold text-foreground">{locale === 'ar' ? 'لا توجد ملاحظات' : 'No Notes Found'}</h3>
          <p className="text-xs text-muted-foreground max-w-sm">
            {locale === 'ar' 
              ? 'ابدأ بإنشاء أول ملاحظة أو قائمة مهام خاصة بك للبدء في تنظيم أفكارك.' 
              : 'Start by creating your first note or checklist task tracker to organize your thoughts.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
          {filteredNotes.map(note => {
            const isTodo = note.type === 'todo';
            const itemsCount = note.todo_items?.length || 0;
            const completedCount = note.todo_items?.filter(t => t.completed).length || 0;
            const progress = itemsCount > 0 ? Math.round((completedCount / itemsCount) * 100) : 0;
            
            // Preview list for checklist
            const previewTodos = note.todo_items?.slice(0, 3) || [];
            
            return (
              <Card 
                key={note.id}
                onClick={() => handleOpenEdit(note)}
                className="hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 cursor-pointer border border-border bg-card flex flex-col justify-between group overflow-hidden"
              >
                <CardContent className="p-5 flex flex-col gap-3 h-full">
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      {isTodo ? (
                        <CheckSquare className="size-4 text-indigo-500 shrink-0" />
                      ) : (
                        <FileText className="size-4 text-primary shrink-0" />
                      )}
                      <h3 className="font-bold text-sm text-foreground truncate">{note.title || (isTodo ? 'Untitled Checklist' : 'Untitled Note')}</h3>
                    </div>

                    <button
                      onClick={(e) => handleDeleteNote(e, note.id)}
                      className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 rounded-md text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-all cursor-pointer"
                      title={locale === 'ar' ? 'حذف' : 'Delete'}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>

                  {/* Card Body Previews */}
                  <div className="flex-1 min-h-[80px] text-xs">
                    {isTodo ? (
                      /* Checklist Preview */
                      <div className="flex flex-col gap-1.5 text-muted-foreground">
                        {previewTodos.length === 0 ? (
                          <span className="italic opacity-60">{locale === 'ar' ? 'قائمة فارغة' : 'Empty checklist'}</span>
                        ) : (
                          <div className="flex flex-col gap-1">
                            {previewTodos.map(todo => (
                              <div key={todo.id} className="flex items-center gap-2 min-w-0">
                                <span className={`size-1.5 rounded-full shrink-0 ${todo.completed ? 'bg-muted-foreground/40' : 'bg-indigo-500'}`} />
                                <span className={`truncate text-start ${todo.completed ? 'line-through opacity-50' : 'font-medium text-slate-700 dark:text-slate-300'}`}>
                                  {todo.text}
                                </span>
                              </div>
                            ))}
                            {itemsCount > 3 && (
                              <span className="text-[10px] font-semibold text-indigo-500/80 mt-0.5">
                                +{itemsCount - 3} {locale === 'ar' ? 'مهام إضافية' : 'more items'}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      /* Plain Text Preview */
                      <p className="text-muted-foreground/80 line-clamp-4 leading-relaxed whitespace-pre-line break-words text-start">
                        {note.content?.trim() || (
                          <span className="italic opacity-50">{locale === 'ar' ? 'لا يوجد محتوى...' : 'No content...'}</span>
                        )}
                      </p>
                    )}
                  </div>

                  {/* Card Footer Progress / Date */}
                  <div className="flex items-center justify-between border-t border-border/40 pt-3 mt-1 shrink-0 text-[10px] font-bold font-mono text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="size-3 text-muted-foreground/75" />
                      {note.updated_at ? new Date(note.updated_at).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US', { day: 'numeric', month: 'short' }) : ''}
                    </span>

                    {isTodo && itemsCount > 0 && (
                      <span className="text-indigo-600 bg-indigo-50 dark:bg-indigo-950/20 dark:text-indigo-400 px-1.5 py-0.5 rounded">
                        {completedCount}/{itemsCount} ({progress}%)
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* EDITOR DIALOG MODAL */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingNote(null);
        }}
        title={editingNote ? (editingNote.type === 'todo' ? (locale === 'ar' ? 'تعديل قائمة المهام' : 'Edit Checklist') : (locale === 'ar' ? 'تعديل الملاحظة' : 'Edit Note')) : ''}
      >
        {editingNote && (
          <form onSubmit={handleSave} className="flex flex-col gap-5 text-start max-h-[80vh] overflow-y-auto pr-1">
            {error && (
              <div className="bg-destructive/10 border border-destructive/30 text-destructive text-xs px-3 py-2 rounded-md font-semibold font-sans">
                {error}
              </div>
            )}

            {/* Note Title Input */}
            <div className="flex flex-col gap-1.5 font-sans">
              <label htmlFor="note-title" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{locale === 'ar' ? 'العنوان' : 'Title'}</label>
              <input
                id="note-title"
                type="text"
                className="w-full bg-card py-2.5 px-3.5 text-sm font-semibold rounded-xl border border-border focus:outline-hidden focus:ring-1 focus:ring-primary font-sans"
                placeholder={editingNote.type === 'todo' ? 'Checklist Title...' : 'Note Title...'}
                value={editorTitle}
                onChange={e => setEditorTitle(e.target.value)}
                required
                disabled={saving}
              />
            </div>

            {/* Note Content Section */}
            <div className="flex flex-col gap-1.5 flex-1 min-h-[220px]">
              <label htmlFor="note-body" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                {editingNote.type === 'todo' ? (locale === 'ar' ? 'المهام' : 'Checklist Items') : (locale === 'ar' ? 'المحتوى' : 'Content')}
              </label>

              {editingNote.type === 'text' ? (
                /* Plain notepad textarea */
                <textarea
                  id="note-body"
                  className="w-full min-h-[250px] bg-card text-xs p-4 rounded-xl border border-border focus:outline-hidden focus:ring-1 focus:ring-primary font-sans leading-relaxed resize-y custom-scrollbar"
                  placeholder={locale === 'ar' ? 'ابدأ في الكتابة هنا...' : 'Start typing your private notes here...'}
                  value={editorContent}
                  onChange={e => setEditorContent(e.target.value)}
                  disabled={saving}
                />
              ) : (
                /* Checklist manager view */
                <div className="flex flex-col gap-4 font-sans">
                  {/* Checklist statistics */}
                  {editorTodos.length > 0 && (
                    <div className="bg-muted/30 p-3 border rounded-xl flex flex-col gap-1.5">
                      <div className="flex justify-between items-center text-[10px] font-bold text-muted-foreground font-mono">
                        <span>{locale === 'ar' ? 'معدل الإنجاز' : 'PROGRESS'}</span>
                        <span>{editorTodos.filter(t => t.completed).length} of {editorTodos.length} ({Math.round((editorTodos.filter(t => t.completed).length / editorTodos.length) * 100)}%)</span>
                      </div>
                      <div className="w-full bg-muted/60 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-indigo-500 h-full rounded-full transition-all duration-300"
                          style={{ width: `${Math.round((editorTodos.filter(t => t.completed).length / editorTodos.length) * 100)}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Add Todo Checklist Row */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder={locale === 'ar' ? 'إضافة مهمة جديدة...' : 'Add a new checklist item...'}
                      className="flex-1 text-xs py-2 px-3 rounded-lg border border-border bg-card focus:outline-hidden focus:ring-1 focus:ring-primary font-medium"
                      value={newTodoText}
                      onChange={e => setNewTodoText(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault(); // Don't submit the form
                          handleAddTodo();
                        }
                      }}
                      disabled={saving}
                    />
                    <Button type="button" onClick={handleAddTodo} size="sm" className="px-3" disabled={saving}>
                      <Plus className="size-4" />
                    </Button>
                  </div>

                  {/* Todo Item Manager List */}
                  <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-0.5 custom-scrollbar">
                    {editorTodos.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground text-xs font-semibold bg-muted/10 border border-dashed rounded-xl">
                        {locale === 'ar' ? 'القائمة فارغة، أضف مهامك للبدء' : 'No items yet. Type above to start your checklist.'}
                      </div>
                    ) : (
                      editorTodos.map(todo => (
                        <div
                          key={todo.id}
                          className="flex items-center justify-between p-2.5 border border-border/40 rounded-xl bg-card/35 hover:bg-card/75 transition-colors group/todo"
                        >
                          <div className="flex items-center gap-3 flex-1 cursor-pointer" onClick={() => handleToggleTodo(todo.id)}>
                            <input
                              type="checkbox"
                              checked={todo.completed}
                              onChange={() => {}} // handled by click on outer div
                              className="size-4 text-indigo-600 rounded-sm border-border focus:ring-indigo-500 cursor-pointer pointer-events-none"
                            />
                            <span className={`text-xs font-medium font-sans leading-none select-none transition-all text-start ${
                              todo.completed ? 'line-through text-muted-foreground opacity-55' : 'text-slate-700 dark:text-slate-300 font-semibold'
                            }`}>
                              {todo.text}
                            </span>
                          </div>
                          
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-7 opacity-0 group-hover/todo:opacity-100 focus:opacity-100 transition-opacity text-muted-foreground hover:text-rose-500 hover:bg-rose-50/50"
                            onClick={() => handleDeleteTodo(todo.id)}
                            disabled={saving}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer Controls */}
            <div className="flex gap-3 justify-end pt-3 border-t mt-2 shrink-0 font-sans">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingNote(null);
                }}
                disabled={saving}
                className="cursor-pointer"
              >
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={saving} className="cursor-pointer">
                {saving ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    <span>{locale === 'ar' ? 'جاري الحفظ...' : 'Saving...'}</span>
                  </>
                ) : (
                  <span>{locale === 'ar' ? 'حفظ التعديلات' : 'Save Changes'}</span>
                )}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
