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

  const Contacts = isNative ? Capacitor.registerPlugin('Contacts') : null;

  // Returns [{ name, phone }] sorted A-Z
  async function loadContacts() {
    if (!Contacts) {
      return [{ name: 'Sample contact', phone: '+000 000 000' }]; // browser preview
    }
    const perm = await Contacts.requestPermissions();
    if (perm.contacts !== 'granted') throw new Error('denied');
    const res = await Contacts.getContacts({ projection: { name: true, phones: true } });
    return res.contacts
      .map(c => ({
        name: (c.name && c.name.display) || 'No name',
        phone: (c.phones && c.phones[0] && c.phones[0].number) || ''
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  window.loadContacts = loadContacts;
  window.scanInstalledApps = scanInstalledApps;
  window.loadDeviceApps = loadDeviceApps;
  window.openPlayStoreNative = openPlayStoreNative;
})();
