'use client';

import { useEffect, useState } from 'react';
import { useLanguage } from '@/lib/i18n';
import { tasksApi } from '@/lib/api';
import { Task } from '@/types';
import TaskCard from '@/components/TaskCard';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

export default function DailyTasksPage() {
  const { t, locale } = useLanguage();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    tasksApi.daily()
      .then(data => setTasks(data.tasks))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const today = new Date().toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const completedCount = tasks.filter(t => t.status === 'completed').length;
  const progress = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

  return (
    <div className="page-container fade-in pb-12">
      {/* Banner */}
      <div className="flex items-center gap-4 p-5 mb-6 rounded-2xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white shadow-md">
        <span className="text-3xl select-none">☀️</span>
        <div>
          <div className="text-lg font-bold tracking-tight">{t('daily.todaysSchedule')}</div>
          <div className="text-xs opacity-90 mt-0.5">{today}</div>
        </div>
        <div className="ml-auto text-right">
          <div className="text-3xl font-extrabold leading-none">{tasks.length}</div>
          <div className="text-[10px] uppercase font-bold tracking-wider opacity-95 mt-1">
            {t('daily.tasksDueToday', { count: tasks.length })}
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      {tasks.length > 0 && (
        <Card className="mb-6 hover:shadow-md transition-shadow">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{t('daily.dailyProgress')}</span>
              <span className="text-xs font-extrabold text-indigo-600 bg-indigo-50 dark:bg-indigo-950/20 px-2 py-0.5 rounded-full border border-indigo-200">
                {t('daily.completedCount', { completedCount, total: tasks.length })}
              </span>
            </div>
            <div className="h-2.5 bg-muted border rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="text-xs text-muted-foreground mt-2 font-medium">
              {progress === 100 ? t('daily.outstanding') : t('daily.progressPercent', { progress })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tasks */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="pt-6">
                <div className="h-4 bg-muted rounded w-2/3 mb-3" />
                <div className="h-3 bg-muted rounded w-full mb-2" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : tasks.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 animate-fade-in">
          {tasks.map(task => <TaskCard key={task.id} task={task} />)}
        </div>
      ) : (
        <Card className="border-dashed py-16 text-center max-w-md mx-auto mt-4">
          <CardContent className="flex flex-col items-center">
            <div className="size-12 rounded-full bg-muted flex items-center justify-center text-xl mb-3">🎉</div>
            <h3 className="font-semibold text-base mb-1">{t('daily.noDailyTasks')}</h3>
            <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
              {t('daily.clearScheduleDesc')}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
