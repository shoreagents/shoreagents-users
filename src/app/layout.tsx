import type { Metadata } from "next";
// import { Montserrat } from "next/font/google";
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
import { HealthProvider } from "@/contexts/health-context";
import { RestroomProvider } from "@/contexts/restroom-context";
import { LoadingProvider } from "@/contexts/loading-context";
import { TutorialProvider } from "@/contexts/tutorial-context";
import { QueryProvider } from "@/providers/query-provider";

import ElectronLogoutHandler from "@/components/electron-logout-handler";
import { GlobalTimerDisplay } from "@/components/global-timer-display";
import { GlobalMeetingIndicator } from "@/components/global-meeting-indicator";
import { GlobalEventIndicator } from "@/components/global-event-indicator";
import { GlobalLoadingIndicator } from "@/components/global-loading-indicator";
import { GlobalRestroomQuickAction } from "@/components/global-restroom-quick-action";
import { AuthMonitor } from "@/components/auth-monitor";
import AuthNormalizer from "@/components/auth-normalizer";
import { LogoutLoadingOverlay } from "@/components/logout-loading-overlay";
import { AppWrapper } from "@/components/app-wrapper";
import { TutorialOverlay } from "@/components/tutorial-overlay";
import { AnnouncementsLayoutWrapper } from "@/components/announcements/announcements-layout-wrapper";
import { AnnouncementsProvider } from '@/contexts/announcements-context';
import { UpdateNotification } from "@/components/update-notification";
import { Toaster } from "sonner";


// const montserrat = Montserrat({
//   subsets: ["latin"],
//   variable: "--font-montserrat",
// });

export const metadata: Metadata = {
  title: "ShoreAgents Dashboard",
  description: "Agent Support Ticket Form Dashboard for ShoreAgents",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased overflow-x-hidden">
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
            <LoadingProvider>
              <TutorialProvider>
                <AuthMonitor>
                  <AuthProvider>
                    <SocketProvider>
                      <AnnouncementsProvider>
                        <AnnouncementsLayoutWrapper />
                      </AnnouncementsProvider>
                      <MeetingProvider>
                        <EventsProvider>
                          <BreakProvider>
                            <HealthProvider>
                              <RestroomProvider>
                                <TimerProvider>
                                  <ActivityProvider>
                                  <TeamStatusProvider>
                                  {/* Keep auth stores in sync as early as possible */}
                                    <AuthNormalizer />
                                    <ElectronLogoutHandler />
                                    <AppWrapper>
                                      {children}
                                    </AppWrapper>
                                    <GlobalTimerDisplay />
                                    <GlobalMeetingIndicator />
                                    <GlobalEventIndicator />
                                    <GlobalLoadingIndicator />
                                    <GlobalRestroomQuickAction />
                                    <TutorialOverlay />
                                    <UpdateNotification />
                                    <Toaster position="top-right" richColors />
                                  </TeamStatusProvider>
                                  </ActivityProvider>
                                </TimerProvider>
                              </RestroomProvider>
                            </HealthProvider>
                          </BreakProvider>
                        </EventsProvider>
                      </MeetingProvider>
                  </SocketProvider>
                  </AuthProvider>
                  <LogoutLoadingOverlay />
                </AuthMonitor>
              </TutorialProvider>
            </LoadingProvider>
          </LogoutProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
