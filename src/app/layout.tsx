
import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from '@/context/auth-context';
import { OfflineQueueProvider } from '@/context/offline-queue';
import { OfflineBanner } from '@/components/layout/offline-banner';
import AttendanceButton from '@/components/attendance/AttendanceButton';
import { ThemeProvider } from '@/context/theme-provider';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

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
      <body className={`${inter.variable} font-body antialiased min-h-screen flex flex-col`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <OfflineQueueProvider>
            <AuthProvider>
              {/* AttendanceButton is now rendered here for global access */}
              <AttendanceButton /> 
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
