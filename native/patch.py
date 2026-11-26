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
perm = '<uses-permission android:name="android.permission.READ_CONTACTS" />'

if "<queries>" not in m:
    m = m.replace("<application", queries + "\n    <application", 1)
if "READ_CONTACTS" not in m:
    m = m.replace("<application", perm + "\n    <application", 1)

open(manifest, "w", encoding="utf-8").write(m)
print("Cloup native patch done")
