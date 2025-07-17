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
      getVersion: () => string;
      platform: string;
    };
  }
}

export {}; 