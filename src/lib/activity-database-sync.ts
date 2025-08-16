// Activity Database Sync Utility
// Syncs activity data between localStorage and database

export interface ActivityData {
  id?: number;
  user_id: number;
  is_currently_active: boolean;
  created_at?: string;
  updated_at?: string;
}

// Sync activity data to database
export const syncActivityToDatabase = async (email: string, isCurrentlyActive: boolean): Promise<boolean> => {
  try {
    const response = await fetch('/api/activity', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        isCurrentlyActive
      }),
    });

    if (!response.ok) {
      console.error('Failed to sync activity to database:', response.statusText);
      return false;
    }

    const data = await response.json();
    return true;
  } catch (error) {
    console.error('Error syncing activity to database:', error);
    return false;
  }
};

// Get activity data from database
export const getActivityFromDatabase = async (email: string): Promise<ActivityData | null> => {
  try {
    const response = await fetch(`/api/activity?email=${encodeURIComponent(email)}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        return null; // No activity data found
      }
      console.error('Failed to get activity from database:', response.statusText);
      return null;
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error getting activity from database:', error);
    return null;
  }
};

// Update activity data in database
export const updateActivityInDatabase = async (email: string, isCurrentlyActive: boolean): Promise<boolean> => {
  try {
    const response = await fetch('/api/activity', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        isCurrentlyActive
      }),
    });

    if (!response.ok) {
      console.error('Failed to update activity in database:', response.statusText);
      return false;
    }

    const data = await response.json();
    return true;
  } catch (error) {
    console.error('Error updating activity in database:', error);
    return false;
  }
};

// Initialize activity data in database (called when user logs in)
export const initializeActivityInDatabase = async (email: string, isCurrentlyActive: boolean = true): Promise<boolean> => {
  try {
    const response = await fetch('/api/activity', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        isCurrentlyActive
      }),
    });

    if (!response.ok) {
      console.error('Failed to initialize activity in database:', response.statusText);
      return false;
    }

    const data = await response.json();
    return true;
  } catch (error) {
    console.error('Error initializing activity in database:', error);
    return false;
  }
}; 