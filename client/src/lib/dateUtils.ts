/**
 * Direct date utilities for sawaqlycrm.
 * Stores and displays exact date and time as selected by the user without timezone offsets.
 */

export function getDateParts(dateInput?: Date | string | number | null) {
  if (!dateInput) {
    const now = new Date();
    return {
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      day: now.getDate(),
      hour: now.getHours(),
      minute: now.getMinutes(),
      second: now.getSeconds(),
    };
  }

  if (typeof dateInput === 'string') {
    const str = dateInput.trim();
    // Match ISO/datetime-local pattern YYYY-MM-DD[T ]HH:mm(:ss)? directly without timezone offset shifting
    const match = str.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/);
    if (match) {
      return {
        year: parseInt(match[1], 10),
        month: parseInt(match[2], 10),
        day: parseInt(match[3], 10),
        hour: match[4] !== undefined ? parseInt(match[4], 10) : 0,
        minute: match[5] !== undefined ? parseInt(match[5], 10) : 0,
        second: match[6] !== undefined ? parseInt(match[6], 10) : 0,
      };
    }
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      return {
        year: d.getFullYear(),
        month: d.getMonth() + 1,
        day: d.getDate(),
        hour: d.getHours(),
        minute: d.getMinutes(),
        second: d.getSeconds(),
      };
    }
  }

  const d = typeof dateInput === 'number' ? new Date(dateInput) : (dateInput as Date);
  if (isNaN(d.getTime())) {
    const now = new Date();
    return {
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      day: now.getDate(),
      hour: now.getHours(),
      minute: now.getMinutes(),
      second: now.getSeconds(),
    };
  }

  return {
    year: d.getFullYear(),
    month: d.getMonth() + 1,
    day: d.getDate(),
    hour: d.getHours(),
    minute: d.getMinutes(),
    second: d.getSeconds(),
  };
}

export function getCairoDateParts(dateInput?: Date | string | number | null) {
  return getDateParts(dateInput);
}

export function parseCairoDateTimeToISO(dateInput?: string | null): string {
  if (!dateInput) return '';
  const str = dateInput.trim();
  if (!str) return '';
  const { year, month, day, hour, minute } = getDateParts(str);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:00`;
}

export function toCairoISOString(dateInput?: string | null): string {
  return parseCairoDateTimeToISO(dateInput);
}

export function getCairoDatetimeLocalString(dateInput?: Date | string | number | null): string {
  if (!dateInput) return '';
  const { year, month, day, hour, minute } = getDateParts(dateInput);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}`;
}

export function getCairoTodayString(): string {
  const { year, month, day } = getDateParts();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function getCairoDateString(dateInput: Date | string | number): string {
  const { year, month, day } = getDateParts(dateInput);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function formatCairoTime(
  dateInput: Date | string | number | null | undefined,
  locale: string = 'en-US'
): string {
  if (!dateInput) return '';
  const { hour, minute } = getDateParts(dateInput);
  let h = hour % 12;
  if (h === 0) h = 12;
  const ampm = hour >= 12 ? (locale === 'ar' ? 'م' : 'PM') : (locale === 'ar' ? 'ص' : 'AM');
  const pad = (n: number) => String(n).padStart(2, '0');
  
  if (locale === 'ar') {
    const arDigits = ['٠','١','٢','٣','٤','٥','٦','٧','٨','٩'];
    const toAr = (str: string) => str.replace(/\d/g, d => arDigits[parseInt(d, 10)]);
    return `${toAr(pad(h))}:${toAr(pad(minute))} ${ampm}`;
  }
  return `${pad(h)}:${pad(minute)} ${ampm}`;
}

export function formatCairoDate(
  dateInput: Date | string | number | null | undefined,
  locale: string = 'en-US',
  options?: Intl.DateTimeFormatOptions
): string {
  if (!dateInput) return '';
  const { year, month, day } = getDateParts(dateInput);
  const d = new Date(year, month - 1, day);
  const resolvedLocale = locale === 'ar' ? 'ar-EG' : locale === 'en-GB' ? 'en-GB' : 'en-US';
  return d.toLocaleDateString(resolvedLocale, options || { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatCairoDateTime(
  dateInput: Date | string | number | null | undefined,
  locale: string = 'en-US',
  options?: Intl.DateTimeFormatOptions
): string {
  if (!dateInput) return '';
  const formattedDate = formatCairoDate(dateInput, locale, { month: 'short', day: 'numeric', year: 'numeric' });
  const formattedTime = formatCairoTime(dateInput, locale);
  return `${formattedDate}, ${formattedTime}`;
}

export function isDateOverdue(dateStr?: string): boolean {
  if (!dateStr) return false;
  const { year, month, day, hour, minute } = getDateParts(dateStr);

  const now = new Date();

  // If a specific time (hour or minute != 0) was set for the due date:
  if (hour !== 0 || minute !== 0) {
    const dueDateObj = new Date(year, month - 1, day, hour, minute, 59);
    return now > dueDateObj;
  }

  // If no specific time was set (00:00:00), the due date spans the entire day.
  // It is overdue if today's date has passed the due date (i.e. starting the next day).
  const pad = (n: number) => String(n).padStart(2, '0');
  const formattedDueDate = `${year}-${pad(month)}-${pad(day)}`;
  const todayStr = getCairoTodayString();
  return formattedDueDate < todayStr;
}

export function isAssigneeOverdue(dueDateStr?: string, status?: string, submittedAt?: string | null): boolean {
  if (!dueDateStr) return false;
  if (status === 'completed' || status === 'submitted') return false;
  return isDateOverdue(dueDateStr);
}

export function isAssigneeSubmittedLate(dueDateStr?: string, submittedAt?: string | null): boolean {
  if (!dueDateStr || !submittedAt) return false;
  const { year: dy, month: dm, day: dd, hour: dh, minute: dmin } = getDateParts(dueDateStr);

  const dueObj = (dh === 0 && dmin === 0)
    ? new Date(dy, dm - 1, dd, 23, 59, 59)
    : new Date(dy, dm - 1, dd, dh, dmin, 59);

  const { year: sy, month: sm, day: sd, hour: sh, minute: smin, second: ss } = getDateParts(submittedAt);
  const submittedObj = new Date(sy, sm - 1, sd, sh, smin, ss);

  return submittedObj > dueObj;
}

export function getCairoTodayPlusNDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return getCairoDateString(d);
}

/**
 * Format server UTC timestamps (e.g. task.created_at, call_date) in Africa/Cairo (+3h offset).
 */
export function formatServerTimestamp(
  dateInput: Date | string | number | null | undefined,
  locale: string = 'en-US'
): string {
  if (!dateInput) return '';

  let d: Date;
  if (typeof dateInput === 'string') {
    let str = dateInput.trim();
    if (!str) return '';
    // Append 'Z' if missing so JavaScript parses server ISO strings as UTC (+3h Cairo offset)
    if (!str.endsWith('Z') && !/[+-]\d{2}:\d{2}$/.test(str)) {
      str = str.replace(' ', 'T') + 'Z';
    }
    d = new Date(str);
  } else if (typeof dateInput === 'number') {
    d = new Date(dateInput);
  } else {
    d = dateInput;
  }

  if (isNaN(d.getTime())) return '';

  const resolvedLocale = locale === 'ar' ? 'ar-EG' : locale === 'en-GB' ? 'en-GB' : 'en-US';
  return d.toLocaleString(resolvedLocale, {
    timeZone: 'Africa/Cairo',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format Call Log timestamps (call_date) which come in UTC ISO format from DB.
 * Converts UTC ISO string to Africa/Cairo local time (+3 hours offset).
 */
export function formatLogDateTime(
  dateInput: Date | string | number | null | undefined,
  locale: string = 'en-US'
): string {
  return formatServerTimestamp(dateInput, locale);
}
