import { Capacitor } from '@capacitor/core';
import { AdMob, RewardAdPluginEvents, InterstitialAdPluginEvents } from '@capacitor-community/admob';

export type AdType = 'rewarded' | 'interstitial';

export interface AdRequest {
  type: AdType;
  placement: string;
  durationSeconds: number;
  resolve: (completed: boolean) => void;
}

export const ADMOB_CONFIG = {
  iosAppId: 'ca-app-pub-6225511243835633~5158246226',
  iosInterstitialId: 'ca-app-pub-6225511243835633/7405135612',
  iosRewardedId: 'ca-app-pub-6225511243835633/4482237618',
  androidAppId: 'ca-app-pub-6225511243835633~9807404848',
  androidInterstitialId: 'ca-app-pub-6225511243835633/8742890132',
  androidRewardedId: 'ca-app-pub-6225511243835633/6229900728',
};

type AdListener = (request: AdRequest | null) => void;

class AdService {
  private listener: AdListener | null = null;
  private levelsSinceLastInterstitial = 0;
  private initialized = false;

  public subscribe(listener: AdListener): () => void {
    this.listener = listener;
    return () => {
      this.listener = null;
    };
  }

  private async ensureInitialized(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) return false;
    if (this.initialized) return true;
    try {
      await AdMob.initialize({
        initializeForTesting: false,
      });
      await AdMob.requestTrackingAuthorization().catch(() => {});
      this.initialized = true;
      return true;
    } catch {
      return false;
    }
  }

  private showFallbackPreview(type: AdType, placement: string, durationSeconds: number): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.listener) {
        resolve(type === 'rewarded');
        return;
      }
      this.listener({
        type,
        placement,
        durationSeconds,
        resolve: (completed) => {
          this.listener?.(null);
          resolve(completed);
        },
      });
    });
  }

  /** Show a rewarded video ad (returns true if user watched to completion) */
  public async showRewardedAd(placement: string): Promise<boolean> {
    const isNative = await this.ensureInitialized();
    if (!isNative) {
      return this.showFallbackPreview('rewarded', placement, 4);
    }

    try {
      let earnedReward = false;
      const rewardHandle = await AdMob.addListener(RewardAdPluginEvents.Rewarded, () => {
        earnedReward = true;
      });

      const dismissPromise = new Promise<boolean>(async (resolve) => {
        const dismissHandle = await AdMob.addListener(RewardAdPluginEvents.Dismissed, () => {
          dismissHandle.remove();
          rewardHandle.remove();
          resolve(earnedReward);
        });
      });

      const isAndroid = Capacitor.getPlatform() === 'android';
      await AdMob.prepareRewardVideoAd({
        adId: isAndroid ? ADMOB_CONFIG.androidRewardedId : ADMOB_CONFIG.iosRewardedId,
        isTesting: false,
      });
      await AdMob.showRewardVideoAd();
      return await dismissPromise;
    } catch {
      // Fallback if new ad unit is still propagating (~1 hour) or offline
      return this.showFallbackPreview('rewarded', placement, 4);
    }
  }

  /** Show an interstitial ad every 3 cleared levels */
  public async maybeShowInterstitialOnLevelClear(clearedLevel: number): Promise<void> {
    this.levelsSinceLastInterstitial++;
    // Never show on Level 1-2; show every 3rd cleared level
    if (clearedLevel < 3 || this.levelsSinceLastInterstitial < 3) {
      return;
    }
    this.levelsSinceLastInterstitial = 0;

    const isNative = await this.ensureInitialized();
    if (!isNative) {
      await this.showFallbackPreview('interstitial', `After Level ${clearedLevel}`, 3);
      return;
    }

    try {
      const dismissPromise = new Promise<void>(async (resolve) => {
        const dismissHandle = await AdMob.addListener(InterstitialAdPluginEvents.Dismissed, () => {
          dismissHandle.remove();
          resolve();
        });
      });

      const isAndroid = Capacitor.getPlatform() === 'android';
      await AdMob.prepareInterstitial({
        adId: isAndroid ? ADMOB_CONFIG.androidInterstitialId : ADMOB_CONFIG.iosInterstitialId,
        isTesting: false,
      });
      await AdMob.showInterstitial();
      await dismissPromise;
    } catch {
      await this.showFallbackPreview('interstitial', `After Level ${clearedLevel}`, 3);
    }
  }
}

export const adService = new AdService();
