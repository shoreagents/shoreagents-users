declare global {
  interface Window {
    electronAPI: {
      send: (channel: string, data?: unknown) => void;
      receive: (channel: string, func: (...args: unknown[]) => void) => void;
      removeAllListeners: (channel: string) => void;
      activityTracking: {
        start: () => Promise<{ success: boolean; error?: string }>;
        stop: () => Promise<{ success: boolean; error?: string }>;
        pause: () => Promise<{ success: boolean; error?: string }>;
        resume: () => Promise<{ success: boolean; error?: string }>;
        reset: () => Promise<{ success: boolean; error?: string }>;
        setThreshold: (threshold: number) => Promise<{ success: boolean; error?: string }>;
        getStatus: () => Promise<{
          lastActivityTime: number;
          isTracking: boolean;
          mousePosition: { x: number; y: number };
          timeSinceLastActivity: number;
          error?: string;
        }>;
      };
      inactivityNotifications: {
        show: (data: { inactiveTime: number }) => Promise<{ success: boolean; error?: string }>;
        update: (data: { inactiveTime: number }) => Promise<{ success: boolean; error?: string }>;
        close: () => Promise<{ success: boolean; error?: string }>;
      };
      getVersion: () => string;
      platform: string;
    };
  }
}

export {}; 