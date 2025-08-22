import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";
import { ActivityProvider } from "@/contexts/activity-context";
import { BreakProvider } from "@/contexts/break-context";
import { TimerProvider } from "@/contexts/timer-context";
import { MeetingProvider } from "@/contexts/meeting-context";

import ElectronLogoutHandler from "@/components/electron-logout-handler";
import DatabaseInitializer from "@/components/database-initializer";
import { GlobalTimerDisplay } from "@/components/global-timer-display";
import { AuthMonitor } from "@/components/auth-monitor";
import AuthNormalizer from "@/components/auth-normalizer";
import { Toaster } from "sonner";


const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat",
});

export const metadata: Metadata = {
  title: "ShoreAgents Dashboard - User Form",
  description: "Agent Support Ticket Form Dashboard for ShoreAgents",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${montserrat.variable} antialiased overflow-x-hidden`}>
        {/* Persist theme across reloads */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function(){
                try {
                  var theme = localStorage.getItem('theme');
                  if(theme === 'dark') document.documentElement.classList.add('dark');
                } catch(e) {}
              })();
            `,
          }}
        />
        <AuthMonitor>
          <BreakProvider>
            <ActivityProvider>
              <MeetingProvider>
                <TimerProvider>
                  {/* Keep auth stores in sync as early as possible */}
                  <AuthNormalizer />
                  <DatabaseInitializer />
                  <ElectronLogoutHandler />
                  {children}
                  <GlobalTimerDisplay />
                  <Toaster position="top-right" richColors />
                </TimerProvider>
              </MeetingProvider>
            </ActivityProvider>
          </BreakProvider>
        </AuthMonitor>
      </body>
    </html>
  );
}
