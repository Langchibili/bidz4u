// OkraApp/plugins/withDrawOverPermission.js
const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withDrawOverPermission(config) {
  return withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults.manifest;

    // ── Permissions ──────────────────────────────────────────
    if (!androidManifest['uses-permission']) {
      androidManifest['uses-permission'] = [];
    }

    const permissionsToAdd = [
      'android.permission.SYSTEM_ALERT_WINDOW',
      'android.permission.FOREGROUND_SERVICE',
      'android.permission.FOREGROUND_SERVICE_LOCATION',
    ];

    permissionsToAdd.forEach((permission) => {
      const already = androidManifest['uses-permission'].some(
        (p) => p.$['android:name'] === permission
      );
      if (!already) {
        androidManifest['uses-permission'].push({
          $: { 'android:name': permission },
        });
      }
    });

    // ── Service declaration ───────────────────────────────────
    const application = androidManifest.application[0];

    if (!application.service) {
      application.service = [];
    }

    const serviceExists = application.service.some(
      (s) => s.$['android:name'] === 'expo.modules.drawover.FloatingBubbleService'
    );

    if (!serviceExists) {
      application.service.push({
        $: {
          'android:name': 'expo.modules.drawover.FloatingBubbleService',
          'android:enabled': 'true',
          'android:exported': 'false',
          'android:foregroundServiceType': 'location',
        },
      });
    }

    return config;
  });
};