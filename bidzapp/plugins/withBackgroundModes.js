const { withInfoPlist } = require('@expo/config-plugins');

module.exports = function withBackgroundModes(config) {
  return withInfoPlist(config, (config) => {
    if (!config.modResults.UIBackgroundModes) {
      config.modResults.UIBackgroundModes = [];
    }

    const modes = ['location', 'fetch', 'remote-notification'];
    
    modes.forEach(mode => {
      if (!config.modResults.UIBackgroundModes.includes(mode)) {
        config.modResults.UIBackgroundModes.push(mode);
      }
    });

    // Enable background location indicator
    config.modResults.UIShowsBackgroundLocationIndicator = true;

    return config;
  })
}