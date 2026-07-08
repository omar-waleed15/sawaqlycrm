'use client';

import { useState } from 'react';
import { closedClientsApi } from '@/lib/api';
import { ClientFAQ, Client } from '@/types';
import { useLanguage } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import Modal from '@/components/Modal';
import {
  Plus,
  Edit,
  Trash2,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Building2,
  Loader2,
} from 'lucide-react';

interface ClosedClientFAQProps {
  client: Client;
  faqList: ClientFAQ[];
  onRefresh: () => void;
}

export default function ClosedClientFAQ({ client, faqList, onRefresh }: ClosedClientFAQProps) {
  const { t, locale } = useLanguage();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingFaq, setEditingFaq] = useState<ClientFAQ | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ question: '', answer: '' });

  const openCreate = () => {
    setEditingFaq(null);
    setForm({ question: '', answer: '' });
    setModalOpen(true);
  };

  const openEdit = (faq: ClientFAQ) => {
    setEditingFaq(faq);
    setForm({ question: faq.question, answer: faq.answer });
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.question.trim() || !form.answer.trim()) return;
    setSubmitting(true);
    try {
      if (editingFaq) {
        await closedClientsApi.updateFaq(client.id, editingFaq.id, form);
      } else {
        await closedClientsApi.createFaq(client.id, { ...form, sort_order: faqList.length });
      }
      setModalOpen(false);
      onRefresh();
    } catch (err) {
      console.error('Failed to save FAQ', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (faq: ClientFAQ) => {
    if (!confirm(t('closedClients.faq.deleteConfirm'))) return;
    try {
      await closedClientsApi.deleteFaq(client.id, faq.id);
      onRefresh();
    } catch (err) {
      console.error('Failed to delete FAQ', err);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Client Overview Header */}
      <Card className="border border-border bg-card">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-start gap-6">
            {/* Avatar */}
            <div className="size-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-xl font-bold shrink-0">
              {client.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
            </div>

            {/* Info Grid */}
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <h2 className="text-lg font-bold text-foreground">{client.name}</h2>
                {client.company && (
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
                    <Building2 className="size-3.5" /> {client.company}
                  </div>
                )}
              </div>

              {client.phone && (
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Phone className="size-3.5" /> {client.phone}
                </div>
              )}
              {client.email && (
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Mail className="size-3.5" /> {client.email}
                </div>
              )}
              {client.address && (
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <MapPin className="size-3.5" /> {client.address}
                </div>
              )}
              {client.start_date && (
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Calendar className="size-3.5" /> {t('closedClients.clientSince')} {formatDate(client.start_date)}
                </div>
              )}

              <div>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  client.status === 'active'
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                }`}>
                  {client.status === 'active' ? t('closedClients.activeStatus') : t('closedClients.inactiveStatus')}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* FAQ Section */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-foreground">{t('closedClients.faq.title')}</h3>
          <p className="text-sm text-muted-foreground">{t('closedClients.faq.subtitle')}</p>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus className="size-4 mr-1.5 rtl:ml-1.5 rtl:mr-0" /> {t('closedClients.faq.addQuestion')}
        </Button>
      </div>

      {faqList.length === 0 ? (
        <Card className="border border-dashed border-border bg-muted/30">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <HelpCircle className="size-10 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">{t('closedClients.faq.noQuestions')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {faqList.map((faq) => {
            const isOpen = expandedId === faq.id;
            return (
              <Card key={faq.id} className="border border-border bg-card overflow-hidden transition-all duration-200">
                <button
                  onClick={() => setExpandedId(isOpen ? null : faq.id)}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="size-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center shrink-0">
                      <HelpCircle className="size-4 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <span className="text-sm font-medium text-foreground truncate">{faq.question}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); openEdit(faq); }}
                      className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Edit className="size-3.5" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(faq); }}
                      className="p-1.5 rounded-md hover:bg-rose-50 dark:hover:bg-rose-900/20 text-muted-foreground hover:text-rose-600 transition-colors"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                    {isOpen ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
                  </div>
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 pt-0 border-t border-border">
                    <p className="text-sm text-muted-foreground leading-relaxed pt-3 whitespace-pre-wrap">{faq.answer}</p>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* FAQ Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editingFaq ? t('closedClients.faq.editQuestion') : t('closedClients.faq.addQuestion')}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <Label>{t('closedClients.faq.question')}</Label>
            <Input
              value={form.question}
              onChange={(e) => setForm({ ...form, question: e.target.value })}
              placeholder={t('closedClients.faq.questionPlaceholder')}
              required
            />
          </div>
          <div>
            <Label>{t('closedClients.faq.answer')}</Label>
            <Textarea
              value={form.answer}
              onChange={(e) => setForm({ ...form, answer: e.target.value })}
              placeholder={t('closedClients.faq.answerPlaceholder')}
              rows={4}
              required
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="size-4 mr-1.5 animate-spin" />}
              {t('common.save')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
