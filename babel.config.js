// babel-preset-expo adds the react-native-worklets plugin when Reanimated is
// installed. That plugin has to stay inside the preset — listing it again
// runs it twice and breaks the bundle. Native builds use this same config.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
  };
};
