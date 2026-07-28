/**
 * Convert a user input string (from datetime-local "YYYY-MM-DDTHH:mm" or ISO string)
 * into a valid UTC ISO string, assuming naive inputs are in Africa/Cairo local time.
 */
export function parseCairoDateTimeToISO(dateInput?: string | null): string {
  if (!dateInput) return '';
  const str = dateInput.trim();
  if (!str) return '';

  // If already standard ISO with explicit 'Z' or offset (e.g. +03:00 or -05:00)
  if (str.endsWith('Z') || (str.includes('T') && (str.includes('+', 10) || (str.includes('-', 10) && str.indexOf('-', 10) > 10)))) {
    const d = new Date(str);
    return isNaN(d.getTime()) ? str : d.toISOString();
  }

  // Handle naive string "YYYY-MM-DDTHH:mm" or "YYYY-MM-DD HH:mm"
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!match) {
    const fallback = new Date(str);
    return isNaN(fallback.getTime()) ? str : fallback.toISOString();
  }

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);
  const hour = parseInt(match[4], 10);
  const minute = parseInt(match[5], 10);
  const second = match[6] ? parseInt(match[6], 10) : 0;

  // Create a UTC date representing these naive parts
  const naiveUtc = new Date(Date.UTC(year, month - 1, day, hour, minute, second));

  // Determine Cairo offset for this date
  const cairoParts = getCairoDateParts(naiveUtc);
  const cairoUtcTime = Date.UTC(cairoParts.year, cairoParts.month - 1, cairoParts.day, cairoParts.hour, cairoParts.minute, cairoParts.second);

  // Offset in milliseconds between Cairo time and UTC time
  const offsetMs = cairoUtcTime - naiveUtc.getTime();

  // Subtract the offset to get the true UTC date corresponding to target Cairo local time
  const trueUtc = new Date(naiveUtc.getTime() - offsetMs);
  return trueUtc.toISOString();
}

export function toCairoISOString(dateInput?: string | null): string {
  return parseCairoDateTimeToISO(dateInput);
}

// Helper to get Cairo date parts
export function getCairoDateParts(dateInput?: Date | string | number) {
  let d: Date;
  if (dateInput !== undefined) {
    if (typeof dateInput === 'string') {
      // If naive string without timezone, parse it using parseCairoDateTimeToISO first
      if (!dateInput.endsWith('Z') && !dateInput.includes('+') && (!dateInput.includes('-', 10) || dateInput.indexOf('-', 10) <= 10)) {
        d = new Date(parseCairoDateTimeToISO(dateInput));
      } else {
        d = new Date(dateInput);
      }
    } else if (typeof dateInput === 'number') {
      d = new Date(dateInput);
    } else {
      d = dateInput;
    }
  } else {
    d = new Date();
  }

  if (isNaN(d.getTime())) {
    d = new Date();
  }
  
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Cairo',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
    hourCycle: 'h23',
  });

  const parts = formatter.formatToParts(d);
  const partMap = Object.fromEntries(parts.map((p) => [p.type, p.value]));

  let hour = parseInt(partMap.hour, 10);
  if (hour === 24) hour = 0;

  return {
    year: parseInt(partMap.year, 10),
    month: parseInt(partMap.month, 10), // 1-12
    day: parseInt(partMap.day, 10),
    hour,
    minute: parseInt(partMap.minute, 10),
    second: parseInt(partMap.second, 10),
  };
}

/**
 * Formats a Date or ISO string into a "YYYY-MM-DDTHH:mm" string in Africa/Cairo timezone
 * suitable for HTML <input type="datetime-local" /> value attribute.
 */
export function getCairoDatetimeLocalString(dateInput?: Date | string | number | null): string {
  if (!dateInput) return '';
  const { year, month, day, hour, minute } = getCairoDateParts(dateInput);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}`;
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

// Determine if a date/timestamp is overdue
export function isDateOverdue(dateStr?: string): boolean {
  if (!dateStr) return false;
  
  // If exact time is present (ISO format with T), check exact timestamp against now
  if (dateStr.includes('T') && dateStr.length > 10) {
    const time = new Date(dateStr).getTime();
    if (!isNaN(time)) {
      return time < Date.now();
    }
  }
  
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
