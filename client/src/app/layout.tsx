import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/lib/auth';
import { LanguageProvider } from '@/lib/i18n';
import { ThemeProvider } from '@/lib/theme';
import { Geist, Noto_Sans_Arabic } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});
const notoArabic = Noto_Sans_Arabic({subsets:['arabic'],variable:'--font-arabic', weight:['400','500','600','700']});

export const metadata: Metadata = {
  title: 'Sawaqly CRM — Marketing Agency',
  description: 'Task management CRM for marketing agency teams',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning className={cn("font-sans", geist.variable, notoArabic.variable)}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `
          try {
            document.documentElement.classList.remove('dark');
            document.documentElement.classList.add('light');
          } catch (_) {}
        ` }} />
      </head>
      <body>
        <LanguageProvider>
          <ThemeProvider>
            <AuthProvider>
              {children}
            </AuthProvider>
          </ThemeProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
