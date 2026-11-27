import os, re, shutil

APP_ID = os.environ["APP_ID"]
pkg_dir = os.path.join("android", "app", "src", "main", "java", *APP_ID.split("."))
os.makedirs(pkg_dir, exist_ok=True)

for name in ("AppScannerPlugin.java", "MainActivity.java"):
    shutil.copy(os.path.join("native", name), os.path.join(pkg_dir, name))

manifest = os.path.join("android", "app", "src", "main", "AndroidManifest.xml")
m = open(manifest, encoding="utf-8").read()

queries = (
    "<queries>\n"
    "        <intent>\n"
    '            <action android:name="android.intent.action.MAIN" />\n'
    '            <category android:name="android.intent.category.LAUNCHER" />\n'
    "        </intent>\n"
    "    </queries>"
)
perms = [
    ("READ_CONTACTS", '<uses-permission android:name="android.permission.READ_CONTACTS" />'),
    ("READ_MEDIA_IMAGES", '<uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />'),
    ("READ_MEDIA_VIDEO", '<uses-permission android:name="android.permission.READ_MEDIA_VIDEO" />'),
    ("READ_MEDIA_AUDIO", '<uses-permission android:name="android.permission.READ_MEDIA_AUDIO" />'),
    ("READ_EXTERNAL_STORAGE", '<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32" />'),
]

if "<queries>" not in m:
    m = m.replace("<application", queries + "\n    <application", 1)
for key, line in perms:
    if key not in m:
        m = m.replace("<application", line + "\n    <application", 1)

if 'android:scheme="cloup"' not in m:
    m = m.replace("</activity>", '<intent-filter><action android:name="android.intent.action.VIEW" /><category android:name="android.intent.category.DEFAULT" /><category android:name="android.intent.category.BROWSABLE" /><data android:scheme="cloup" android:host="auth" /></intent-filter></activity>', 1)
open(manifest, "w", encoding="utf-8").write(m)
print("Cloup native patch done")
