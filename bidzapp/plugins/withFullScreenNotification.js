const { withAndroidManifest } = require('@expo/config-plugins');

function withFullScreenNotification(config) {
  return withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults.manifest;

    // Ensure application exists
    if (!androidManifest.application) {
      androidManifest.application = [{}];
    }

    const application = androidManifest.application[0];

    // Add full screen intent permission
    if (!androidManifest['uses-permission']) {
      androidManifest['uses-permission'] = [];
    }

    const hasFullScreenPermission = androidManifest['uses-permission'].some(
      (perm) => perm.$['android:name'] === 'android.permission.USE_FULL_SCREEN_INTENT'
    );

    if (!hasFullScreenPermission) {
      androidManifest['uses-permission'].push({
        $: { 'android:name': 'android.permission.USE_FULL_SCREEN_INTENT' },
      });
    }

    // Add activity for full screen intent
    if (!application.activity) {
      application.activity = [];
    }

    const hasFullScreenActivity = application.activity.some(
      (activity) => activity.$['android:name'] === '.RideRequestActivity'
    );

    if (!hasFullScreenActivity) {
      application.activity.push({
        $: {
          'android:name': '.RideRequestActivity',
          'android:exported': 'false',
          'android:launchMode': 'singleInstance',
          'android:showWhenLocked': 'true',
          'android:turnScreenOn': 'true',
          'android:excludeFromRecents': 'true',
        },
      });
    }

    return config;
  });
}

module.exports = withFullScreenNotification;