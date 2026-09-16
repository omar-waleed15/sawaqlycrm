'use client';

import { useState } from 'react';
import { User, Task } from '@/types';
import { useLanguage } from '@/lib/i18n';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Phone,
  Mail,
  Calendar,
  Shield,
  MapPin,
  IdCard,
  HeartPulse,
  FileText,
  MessageCircle,
  Edit2,
  Check,
  Save,
  CheckCircle2,
  Clock,
  Star,
  Users,
  Briefcase
} from 'lucide-react';
import { usersApi } from '@/lib/api';

interface ProfileOverviewTabProps {
  member: User;
  onMemberUpdated?: (updated: User) => void;
  canEdit: boolean;
  tasks: Task[];
  clients?: Array<{ id: string; name: string; company?: string }>;
}

export default function ProfileOverviewTab({
  member,
  onMemberUpdated,
  canEdit,
  tasks,
  clients = [],
}: ProfileOverviewTabProps) {
  const { t, locale } = useLanguage();

  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Form states
  const [phone, setPhone] = useState(member.phone || '');
  const [emergencyName, setEmergencyName] = useState(member.emergency_contact_name || '');
  const [emergencyPhone, setEmergencyPhone] = useState(member.emergency_contact_phone || '');
  const [nationalId, setNationalId] = useState(member.national_id || '');
  const [address, setAddress] = useState(member.address || '');
  const [bio, setBio] = useState(member.bio || '');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMessage('');
    try {
      const payload = {
        phone: phone.trim() || null,
        emergency_contact_name: emergencyName.trim() || null,
        emergency_contact_phone: emergencyPhone.trim() || null,
        national_id: nationalId.trim() || null,
        address: address.trim() || null,
        bio: bio.trim() || null,
      };

      const res = await usersApi.update(member.id, payload);
      if (res?.user && onMemberUpdated) {
        onMemberUpdated(res.user);
      }
      setSuccessMessage(t('profile.profileSaved') || 'Profile saved successfully');
      setIsEditing(false);
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err: any) {
      console.error('Failed to update profile:', err);
    } finally {
      setSaving(false);
    }
  };

  // Performance calculations from member tasks
  const completedTasks = tasks.filter(t => {
    const a = t.task_assignees?.find(assignee => assignee.user_id === member.id);
    return a ? a.status === 'completed' : t.status === 'completed';
  });

  const activeTasks = tasks.filter(t => {
    const a = t.task_assignees?.find(assignee => assignee.user_id === member.id);
    const s = a ? a.status : t.status;
    return s !== 'completed';
  });

  const completionRate = tasks.length > 0
    ? Math.round((completedTasks.length / tasks.length) * 100)
    : null;

  // Rating average
  const ratedAssignments = tasks
    .map(t => t.task_assignees?.find(a => a.user_id === member.id))
    .filter((a): a is NonNullable<typeof a> => !!a && typeof a.rating === 'number' && a.rating > 0);

  const averageRating = ratedAssignments.length > 0
    ? (ratedAssignments.reduce((sum, a) => sum + (a.rating || 0), 0) / ratedAssignments.length).toFixed(1)
    : null;

  // Clean WhatsApp number
  const cleanPhone = member.phone ? member.phone.replace(/[^0-9+]/g, '') : '';
  const waLink = cleanPhone ? `https://wa.me/${cleanPhone.replace('+', '')}` : null;

  return (
    <div className="space-y-6">
      {successMessage && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 rounded-xl text-xs font-semibold flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
          {successMessage}
        </div>
      )}

      {/* Top Quick Actions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-card border border-border/80 rounded-2xl p-4 shadow-xs">
        <div className="flex items-center gap-2 flex-wrap">
          {waLink && (
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors"
            >
              <MessageCircle className="size-3.5" />
              {t('profile.openWhatsApp')}
            </a>
          )}
          {member.phone && (
            <a
              href={`tel:${member.phone}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-xs font-semibold shadow-xs transition-colors"
            >
              <Phone className="size-3.5" />
              {t('profile.callMember')}
            </a>
          )}
          {member.email && (
            <a
              href={`mailto:${member.email}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border hover:bg-muted text-foreground text-xs font-semibold transition-colors"
            >
              <Mail className="size-3.5 text-muted-foreground" />
              {member.email}
            </a>
          )}
        </div>

        {canEdit && (
          <Button
            variant={isEditing ? 'outline' : 'default'}
            size="sm"
            onClick={() => setIsEditing(!isEditing)}
            className="h-8 text-xs gap-1.5"
          >
            <Edit2 className="size-3.5" />
            {isEditing ? t('common.cancel') : t('common.edit')}
          </Button>
        )}
      </div>

      {/* Performance Summary Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="border-border/80 shadow-xs hover:shadow-sm transition-all">
          <CardContent className="p-4 flex flex-col justify-between">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              {t('profile.activeTasks')}
            </span>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-2xl font-black text-foreground">{activeTasks.length}</span>
              <Clock className="size-4 text-amber-500 ml-auto" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80 shadow-xs hover:shadow-sm transition-all">
          <CardContent className="p-4 flex flex-col justify-between">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              {t('team.completedTasks')}
            </span>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-2xl font-black text-emerald-600">{completedTasks.length}</span>
              <CheckCircle2 className="size-4 text-emerald-500 ml-auto" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80 shadow-xs hover:shadow-sm transition-all">
          <CardContent className="p-4 flex flex-col justify-between">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              {t('profile.completionRate')}
            </span>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-2xl font-black text-[#1D61E7]">
                {completionRate !== null ? `${completionRate}%` : '—'}
              </span>
              <div className="size-4 rounded-full border-2 border-[#1D61E7] flex items-center justify-center text-[9px] font-bold text-[#1D61E7] ml-auto">
                %
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80 shadow-xs hover:shadow-sm transition-all">
          <CardContent className="p-4 flex flex-col justify-between">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              {t('profile.averageRating')}
            </span>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-2xl font-black text-amber-500">{averageRating ? `${averageRating}/5` : '—'}</span>
              <Star className="size-4 text-amber-500 fill-amber-500 ml-auto" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Editing Mode Form */}
      {isEditing ? (
        <Card className="border-border/80 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Edit2 className="size-4 text-primary" />
              {t('profile.editInfo') || 'Edit Profile Information'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">{t('team.phone')}</Label>
                  <Input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="+20 100 000 0000"
                    className="h-9 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">{t('profile.nationalId')}</Label>
                  <Input
                    type="text"
                    value={nationalId}
                    onChange={e => setNationalId(e.target.value)}
                    placeholder="e.g. 29901010000000"
                    className="h-9 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">{t('profile.emergencyContact')}</Label>
                  <Input
                    type="text"
                    value={emergencyName}
                    onChange={e => setEmergencyName(e.target.value)}
                    placeholder="Full name & relation (e.g. Father, Spouse)"
                    className="h-9 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">{t('profile.emergencyPhone')}</Label>
                  <Input
                    type="tel"
                    value={emergencyPhone}
                    onChange={e => setEmergencyPhone(e.target.value)}
                    placeholder="+20 100 000 0000"
                    className="h-9 text-xs"
                  />
                </div>

                <div className="sm:col-span-2 space-y-1.5">
                  <Label className="text-xs font-semibold">{t('profile.address')}</Label>
                  <Input
                    type="text"
                    value={address}
                    onChange={e => setAddress(e.target.value)}
                    placeholder="City, District, Street..."
                    className="h-9 text-xs"
                  />
                </div>

                <div className="sm:col-span-2 space-y-1.5">
                  <Label className="text-xs font-semibold">{t('profile.bio')}</Label>
                  <Textarea
                    rows={3}
                    value={bio}
                    onChange={e => setBio(e.target.value)}
                    placeholder="Professional bio, special skills, personal notes..."
                    className="text-xs resize-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(false)}
                  className="h-9 text-xs"
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  type="submit"
                  disabled={saving}
                  size="sm"
                  className="h-9 text-xs bg-[#1D61E7] hover:bg-[#1553c7] text-white gap-1.5"
                >
                  <Save className="size-3.5" />
                  {saving ? t('common.loading') : t('common.saveChanges')}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : (
        /* Details Display Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card 1: Official & Contact Details */}
          <Card className="border-border/80 shadow-xs">
            <CardHeader className="pb-3 border-b border-border/50">
              <CardTitle className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Shield className="size-4 text-primary" />
                {t('profile.contactInfo')}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3.5 text-xs">
              <div className="flex items-center justify-between py-1 border-b border-border/40">
                <span className="text-muted-foreground font-medium flex items-center gap-2">
                  <Mail className="size-3.5 text-muted-foreground" />
                  {t('team.email')}
                </span>
                <span className="font-semibold text-foreground">{member.email}</span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-border/40">
                <span className="text-muted-foreground font-medium flex items-center gap-2">
                  <Phone className="size-3.5 text-muted-foreground" />
                  {t('team.phone')}
                </span>
                <span className="font-semibold text-foreground font-sans">
                  {member.phone || <span className="text-muted-foreground italic">—</span>}
                </span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-border/40">
                <span className="text-muted-foreground font-medium flex items-center gap-2">
                  <IdCard className="size-3.5 text-muted-foreground" />
                  {t('profile.nationalId')}
                </span>
                <span className="font-semibold text-foreground font-mono">
                  {member.national_id || <span className="text-muted-foreground italic">—</span>}
                </span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-border/40">
                <span className="text-muted-foreground font-medium flex items-center gap-2">
                  <Calendar className="size-3.5 text-muted-foreground" />
                  {t('profile.joinedDate')}
                </span>
                <span className="font-semibold text-foreground">
                  {member.created_at
                    ? new Date(member.created_at).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })
                    : '—'}
                </span>
              </div>

              <div className="flex items-start justify-between py-1">
                <span className="text-muted-foreground font-medium flex items-center gap-2 shrink-0">
                  <MapPin className="size-3.5 text-muted-foreground" />
                  {t('profile.address')}
                </span>
                <span className="font-semibold text-foreground text-end max-w-[200px]">
                  {member.address || <span className="text-muted-foreground italic">—</span>}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Emergency Contact & Bio */}
          <div className="space-y-6">
            <Card className="border-border/80 shadow-xs">
              <CardHeader className="pb-3 border-b border-border/50">
                <CardTitle className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <HeartPulse className="size-4 text-rose-500" />
                  {t('profile.emergencyContact')}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3.5 text-xs">
                <div className="flex items-center justify-between py-1 border-b border-border/40">
                  <span className="text-muted-foreground font-medium">{t('team.name')}</span>
                  <span className="font-bold text-foreground">
                    {member.emergency_contact_name || <span className="text-muted-foreground italic font-normal">—</span>}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-muted-foreground font-medium">{t('profile.emergencyPhone')}</span>
                  <span className="font-bold text-foreground font-sans">
                    {member.emergency_contact_phone ? (
                      <a href={`tel:${member.emergency_contact_phone}`} className="hover:text-primary transition-colors">
                        {member.emergency_contact_phone}
                      </a>
                    ) : (
                      <span className="text-muted-foreground italic font-normal">—</span>
                    )}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Bio Card */}
            <Card className="border-border/80 shadow-xs">
              <CardHeader className="pb-3 border-b border-border/50">
                <CardTitle className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <FileText className="size-4 text-amber-500" />
                  {t('profile.bio')}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 text-xs">
                {member.bio ? (
                  <p className="text-foreground leading-relaxed whitespace-pre-line">{member.bio}</p>
                ) : (
                  <p className="text-muted-foreground italic">{t('common.noData') || 'No bio information added yet.'}</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Card 3: Assigned Clients / Accounts */}
      {clients.length > 0 && (
        <Card className="border-border/80 shadow-xs">
          <CardHeader className="pb-3 border-b border-border/50">
            <CardTitle className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Briefcase className="size-4 text-indigo-500" />
              {t('profile.assignedClients')} ({clients.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {clients.map(c => (
                <div
                  key={c.id}
                  className="p-3 rounded-xl border border-border/70 bg-muted/20 hover:bg-muted/40 transition-colors flex items-center gap-3 text-xs"
                >
                  <div className="size-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 flex items-center justify-center font-bold shrink-0">
                    {c.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-foreground truncate">{c.name}</div>
                    {c.company && (
                      <div className="text-[11px] text-muted-foreground truncate">{c.company}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
