'use client';

import { useEffect, use } from 'react';
import { useRouter } from 'next/navigation';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ClientsOnboardingRedirect({ params }: PageProps) {
  const resolvedParams = use(params);
  const router = useRouter();

  useEffect(() => {
    router.replace(`/dashboard/closed-clients/${resolvedParams.id}/onboarding`);
  }, [router, resolvedParams.id]);

  return null;
}
