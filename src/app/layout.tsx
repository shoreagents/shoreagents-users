import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";
import { ActivityProvider } from "@/contexts/activity-context";
import { BreakProvider } from "@/contexts/break-context";
import { TimerProvider } from "@/contexts/timer-context";
import { MeetingProvider } from "@/contexts/meeting-context";
import { SocketProvider } from "@/contexts/socket-context";
import { LogoutProvider } from "@/contexts/logout-context";
import { TeamStatusProvider } from "@/contexts/team-status-context";
import { AuthProvider } from "@/contexts/auth-context";
import { EventsProvider } from "@/contexts/events-context";
import { QueryProvider } from "@/providers/query-provider";

import ElectronLogoutHandler from "@/components/electron-logout-handler";
import DatabaseInitializer from "@/components/database-initializer";
import { GlobalTimerDisplay } from "@/components/global-timer-display";
import { GlobalMeetingIndicator } from "@/components/global-meeting-indicator";
import { GlobalEventIndicator } from "@/components/global-event-indicator";
import { AuthMonitor } from "@/components/auth-monitor";
import AuthNormalizer from "@/components/auth-normalizer";
import { LogoutLoadingOverlay } from "@/components/logout-loading-overlay";
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
        <QueryProvider>
          <LogoutProvider>
            <AuthMonitor>
              <AuthProvider>
                <SocketProvider>
                  <EventsProvider>
                    <BreakProvider>
                      <MeetingProvider>
                        <TimerProvider>
                          <ActivityProvider>
                            <TeamStatusProvider>
                            {/* Keep auth stores in sync as early as possible */}
                            <AuthNormalizer />
                            <DatabaseInitializer />
                            <ElectronLogoutHandler />
                            {children}
                            <GlobalTimerDisplay />
                            <GlobalMeetingIndicator />
                            <GlobalEventIndicator />
                            <Toaster position="top-right" richColors />
                          </TeamStatusProvider>
                          </ActivityProvider>
                        </TimerProvider>
                      </MeetingProvider>
                    </BreakProvider>
                  </EventsProvider>
              </SocketProvider>
              </AuthProvider>
              <LogoutLoadingOverlay />
            </AuthMonitor>
          </LogoutProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
