declare global {
  interface Window {
    electronAPI?: {
      send: (channel: string, data?: any) => void;
      receive: (channel: string, func: (...args: any[]) => void) => void;
      removeAllListeners: (channel: string) => void;
      activityTracking: {
        start: () => Promise<any>;
        stop: () => Promise<any>;
        pause: () => Promise<any>;
        resume: () => Promise<any>;
        reset: () => Promise<any>;
        setThreshold: (threshold: number) => Promise<any>;
        getStatus: () => Promise<any>;
      };
      inactivityNotifications: {
        show: (data: any) => Promise<any>;
        update: (data: any) => Promise<any>;
        close: () => Promise<any>;
      };
      systemNotifications: {
        show: (notificationData: any) => Promise<any>;
        clear: () => Promise<any>;
        getCount: () => Promise<any>;
      };
      onClearAllNotifications: (callback: () => void) => void;
      app: {
        confirmLogoutAndQuit: () => Promise<any>;
        logoutCompleted: () => Promise<any>;
        userLoggedIn: () => Promise<any>;
        userLoggedOut: () => Promise<any>;
      };
      secureCredentials: {
        store: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
        get: () => Promise<{ success: boolean; credentials?: { email: string; password: string; timestamp: number; version: string }; error?: string }>;
        clear: () => Promise<{ success: boolean; error?: string }>;
      };
      fullscreen: {
        enter: () => Promise<any>;
        exit: () => Promise<any>;
      };
      multiMonitor: {
        createBlackScreens: () => Promise<{ success: boolean; count?: number; error?: string }>;
        closeBlackScreens: () => Promise<{ success: boolean; error?: string }>;
        getMonitorInfo: () => Promise<{
          success: boolean;
          displays?: Array<{
            id: number;
            isPrimary: boolean;
            bounds: { x: number; y: number; width: number; height: number };
            workArea: { x: number; y: number; width: number; height: number };
            scaleFactor: number;
          }>;
          primaryDisplay?: {
            id: number;
            bounds: { x: number; y: number; width: number; height: number };
            workArea: { x: number; y: number; width: number; height: number };
            scaleFactor: number;
          };
          error?: string;
        }>;
        testBlackScreens: () => Promise<{ success: boolean; count?: number; error?: string }>;
      };
      breakMonitoring: {
        setActive: (active: boolean) => Promise<{ success: boolean; breakActive?: boolean; error?: string }>;
        getActive: () => Promise<{ success: boolean; breakActive?: boolean; error?: string }>;
        confirmEndDueToFocusLoss: () => Promise<{ success: boolean; blackScreens?: { success: boolean; error?: string }; error?: string }>;
        returnToBreak: () => Promise<{ success: boolean; error?: string }>;
        emergencyEscape: () => Promise<{ success: boolean; blackScreens?: { success: boolean; error?: string }; error?: string }>;
      };
      kioskMode: {
        enable: () => Promise<{ success: boolean; kioskMode?: boolean; error?: string }>;
        disable: () => Promise<{ success: boolean; kioskMode?: boolean; error?: string }>;
        setActive: (enabled: boolean) => Promise<{ success: boolean; kioskMode?: boolean; error?: string }>;
      };
      getVersion: () => string;
      platform: string;
    };
  }
}

export {}; 