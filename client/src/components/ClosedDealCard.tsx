'use client';

import { Client } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCairoDate } from '@/lib/dateUtils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Mail,
  Phone,
  MapPin,
  Calendar,
  User,
  CheckCircle,
  MoreVertical,
  Pencil,
  Trash2,
} from 'lucide-react';

interface ClosedDealCardProps {
  client: Client;
  locale: string;
  t: any;
  onEditClick: (client: Client) => void;
  onDeleteClick: (id: string, name: string) => void;
}

export default function ClosedDealCard({ client, locale, t, onEditClick, onDeleteClick }: ClosedDealCardProps) {
  const formatDateLabel = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    return formatCairoDate(dateStr, locale);
  };

  return (
    <Card className="transition-all duration-200 hover:shadow-md flex flex-col bg-card border border-border/80 rounded-xl overflow-hidden text-start">
      <CardContent className="p-5 flex flex-col gap-4">
        {/* Header Row: Avatar, Name & Won Badge / Actions */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="size-11 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-extrabold text-sm shrink-0 shadow-xs border border-emerald-200/50">
              {client.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground leading-snug truncate max-w-[180px]" title={client.name}>
                {client.name}
              </h3>
              <p className="text-xs text-muted-foreground truncate max-w-[180px]" title={client.company || t('clients.privateClient')}>
                {client.company || t('clients.privateClient')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <Badge className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/30 flex items-center gap-1 text-[10px] px-2.5 py-0.5 font-bold tracking-wide uppercase">
              <CheckCircle className="size-3" />
              {t('sales.won') || 'Won'}
            </Badge>

            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-foreground rounded-md shrink-0">
                    <MoreVertical className="size-4" />
                  </Button>
                }
              />
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEditClick(client)}>
                  <Pencil className="size-3.5 mr-2 rtl:ml-2 rtl:mr-0 text-muted-foreground" />
                  {t('common.edit')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-rose-600 focus:text-rose-600 focus:bg-rose-50 dark:focus:bg-rose-950/20"
                  onClick={() => onDeleteClick(client.id, client.name)}
                >
                  <Trash2 className="size-3.5 mr-2 rtl:ml-2 rtl:mr-0" />
                  {t('common.delete')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Contact Info Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs bg-muted/10 border border-border/30 rounded-lg p-3">
          {client.email && (
            <div className="flex items-center gap-2 text-muted-foreground min-w-0">
              <Mail className="size-3.5 shrink-0 text-indigo-500/80" />
              <span className="truncate" title={client.email}>{client.email}</span>
            </div>
          )}
          {client.phone && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Phone className="size-3.5 shrink-0 text-indigo-500/80" />
              <span>{client.phone}</span>
            </div>
          )}
          {client.address && (
            <div className="flex items-start gap-2 text-muted-foreground col-span-1 sm:col-span-2">
              <MapPin className="size-3.5 shrink-0 text-indigo-500/80 mt-0.5" />
              <span className="line-clamp-2 leading-tight" title={client.address}>{client.address}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-muted-foreground col-span-1 sm:col-span-2">
            <Calendar className="size-3.5 shrink-0 text-indigo-500/80" />
            <span>
              {t('clients.startDate') || 'Start Date'}:{' '}
              <strong className="text-foreground/90 font-semibold">{formatDateLabel(client.start_date)}</strong>
            </span>
          </div>
        </div>

        {/* Closed By Sales Rep Badge */}
        <div className="flex items-center gap-2 text-xs border-t border-border/50 pt-3">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {t('clients.closedBy') || 'Closed By'}:
          </span>
          <span className="text-xs font-bold text-foreground flex items-center gap-1.5 ml-auto rtl:mr-auto rtl:ml-0">
            <User className="size-3.5 text-indigo-500" />
            {client.sales_rep?.name?.trim() || <span className="italic font-normal text-muted-foreground/60">{t('common.unassigned')}</span>}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
