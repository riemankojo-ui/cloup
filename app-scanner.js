// Cloup: JS bridge for the native AppScanner plugin.
// Put this file next to index.html (your www folder).
(function () {
  const isNative = !!(window.Capacitor &&
    typeof Capacitor.isNativePlatform === 'function' &&
    Capacitor.isNativePlatform());

  const AppScanner = isNative ? Capacitor.registerPlugin('AppScanner') : null;

  // Returns [{ name, pkg, playUrl, icon }] or null when not running on a phone
  async function scanInstalledApps(options) {
    if (!AppScanner) return null;
    const res = await AppScanner.getInstalledApps(
      Object.assign({ iconSize: 96, withIcons: true }, options)
    );
    return res.apps;
  }

  // Fills the Device Apps > Installed grid
  async function loadDeviceApps() {
    try {
      const apps = await scanInstalledApps();
      if (apps === null) {
        renderDeviceApps(PLACEHOLDER_APPS); // browser preview only
        return;
      }
      window.CLOUP_DEVICE_APPS = apps;      // reused later for the backup
      renderDeviceApps(apps);
    } catch (err) {
      console.error('App scan failed:', err);
      renderDeviceApps([]);
    }
  }

  // Opens the Play Store app on the phone
  function openPlayStoreNative(pkg) {
    if (AppScanner) return AppScanner.openPlayStore({ pkg: pkg });
    window.open(
      'https://play.google.com/store/apps/details?id=' + encodeURIComponent(pkg),
      '_blank'
    );
  }

  window.scanInstalledApps = scanInstalledApps;
  window.loadDeviceApps = loadDeviceApps;
  window.openPlayStoreNative = openPlayStoreNative;
})();
