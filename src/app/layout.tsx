
import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from '@/context/auth-context';
import { OfflineQueueProvider } from '@/context/offline-queue';
import { OfflineBanner } from '@/components/layout/offline-banner';
import AttendanceButton from '@/components/attendance/AttendanceButton';
import { ThemeProvider } from '@/context/theme-provider';

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
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=PT+Sans:ital,wght@0,400;0,700;1,400;1,700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased min-h-screen flex flex-col">
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
