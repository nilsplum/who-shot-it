/*
 * The app's own native plugin "Phone" on Android: photo access, one random photo at a
 * time, the app's page in the phone's settings, and keeping the screen on. JavaScript
 * reaches it as `window.Capacitor.Plugins.Phone` (`web/js/phone.js` documents every
 * method; the iPhone twin is `ios/App/App/PhonePlugin.swift`).
 *
 * Invariants:
 * - Photos are read only on the phone. A photo leaves this file as a JPEG at most
 *   `maxSide` pixels on its longest side, re-encoded from its pixels only, so location
 *   and all other metadata never reach JavaScript, and so never the server.
 * - Screenshots are never picked (they often show private messages or banking apps).
 * - Access is "limited" when the player shared only some photos (Android 14 and newer,
 *   READ_MEDIA_VISUAL_USER_SELECTED); the game then draws from those.
 * - Slow work (decoding and shrinking a photo) runs on the plugin's own threads, never on
 *   Capacitor's single plugin thread or the UI thread, so one slow photo never blocks
 *   the next call.
 */
package com.hivedone.whoshotit;

import android.Manifest;
import android.content.ContentResolver;
import android.content.ContentUris;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.graphics.ImageDecoder;
import android.net.Uri;
import android.os.Build;
import android.provider.MediaStore;
import android.provider.Settings;
import android.util.Base64;
import android.view.WindowManager;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.io.ByteArrayOutputStream;
import java.util.HashSet;
import java.util.Random;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(
    name = "Phone",
    permissions = {
        // Android 13 and newer: all photos, or (Android 14 and newer) the ones the player selected.
        @Permission(alias = PhonePlugin.PHOTOS, strings = { Manifest.permission.READ_MEDIA_IMAGES, Manifest.permission.READ_MEDIA_VISUAL_USER_SELECTED }),
        // Android 10 to 12.
        @Permission(alias = PhonePlugin.STORAGE, strings = { Manifest.permission.READ_EXTERNAL_STORAGE })
    }
)
public class PhonePlugin extends Plugin {

    static final String PHOTOS = "photos";
    static final String STORAGE = "storage";

    private final ExecutorService work = Executors.newCachedThreadPool();
    private final Random random = new Random();

    private String alias() {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU ? PHOTOS : STORAGE;
    }

    private boolean granted(String permission) {
        return ContextCompat.checkSelfPermission(getContext(), permission) == PackageManager.PERMISSION_GRANTED;
    }

    /** The access names both platforms report: full, limited, ask (may ask again) or denied. */
    private String access() {
        String full = Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU ? Manifest.permission.READ_MEDIA_IMAGES : Manifest.permission.READ_EXTERNAL_STORAGE;
        if (granted(full)) return "full";
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE && granted(Manifest.permission.READ_MEDIA_VISUAL_USER_SELECTED)) return "limited";
        return getPermissionState(alias()) == PermissionState.DENIED ? "denied" : "ask";
    }

    private void resolveAccess(PluginCall call) {
        JSObject result = new JSObject();
        result.put("access", access());
        call.resolve(result);
    }

    @PluginMethod
    public void photoAccess(PluginCall call) {
        resolveAccess(call);
    }

    @PluginMethod
    public void requestPhotoAccess(PluginCall call) {
        if (!"ask".equals(access())) {
            resolveAccess(call);
            return;
        }
        requestPermissionForAlias(alias(), call, "accessAnswered");
    }

    @PermissionCallback
    private void accessAnswered(PluginCall call) {
        resolveAccess(call);
    }

    /** One random photo not in `exclude`: `{ id, data }` (base64 JPEG), or `{}` when none is left (or without photo access). */
    @PluginMethod
    public void randomPhoto(PluginCall call) {
        String access = access();
        if (!"full".equals(access) && !"limited".equals(access)) {
            call.resolve(new JSObject());
            return;
        }
        JSArray list = call.getArray("exclude", new JSArray());
        Set<String> exclude = new HashSet<>();
        for (int i = 0; i < list.length(); i++) exclude.add(list.optString(i));
        int maxSide = call.getInt("maxSide", 1080);
        double quality = call.getDouble("quality", 0.75);
        work.execute(() -> {
            try {
                JSObject photo = pick(exclude, maxSide, quality);
                call.resolve(photo == null ? new JSObject() : photo);
            } catch (Exception e) {
                call.reject("unreadable");
            }
        });
    }

    private JSObject pick(Set<String> exclude, int maxSide, double quality) throws Exception {
        ContentResolver resolver = getContext().getContentResolver();
        Uri collection = MediaStore.Images.Media.getContentUri(MediaStore.VOLUME_EXTERNAL);
        String where = "(" + MediaStore.Images.Media.RELATIVE_PATH + " IS NULL OR " + MediaStore.Images.Media.RELATIVE_PATH + " NOT LIKE ?)";
        try (Cursor cursor = resolver.query(collection, new String[] { MediaStore.Images.Media._ID }, where, new String[] { "%screenshot%" }, null)) {
            if (cursor == null || cursor.getCount() == 0) return null;
            long id = randomId(cursor, exclude);
            if (id < 0) return null;
            Bitmap bitmap = shrink(resolver, ContentUris.withAppendedId(collection, id), maxSide);
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            bitmap.compress(Bitmap.CompressFormat.JPEG, (int) Math.round(quality * 100), out);
            bitmap.recycle();
            JSObject photo = new JSObject();
            photo.put("id", String.valueOf(id));
            photo.put("data", Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP));
            return photo;
        }
    }

    /** A few random tries first; when nearly everything is excluded, one pass from a random start. */
    private long randomId(Cursor cursor, Set<String> exclude) {
        int count = cursor.getCount();
        for (int i = 0; i < Math.min(count, 40); i++) {
            cursor.moveToPosition(random.nextInt(count));
            if (!exclude.contains(String.valueOf(cursor.getLong(0)))) return cursor.getLong(0);
        }
        int start = random.nextInt(count);
        for (int offset = 0; offset < count; offset++) {
            cursor.moveToPosition((start + offset) % count);
            if (!exclude.contains(String.valueOf(cursor.getLong(0)))) return cursor.getLong(0);
        }
        return -1;
    }

    /**
     * Decodes the photo upright (ImageDecoder applies the camera's orientation) and at most
     * `maxSide` on its longest side: first a cheap power-of-two subsample, then an exact
     * scale of the decoded pixels, which keeps the aspect ratio whatever the orientation.
     */
    private Bitmap shrink(ContentResolver resolver, Uri uri, int maxSide) throws Exception {
        Bitmap decoded = ImageDecoder.decodeBitmap(ImageDecoder.createSource(resolver, uri), (decoder, info, source) -> {
            decoder.setAllocator(ImageDecoder.ALLOCATOR_SOFTWARE);
            int longest = Math.max(info.getSize().getWidth(), info.getSize().getHeight());
            int sample = 1;
            while (longest / (sample * 2) >= maxSide) sample *= 2;
            decoder.setTargetSampleSize(sample);
        });
        int w = decoded.getWidth();
        int h = decoded.getHeight();
        double scale = Math.min(1.0, (double) maxSide / Math.max(w, h));
        if (scale >= 1.0) return decoded;
        Bitmap scaled = Bitmap.createScaledBitmap(decoded, Math.max(1, (int) Math.round(w * scale)), Math.max(1, (int) Math.round(h * scale)), true);
        decoded.recycle();
        return scaled;
    }

    @PluginMethod
    public void openSettings(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", getContext().getPackageName(), null));
        getActivity().startActivity(intent);
        call.resolve();
    }

    @PluginMethod
    public void keepAwake(PluginCall call) {
        boolean on = call.getBoolean("on", false);
        getActivity().runOnUiThread(() -> {
            if (on) getActivity().getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            else getActivity().getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            call.resolve();
        });
    }
}
