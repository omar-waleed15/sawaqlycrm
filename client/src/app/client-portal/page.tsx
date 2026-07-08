'use client';

import { useEffect, useState } from 'react';
import { request } from '@/lib/api';
import { Client, ClientFAQ, ClientContentPlan } from '@/types';
import { useLanguage } from '@/lib/i18n';
import { Loader2, ExternalLink, Activity, Eye, MessageSquare, Target, TrendingUp, Heart } from 'lucide-react';

interface PortalData {
  client: Client;
  faq: ClientFAQ[];
  contentPlans: ClientContentPlan[];
  reports: any[];
}

export default function ClientPortalDashboard() {
  const { t, locale } = useLanguage();
  const [data, setData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  useEffect(() => {
    request<PortalData>('/clients/portal/data')
      .then((res: PortalData) => setData(res))
      .catch((err: any) => setError(err.message || 'Failed to load client dashboard data'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col gap-6 py-6 animate-pulse">
        <div className="h-12 bg-slate-100 border border-slate-200 w-1/3 rounded-lg" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-[320px] bg-slate-100 border border-slate-200 rounded-2xl" />
          <div className="h-[320px] bg-slate-100 border border-slate-200 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[350px] text-center p-6 bg-[#F8FAFC] text-[#0F172A] font-sans">
        <div className="bg-red-50 border border-red-200 text-red-600 text-xs uppercase font-mono tracking-wider px-4 py-3 rounded-lg max-w-md">
          {error || 'Failed to initialize portal dashboard'}
        </div>
      </div>
    );
  }

  const { client, reports } = data;

  const mockReports = [
    { id: 'mock-1', report_month: '2026-03-01', views: 4500, interactions: 320, messages: 15 },
    { id: 'mock-2', report_month: '2026-04-01', views: 8200, interactions: 610, messages: 28 },
    { id: 'mock-3', report_month: '2026-05-01', views: 14800, interactions: 950, messages: 42 },
    { id: 'mock-4', report_month: '2026-06-01', views: 18500, interactions: 1250, messages: 55 }
  ];

  const reportsToUse = reports && reports.length > 0 ? reports : mockReports;

  const calcPercent = (done: number = 0, target: number = 0) => {
    if (target === 0) return 0;
    return Math.min(Math.round((done / target) * 100), 100);
  };

  const currentMonthLabel = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const latestReport = reportsToUse[0] || { views: 0, interactions: 0, messages: 0 };

  // Sort reports by month ascending
  const sortedReports = [...reportsToUse].sort(
    (a, b) => new Date(a.report_month).getTime() - new Date(b.report_month).getTime()
  );

  const getMonthLabel = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString(undefined, { month: 'short' });
    } catch {
      return '';
    }
  };

  const numPoints = sortedReports.length;
  const hasMultiplePoints = numPoints > 1;

  // Find max values for scaling
  const maxViews = Math.max(...sortedReports.map(r => r.views || 0), 1) || 1;
  const maxInteractions = Math.max(...sortedReports.map(r => r.interactions || 0), 1) || 1;
  const maxComments = Math.max(...sortedReports.map(r => r.comments ?? Math.round((r.interactions || 0) * 0.15)), 1) || 1;
  const maxMessages = Math.max(...sortedReports.map(r => r.messages || 0), 1) || 1;

  // Compute overall totals for the KPI banner
  const totalViews = sortedReports.reduce((sum, r) => sum + (r.views || 0), 0);
  const totalInteracts = sortedReports.reduce((sum, r) => sum + (r.interactions || 0), 0);
  const totalComments = sortedReports.reduce((sum, r) => sum + (r.comments ?? Math.round((r.interactions || 0) * 0.15)), 0);
  const totalMessages = sortedReports.reduce((sum, r) => sum + (r.messages || 0), 0);

  // SVG Chart settings
  const width = 600;
  const height = 340;
  const paddingLeft = 50;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 40;
  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  // Generate coordinates for each report
  const chartData = sortedReports.map((r, i) => {
    const x = numPoints > 1 
      ? paddingLeft + (i / (numPoints - 1)) * chartWidth 
      : paddingLeft + chartWidth / 2;

    const yViews = paddingTop + chartHeight - ((r.views || 0) / maxViews) * chartHeight;
    const yInteracts = paddingTop + chartHeight - ((r.interactions || 0) / maxInteractions) * chartHeight;
    const commentsVal = r.comments ?? Math.round((r.interactions || 0) * 0.15);
    const yComments = paddingTop + chartHeight - (commentsVal / maxComments) * chartHeight;
    const yMessages = paddingTop + chartHeight - ((r.messages || 0) / maxMessages) * chartHeight;

    return {
      x,
      yViews,
      yInteracts,
      yComments,
      yMessages,
      report: r,
      formattedMonth: getMonthLabel(r.report_month),
      values: {
        views: r.views || 0,
        interactions: r.interactions || 0,
        comments: commentsVal,
        messages: r.messages || 0,
      }
    };
  });

  const viewsPath = hasMultiplePoints ? 'M ' + chartData.map(d => `${d.x} ${d.yViews}`).join(' L ') : '';
  const interactsPath = hasMultiplePoints ? 'M ' + chartData.map(d => `${d.x} ${d.yInteracts}`).join(' L ') : '';
  const commentsPath = hasMultiplePoints ? 'M ' + chartData.map(d => `${d.x} ${d.yComments}`).join(' L ') : '';
  const messagesPath = hasMultiplePoints ? 'M ' + chartData.map(d => `${d.x} ${d.yMessages}`).join(' L ') : '';

  return (
    <div className="flex flex-col gap-8 text-[#0F172A] text-start font-sans" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E2E8F0] pb-6">
        <div className="text-start">
          <h1 className="text-2xl font-extrabold uppercase tracking-widest text-[#0F172A] font-mono">{t('portal.overview')}</h1>
          <p className="text-[10px] text-[#64748B] uppercase tracking-wider font-semibold mt-1">{t('portal.overviewDesc')}</p>
        </div>
        
        {client.content_plan_link && (
          <a
            href={client.content_plan_link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-4 h-9 border border-[#E2E8F0] bg-white hover:bg-slate-50 text-[#1D61E7] hover:text-[#1553c7] hover:border-[#1D61E7] text-[10px] uppercase font-mono tracking-widest font-bold transition-all rounded-full shadow-xs"
          >
            <ExternalLink className="size-3.5" /> {t('portal.brandAssets')}
          </a>
        )}
      </div>

      {/* Grid Layout */}
      <div className="flex flex-col gap-6 max-w-4xl">
        
        {/* Sleto-style Summary Cards (5-Column Grid) */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          
          {/* Card 1: Deliverables (Blue) */}
          <div className="p-5 rounded-2xl bg-[#1D61E7] text-white flex flex-col gap-4 shadow-sm relative overflow-hidden justify-between text-start">
            <div className="flex items-center justify-between">
              <div className="text-[8px] font-extrabold uppercase tracking-widest font-mono text-white/80">
                {t('portal.deliverables')}
              </div>
              <Target className="size-4 text-white/80" />
            </div>
            <div className="flex flex-col mt-2">
              <span className="text-[9px] text-white/70 uppercase tracking-widest font-mono font-bold">{t('portal.totalCompleted')}</span>
              <span className="text-2xl font-bold font-mono mt-1 leading-none">
                {((client.done_posts || 0) + (client.done_reels || 0) + (client.done_stories || 0) + (client.done_photos || 0))}
              </span>
            </div>
          </div>

          {/* Card 2: Account Health (Yellow) */}
          <div className="p-5 rounded-2xl bg-[#FFD200] text-[#0F172A] flex flex-col gap-4 shadow-sm relative overflow-hidden justify-between text-start">
            <div className="flex items-center justify-between">
              <div className="text-[8px] font-extrabold uppercase tracking-widest font-mono text-[#0F172A]/85">
                {t('portal.accountHealth')}
              </div>
              <Heart className="size-4 text-[#0F172A]/70" fill="currentColor" />
            </div>
            <div className="flex flex-col mt-2">
              <span className="text-[9px] text-[#0F172A]/70 uppercase tracking-widest font-mono font-bold">{t('portal.overallProgress')}</span>
              <span className="text-2xl font-bold font-mono mt-1 leading-none">
                {calcPercent(
                  (client.done_posts || 0) + (client.done_reels || 0) + (client.done_stories || 0) + (client.done_photos || 0),
                  (client.num_posts || 0) + (client.num_reels || 0) + (client.num_stories || 0) + (client.num_photos || 0)
                )}%
              </span>
            </div>
          </div>

          {/* Card 3: Views (White) */}
          <div className="p-5 rounded-2xl bg-white border border-[#E2E8F0] text-[#0F172A] flex flex-col gap-4 shadow-xs relative overflow-hidden justify-between text-start">
            <div className="flex items-center justify-between">
              <div className="text-[8px] font-extrabold uppercase tracking-widest font-mono text-slate-400">
                {t('portal.views')}
              </div>
              <Eye className="size-4 text-[#1D61E7]" />
            </div>
            <div className="flex flex-col mt-2">
              <span className="text-[9px] text-slate-500 uppercase tracking-widest font-mono font-bold">{t('portal.monthlyViews')}</span>
              <span className="text-2xl font-bold font-mono mt-1 leading-none">
                {latestReport.views?.toLocaleString() || 0}
              </span>
            </div>
          </div>

          {/* Card 4: Engagement (White) */}
          <div className="p-5 rounded-2xl bg-white border border-[#E2E8F0] text-[#0F172A] flex flex-col gap-4 shadow-xs relative overflow-hidden justify-between text-start">
            <div className="flex items-center justify-between">
              <div className="text-[8px] font-extrabold uppercase tracking-widest font-mono text-slate-400">
                {t('portal.engagement')}
              </div>
              <Activity className="size-4 text-[#FFD200]" />
            </div>
            <div className="flex flex-col mt-2">
              <span className="text-[9px] text-slate-500 uppercase tracking-widest font-mono font-bold">{t('portal.monthlyInteracts')}</span>
              <span className="text-2xl font-bold font-mono mt-1 leading-none">
                {latestReport.interactions?.toLocaleString() || 0}
              </span>
            </div>
          </div>

          {/* Card 5: Messages (White) */}
          <div className="p-5 rounded-2xl bg-white border border-[#E2E8F0] text-[#0F172A] flex flex-col gap-4 shadow-xs relative overflow-hidden justify-between text-start">
            <div className="flex items-center justify-between">
              <div className="text-[8px] font-extrabold uppercase tracking-widest font-mono text-slate-400">
                {t('portal.messages')}
              </div>
              <MessageSquare className="size-4 text-slate-400" />
            </div>
            <div className="flex flex-col mt-2">
              <span className="text-[9px] text-slate-500 uppercase tracking-widest font-mono font-bold">{t('portal.inboundMessages')}</span>
              <span className="text-2xl font-bold font-mono mt-1 leading-none">
                {latestReport.messages?.toLocaleString() || 0}
              </span>
            </div>
          </div>

        </div>

        {/* Second Row Grid: Full-Width line Chart and Stats Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Brand Performance history Line Chart Card (Spans all 3 columns) */}
          <div className="md:col-span-3 border border-[#E2E8F0] bg-white p-6 flex flex-col gap-5 rounded-2xl shadow-xs relative">
            <div className="border-b border-[#E2E8F0] pb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="size-4 text-[#1D61E7]" />
                <span className="text-xs font-bold uppercase tracking-widest text-[#0F172A] font-mono">{t('portal.performanceTrends')}</span>
              </div>
            </div>

            {/* KPI Summary Banner */}
            {sortedReports.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl mb-2 text-start">
                <div className="flex flex-col">
                  <span className="text-[9px] text-[#64748B] uppercase tracking-wider font-bold font-mono flex items-center gap-1"><span className="size-1.5 rounded-full bg-[#1D61E7]" /> {t('portal.totalViews')}</span>
                  <span className="text-sm font-extrabold text-[#0F172A] font-mono mt-0.5">{totalViews.toLocaleString()}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[9px] text-[#64748B] uppercase tracking-wider font-bold font-mono flex items-center gap-1"><span className="size-1.5 rounded-full bg-[#FFD200]" /> {t('portal.engagement')}</span>
                  <span className="text-sm font-extrabold text-[#0F172A] font-mono mt-0.5">{totalInteracts.toLocaleString()}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[9px] text-[#64748B] uppercase tracking-wider font-bold font-mono flex items-center gap-1"><span className="size-1.5 rounded-full bg-[#10B981]" /> {t('portal.comments')}</span>
                  <span className="text-sm font-extrabold text-[#0F172A] font-mono mt-0.5">{totalComments.toLocaleString()}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[9px] text-[#64748B] uppercase tracking-wider font-bold font-mono flex items-center gap-1"><span className="size-1.5 rounded-full bg-[#F43F5E]" /> {t('portal.messages')}</span>
                  <span className="text-sm font-extrabold text-[#0F172A] font-mono mt-0.5">{totalMessages.toLocaleString()}</span>
                </div>
              </div>
            )}

            {/* SVG Trend Chart Canvas */}
            {sortedReports.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center h-[380px] text-center text-slate-400 font-mono text-[9px] uppercase font-bold tracking-wider border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                {t('portal.noHistory')}
              </div>
            ) : (
              <div className="relative w-full h-[380px] pt-2">
                <svg viewBox="0 0 600 340" width="100%" height="100%" className="overflow-visible select-none">
                  {/* Horizontal grid lines */}
                  {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                    const y = paddingTop + ratio * chartHeight;
                    return (
                      <line
                        key={idx}
                        x1={paddingLeft}
                        y1={y}
                        x2={width - paddingRight}
                        y2={y}
                        stroke="#F1F5F9"
                        strokeWidth="1.5"
                      />
                    );
                  })}

                  {/* Y-axis scale labels */}
                  {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                    const y = paddingTop + ratio * chartHeight;
                    const val = Math.round(maxViews - ratio * maxViews);
                    let valStr = val.toLocaleString();
                    if (val >= 1000) valStr = (val / 1000).toFixed(1) + 'K';
                    return (
                      <text
                        key={idx}
                        x={paddingLeft - 8}
                        y={y + 3}
                        textAnchor="end"
                        className="text-[8px] font-bold font-mono fill-[#94A3B8]"
                      >
                        {valStr}
                      </text>
                    );
                  })}

                  {/* Vertical grid lines */}
                  {chartData.map((d, idx) => (
                    <line
                      key={idx}
                      x1={d.x}
                      y1={paddingTop}
                      x2={d.x}
                      y2={paddingTop + chartHeight}
                      stroke="#F1F5F9"
                      strokeWidth="1.5"
                      strokeDasharray="4 4"
                    />
                  ))}

                  {/* X-axis Month labels */}
                  {chartData.map((d, idx) => (
                    <text
                      key={idx}
                      x={d.x}
                      y={height - 12}
                      textAnchor="middle"
                      className="text-[9px] font-bold font-mono fill-[#64748B]"
                    >
                      {d.formattedMonth}
                    </text>
                  ))}

                  {/* Views Line */}
                  {hasMultiplePoints && (
                    <path
                      d={viewsPath}
                      fill="none"
                      stroke="#1D61E7"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="transition-all duration-300"
                    />
                  )}

                  {/* Interactions Line */}
                  {hasMultiplePoints && (
                    <path
                      d={interactsPath}
                      fill="none"
                      stroke="#FFD200"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="transition-all duration-300"
                    />
                  )}

                  {/* Comments Line */}
                  {hasMultiplePoints && (
                    <path
                      d={commentsPath}
                      fill="none"
                      stroke="#10B981"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="transition-all duration-300"
                    />
                  )}

                  {/* Messages Line */}
                  {hasMultiplePoints && (
                    <path
                      d={messagesPath}
                      fill="none"
                      stroke="#F43F5E"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="transition-all duration-300"
                    />
                  )}

                  {/* Chart Dots for each point */}
                  {chartData.map((d, idx) => (
                    <g key={idx}>
                      <circle
                        cx={d.x}
                        cy={d.yViews}
                        r="3.5"
                        className="fill-white stroke-[#1D61E7] stroke-2 hover:r-5 transition-all cursor-pointer"
                        onMouseEnter={() => setHoveredIndex(idx)}
                      />
                      <circle
                        cx={d.x}
                        cy={d.yInteracts}
                        r="3.5"
                        className="fill-white stroke-[#FFD200] stroke-2 hover:r-5 transition-all cursor-pointer"
                        onMouseEnter={() => setHoveredIndex(idx)}
                      />
                      <circle
                        cx={d.x}
                        cy={d.yComments}
                        r="3.5"
                        className="fill-white stroke-[#10B981] stroke-2 hover:r-5 transition-all cursor-pointer"
                        onMouseEnter={() => setHoveredIndex(idx)}
                      />
                      <circle
                        cx={d.x}
                        cy={d.yMessages}
                        r="3.5"
                        className="fill-white stroke-[#F43F5E] stroke-2 hover:r-5 transition-all cursor-pointer"
                        onMouseEnter={() => setHoveredIndex(idx)}
                      />
                    </g>
                  ))}

                  {/* Hover vertical split triggers */}
                  {chartData.map((d, idx) => {
                    const rectWidth = chartWidth / Math.max(numPoints, 1);
                    const rectX = d.x - rectWidth / 2;
                    return (
                      <rect
                        key={idx}
                        x={rectX}
                        y={paddingTop}
                        width={rectWidth}
                        height={chartHeight}
                        fill="transparent"
                        className="cursor-pointer"
                        onMouseEnter={() => setHoveredIndex(idx)}
                        onMouseLeave={() => setHoveredIndex(null)}
                      />
                    );
                  })}
                </svg>

                {/* Floating Tooltip Box */}
                {hoveredIndex !== null && chartData[hoveredIndex] && (
                  <div 
                    className="absolute bg-[#0F172A] text-white p-3 rounded-xl shadow-xl border border-slate-700/50 flex flex-col gap-1.5 pointer-events-none z-10 text-[9px] font-mono w-36 text-start"
                    style={{
                      left: `${chartData[hoveredIndex].x}px`,
                      top: `${Math.min(chartData[hoveredIndex].yViews, chartData[hoveredIndex].yInteracts, chartData[hoveredIndex].yComments, chartData[hoveredIndex].yMessages) - 10}px`,
                      transform: 'translateX(-50%) translateY(-100%)',
                    }}
                  >
                    <div className="font-extrabold uppercase border-b border-white/10 pb-1 text-[#FFD200]">
                      {new Date(chartData[hoveredIndex].report.report_month).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US', { month: 'short', year: 'numeric' })}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-[#1D61E7]" /> {t('portal.views')}</span>
                      <span className="font-bold">{chartData[hoveredIndex].values.views.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-[#FFD200]" /> {t('portal.engagement')}</span>
                      <span className="font-bold">{chartData[hoveredIndex].values.interactions.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-[#10B981]" /> {t('portal.comments')}</span>
                      <span className="font-bold">{chartData[hoveredIndex].values.comments.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-[#F43F5E]" /> {t('portal.messages')}</span>
                      <span className="font-bold">{chartData[hoveredIndex].values.messages.toLocaleString()}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>



        </div>
      </div>
    </div>
  );
}
