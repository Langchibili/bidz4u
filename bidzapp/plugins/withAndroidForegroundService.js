const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withAndroidForegroundService(config) {
  return withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults.manifest;

    // Add foreground service to application
    if (!androidManifest.application) {
      androidManifest.application = [{}];
    }

    const application = androidManifest.application[0];

    if (!application.service) {
      application.service = [];
    }

    // Add location foreground service
    application.service.push({
      $: {
        'android:name': '.LocationForegroundService',
        'android:foregroundServiceType': 'location',
        'android:enabled': 'true',
        'android:exported': 'false'
      }
    });

    return config;
  });
};