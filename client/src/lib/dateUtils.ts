/**
 * Date utilities for sawaqlycrm, enforcing Africa/Cairo timezone.
 */

// Helper to get Cairo date parts
export function getCairoDateParts(dateInput?: Date | string | number) {
  const d = dateInput !== undefined
    ? (typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput)
    : new Date();
  
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Cairo',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  });

  const parts = formatter.formatToParts(d);
  const partMap = Object.fromEntries(parts.map((p) => [p.type, p.value]));

  return {
    year: parseInt(partMap.year, 10),
    month: parseInt(partMap.month, 10), // 1-12
    day: parseInt(partMap.day, 10),
    hour: parseInt(partMap.hour, 10),
    minute: parseInt(partMap.minute, 10),
    second: parseInt(partMap.second, 10),
  };
}

// Get the current date in Cairo as a 'YYYY-MM-DD' string
export function getCairoTodayString(): string {
  const { year, month, day } = getCairoDateParts();
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// Convert any date/time string or Date to Cairo YYYY-MM-DD date string
export function getCairoDateString(dateInput: Date | string | number): string {
  const { year, month, day } = getCairoDateParts(dateInput);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// Format a date string or Date object in Africa/Cairo timezone (Locale-based)
export function formatCairoDate(
  dateInput: Date | string | number | null | undefined,
  locale: string = 'en-US',
  options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }
): string {
  if (!dateInput) return '';
  const date = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return '';

  const resolvedLocale = locale === 'ar' ? 'ar-EG' : locale === 'en-GB' ? 'en-GB' : 'en-US';
  return date.toLocaleDateString(resolvedLocale, {
    timeZone: 'Africa/Cairo',
    ...options,
  });
}

// Format time in Africa/Cairo timezone
export function formatCairoTime(
  dateInput: Date | string | number | null | undefined,
  locale: string = 'en-US',
  options: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' }
): string {
  if (!dateInput) return '';
  const date = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return '';

  const resolvedLocale = locale === 'ar' ? 'ar-EG' : locale === 'en-GB' ? 'en-GB' : 'en-US';
  return date.toLocaleTimeString(resolvedLocale, {
    timeZone: 'Africa/Cairo',
    ...options,
  });
}

// Format both date and time in Africa/Cairo timezone
export function formatCairoDateTime(
  dateInput: Date | string | number | null | undefined,
  locale: string = 'en-US',
  options: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' }
): string {
  if (!dateInput) return '';
  const date = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return '';

  const resolvedLocale = locale === 'ar' ? 'ar-EG' : locale === 'en-GB' ? 'en-GB' : 'en-US';
  
  const formatOptions: Intl.DateTimeFormatOptions = {
    timeZone: 'Africa/Cairo',
    ...options,
  };
  
  return date.toLocaleString(resolvedLocale, formatOptions);
}

// Determine if a YYYY-MM-DD date is overdue based on Cairo today
export function isDateOverdue(dateStr?: string): boolean {
  if (!dateStr) return false;
  
  const formattedDueDate = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
  const todayStr = getCairoTodayString();
  
  return formattedDueDate < todayStr;
}

// Helper to get Cairo date offset by a certain number of days
export function getCairoTodayPlusNDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return getCairoDateString(d);
}
