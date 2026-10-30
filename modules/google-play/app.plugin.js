const { AndroidConfig, withAndroidManifest, withStringsXml } = require('expo/config-plugins');

const APP_ID = 'com.google.android.gms.games.APP_ID';
const PROJECT_ID = 'game_services_project_id';
const INIT_PROVIDER = 'com.google.android.gms.games.provider.PlayGamesInitProvider';

/**
 * Google Play Games Services needs the game's Play Console project id (Play Console > Play Games Services > Setup and
 * management > Configuration, the number under the game's name). Pass it as `gamesAppId`.
 *
 * The SDK's start-up provider is always removed: it would start Play Games (and its automatic sign-in) with the app,
 * before the age screen. The game starts it itself (PlayGamesModule.initialize) for players the age screen allows,
 * as Google Play's Families policy requires. Without an id the game hides Play Games features entirely.
 */
module.exports = function withGooglePlay(config, { gamesAppId = '' } = {}) {
  const id = String(gamesAppId).trim();
  if (id && !/^\d+$/.test(id)) throw new Error(`google-play: gamesAppId must be the numeric Play Console project id, got "${id}"`);

  config = withStringsXml(config, c => {
    c.modResults = id
      ? AndroidConfig.Strings.setStringItem([{ $: { name: PROJECT_ID, translatable: 'false' }, _: id }], c.modResults)
      : AndroidConfig.Strings.removeStringItem(PROJECT_ID, c.modResults);
    return c;
  });

  return withAndroidManifest(config, c => {
    const manifest = c.modResults;
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);
    if (id) AndroidConfig.Manifest.addMetaDataItemToMainApplication(app, APP_ID, `@string/${PROJECT_ID}`);
    else AndroidConfig.Manifest.removeMetaDataItemFromMainApplication(app, APP_ID);
    manifest.manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    app.provider = (app.provider ?? []).filter(p => p.$['android:name'] !== INIT_PROVIDER);
    app.provider.push({ $: { 'android:name': INIT_PROVIDER, 'android:authorities': '${applicationId}.playgamesinitprovider', 'tools:node': 'remove' } });
    return c;
  });
};
