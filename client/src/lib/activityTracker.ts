import { apiRequest } from "./queryClient";

export interface ActivityData {
  activityType: string;
  activityData?: any;
}

class ActivityTracker {
  private isEnabled = true;
  private batchQueue: ActivityData[] = [];
  private batchTimeout: NodeJS.Timeout | null = null;
  private readonly BATCH_SIZE = 10;
  private readonly BATCH_DELAY = 5000; // 5 seconds

  enable() {
    this.isEnabled = true;
  }

  disable() {
    this.isEnabled = false;
  }

  async track(activityType: string, activityData?: any) {
    if (!this.isEnabled) return;

    try {
      // For real-time critical events, send immediately
      const immediateEvents = ['login', 'signup', 'error', 'payment'];
      if (immediateEvents.includes(activityType)) {
        await this.sendActivity(activityType, activityData);
        return;
      }

      // Batch less critical events
      this.batchQueue.push({ activityType, activityData });
      
      if (this.batchQueue.length >= this.BATCH_SIZE) {
        await this.flushBatch();
      } else if (this.batchTimeout === null) {
        this.batchTimeout = setTimeout(() => this.flushBatch(), this.BATCH_DELAY);
      }
    } catch (error) {
      console.warn('Failed to track activity:', error);
    }
  }

  private async sendActivity(activityType: string, activityData?: any) {
    const response = await fetch('/api/activity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activityType, activityData }),
      credentials: 'include'
    });
    
    if (!response.ok) {
      throw new Error(`Failed to track activity: ${response.statusText}`);
    }
    
    return response.json();
  }

  private async flushBatch() {
    if (this.batchQueue.length === 0) return;

    const batch = [...this.batchQueue];
    this.batchQueue = [];
    
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }

    try {
      // Send all activities in a single batch request
      const response = await fetch('/api/activity/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activities: batch }),
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`Failed to track batch activities: ${response.statusText}`);
      }
    } catch (error) {
      console.warn('Failed to send activity batch:', error);
    }
  }

  // Track common activities
  trackPageView(page: string) {
    this.track('page_view', { page, timestamp: Date.now() });
  }

  trackButtonClick(buttonId: string, context?: string) {
    this.track('button_click', { buttonId, context, timestamp: Date.now() });
  }

  trackFormSubmission(formType: string, success: boolean) {
    this.track('form_submission', { formType, success, timestamp: Date.now() });
  }

  trackContractAction(action: string, contractId: string) {
    this.track('contract_action', { action, contractId, timestamp: Date.now() });
  }

  trackProfileAction(action: string, profileData?: any) {
    this.track('profile_action', { action, profileData, timestamp: Date.now() });
  }

  trackLogin() {
    this.track('login', { timestamp: Date.now() });
  }

  trackSignup() {
    this.track('signup', { timestamp: Date.now() });
  }

  trackError(error: string, context?: string) {
    this.track('error', { error, context, timestamp: Date.now() });
  }

  // Flush any remaining activities before the user leaves
  beforeUnload() {
    if (this.batchQueue.length > 0) {
      // Use sendBeacon for better reliability during page unload
      if (navigator.sendBeacon) {
        const data = JSON.stringify({ 
          activityType: 'batch_unload', 
          activityData: { activities: this.batchQueue }
        });
        navigator.sendBeacon('/api/activity', data);
      }
    }
  }
}

export const activityTracker = new ActivityTracker();

// Setup page unload tracking
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => activityTracker.beforeUnload());
}