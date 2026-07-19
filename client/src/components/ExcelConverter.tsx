'use client';

import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/lib/i18n';
import {
  Upload,
  Loader2,
  Download,
  CheckCircle,
  XCircle,
  Sparkles,
  FileSpreadsheet,
  Globe,
  RefreshCw,
  Trash2,
  Megaphone,
} from 'lucide-react';

interface ExcelConverterProps {
  onUseInCampaign?: (file: File, validCount: number) => void;
}

interface FormattedRow {
  index: number; // 0-based index in data rows
  original: string;
  formatted: string;
  isValid: boolean;
  rowCells: any[];
}

export default function ExcelConverter({ onUseInCampaign }: ExcelConverterProps) {
  const { locale } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // File states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [sheets, setSheets] = useState<string[]>([]);
  const [activeSheet, setActiveSheet] = useState<string>('');
  
  // Sheet Data state (2D array: rows containing cols)
  const [sheetData, setSheetData] = useState<any[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  
  // Mapping options
  const [phoneColumnIdx, setPhoneColumnIdx] = useState<number>(-1);
  const [countryCode, setCountryCode] = useState<string>('20'); // Egypt by default
  const [customCountryCode, setCustomCountryCode] = useState<string>('');
  
  // Rule toggles
  const [cleanNonDigits, setCleanNonDigits] = useState(true);
  const [replaceLeadingZero, setReplaceLeadingZero] = useState(true);
  const [forcePrefix, setForcePrefix] = useState(true);
  const [removeInvalid, setRemoveInvalid] = useState(true);
  const [exportType, setExportType] = useState<'phone_only' | 'all_columns'>('phone_only');

  // Preview / Formatted state
  const [formattedRows, setFormattedRows] = useState<FormattedRow[]>([]);
  const [validCount, setValidCount] = useState(0);
  const [invalidCount, setInvalidCount] = useState(0);

  // Common Arab countries prefix list
  const countryPrefixes = [
    { code: '966', nameEn: 'Saudi Arabia (+966)', nameAr: 'المملكة العربية السعودية (+966)' },
    { code: '20', nameEn: 'Egypt (+20)', nameAr: 'جمهورية مصر العربية (+20)' },
    { code: '971', nameEn: 'UAE (+971)', nameAr: 'الإمارات العربية المتحدة (+971)' },
    { code: '962', nameEn: 'Jordan (+962)', nameAr: 'الأردن (+962)' },
    { code: '965', nameEn: 'Kuwait (+965)', nameAr: 'الكويت (+965)' },
    { code: '974', nameEn: 'Qatar (+974)', nameAr: 'قطر (+974)' },
    { code: '968', nameEn: 'Oman (+968)', nameAr: 'سلطنة عمان (+968)' },
    { code: '973', nameEn: 'Bahrain (+973)', nameAr: 'البحرين (+973)' },
    { code: '', nameEn: 'No Prefix (Keep Original)', nameAr: 'بدون رمز دولي (إبقاء الأصلي)' },
    { code: 'custom', nameEn: 'Custom Prefix...', nameAr: 'رمز دولي مخصص...' },
  ];

  // Reset converter state
  const resetConverter = () => {
    setSelectedFile(null);
    setWorkbook(null);
    setSheets([]);
    setActiveSheet('');
    setSheetData([]);
    setHeaders([]);
    setPhoneColumnIdx(-1);
    setFormattedRows([]);
    setValidCount(0);
    setInvalidCount(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Handle excel file parsing
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setSelectedFile(file);
    setLoading(true);
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        
        setWorkbook(wb);
        setSheets(wb.SheetNames);
        
        if (wb.SheetNames.length > 0) {
          const firstSheet = wb.SheetNames[0];
          setActiveSheet(firstSheet);
          parseSheet(wb, firstSheet);
        }
      } catch (err) {
        console.error('Error parsing Excel file', err);
        alert(locale === 'ar' ? 'فشل قراءة ملف الإكسل. يرجى التأكد من سلامة الملف.' : 'Failed to parse Excel file. Please verify the file is not corrupted.');
        resetConverter();
      } finally {
        setLoading(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Parse a specific worksheet
  const parseSheet = (wb: XLSX.WorkBook, sheetName: string) => {
    const ws = wb.Sheets[sheetName];
    // Read with header: 1 to get a 2D array of rows
    const data = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, raw: false });
    
    if (data.length === 0) {
      setSheetData([]);
      setHeaders([]);
      setPhoneColumnIdx(-1);
      return;
    }
    
    // Find the header row (typically row 0, but skip leading empty rows if any)
    let headerRowIdx = 0;
    for (let i = 0; i < data.length; i++) {
      if (data[i] && data[i].length > 0) {
        headerRowIdx = i;
        break;
      }
    }
    
    const parsedHeaders = data[headerRowIdx].map((h: any) => String(h || '').trim());
    setHeaders(parsedHeaders);
    
    // Slice rows after header row
    const dataRows = data.slice(headerRowIdx + 1);
    setSheetData(dataRows);
    
    // Auto-detect phone column index
    const autoIdx = parsedHeaders.findIndex((h: string) => {
      const lower = h.toLowerCase();
      return (
        lower.includes('phone') ||
        lower.includes('mobile') ||
        lower.includes('number') ||
        lower.includes('tel') ||
        lower.includes('جوال') ||
        lower.includes('هاتف') ||
        lower.includes('رقم') ||
        lower.includes('موبايل')
      );
    });
    setPhoneColumnIdx(autoIdx !== -1 ? autoIdx : 0);
  };

  // Handle active sheet tab change
  const handleSheetChange = (sheetName: string) => {
    if (!workbook) return;
    setActiveSheet(sheetName);
    parseSheet(workbook, sheetName);
  };

  // Run conversion formatting whenever parameters or sheetData changes
  useEffect(() => {
    if (sheetData.length === 0 || phoneColumnIdx === -1) {
      setFormattedRows([]);
      setValidCount(0);
      setInvalidCount(0);
      return;
    }

    const activePrefix = countryCode === 'custom' ? customCountryCode.replace(/\D/g, '') : countryCode;
    let vCount = 0;
    let iCount = 0;

    const processed = sheetData.map((rowCells, idx) => {
      const rawCellVal = rowCells[phoneColumnIdx];
      const originalStr = rawCellVal !== undefined && rawCellVal !== null ? String(rawCellVal).trim() : '';
      
      let cleaned = originalStr;

      // 1. Recover scientific notation
      if (/^\d+(\.\d+)?[eE]\+?\d+$/.test(cleaned)) {
        try {
          cleaned = BigInt(Math.round(Number(cleaned))).toString();
        } catch (e) {
          cleaned = String(Math.round(Number(cleaned)));
        }
      }

      // If read as numeric double, ensure it doesn't carry decimals
      if (typeof rawCellVal === 'number') {
        cleaned = BigInt(Math.round(rawCellVal)).toString();
      }

      // 2. Strip non-digits
      if (cleanNonDigits) {
        cleaned = cleaned.replace(/[+\s-()'"\\]/g, '');
      }

      // 3. Remove leading double zeros
      if (cleaned.startsWith('00')) {
        cleaned = cleaned.substring(2);
      }

      // 4. Prefix country code
      if (activePrefix) {
        if (cleaned.startsWith('0')) {
          if (replaceLeadingZero) {
            cleaned = activePrefix + cleaned.substring(1);
          }
        } else if (cleaned.length > 0) {
          if (forcePrefix && !cleaned.startsWith(activePrefix)) {
            cleaned = activePrefix + cleaned;
          }
        }
      }

      // 5. Validation check (WAPilot needs 8 to 15 digits)
      const isValid = /^\d{8,15}$/.test(cleaned);

      if (isValid) vCount++;
      else iCount++;

      return {
        index: idx,
        original: originalStr,
        formatted: cleaned,
        isValid,
        rowCells,
      };
    });

    setFormattedRows(processed);
    setValidCount(vCount);
    setInvalidCount(iCount);
  }, [sheetData, phoneColumnIdx, countryCode, customCountryCode, cleanNonDigits, replaceLeadingZero, forcePrefix]);

  // Construct CSV text client-side
  const generateCSVContent = (): string => {
    const activePrefix = countryCode === 'custom' ? customCountryCode.replace(/\D/g, '') : countryCode;
    const filterFunc = (row: FormattedRow) => !removeInvalid || row.isValid;

    if (exportType === 'phone_only') {
      // CSV format: phone numbers only (one per line, with an optional header)
      const headerRow = locale === 'ar' ? 'الهاتف' : 'Phone';
      const body = formattedRows
        .filter(filterFunc)
        .map((r) => r.formatted)
        .join('\n');
      return `${headerRow}\n${body}`;
    } else {
      // CSV format: keeping all original columns but replacing the phone column value with our formatted number
      // We will also insert commas and handle quotes properly
      const escapeField = (val: any) => {
        const str = val !== undefined && val !== null ? String(val) : '';
        if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      const csvHeaders = headers.map(h => escapeField(h)).join(',');
      const csvBody = formattedRows
        .filter(filterFunc)
        .map((row) => {
          const cells = [...row.rowCells];
          // Padding cells if row cells length is shorter than headers length
          while (cells.length < headers.length) {
            cells.push('');
          }
          // Substitute with formatted phone number
          cells[phoneColumnIdx] = row.formatted;
          return cells.map(c => escapeField(c)).join(',');
        })
        .join('\n');

      return `${csvHeaders}\n${csvBody}`;
    }
  };

  // Convert CSV string to Javascript File
  const createCSVFile = (): File => {
    const csvContent = generateCSVContent();
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const originalBaseName = selectedFile ? selectedFile.name.replace(/\.[^/.]+$/, '') : 'excel_converted';
    return new File([blob], `${originalBaseName}_cleaned.csv`, { type: 'text/csv' });
  };

  // Trigger CSV File Download
  const handleDownload = () => {
    if (formattedRows.length === 0) return;
    
    const file = createCSVFile();
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Trigger campaign creation directly
  const handleUseInCampaign = () => {
    if (!onUseInCampaign || formattedRows.length === 0) return;
    const file = createCSVFile();
    const finalValidCount = removeInvalid ? validCount : (validCount + invalidCount);
    onUseInCampaign(file, finalValidCount);
  };

  return (
    <div className="flex flex-col gap-6 w-full animate-in fade-in duration-200">
      {/* Excel Upload Area */}
      {!selectedFile ? (
        <Card className="border border-dashed border-border bg-card/40 hover:bg-card/70 transition-all duration-300 rounded-2xl">
          <CardContent className="p-12 text-center flex flex-col items-center justify-center gap-4">
            <div className="size-16 rounded-full bg-emerald-500/10 dark:bg-emerald-500/20 flex items-center justify-center text-emerald-500 animate-pulse">
              <FileSpreadsheet className="size-8" />
            </div>
            
            <div>
              <h3 className="text-base font-bold text-foreground">
                {locale === 'ar' ? 'تحميل قائمة الأرقام من ملف إكسل' : 'Import phone list from Excel sheet'}
              </h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                {locale === 'ar'
                  ? 'قم بسحب ملف Excel (.xlsx أو .xls) هنا أو اضغط لتصفح ملفاتك.'
                  : 'Drag and drop your Excel (.xlsx, .xls) file here, or click to browse files.'}
              </p>
            </div>

            <div className="relative">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                className="hidden"
                disabled={loading}
              />
              <Button
                type="button"
                size="sm"
                className="cursor-pointer font-semibold py-5"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    {locale === 'ar' ? 'جاري القراءة...' : 'Reading file...'}
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 size-4" />
                    {locale === 'ar' ? 'اختر ملف إكسل' : 'Select Excel File'}
                  </>
                )}
              </Button>
            </div>
            
            <span className="text-[10px] text-muted-foreground/80 font-mono">
              {locale === 'ar' ? 'يدعم التنسيقات: .xlsx, .xls | المعالجة تتم محلياً بالكامل' : 'Supports formats: .xlsx, .xls | Processing is 100% client-side'}
            </span>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Left / Top Controls Column */}
          <div className="lg:col-span-1 flex flex-col gap-6">
            {/* File & Sheet details Card */}
            <Card className="border border-border bg-card">
              <CardContent className="p-5 flex flex-col gap-4">
                <div className="flex items-start justify-between border-b pb-3 border-border/50">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileSpreadsheet className="size-5 text-emerald-500 shrink-0" />
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-foreground truncate">{selectedFile.name}</h4>
                      <p className="text-[9px] text-muted-foreground font-mono">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 hover:bg-rose-50 hover:text-rose-500 rounded-md shrink-0 cursor-pointer"
                    onClick={resetConverter}
                    title={locale === 'ar' ? 'حذف الملف' : 'Remove File'}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>

                {/* Sheet Selector (if multiple) */}
                {sheets.length > 1 && (
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      {locale === 'ar' ? 'ورقة العمل النشطة' : 'Select Sheet'}
                    </label>
                    <div className="flex flex-wrap gap-1">
                      {sheets.map((sheet) => (
                        <button
                          key={sheet}
                          onClick={() => handleSheetChange(sheet)}
                          className={`px-2.5 py-1 rounded-md text-[10px] font-bold border transition-colors ${
                            activeSheet === sheet
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/50'
                              : 'bg-card border-border hover:bg-muted text-muted-foreground'
                          }`}
                        >
                          {sheet}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Column Mapper */}
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="phone-col-select" className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    {locale === 'ar' ? 'عامود أرقام الهواتف' : 'Phone Number Column'}
                  </label>
                  <select
                    id="phone-col-select"
                    className="w-full bg-card py-2 px-3 text-xs font-semibold rounded-lg border border-border focus:outline-hidden focus:ring-1 focus:ring-primary"
                    value={phoneColumnIdx}
                    onChange={(e) => setPhoneColumnIdx(Number(e.target.value))}
                  >
                    {headers.map((h, i) => (
                      <option key={i} value={i}>
                        {h || `Column ${i + 1}`}
                      </option>
                    ))}
                  </select>
                </div>
              </CardContent>
            </Card>

            {/* Formatting Rules Card */}
            <Card className="border border-border bg-card">
              <CardContent className="p-5 flex flex-col gap-4">
                <h4 className="text-xs font-extrabold text-foreground flex items-center gap-1.5 border-b pb-2.5 border-border/50 uppercase tracking-wider">
                  <Globe className="size-4 text-indigo-500" />
                  <span>{locale === 'ar' ? 'قواعد تهيئة الأرقام' : 'Formatting Rules'}</span>
                </h4>

                {/* Country Prefix Code Selector */}
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="country-prefix-select" className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    {locale === 'ar' ? 'البلد الافتراضي (الرمز الدولي)' : 'Default Country Prefix'}
                  </label>
                  <select
                    id="country-prefix-select"
                    className="w-full bg-card py-2 px-3 text-xs font-semibold rounded-lg border border-border focus:outline-hidden focus:ring-1 focus:ring-primary"
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value)}
                  >
                    {countryPrefixes.map((p) => (
                      <option key={p.code} value={p.code}>
                        {locale === 'ar' ? p.nameAr : p.nameEn}
                      </option>
                    ))}
                  </select>

                  {countryCode === 'custom' && (
                    <input
                      type="text"
                      className="w-full mt-1 bg-card py-2 px-3 text-xs font-semibold rounded-lg border border-border focus:outline-hidden focus:ring-1 focus:ring-primary"
                      placeholder={locale === 'ar' ? 'مثال: 966' : 'e.g. 966'}
                      value={customCountryCode}
                      onChange={(e) => setCustomCountryCode(e.target.value)}
                    />
                  )}
                </div>

                {/* Formatting Toggles */}
                <div className="flex flex-col gap-3 pt-2 text-xs font-semibold text-foreground/80">
                  <label className="flex items-start gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      className="mt-0.5 rounded border-border text-primary focus:ring-primary size-3.5"
                      checked={cleanNonDigits}
                      onChange={(e) => setCleanNonDigits(e.target.checked)}
                    />
                    <span>{locale === 'ar' ? 'تنظيف الفراغات، الشرطات، والرموز (مثل + أو -)' : 'Remove spaces, dashes, + signs, and parentheses'}</span>
                  </label>

                  {countryCode !== '' && (
                    <>
                      <label className="flex items-start gap-2.5 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          className="mt-0.5 rounded border-border text-primary focus:ring-primary size-3.5"
                          checked={replaceLeadingZero}
                          onChange={(e) => setReplaceLeadingZero(e.target.checked)}
                        />
                        <span>{locale === 'ar' ? 'استبدال الصفر الأول بالرمز الدولي (05... -> 9665...)' : 'Replace leading zero with country code (e.g. 05... -> 9665...)'}</span>
                      </label>

                      <label className="flex items-start gap-2.5 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          className="mt-0.5 rounded border-border text-primary focus:ring-primary size-3.5"
                          checked={forcePrefix}
                          onChange={(e) => setForcePrefix(e.target.checked)}
                        />
                        <span>{locale === 'ar' ? 'إضافة الرمز الدولي إذا كان الرقم لا يبدأ به' : 'Force country code prefix if it is missing'}</span>
                      </label>
                    </>
                  )}

                  <label className="flex items-start gap-2.5 cursor-pointer select-none border-t border-border/30 pt-3 text-amber-600 dark:text-amber-400">
                    <input
                      type="checkbox"
                      className="mt-0.5 rounded border-border text-primary focus:ring-primary size-3.5"
                      checked={removeInvalid}
                      onChange={(e) => setRemoveInvalid(e.target.checked)}
                    />
                    <span>{locale === 'ar' ? 'تصفية وحذف الأرقام غير الصالحة من ملف التصدير' : 'Filter out invalid numbers from final CSV'}</span>
                  </label>
                </div>

                {/* Export Format Select */}
                <div className="flex flex-col gap-2 border-t border-border/30 pt-3">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    {locale === 'ar' ? 'صيغة تصدير ملف الـ CSV' : 'Export File Format'}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setExportType('phone_only')}
                      className={`py-2 px-3 text-center text-xs font-bold border rounded-lg transition-colors ${
                        exportType === 'phone_only'
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-card border-border hover:bg-muted text-foreground'
                      }`}
                    >
                      {locale === 'ar' ? 'أرقام هواتف فقط' : 'Phone Numbers Only'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setExportType('all_columns')}
                      className={`py-2 px-3 text-center text-xs font-bold border rounded-lg transition-colors ${
                        exportType === 'all_columns'
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-card border-border hover:bg-muted text-foreground'
                      }`}
                    >
                      {locale === 'ar' ? 'كامل بيانات الجدول' : 'All Original Columns'}
                    </button>
                  </div>
                  <p className="text-[9px] text-muted-foreground leading-normal mt-1">
                    {exportType === 'phone_only'
                      ? (locale === 'ar' ? 'سيتم توليد ملف يحتوي على عامود واحد للأرقام فقط.' : 'Outputs a clean CSV with a single column containing only formatted phone numbers.')
                      : (locale === 'ar' ? 'سيتم الاحتفاظ بكافة أعمدة الملف الأصلي واستبدال عامود الهواتف فقط بالصيغة المعدلة.' : 'Keeps all columns from your original sheet intact, but replaces the selected phone column with formatted numbers.')}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right / Main Data Table Preview & Actions Column */}
          <div className="lg:col-span-2 flex flex-col gap-6 w-full">
            {/* Quick summary banner */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-card border border-border rounded-xl p-4 flex flex-col">
                <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">{locale === 'ar' ? 'إجمالي الصفوف' : 'Total Rows'}</span>
                <span className="text-lg font-black text-foreground font-mono mt-1">{formattedRows.length}</span>
              </div>
              <div className="bg-emerald-500/5 border border-emerald-500/20 dark:border-emerald-500/10 rounded-xl p-4 flex flex-col text-emerald-600 dark:text-emerald-400">
                <span className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 font-bold uppercase tracking-wider">{locale === 'ar' ? 'أرقام صالحة' : 'Valid Numbers'}</span>
                <span className="text-lg font-black font-mono mt-1">{validCount}</span>
              </div>
              <div className={`border rounded-xl p-4 flex flex-col ${
                invalidCount > 0 
                  ? 'bg-rose-500/5 border-rose-500/20 text-rose-600 dark:text-rose-400' 
                  : 'bg-card border-border text-muted-foreground/70'
              }`}>
                <span className="text-[10px] font-bold uppercase tracking-wider">{locale === 'ar' ? 'صفوف غير صالحة' : 'Invalid Rows'}</span>
                <span className="text-lg font-black font-mono mt-1">{invalidCount}</span>
              </div>
            </div>

            {/* Live Data Preview Table */}
            <Card className="border border-border bg-card flex flex-col min-h-[350px]">
              <CardContent className="p-0 flex flex-col justify-between flex-1">
                <div className="w-full overflow-x-auto">
                  <table className="w-full text-start text-xs border-collapse">
                    <thead>
                      <tr className="bg-muted/30 border-b border-border/80 text-[10px] font-bold text-muted-foreground uppercase font-sans">
                        <th className="px-4 py-3 text-center w-12 border-r border-border/40 font-mono">#</th>
                        <th className="px-4 py-3">{locale === 'ar' ? 'القيمة الأصلية بالخلية' : 'Original Cell Value'}</th>
                        <th className="px-4 py-3">{locale === 'ar' ? 'الرقم بعد المعالجة والتهيئة' : 'Formatted Phone'}</th>
                        <th className="px-4 py-3 text-center w-24">{locale === 'ar' ? 'الحالة' : 'Status'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40 font-sans">
                      {formattedRows.slice(0, 10).map((row, idx) => (
                        <tr
                          key={idx}
                          className={`hover:bg-muted/10 transition-colors ${
                            !row.isValid ? 'bg-rose-500/5 dark:bg-rose-950/5' : ''
                          }`}
                        >
                          <td className="px-4 py-2.5 text-center text-[10px] font-mono text-muted-foreground border-r border-border/40 bg-muted/10">
                            {row.index + 2} {/* row index + 2 to match Excel Row number (1-based + 1 header) */}
                          </td>
                          <td className="px-4 py-2.5 font-mono text-muted-foreground truncate max-w-[150px]" title={row.original}>
                            {row.original || <span className="text-muted-foreground/30 italic">{locale === 'ar' ? 'خلية فارغة' : 'Empty cell'}</span>}
                          </td>
                          <td className="px-4 py-2.5 font-bold font-mono text-indigo-600 dark:text-indigo-400">
                            {row.formatted || '-'}
                          </td>
                          <td className="px-4 py-2.5 text-center shrink-0">
                            {row.isValid ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 border border-emerald-200/50">
                                <CheckCircle className="size-3 shrink-0 text-emerald-500" />
                                <span>{locale === 'ar' ? 'صالح' : 'Valid'}</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400 border border-rose-200/50">
                                <XCircle className="size-3 shrink-0 text-rose-500" />
                                <span>{locale === 'ar' ? 'غير صالح' : 'Invalid'}</span>
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  
                  {formattedRows.length > 10 && (
                    <div className="py-2.5 border-t border-border/40 text-center bg-muted/5">
                      <span className="text-[10px] text-muted-foreground font-semibold">
                        {locale === 'ar'
                          ? `... تم إظهار أول 10 صفوف فقط من أصل ${formattedRows.length} صف ...`
                          : `... Showing first 10 rows of ${formattedRows.length} total rows ...`}
                      </span>
                    </div>
                  )}
                </div>

                {/* Big Actions Area */}
                <div className="p-5 border-t border-border flex flex-col sm:flex-row justify-between items-center gap-4 bg-muted/10 shrink-0">
                  <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    <Sparkles className="size-4 text-indigo-500" />
                    <span>
                      {locale === 'ar'
                        ? `سيتم تصدير عدد ${removeInvalid ? validCount : (validCount + invalidCount)} رقم بعد المعالجة.`
                        : `Will export ${removeInvalid ? validCount : (validCount + invalidCount)} records after processing.`}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2.5 self-stretch sm:self-auto justify-end">
                    {/* Reset Button */}
                    <Button
                      variant="outline"
                      size="sm"
                      className="cursor-pointer font-semibold py-4"
                      onClick={resetConverter}
                    >
                      <RefreshCw className="mr-1.5 size-3.5" />
                      <span>{locale === 'ar' ? 'إعادة تعيين' : 'Reset'}</span>
                    </Button>
                    
                    {/* Download CSV Button */}
                    <Button
                      variant="outline"
                      size="sm"
                      className="cursor-pointer font-semibold py-4"
                      onClick={handleDownload}
                    >
                      <Download className="mr-1.5 size-3.5" />
                      <span>{locale === 'ar' ? 'تحميل ملف CSV' : 'Download CSV'}</span>
                    </Button>

                    {/* Direct campaign launcher button */}
                    {onUseInCampaign && (
                      <Button
                        variant="default"
                        size="sm"
                        className="cursor-pointer font-semibold py-4 bg-indigo-600 hover:bg-indigo-700 text-white"
                        onClick={handleUseInCampaign}
                        disabled={removeInvalid && validCount === 0}
                      >
                        <Megaphone className="mr-1.5 size-3.5 fill-white" />
                        <span>{locale === 'ar' ? 'استخدام في حملة جديدة' : 'Use in Campaign'}</span>
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
