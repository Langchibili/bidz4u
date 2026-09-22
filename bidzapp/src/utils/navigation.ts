import { logger } from './logger';

export class NavigationHelper {
  /**
   * Inject navigation command into WebView
   */
  static injectNavigationScript(webViewRef: any, url: string, data?: any): void {
    if (!webViewRef.current) {
      logger.warn('WebView ref not available for navigation');
      return;
    }

    const script = `
      (function() {
        try {
          // Check if we should just refresh
          if ('${url}' === 'refresh') {
            window.location.reload();
            return;
          }

          // Check if URL is different from current
          if (window.location.href !== '${url}') {
            window.location.href = '${url}';
          }

          // Dispatch custom event with data
          ${data ? `
          window.dispatchEvent(new CustomEvent('navigate', {
            detail: ${JSON.stringify(data)}
          }));
          ` : ''}
        } catch(e) {
          console.error('Navigation error:', e);
        }
      })();
      true;
    `;

    webViewRef.current.injectJavaScript(script);
    logger.info(`Navigation injected: ${url}`);
  }

  /**
   * Send message to WebView
   */
  static sendMessage(webViewRef: any, type: string, payload: any): void {
    if (!webViewRef.current) {
      logger.warn('WebView ref not available for message');
      return;
    }

    const script = `
      (function() {
        try {
          window.dispatchEvent(new MessageEvent('message', {
            data: ${JSON.stringify({ type, payload })}
          }));
        } catch(e) {
          console.error('Message dispatch error:', e);
        }
      })();
      true;
    `;

    webViewRef.current.injectJavaScript(script);
    logger.debug(`Message sent to WebView: ${type}`);
  }
}