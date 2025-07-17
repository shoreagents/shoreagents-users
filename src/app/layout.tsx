import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";
import { ActivityProvider } from "@/contexts/activity-context";
import { BreakProvider } from "@/contexts/break-context";

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
    <html lang="en">
      <body className={`${montserrat.variable} antialiased`}>
        <BreakProvider>
          <ActivityProvider>
        {children}
          </ActivityProvider>
        </BreakProvider>
      </body>
    </html>
  );
}
