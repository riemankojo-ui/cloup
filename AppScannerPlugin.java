package com.cloup.app; // <-- change to your appId (see capacitor.config)

import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.drawable.Drawable;
import android.net.Uri;
import android.util.Base64;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayOutputStream;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Cloup AppScanner
 * Reads the apps shown in the phone's app drawer (name, package, icon)
 * and builds a Google Play link for each one. No APKs are touched.
 */
@CapacitorPlugin(name = "AppScanner")
public class AppScannerPlugin extends Plugin {

    /**
     * getInstalledApps({ iconSize?: number, withIcons?: boolean })
     * -> { count: number, apps: [{ name, pkg, playUrl, icon? }] }
     */
    @PluginMethod
    public void getInstalledApps(PluginCall call) {
        int iconSize = call.getInt("iconSize", 96);
        boolean withIcons = call.getBoolean("withIcons", true);

        try {
            PackageManager pm = getContext().getPackageManager();

            // Only apps with a launcher icon (same list as the app drawer)
            Intent launcher = new Intent(Intent.ACTION_MAIN, null);
            launcher.addCategory(Intent.CATEGORY_LAUNCHER);
            List<ResolveInfo> resolved = pm.queryIntentActivities(launcher, 0);

            // Sort A-Z by app name
            Collections.sort(resolved, new ResolveInfo.DisplayNameComparator(pm));

            String self = getContext().getPackageName();
            Set<String> seen = new HashSet<>();
            JSArray apps = new JSArray();

            for (ResolveInfo ri : resolved) {
                String pkg = ri.activityInfo.packageName;
                if (pkg.equals(self) || !seen.add(pkg)) continue; // skip Cloup + duplicates

                JSObject app = new JSObject();
                app.put("name", ri.loadLabel(pm).toString());
                app.put("pkg", pkg);
                app.put("playUrl", "https://play.google.com/store/apps/details?id=" + pkg);
                if (withIcons) {
                    app.put("icon", iconToDataUrl(ri.loadIcon(pm), iconSize));
                }
                apps.put(app);
            }

            JSObject result = new JSObject();
            result.put("count", apps.length());
            result.put("apps", apps);
            call.resolve(result);

        } catch (Exception e) {
            call.reject("Could not scan apps: " + e.getMessage());
        }
    }

    /**
     * openPlayStore({ pkg: string })
     * Opens the app's page in the Play Store app (falls back to the browser link).
     */
    @PluginMethod
    public void openPlayStore(PluginCall call) {
        String pkg = call.getString("pkg");
        if (pkg == null || pkg.isEmpty()) {
            call.reject("pkg is required");
            return;
        }

        try {
            Intent market = new Intent(Intent.ACTION_VIEW,
                    Uri.parse("market://details?id=" + Uri.encode(pkg)));
            market.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(market);
            call.resolve();
        } catch (Exception e) {
            try {
                Intent web = new Intent(Intent.ACTION_VIEW,
                        Uri.parse("https://play.google.com/store/apps/details?id=" + Uri.encode(pkg)));
                web.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(web);
                call.resolve();
            } catch (Exception e2) {
                call.reject("Could not open the Play Store: " + e2.getMessage());
            }
        }
    }

    // Draws any icon (normal or adaptive) into a small PNG data URL
    private String iconToDataUrl(Drawable drawable, int size) {
        Bitmap bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);
        drawable.setBounds(0, 0, size, size);
        drawable.draw(canvas);

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        bitmap.compress(Bitmap.CompressFormat.PNG, 100, out);
        bitmap.recycle();

        return "data:image/png;base64," + Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP);
    }
}
