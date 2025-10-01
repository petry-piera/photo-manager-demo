/**
 * Centralized error handling and recovery service for PhotoManager
 * - Centralized error handling and logging
 * - User-friendly error messages
 * - Data recovery mechanisms
 * - Offline error handling
 */

import { announcer } from '@/utils/accessibility-utils';

/**
 * Error severity levels
 */
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Error categories
 */
export type ErrorCategory =
  | 'storage'
  | 'network'
  | 'validation'
  | 'permission'
  | 'file'
  | 'memory'
  | 'corruption'
  | 'unknown';

/**
 * Error context information
 */
export interface ErrorContext {
  component?: string;
  action?: string;
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, any>;
}

/**
 * Error log entry
 */
export interface ErrorLogEntry {
  id: string;
  timestamp: number;
  message: string;
  severity: ErrorSeverity;
  category: ErrorCategory;
  stack?: string;
  context?: ErrorContext;
  userAgent?: string;
  url?: string;
  resolved?: boolean;
  recoveryAttempts?: number;
}

/**
 * Recovery strategy interface
 */
export interface RecoveryStrategy {
  name: string;
  description: string;
  action: () => Promise<boolean>;
  canRetry: boolean;
}

/**
 * Error notification options
 */
export interface ErrorNotificationOptions {
  title?: string;
  message: string;
  severity: ErrorSeverity;
  actions?: {
    label: string;
    action: () => void;
    primary?: boolean;
  }[];
  autoHide?: boolean;
  duration?: number;
}

/**
 * Custom error classes
 */
export class PhotoManagerError extends Error {
  public readonly severity: ErrorSeverity;
  public readonly category: ErrorCategory;
  public readonly context?: ErrorContext;
  public readonly code?: string;

  constructor(
    message: string,
    severity: ErrorSeverity = 'medium',
    category: ErrorCategory = 'unknown',
    context?: ErrorContext,
    code?: string
  ) {
    super(message);
    this.name = 'PhotoManagerError';
    this.severity = severity;
    this.category = category;
    this.context = context;
    this.code = code;
  }
}

export class StorageError extends PhotoManagerError {
  constructor(message: string, context?: ErrorContext, code?: string) {
    super(message, 'high', 'storage', context, code);
    this.name = 'StorageError';
  }
}

export class NetworkError extends PhotoManagerError {
  constructor(message: string, context?: ErrorContext, code?: string) {
    super(message, 'medium', 'network', context, code);
    this.name = 'NetworkError';
  }
}

export class ValidationError extends PhotoManagerError {
  constructor(message: string, context?: ErrorContext, code?: string) {
    super(message, 'low', 'validation', context, code);
    this.name = 'ValidationError';
  }
}

export class PermissionError extends PhotoManagerError {
  constructor(message: string, context?: ErrorContext, code?: string) {
    super(message, 'high', 'permission', context, code);
    this.name = 'PermissionError';
  }
}

export class FileError extends PhotoManagerError {
  constructor(message: string, context?: ErrorContext, code?: string) {
    super(message, 'medium', 'file', context, code);
    this.name = 'FileError';
  }
}

export class MemoryError extends PhotoManagerError {
  constructor(message: string, context?: ErrorContext, code?: string) {
    super(message, 'high', 'memory', context, code);
    this.name = 'MemoryError';
  }
}

export class CorruptionError extends PhotoManagerError {
  constructor(message: string, context?: ErrorContext, code?: string) {
    super(message, 'critical', 'corruption', context, code);
    this.name = 'CorruptionError';
  }
}

/**
 * Error service class
 */
export class ErrorService {
  private errorLog: ErrorLogEntry[] = [];
  private maxLogEntries = 500;
  private notificationContainer?: HTMLElement;
  private recoveryStrategies = new Map<ErrorCategory, RecoveryStrategy[]>();
  private onlineStatus = navigator.onLine;

  constructor() {
    this.setupErrorHandlers();
    this.setupNotificationContainer();
    this.setupRecoveryStrategies();
    this.monitorOnlineStatus();
  }

  /**
   * Log an error
   */
  logError(
    error: Error | string,
    severity: ErrorSeverity = 'medium',
    category: ErrorCategory = 'unknown',
    context?: ErrorContext
  ): string {
    const id = this.generateErrorId();
    const timestamp = Date.now();

    let message: string;
    let stack: string | undefined;

    if (error instanceof Error) {
      message = error.message;
      stack = error.stack;

      // Extract additional info from custom errors
      if (error instanceof PhotoManagerError) {
        severity = error.severity;
        category = error.category;
        context = { ...context, ...error.context };
      }
    } else {
      message = String(error);
    }

    const logEntry: ErrorLogEntry = {
      id,
      timestamp,
      message,
      severity,
      category,
      stack,
      context,
      userAgent: navigator.userAgent,
      url: window.location.href,
      resolved: false,
      recoveryAttempts: 0
    };

    this.errorLog.push(logEntry);

    // Maintain log size
    if (this.errorLog.length > this.maxLogEntries) {
      this.errorLog.splice(0, this.errorLog.length - this.maxLogEntries);
    }

    // Store in localStorage for persistence
    this.persistErrorLog();

    // Log to console for development
    if (process.env.NODE_ENV === 'development') {
      console.error('ErrorService:', logEntry);
    }

    // Announce error to screen readers for critical/high severity
    if (severity === 'critical' || severity === 'high') {
      announcer.announceError(this.getUserFriendlyMessage(message, category));
    }

    return id;
  }

  /**
   * Handle an error with automatic recovery
   */
  async handleError(
    error: Error | string,
    severity: ErrorSeverity = 'medium',
    category: ErrorCategory = 'unknown',
    context?: ErrorContext
  ): Promise<boolean> {
    const errorId = this.logError(error, severity, category, context);

    // Show notification to user
    const userMessage = this.getUserFriendlyMessage(
      error instanceof Error ? error.message : error,
      category
    );

    this.showNotification({
      title: this.getSeverityTitle(severity),
      message: userMessage,
      severity,
      actions: await this.getRecoveryActions(category, errorId),
      autoHide: severity === 'low' || severity === 'medium',
      duration: severity === 'low' ? 3000 : 5000
    });

    // Attempt automatic recovery for appropriate errors
    if (severity !== 'critical' && this.canAutoRecover(category)) {
      return this.attemptRecovery(errorId, category);
    }

    return false;
  }

  /**
   * Attempt recovery for a specific error
   */
  async attemptRecovery(errorId: string, category: ErrorCategory): Promise<boolean> {
    const logEntry = this.errorLog.find(entry => entry.id === errorId);
    if (!logEntry) return false;

    const strategies = this.recoveryStrategies.get(category) || [];

    for (const strategy of strategies) {
      try {
        logEntry.recoveryAttempts = (logEntry.recoveryAttempts || 0) + 1;

        console.log(`Attempting recovery strategy: ${strategy.name}`);
        const success = await strategy.action();

        if (success) {
          logEntry.resolved = true;
          this.persistErrorLog();

          this.showNotification({
            title: 'Recovery Successful',
            message: `Problem resolved using ${strategy.description}`,
            severity: 'low',
            autoHide: true,
            duration: 3000
          });

          return true;
        }
      } catch (recoveryError) {
        console.warn(`Recovery strategy failed: ${strategy.name}`, recoveryError);
      }
    }

    return false;
  }

  /**
   * Get error statistics
   */
  getErrorStats(): {
    total: number;
    byCategory: Record<ErrorCategory, number>;
    bySeverity: Record<ErrorSeverity, number>;
    resolved: number;
    recent: number;
  } {
    const now = Date.now();
    const recentThreshold = now - (24 * 60 * 60 * 1000); // 24 hours

    const stats = {
      total: this.errorLog.length,
      byCategory: {} as Record<ErrorCategory, number>,
      bySeverity: {} as Record<ErrorSeverity, number>,
      resolved: 0,
      recent: 0
    };

    // Initialize counters
    const categories: ErrorCategory[] = ['storage', 'network', 'validation', 'permission', 'file', 'memory', 'corruption', 'unknown'];
    const severities: ErrorSeverity[] = ['low', 'medium', 'high', 'critical'];

    categories.forEach(cat => stats.byCategory[cat] = 0);
    severities.forEach(sev => stats.bySeverity[sev] = 0);

    // Count errors
    this.errorLog.forEach(entry => {
      stats.byCategory[entry.category]++;
      stats.bySeverity[entry.severity]++;

      if (entry.resolved) {
        stats.resolved++;
      }

      if (entry.timestamp > recentThreshold) {
        stats.recent++;
      }
    });

    return stats;
  }

  /**
   * Clear error log
   */
  clearErrorLog(): void {
    this.errorLog = [];
    localStorage.removeItem('photoManager_errorLog');
  }

  /**
   * Export error log
   */
  exportErrorLog(): string {
    return JSON.stringify(this.errorLog, null, 2);
  }

  /**
   * Get user-friendly error message
   */
  private getUserFriendlyMessage(message: string, category: ErrorCategory): string {
    const friendlyMessages: Record<ErrorCategory, string> = {
      storage: 'There was a problem saving your data. This might be due to insufficient storage space.',
      network: 'Network connection issue. Please check your internet connection.',
      validation: 'The data provided is not valid. Please check your input.',
      permission: 'Permission denied. Please allow the required permissions to continue.',
      file: 'There was a problem with the file. It might be corrupted or in an unsupported format.',
      memory: 'The application is running low on memory. Try closing other applications.',
      corruption: 'Data corruption detected. Some data might need to be restored from backup.',
      unknown: 'An unexpected error occurred. Please try again.'
    };

    const baseMessage = friendlyMessages[category] || friendlyMessages.unknown;

    // For development, append original message
    if (process.env.NODE_ENV === 'development') {
      return `${baseMessage}\n\nTechnical details: ${message}`;
    }

    return baseMessage;
  }

  /**
   * Get severity title
   */
  private getSeverityTitle(severity: ErrorSeverity): string {
    const titles: Record<ErrorSeverity, string> = {
      low: 'Notice',
      medium: 'Warning',
      high: 'Error',
      critical: 'Critical Error'
    };

    return titles[severity];
  }

  /**
   * Check if error can be auto-recovered
   */
  private canAutoRecover(category: ErrorCategory): boolean {
    return ['network', 'storage', 'memory'].includes(category);
  }

  /**
   * Get recovery actions for user
   */
  private async getRecoveryActions(category: ErrorCategory, errorId: string): Promise<ErrorNotificationOptions['actions']> {
    const strategies = this.recoveryStrategies.get(category) || [];

    if (strategies.length === 0) {
      return [{
        label: 'Dismiss',
        action: () => this.dismissNotification(),
        primary: true
      }];
    }

    const actions: ErrorNotificationOptions['actions'] = [];

    // Add primary recovery action
    if (strategies.length > 0 && strategies[0].canRetry) {
      actions.push({
        label: `Try ${strategies[0].name}`,
        action: () => this.attemptRecovery(errorId, category),
        primary: true
      });
    }

    // Add dismiss action
    actions.push({
      label: 'Dismiss',
      action: () => this.dismissNotification()
    });

    return actions;
  }

  /**
   * Generate unique error ID
   */
  private generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Setup global error handlers
   */
  private setupErrorHandlers(): void {
    // Unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.handleError(
        event.reason || 'Unhandled promise rejection',
        'high',
        'unknown',
        { component: 'global', action: 'promise_rejection' }
      );
    });

    // JavaScript errors
    window.addEventListener('error', (event) => {
      this.handleError(
        event.error || event.message,
        'high',
        'unknown',
        {
          component: 'global',
          action: 'javascript_error',
          metadata: {
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno
          }
        }
      );
    });

    // Resource loading errors
    window.addEventListener('error', (event) => {
      if (event.target !== window && event.target instanceof HTMLElement) {
        this.handleError(
          `Failed to load resource: ${event.target.tagName}`,
          'medium',
          'network',
          {
            component: 'resource_loader',
            metadata: {
              tagName: event.target.tagName,
              src: (event.target as any).src || (event.target as any).href
            }
          }
        );
      }
    }, true);
  }

  /**
   * Setup notification container
   */
  private setupNotificationContainer(): void {
    this.notificationContainer = document.createElement('div');
    this.notificationContainer.className = 'error-notifications';
    this.notificationContainer.setAttribute('aria-live', 'polite');
    this.notificationContainer.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 10000;
      max-width: 400px;
      pointer-events: none;
    `;

    document.body.appendChild(this.notificationContainer);
  }

  /**
   * Setup recovery strategies
   */
  private setupRecoveryStrategies(): void {
    // Storage recovery strategies
    this.recoveryStrategies.set('storage', [
      {
        name: 'Clear Cache',
        description: 'clearing application cache',
        action: async () => {
          try {
            // Clear various caches
            if ('caches' in window) {
              const cacheNames = await caches.keys();
              await Promise.all(cacheNames.map(name => caches.delete(name)));
            }

            // Clear localStorage except error log
            const errorLog = localStorage.getItem('photoManager_errorLog');
            localStorage.clear();
            if (errorLog) {
              localStorage.setItem('photoManager_errorLog', errorLog);
            }

            return true;
          } catch {
            return false;
          }
        },
        canRetry: true
      },
      {
        name: 'Database Cleanup',
        description: 'cleaning up database',
        action: async () => {
          try {
            // This would call database cleanup methods
            // For now, just resolve true
            return true;
          } catch {
            return false;
          }
        },
        canRetry: true
      }
    ]);

    // Network recovery strategies
    this.recoveryStrategies.set('network', [
      {
        name: 'Retry',
        description: 'retrying the operation',
        action: async () => {
          // Simple retry strategy
          await new Promise(resolve => setTimeout(resolve, 1000));
          return navigator.onLine;
        },
        canRetry: true
      },
      {
        name: 'Offline Mode',
        description: 'switching to offline mode',
        action: async () => {
          // Enable offline mode
          document.documentElement.classList.add('offline-mode');
          return true;
        },
        canRetry: false
      }
    ]);

    // Memory recovery strategies
    this.recoveryStrategies.set('memory', [
      {
        name: 'Free Memory',
        description: 'freeing up memory',
        action: async () => {
          try {
            // Force garbage collection if available
            if ('gc' in window) {
              (window as any).gc();
            }

            // Clear image caches
            const images = document.querySelectorAll('img[src^="blob:"]');
            images.forEach(img => {
              URL.revokeObjectURL((img as HTMLImageElement).src);
            });

            return true;
          } catch {
            return false;
          }
        },
        canRetry: true
      }
    ]);
  }

  /**
   * Monitor online status
   */
  private monitorOnlineStatus(): void {
    const updateOnlineStatus = () => {
      const wasOnline = this.onlineStatus;
      this.onlineStatus = navigator.onLine;

      if (!wasOnline && this.onlineStatus) {
        // Came back online
        this.showNotification({
          title: 'Connection Restored',
          message: 'Internet connection has been restored.',
          severity: 'low',
          autoHide: true,
          duration: 3000
        });
      } else if (wasOnline && !this.onlineStatus) {
        // Went offline
        this.showNotification({
          title: 'Connection Lost',
          message: 'Internet connection lost. Some features may be limited.',
          severity: 'medium',
          autoHide: true,
          duration: 5000
        });
      }
    };

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
  }

  /**
   * Show error notification
   */
  private showNotification(options: ErrorNotificationOptions): void {
    if (!this.notificationContainer) return;

    const notification = document.createElement('div');
    notification.className = `error-notification severity-${options.severity}`;
    notification.style.cssText = `
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--border-radius);
      padding: var(--spacing-md);
      margin-bottom: var(--spacing-sm);
      box-shadow: var(--box-shadow-lg);
      pointer-events: auto;
      opacity: 0;
      transform: translateX(100%);
      transition: all 0.3s ease-out;
    `;

    // Add severity-specific styling
    const severityColors = {
      low: '--color-success',
      medium: '--color-warning',
      high: '--color-error',
      critical: '--color-error'
    };

    notification.style.borderLeftColor = `var(${severityColors[options.severity]})`;
    notification.style.borderLeftWidth = '4px';

    const content = `
      <div class="notification-content">
        ${options.title ? `<div class="notification-title" style="font-weight: bold; margin-bottom: var(--spacing-xs);">${options.title}</div>` : ''}
        <div class="notification-message">${options.message}</div>
        ${options.actions ? `
          <div class="notification-actions" style="margin-top: var(--spacing-sm); display: flex; gap: var(--spacing-xs);">
            ${options.actions.map(action =>
              `<button class="btn ${action.primary ? 'btn-primary' : 'btn-secondary'}" style="font-size: var(--font-size-sm);">${action.label}</button>`
            ).join('')}
          </div>
        ` : ''}
      </div>
    `;

    notification.innerHTML = content;

    // Add action handlers
    if (options.actions) {
      const buttons = notification.querySelectorAll('button');
      options.actions.forEach((action, index) => {
        buttons[index]?.addEventListener('click', () => {
          action.action();
          notification.remove();
        });
      });
    }

    this.notificationContainer.appendChild(notification);

    // Animate in
    setTimeout(() => {
      notification.style.opacity = '1';
      notification.style.transform = 'translateX(0)';
    }, 10);

    // Auto-hide if specified
    if (options.autoHide) {
      setTimeout(() => {
        this.dismissNotification(notification);
      }, options.duration || 5000);
    }
  }

  /**
   * Dismiss notification
   */
  private dismissNotification(notification?: HTMLElement): void {
    const target = notification || this.notificationContainer?.lastElementChild as HTMLElement;
    if (!target) return;

    target.style.opacity = '0';
    target.style.transform = 'translateX(100%)';

    setTimeout(() => {
      target.remove();
    }, 300);
  }

  /**
   * Persist error log to localStorage
   */
  private persistErrorLog(): void {
    try {
      localStorage.setItem('photoManager_errorLog', JSON.stringify(this.errorLog));
    } catch (error) {
      console.warn('Failed to persist error log:', error);
    }
  }

  /**
   * Load error log from localStorage
   */
  private loadErrorLog(): void {
    try {
      const stored = localStorage.getItem('photoManager_errorLog');
      if (stored) {
        this.errorLog = JSON.parse(stored);
      }
    } catch (error) {
      console.warn('Failed to load error log:', error);
    }
  }

  /**
   * Initialize error service
   */
  initialize(): void {
    this.loadErrorLog();
    console.log('🛡️ Error service initialized');
  }

  /**
   * Cleanup error service
   */
  destroy(): void {
    this.notificationContainer?.remove();
  }
}

// Create singleton instance
export const errorService = new ErrorService();