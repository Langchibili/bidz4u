// Bidz4u native deep-link service.
import { CONSTANTS } from '../utils/constants';
import { logger } from '../utils/logger';

type WebViewSender = ((data: any) => void) | null;

class DeepLinkService {
  /**
   * Handle notification tap and route to correct page
   */
  handleNotification(data: any, sendToWebView: WebViewSender): void {
    try {
      logger.info('Handling notification deep link:', data);

      if (!sendToWebView) {
        logger.warn('sendToWebView not available');
        return;
      }

      let url = '';

      switch (data.type) {
        case 'bid:placed':
        case 'auction:extended':
        case 'auction:closed':
        case 'payment:required':
          url = `${CONSTANTS.FRONTEND_URLS.bidder}/auction/${data.documentId || data.auctionItemDocumentId || data.auctionItemId}`;
          break;
        case 'payment:success':
        case 'payment:failed':
          url = `${CONSTANTS.FRONTEND_URLS.bidder}/wallet`;
          break;

        case 'reconnect':
          // Just refresh current page
          url = 'refresh';
          break;

        default:
          logger.warn('Unknown notification type:', data.type);
          return;
      }

      // Send navigation command to WebView
      sendToWebView({
        type: 'NAVIGATE_TO',
        payload: {
          url,
          data,
        },
      });

      logger.info('Navigation command sent to WebView:', url);
    } catch (error) {
      logger.error('Error handling notification deep link:', error);
    }
  }

  /**
   * Handle draw-over action result
   */
  handleDrawOverAction(action: 'accept' | 'decline', data: any, sendToWebView: WebViewSender): void {
    try {
      logger.info(`Draw-over action: ${action}`, data);

      if (!sendToWebView) {
        logger.warn('sendToWebView not available');
        return;
      }

      sendToWebView({
        type: 'AUCTION_ACTION',
        payload: {
          action,
          auctionItemId: data.auctionItemId,
        },
      });
    } catch (error) {
      logger.error('Error handling draw-over action:', error);
    }
  }
}

export default new DeepLinkService();