import os, re, glob, base64

PNG = base64.b64decode("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")

res = os.path.join("android", "app", "src", "main", "res")

try:
    for d in glob.glob(os.path.join(res, "mipmap-*")):
        if d.endswith("anydpi-v26"):
            for f in glob.glob(os.path.join(d, "*.xml")):
                os.remove(f)
        else:
            for n in ("ic_launcher.png", "ic_launcher_round.png", "ic_launcher_foreground.png"):
                open(os.path.join(d, n), "wb").write(PNG)
    print("Cloup icon done")
except Exception as e:
    print("Icon step skipped:", e)

try:
    os.makedirs(os.path.join(res, "drawable"), exist_ok=True)
    open(os.path.join(res, "drawable", "splash_cloup.xml"), "w").write(
        '<?xml version="1.0" encoding="utf-8"?>\n'
        '<layer-list xmlns:android="http://schemas.android.com/apk/res/android">\n'
        '    <item><color android:color="#FFFFFF"/></item>\n'
        '    <item android:gravity="center" android:width="240dp" android:height="240dp">\n'
        '        <bitmap android:src="@mipmap/ic_launcher" android:gravity="fill"/>\n'
        '    </item>\n'
        '</layer-list>\n'
    )
    for f in glob.glob(os.path.join(res, "values*", "*.xml")):
        s = open(f, encoding="utf-8").read()
        n = s.replace("@drawable/splash<", "@drawable/splash_cloup<")
        if n != s:
            open(f, "w", encoding="utf-8").write(n)
    print("Cloup splash done")
except Exception as e:
    print("Splash step skipped:", e)
