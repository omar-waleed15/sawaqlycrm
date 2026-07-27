import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Custom React hook for auto-saving form drafts to localStorage.
 * Automatically saves state as user types, flushes on tab-switch/pagehide,
 * restores draft on reload, and clears draft on form submit/reset.
 */
export function useFormDraft<T extends Record<string, any>>(
  key: string,
  initialValues: T
) {
  const [formState, setFormState] = useState<T>(() => {
    if (typeof window === 'undefined') return initialValues;
    try {
      const saved = localStorage.getItem(`form_draft_${key}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed.data === 'object' && parsed.data !== null) {
          return { ...initialValues, ...parsed.data };
        }
      }
    } catch {
      // Ignore parse error
    }
    return initialValues;
  });

  const [hasDraft, setHasDraft] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return !!localStorage.getItem(`form_draft_${key}`);
    } catch {
      return false;
    }
  });

  const stateRef = useRef(formState);
  stateRef.current = formState;

  // Save current state to localStorage
  const saveDraft = useCallback(() => {
    if (typeof window === 'undefined') return;
    try {
      const payload = {
        updatedAt: new Date().toISOString(),
        data: stateRef.current,
      };
      localStorage.setItem(`form_draft_${key}`, JSON.stringify(payload));
      setHasDraft(true);
    } catch {
      // Ignore quota errors
    }
  }, [key]);

  // Clear saved draft from localStorage
  const clearDraft = useCallback(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem(`form_draft_${key}`);
      setHasDraft(false);
    } catch {
      // Ignore
    }
  }, [key]);

  // Reset form to initial values and clear draft
  const resetForm = useCallback(() => {
    clearDraft();
    setFormState(initialValues);
  }, [clearDraft, initialValues]);

  // Auto-save on form state change with 300ms debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      saveDraft();
    }, 300);
    return () => clearTimeout(timer);
  }, [formState, saveDraft]);

  // Flush save on tab-switch (visibilitychange) or pagehide/unload
  useEffect(() => {
    const handleVisibilityOrPageHide = () => {
      if (document.visibilityState === 'hidden') {
        saveDraft();
      }
    };

    window.addEventListener('visibilitychange', handleVisibilityOrPageHide);
    window.addEventListener('pagehide', handleVisibilityOrPageHide);

    return () => {
      window.removeEventListener('visibilitychange', handleVisibilityOrPageHide);
      window.removeEventListener('pagehide', handleVisibilityOrPageHide);
    };
  }, [saveDraft]);

  return {
    formState,
    setFormState,
    saveDraft,
    clearDraft,
    resetForm,
    hasDraft,
  };
}
