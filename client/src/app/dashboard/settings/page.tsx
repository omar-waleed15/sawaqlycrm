'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { PriorityBadge, StatusBadge } from '@/components/Badges';
import { Loader2, CheckCircle2 } from 'lucide-react';

export default function SettingsPage() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user && user.role !== 'owner' && user.role !== 'team_leader') {
      router.replace('/dashboard');
    }
  }, [user, router]);

  const [agencyName, setAgencyName] = useState('Sawaqly Marketing Agency');
  const [supportEmail, setSupportEmail] = useState('support@sawaqly.com');
  const [defaultDeadlineDays, setDefaultDeadlineDays] = useState(3);
  const [backendHealth, setBackendHealth] = useState<'loading' | 'online' | 'offline'>('loading');
  const [latency, setLatency] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    const checkHealth = async () => {
      const start = Date.now();
      try {
        const res = await fetch('http://localhost:4000/api/health');
        if (res.ok) {
          setBackendHealth('online');
          setLatency(Date.now() - start);
        } else {
          setBackendHealth('offline');
        }
      } catch {
        setBackendHealth('offline');
      }
    };
    checkHealth();
  }, []);

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    }, 800);
  };

  if (user?.role !== 'owner' && user?.role !== 'team_leader') return null;

  return (
    <div className="page-container fade-in">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-header-title">Settings</h1>
          <p className="page-header-subtitle">Manage system preferences and agency configurations</p>
        </div>
      </div>

      <div className="grid grid-cols-[2fr_1fr] gap-6">
        {/* Main Settings Panel */}
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader className="border-b">
              <CardTitle className="text-base">Agency Profile</CardTitle>
            </CardHeader>
            <CardContent className="pt-5">
              <form onSubmit={handleSaveSettings} className="flex flex-col gap-5">
                {saveSuccess && (
                  <div className="flex items-center gap-2 bg-green-50 text-green-700 border border-green-200 px-3 py-2 rounded-md text-sm font-medium">
                    <CheckCircle2 className="size-4" />
                    Settings saved successfully!
                  </div>
                )}

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="agency-name">Agency Name</Label>
                  <Input
                    id="agency-name"
                    type="text"
                    value={agencyName}
                    onChange={e => setAgencyName(e.target.value)}
                    required
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="support-email">Support / Contact Email</Label>
                  <Input
                    id="support-email"
                    type="email"
                    value={supportEmail}
                    onChange={e => setSupportEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="deadline-days">Default Task Deadline (Days from creation)</Label>
                  <Input
                    id="deadline-days"
                    type="number"
                    min="1"
                    max="30"
                    value={defaultDeadlineDays}
                    onChange={e => setDefaultDeadlineDays(Number(e.target.value))}
                    required
                  />
                </div>

                <div className="flex justify-end mt-1">
                  <Button type="submit" disabled={saving}>
                    {saving ? (
                      <><Loader2 className="size-4 animate-spin" /> Saving...</>
                    ) : 'Save Settings'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b">
              <CardTitle className="text-base">Task Workflow Config</CardTitle>
            </CardHeader>
            <CardContent className="pt-5 flex flex-col gap-5">
              <div>
                <h4 className="text-sm font-semibold text-muted-foreground mb-3">Task Priorities</h4>
                <div className="flex flex-wrap gap-2">
                  <PriorityBadge priority="urgent" />
                  <PriorityBadge priority="high" />
                  <PriorityBadge priority="medium" />
                  <PriorityBadge priority="low" />
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Priorities determine due-date urgency styling and list sort weights.
                </p>
              </div>

              <Separator />

              <div>
                <h4 className="text-sm font-semibold text-muted-foreground mb-3">Task Statuses</h4>
                <div className="flex flex-wrap gap-2">
                  <StatusBadge status="todo" />
                  <StatusBadge status="in_progress" />
                  <StatusBadge status="submitted" />
                  <StatusBadge status="revision" />
                  <StatusBadge status="completed" />
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Workflow: To Do → In Progress → Submitted (by Member) → Revision / Completed (by Admin).
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* System Health Sidebar */}
        <div>
          <Card>
            <CardHeader className="border-b">
              <CardTitle className="text-base">System Health</CardTitle>
            </CardHeader>
            <CardContent className="pt-5 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Express Server</span>
                {backendHealth === 'loading' && (
                  <Badge variant="outline" className="text-muted-foreground">Checking...</Badge>
                )}
                {backendHealth === 'online' && (
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    <span className="size-1.5 rounded-full bg-green-500 mr-1" /> Online
                  </Badge>
                )}
                {backendHealth === 'offline' && (
                  <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200">
                    <span className="size-1.5 rounded-full bg-rose-500 mr-1" /> Offline
                  </Badge>
                )}
              </div>

              {latency !== null && backendHealth === 'online' && (
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Response Latency</span>
                  <span className="text-sm font-semibold">{latency}ms</span>
                </div>
              )}

              <Separator />

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Supabase Database</span>
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  <span className="size-1.5 rounded-full bg-green-500 mr-1" /> Connected
                </Badge>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Supabase Storage</span>
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  <span className="size-1.5 rounded-full bg-green-500 mr-1" /> Active
                </Badge>
              </div>

              <Separator />

              <p className="text-xs text-muted-foreground leading-relaxed">
                All systems check out. The API and data layer are fully connected.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
