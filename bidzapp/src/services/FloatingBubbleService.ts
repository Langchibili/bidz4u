// OkraApp\src\services\FloatingBubbleService.ts
import { Platform } from 'react-native';
import { logger } from '../utils/logger';
import DrawOverNativeModule from '../../modules/expo-draw-over';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface RideCardData {
  rideId?: number | string;
  rideCode?: string;
  riderName?: string;
  pickupAddress?: string;
  dropoffAddress?: string;
  estimatedFare?: number;
  distance?: number;
  pickupLocation?: { lat: number; lng: number; address?: string; name?: string };
  dropoffLocation?: { lat: number; lng: number; address?: string; name?: string };
}

interface DeliveryCardData {
  deliveryId?: number | string;
  rideCode?: string;
  senderName?: string;
  pickupAddress?: string;
  dropoffAddress?: string;
  estimatedFare?: number;
  distance?: number;
  pickupLocation?: { lat: number; lng: number; address?: string; name?: string };
  dropoffLocation?: { lat: number; lng: number; address?: string; name?: string };
  packageType?: string | null;
  isFragile?: boolean;
  weightKg?: number | null;
  recipientName?: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────

class FloatingBubbleService {
  private pendingRequestCount = 0;

  // ─── Permission helpers ────────────────────────────────────────────────────

  private async ensurePermission(): Promise<boolean> {
    const hasPermission = await DrawOverNativeModule.checkPermission();
    if (hasPermission) return true;

    logger.warn('⚠️ Draw-over permission not granted, requesting…');
    await DrawOverNativeModule.requestPermission();
    await new Promise(resolve => setTimeout(resolve, 900));

    const granted = await DrawOverNativeModule.checkPermission();
    if (!granted) logger.error('❌ Draw-over permission denied by user');
    return granted;
  }

  // ─── Start (generic, no ride data) ────────────────────────────────────────

  /**
   * Start the floating card without ride details.
   * Typically called when the driver goes online.
   */
  async start(): Promise<boolean> {
    if (Platform.OS !== 'android') {
      logger.warn('⚠️ Floating card only supported on Android');
      return false;
    }

    try {
      if (!DrawOverNativeModule) {
        logger.error('❌ DrawOverNativeModule not available');
        return false;
      }

      const permitted = await this.ensurePermission();
      if (!permitted) return false;

      await DrawOverNativeModule.startFloatingBubble();

      const showing = await DrawOverNativeModule.isFloatingBubbleShowing();
      if (showing) {
        logger.info('✅ Floating card started');
        return true;
      }

      logger.error('❌ Card not showing after start');
      return false;
    } catch (error) {
      logger.error('❌ Error starting floating card:', error);
      return false;
    }
  }

  // ─── Show card with ride details ──────────────────────────────────────────

  /**
   * Show (or refresh) the floating card populated with ride request details.
   *
   * Native module requirement:
   *   DrawOverNativeModule must expose `showRideCard(json: string): Promise<void>`.
   *   In modules/expo-draw-over add:
   *     AsyncFunction("showRideCard") { json: String ->
   *         FloatingBubbleService.showRideCard(context, json)
   *     }
   *
   * Falls back to `startFloatingBubble()` if the method is not yet wired up.
   */
  async showRideCard(data: RideCardData): Promise<boolean> {
    if (Platform.OS !== 'android') return false;

    try {
      if (!DrawOverNativeModule) return false;

      const permitted = await this.ensurePermission();
      if (!permitted) return false;
      
      let riderName = data
          ? (data.riderName || 'Passenger')
          : 'Passenger';
      if(riderName === "null null"){
          riderName = "Passenger"
      }
      const json = JSON.stringify({
        type:           'ride_request',
        rideId:         data.rideId,
        rideCode:       data.rideCode,
        riderName:      riderName,
        // Always prefer the nested location objects so the Kotlin side
        // can read `.address` from `pickupLocation` / `dropoffLocation`
        pickupAddress:  data.pickupLocation?.address ?? data.pickupAddress ?? 'Pickup',
        dropoffAddress: data.dropoffLocation?.address ?? data.dropoffAddress ?? 'Dropoff',
        pickupLocation:  data.pickupLocation,
        dropoffLocation: data.dropoffLocation,
        estimatedFare:  data.estimatedFare ?? 0,
        distance:       data.distance ?? 0,
      });

      if (typeof (DrawOverNativeModule as any).showRideCard === 'function') {
        await (DrawOverNativeModule as any).showRideCard(json);
      } else {
        // Fallback until native method is wired — shows card without details
        logger.warn('⚠️ showRideCard not on native module yet, using startFloatingBubble fallback');
        await DrawOverNativeModule.startFloatingBubble();
      }

      logger.info('✅ Floating ride card shown for ride:', data.rideId);
      return true;
    } catch (error) {
      logger.error('❌ Error showing ride card:', error);
      return false;
    }
  }

  /**
   * Show (or refresh) the floating card populated with delivery request details.
   * Same native requirement as showRideCard above.
   */
  async showDeliveryCard(data: DeliveryCardData): Promise<boolean> {
    if (Platform.OS !== 'android') return false;

    try {
      if (!DrawOverNativeModule) return false;

      const permitted = await this.ensurePermission();
      if (!permitted) return false;
      let senderName = data
          ? (data.senderName || 'Sender')
          : 'Sender';
      if(senderName === "null null"){
          senderName = "Sender"
      }
      const json = JSON.stringify({
        type:           'delivery_request',
        deliveryId:     data.deliveryId,
        rideCode:       data.rideCode,
        senderName:     senderName,
        pickupAddress:  data.pickupLocation?.address ?? data.pickupAddress ?? 'Pickup',
        dropoffAddress: data.dropoffLocation?.address ?? data.dropoffAddress ?? 'Dropoff',
        pickupLocation:  data.pickupLocation,
        dropoffLocation: data.dropoffLocation,
        estimatedFare:  data.estimatedFare ?? 0,
        distance:       data.distance ?? 0,
        packageType:    data.packageType,
        isFragile:      data.isFragile,
        weightKg:       data.weightKg,
        recipientName:  data.recipientName,
      });

      if (typeof (DrawOverNativeModule as any).showRideCard === 'function') {
        await (DrawOverNativeModule as any).showRideCard(json);
      } else {
        logger.warn('⚠️ showRideCard not on native module yet, using startFloatingBubble fallback');
        await DrawOverNativeModule.startFloatingBubble();
      }

      logger.info('✅ Floating delivery card shown for delivery:', data.deliveryId);
      return true;
    } catch (error) {
      logger.error('❌ Error showing delivery card:', error);
      return false;
    }
  }

  // ─── Stop ─────────────────────────────────────────────────────────────────

  async stop(): Promise<boolean> {
    if (Platform.OS !== 'android') return false;

    try {
      await DrawOverNativeModule.stopFloatingBubble();
      this.pendingRequestCount = 0;
      logger.info('✅ Floating card stopped');
      return true;
    } catch (error) {
      logger.error('❌ Error stopping floating card:', error);
      return false;
    }
  }

  // ─── Status ───────────────────────────────────────────────────────────────

  async isShowing(): Promise<boolean> {
    if (Platform.OS !== 'android') return false;
    try {
      return await DrawOverNativeModule.isFloatingBubbleShowing();
    } catch {
      return false;
    }
  }

  // ─── Badge ────────────────────────────────────────────────────────────────

  async updateBadge(count: number): Promise<void> {
    if (Platform.OS !== 'android') return;
    try {
      this.pendingRequestCount = count;
      await DrawOverNativeModule.updateBubbleBadge(count);
      logger.info(`✅ Badge updated: ${count}`);
    } catch (error) {
      logger.error('❌ Error updating badge:', error);
    }
  }

  async incrementBadge(): Promise<void> {
    await this.updateBadge(this.pendingRequestCount + 1);
  }

  async decrementBadge(): Promise<void> {
    await this.updateBadge(Math.max(0, this.pendingRequestCount - 1));
  }

  async resetBadge(): Promise<void> {
    await this.updateBadge(0);
  }

  getBadgeCount(): number {
    return this.pendingRequestCount;
  }

  // ─── Ripple ───────────────────────────────────────────────────────────────

  async showRipple(): Promise<void> {
    if (Platform.OS !== 'android') return;
    try {
      await DrawOverNativeModule.showBubbleRipple();
      logger.info('✅ Ripple triggered');
    } catch (error) {
      logger.error('❌ Error showing ripple:', error);
    }
  }
}

export default new FloatingBubbleService();