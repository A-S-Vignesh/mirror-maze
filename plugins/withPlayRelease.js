const { AndroidConfig, withAndroidManifest, withAppBuildGradle } = require('expo/config-plugins');

/**
 * Release settings for Google Play that `expo prebuild` would otherwise lose, since android/ is regenerated.
 *
 * 1. expo-audio declares a lock-screen media service and a microphone recording service (foreground services). The game
 *    only plays sounds while it is open, so both are removed; their permissions are blocked in app.json.
 * 2. The app is declared a game (android:appCategory). For apps targeting Android 16, the system ignores the portrait lock
 *    on screens at least 600 dp wide (tablets, unfolded foldables) unless the app is a game, so without it the game
 *    would be stretched into landscape there.
 * 3. Release builds are signed with the upload key when its four Gradle properties are set (keep them out of the
 *    repository, in ~/.gradle/gradle.properties or as -P flags). Without them, release builds keep the debug key, which is
 *    fine for sideloaded test APKs but rejected by Play Console.
 */
const UNUSED_SERVICES = ['expo.modules.audio.service.AudioControlsService', 'expo.modules.audio.service.AudioRecordingService'];

const UPLOAD_KEY = `
        release {
            if (findProperty('MM_UPLOAD_STORE_FILE')) {
                storeFile file(findProperty('MM_UPLOAD_STORE_FILE'))
                storePassword findProperty('MM_UPLOAD_STORE_PASSWORD')
                keyAlias findProperty('MM_UPLOAD_KEY_ALIAS')
                keyPassword findProperty('MM_UPLOAD_KEY_PASSWORD')
            }
        }`;
const RELEASE_SIGNING = `signingConfig findProperty('MM_UPLOAD_STORE_FILE') ? signingConfigs.release : signingConfigs.debug`;

function withReleaseManifest(config) {
  return withAndroidManifest(config, c => {
    const manifest = c.modResults;
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);
    app.$['android:appCategory'] = 'game';
    manifest.manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    app.service = (app.service ?? []).filter(s => !UNUSED_SERVICES.includes(s.$['android:name']));
    for (const name of UNUSED_SERVICES) app.service.push({ $: { 'android:name': name, 'tools:node': 'remove' } });
    return c;
  });
}

function withUploadKey(config) {
  return withAppBuildGradle(config, c => {
    let gradle = c.modResults.contents;
    if (gradle.includes('MM_UPLOAD_STORE_FILE')) return c;
    const debugKey = /(signingConfigs \{\s*debug \{[^}]*\})/;
    const releaseUsesDebug = /(buildTypes \{[\s\S]*?release \{[\s\S]*?)signingConfig signingConfigs\.debug/;
    // A changed Expo template must fail loudly here, not quietly ship a debug-signed bundle.
    if (!debugKey.test(gradle) || !releaseUsesDebug.test(gradle)) throw new Error('withPlayRelease: app/build.gradle no longer matches the expected Expo template');
    gradle = gradle.replace(debugKey, `$1${UPLOAD_KEY}`).replace(releaseUsesDebug, `$1${RELEASE_SIGNING}`);
    c.modResults.contents = gradle;
    return c;
  });
}

module.exports = function withPlayRelease(config) {
  return withUploadKey(withReleaseManifest(config));
};
