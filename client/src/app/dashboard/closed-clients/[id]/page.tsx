'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { closedClientsApi } from '@/lib/api';
import { Client, ClientFAQ, ClientContentPlan, ClientIdea, ClientReport } from '@/types';
import { useLanguage } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import ClosedClientFAQ from '@/components/closed-client/ClosedClientFAQ';
import ClosedClientContentPlan from '@/components/closed-client/ClosedClientContentPlan';
import ClosedClientIdeas from '@/components/closed-client/ClosedClientIdeas';
import ClosedClientCalendar from '@/components/closed-client/ClosedClientCalendar';
import ClosedClientReport from '@/components/closed-client/ClosedClientReport';
import ClosedClientAccount from '@/components/closed-client/ClosedClientAccount';
import ClosedClientTasks from '@/components/closed-client/ClosedClientTasks';
import {
  ArrowLeft,
  Loader2,
  HelpCircle,
  FileText,
  Lightbulb,
  Calendar,
  BarChart3,
  UserCog,
  ListTodo,
} from 'lucide-react';

type SubTab = 'faq' | 'tasks' | 'contentPlan' | 'ideas' | 'calendar' | 'report' | 'account';

const SUB_TABS: { key: SubTab; labelKey: string; icon: React.ElementType }[] = [
  { key: 'faq', labelKey: 'closedClients.tab.faq', icon: HelpCircle },
  { key: 'tasks', labelKey: 'closedClients.tab.tasks', icon: ListTodo },
  { key: 'contentPlan', labelKey: 'closedClients.tab.contentPlan', icon: FileText },
  { key: 'ideas', labelKey: 'closedClients.tab.ideas', icon: Lightbulb },
  { key: 'calendar', labelKey: 'closedClients.tab.calendar', icon: Calendar },
  { key: 'report', labelKey: 'closedClients.tab.report', icon: BarChart3 },
  { key: 'account', labelKey: 'closedClients.tab.account', icon: UserCog },
];

export default function ClosedClientDetailPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const clientId = params.id as string;
  const { t } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [client, setClient] = useState<Client | null>(null);
  const [activeTab, setActiveTab] = useState<SubTab>('faq');

  // Sub-feature data
  const [faqList, setFaqList] = useState<ClientFAQ[]>([]);
  const [plans, setPlans] = useState<ClientContentPlan[]>([]);
  const [ideas, setIdeas] = useState<ClientIdea[]>([]);
  const [reports, setReports] = useState<ClientReport[]>([]);

  // Navigation Guard
  useEffect(() => {
    if (user && !['owner', 'team_leader', 'account_manager'].includes(user.role)) {
      router.replace('/dashboard');
    }
  }, [user, router]);

  // Load client and all sub-data
  const loadAll = useCallback(async () => {
    if (!clientId) return;
    try {
      setLoading(true);
      const [clientRes, faqRes, plansRes, ideasRes, reportsRes] = await Promise.all([
        closedClientsApi.get(clientId).catch(() => ({ client: null })),
        closedClientsApi.listFaq(clientId).catch(() => ({ faq: [] })),
        closedClientsApi.listPlans(clientId).catch(() => ({ plans: [] })),
        closedClientsApi.listIdeas(clientId).catch(() => ({ ideas: [] })),
        closedClientsApi.listReports(clientId).catch(() => ({ reports: [] })),
      ]);
      setClient((clientRes as any).client || null);
      setFaqList((faqRes as any).faq || []);
      setPlans((plansRes as any).plans || []);
      setIdeas((ideasRes as any).ideas || []);
      setReports((reportsRes as any).reports || []);
    } catch (err) {
      console.error('Failed to load client data', err);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    if (user && ['owner', 'team_leader', 'account_manager'].includes(user.role)) {
      loadAll();
    }
  }, [user, loadAll]);

  // Refresh helpers (only refresh the specific sub-data)
  const refreshFaq = async () => {
    try {
      const res = await closedClientsApi.listFaq(clientId);
      setFaqList(res.faq || []);
    } catch { /* silent */ }
  };
  const refreshPlans = async () => {
    try {
      const res = await closedClientsApi.listPlans(clientId);
      setPlans(res.plans || []);
    } catch { /* silent */ }
  };
  const refreshIdeas = async () => {
    try {
      const res = await closedClientsApi.listIdeas(clientId);
      setIdeas(res.ideas || []);
    } catch { /* silent */ }
  };
  const refreshReports = async () => {
    try {
      const res = await closedClientsApi.listReports(clientId);
      setReports(res.reports || []);
    } catch { /* silent */ }
  };

  if (!user || !['owner', 'team_leader', 'account_manager'].includes(user.role)) return null;

  return (
    <div className="page-container fade-in">
      {/* Back Button */}
      <Button
        variant="ghost"
        size="sm"
        className="mb-4 -ml-2 text-muted-foreground hover:text-foreground"
        onClick={() => router.push('/dashboard/closed-clients')}
      >
        <ArrowLeft className="size-4 mr-1.5 rtl:ml-1.5 rtl:mr-0 rtl:rotate-180" />
        {t('closedClients.backToList')}
      </Button>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      ) : !client ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          Client not found
        </div>
      ) : (
        <>
          {/* Page Header */}
          <div className="page-header mb-0">
            <div className="page-header-left">
              <h1 className="page-header-title">{client.name}</h1>
              {client.company && (
                <p className="page-header-subtitle">{client.company}</p>
              )}
            </div>
          </div>

          {/* Sub-tabs */}
          <div className="flex border-b border-border mb-6 gap-4 sm:gap-6 overflow-x-auto">
            {SUB_TABS.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-1.5 pb-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                    isActive
                      ? 'border-[#1D61E7] text-[#1D61E7] dark:border-[#1D61E7] dark:text-[#1D61E7]'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Icon className="size-4" />
                  {t(tab.labelKey)}
                </button>
              );
            })}
          </div>

          {/* Sub-tab Content */}
          {activeTab === 'faq' && (
            <ClosedClientFAQ client={client} faqList={faqList} onRefresh={refreshFaq} />
          )}
          {activeTab === 'tasks' && (
            <ClosedClientTasks clientId={clientId} client={client} />
          )}
          {activeTab === 'contentPlan' && (
            <ClosedClientContentPlan clientId={clientId} plans={plans} onRefresh={refreshPlans} />
          )}
          {activeTab === 'ideas' && (
            <ClosedClientIdeas clientId={clientId} ideas={ideas} onRefresh={refreshIdeas} />
          )}
          {activeTab === 'calendar' && (
            <ClosedClientCalendar clientId={clientId} plans={plans} client={client} />
          )}
          {activeTab === 'report' && (
            <ClosedClientReport clientId={clientId} reports={reports} onRefresh={refreshReports} />
          )}
          {activeTab === 'account' && (
            <ClosedClientAccount client={client} onClientUpdated={loadAll} />
          )}
        </>
      )}
    </div>
  );
}
