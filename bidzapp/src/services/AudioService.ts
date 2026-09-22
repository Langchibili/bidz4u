import { createAudioPlayer, setAudioModeAsync, AudioPlayer, InterruptionMode } from 'expo-audio';
import { logger } from '../utils/logger';

const SOUND_SOURCES = {
  order_alert: require('../../assets/sounds/order_alert.wav'),
  waiter_call: require('../../assets/sounds/waiter_call.wav'),
};
type SoundType = keyof typeof SOUND_SOURCES;

class AudioService {
  private players: Map<string, AudioPlayer> = new Map();
  private isInitialized = false;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    await setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'doNotMix' as InterruptionMode });
    for (const [key, source] of Object.entries(SOUND_SOURCES)) {
      this.players.set(key, createAudioPlayer(source));
    }
    this.isInitialized = true;
  }

  async playAlert(soundType: SoundType): Promise<void> {
    if (!this.isInitialized) await this.initialize();
    const player = this.players.get(soundType);
    if (!player) return;
    if (player.playing) await Promise.resolve(player.pause());
    await player.seekTo(0);
    await player.play();
  }

  async stopAlert(soundType?: SoundType): Promise<void> {
    if (soundType) {
      const p = this.players.get(soundType);
      if (p?.playing) await Promise.resolve(p.pause());
    } else {
      for (const p of this.players.values()) if (p.playing) await Promise.resolve(p.pause());
    }
  }

  async cleanup(): Promise<void> {
    for (const p of this.players.values()) { if (p.playing) await Promise.resolve(p.pause()); (p as any).removeAllListeners(); }
    this.players.clear();
    this.isInitialized = false;
  }
}

export default new AudioService();