
import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from '@/context/auth-context';
import { OfflineQueueProvider } from '@/context/offline-queue';
import { OfflineBanner } from '@/components/layout/offline-banner';
import { ThemeProvider } from '@/context/theme-provider';
import { PT_Sans } from 'next/font/google';

const ptSans = PT_Sans({ 
  subsets: ['latin'], 
  weight: ['400', '700'],
  variable: '--font-pt-sans'
});

export const metadata: Metadata = {
  title: 'FieldOps',
  description: 'Field Operations Management App',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${ptSans.variable} font-body antialiased min-h-screen flex flex-col`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <OfflineQueueProvider>
            <AuthProvider>
              {children}
            </AuthProvider>
            <OfflineBanner />
          </OfflineQueueProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
