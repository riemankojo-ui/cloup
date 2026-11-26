package com.cloup.app;

import android.Manifest;
import android.app.Activity;
import android.content.ClipData;
import android.content.ContentUris;
import android.os.Build;
import android.provider.MediaStore;
import android.os.Environment;
import android.os.StatFs;
import android.provider.OpenableColumns;
import android.content.Intent;
import android.database.Cursor;
import android.provider.ContactsContract;
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
import androidx.activity.result.ActivityResult;
import com.getcapacitor.PermissionState;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayOutputStream;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Cloup AppScanner
 * Reads the apps shown in the phone's app drawer (name, package, icon)
 * and builds a Google Play link for each one. No APKs are touched.
 */
@CapacitorPlugin(
    name = "AppScanner",
    permissions = {
        @Permission(strings = { Manifest.permission.READ_CONTACTS }, alias = "contacts"),
        @Permission(strings = {
            "android.permission.READ_MEDIA_IMAGES",
            "android.permission.READ_MEDIA_VIDEO",
            "android.permission.READ_MEDIA_AUDIO"
        }, alias = "mediaNew"),
        @Permission(strings = { Manifest.permission.READ_EXTERNAL_STORAGE }, alias = "mediaOld")
    }
)
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

    @PluginMethod
    public void getContacts(PluginCall call) {
        if (getPermissionState("contacts") != PermissionState.GRANTED) {
            requestPermissionForAlias("contacts", call, "contactsPermsCallback");
        } else {
            readContacts(call);
        }
    }

    @PermissionCallback
    private void contactsPermsCallback(PluginCall call) {
        if (getPermissionState("contacts") == PermissionState.GRANTED) {
            readContacts(call);
        } else {
            call.reject("denied");
        }
    }

    private void readContacts(PluginCall call) {
        try {
            JSArray list = new JSArray();
            Set<String> seen = new HashSet<>();
            Cursor c = getContext().getContentResolver().query(
                ContactsContract.CommonDataKinds.Phone.CONTENT_URI,
                new String[] {
                    ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME,
                    ContactsContract.CommonDataKinds.Phone.NUMBER
                },
                null, null,
                ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME + " COLLATE NOCASE ASC"
            );
            if (c != null) {
                try {
                    while (c.moveToNext()) {
                        String name = c.getString(0);
                        String phone = c.getString(1);
                        if (name == null) name = "No name";
                        if (phone == null) phone = "";
                        if (!seen.add(name + "|" + phone.replaceAll("\\s", ""))) continue;
                        JSObject o = new JSObject();
                        o.put("name", name);
                        o.put("phone", phone);
                        list.put(o);
                    }
                } finally {
                    c.close();
                }
            }
            JSObject result = new JSObject();
            result.put("count", list.length());
            result.put("contacts", list);
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Could not read contacts: " + e.getMessage());
        }
    }

    @PluginMethod
    public void getStorageInfo(PluginCall call) {
        try {
            StatFs s = new StatFs(Environment.getDataDirectory().getPath());
            long total = s.getTotalBytes();
            long free = s.getAvailableBytes();
            JSObject o = new JSObject();
            o.put("total", total);
            o.put("free", free);
            o.put("used", total - free);
            call.resolve(o);
        } catch (Exception e) {
            call.reject("Could not read storage: " + e.getMessage());
        }
    }

    @PluginMethod
    public void pickFiles(PluginCall call) {
        Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        i.addCategory(Intent.CATEGORY_OPENABLE);
        i.setType("*/*");
        i.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
        startActivityForResult(call, i, "pickFilesResult");
    }

    @ActivityCallback
    private void pickFilesResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        try {
            JSArray files = new JSArray();
            Intent data = result.getData();
            if (result.getResultCode() == Activity.RESULT_OK && data != null) {
                List<Uri> uris = new ArrayList<>();
                ClipData cd = data.getClipData();
                if (cd != null) {
                    for (int k = 0; k < cd.getItemCount(); k++) uris.add(cd.getItemAt(k).getUri());
                } else if (data.getData() != null) {
                    uris.add(data.getData());
                }
                for (Uri u : uris) {
                    String name = "File";
                    long size = 0;
                    Cursor c = getContext().getContentResolver().query(u, null, null, null, null);
                    if (c != null) {
                        try {
                            if (c.moveToFirst()) {
                                int ni = c.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                                int si = c.getColumnIndex(OpenableColumns.SIZE);
                                if (ni >= 0 && !c.isNull(ni)) name = c.getString(ni);
                                if (si >= 0 && !c.isNull(si)) size = c.getLong(si);
                            }
                        } finally {
                            c.close();
                        }
                    }
                    JSObject o = new JSObject();
                    o.put("name", name);
                    o.put("size", size);
                    o.put("uri", u.toString());
                    files.put(o);
                }
            }
            JSObject r = new JSObject();
            r.put("count", files.length());
            r.put("files", files);
            call.resolve(r);
        } catch (Exception e) {
            call.reject("Could not read files: " + e.getMessage());
        }
    }

    private String mediaAlias() {
        return Build.VERSION.SDK_INT >= 33 ? "mediaNew" : "mediaOld";
    }

    @PluginMethod
    public void getMediaFiles(PluginCall call) {
        if (getPermissionState(mediaAlias()) != PermissionState.GRANTED) {
            requestPermissionForAlias(mediaAlias(), call, "mediaPermsCallback");
        } else {
            readMedia(call);
        }
    }

    @PermissionCallback
    private void mediaPermsCallback(PluginCall call) {
        if (getPermissionState(mediaAlias()) == PermissionState.GRANTED) {
            readMedia(call);
        } else {
            call.reject("denied");
        }
    }

    private void readMedia(PluginCall call) {
        try {
            int limit = call.getInt("limit", 300);
            Uri base = MediaStore.Files.getContentUri("external");
            String[] proj = {
                MediaStore.Files.FileColumns._ID,
                MediaStore.Files.FileColumns.DISPLAY_NAME,
                MediaStore.Files.FileColumns.SIZE,
                MediaStore.Files.FileColumns.MEDIA_TYPE
            };
            String sel = MediaStore.Files.FileColumns.MEDIA_TYPE + " IN (1,2,3)";
            Cursor c = getContext().getContentResolver().query(
                base, proj, sel, null, MediaStore.Files.FileColumns.DATE_ADDED + " DESC"
            );
            JSArray files = new JSArray();
            long total = 0;
            int count = 0;
            if (c != null) {
                try {
                    while (c.moveToNext()) {
                        long size = c.isNull(2) ? 0 : c.getLong(2);
                        total += size;
                        count++;
                        if (files.length() < limit) {
                            int t = c.getInt(3);
                            JSObject o = new JSObject();
                            o.put("name", c.isNull(1) ? "File" : c.getString(1));
                            o.put("size", size);
                            o.put("type", t == 1 ? "image" : (t == 2 ? "audio" : "video"));
                            o.put("uri", ContentUris.withAppendedId(base, c.getLong(0)).toString());
                            files.put(o);
                        }
                    }
                } finally {
                    c.close();
                }
            }
            JSObject r = new JSObject();
            r.put("count", count);
            r.put("totalSize", total);
            r.put("files", files);
            call.resolve(r);
        } catch (Exception e) {
            call.reject("Could not read files: " + e.getMessage());
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
