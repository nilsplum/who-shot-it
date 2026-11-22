/*
 * The app's own native plugin "Phone" on Android: photo access, random previews to choose
 * from and the chosen photos for upload, the app's page in the phone's settings, and keeping
 * the screen on. JavaScript reaches it as `window.Capacitor.Plugins.Phone` (`web/js/phone.js`
 * documents every method; the iPhone twin is `ios/App/App/PhonePlugin.swift`).
 *
 * Invariants:
 * - Photos are read only on the phone. Previews and photos leave this file as JPEGs at most
 *   `side` / `maxSide` pixels on their longest side, re-encoded from their pixels only, so
 *   location and all other metadata never reach JavaScript, and so never the server.
 * - Previews are the phone's own thumbnails (quick, already upright), scaled to fit exactly
 *   like on the iPhone, because the text check is tuned to that size.
 * - Screenshots (anything in a Screenshots folder) are marked, so the game can leave them out.
 * - Access is "limited" when the player shared only some photos (Android 14 and newer,
 *   READ_MEDIA_VISUAL_USER_SELECTED); the game then draws from those.
 * - Slow work (decoding and shrinking) runs on the plugin's own threads, never on
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
import android.util.Size;
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
import java.util.Locale;
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

    private boolean readable() {
        String access = access();
        return "full".equals(access) || "limited".equals(access);
    }

    private static Uri collection() {
        return MediaStore.Images.Media.getContentUri(MediaStore.VOLUME_EXTERNAL);
    }

    /**
     * Up to `count` random photos not in `exclude`, as previews: `{ photos: [{ id, data,
     * screenshot }] }` (data: base64 JPEG). Fewer when the library has no more (or without
     * photo access); a photo whose thumbnail cannot be read is skipped.
     */
    @PluginMethod
    public void randomPhotos(PluginCall call) {
        if (!readable()) {
            JSObject none = new JSObject();
            none.put("photos", new JSArray());
            call.resolve(none);
            return;
        }
        int count = call.getInt("count", 10);
        JSArray list = call.getArray("exclude", new JSArray());
        Set<String> exclude = new HashSet<>();
        for (int i = 0; i < list.length(); i++) exclude.add(list.optString(i));
        int side = call.getInt("side", 480);
        double quality = call.getDouble("quality", 0.7);
        work.execute(() -> {
            try {
                call.resolve(previews(count, exclude, side, quality));
            } catch (Exception e) {
                call.reject("unreadable");
            }
        });
    }

    private JSObject previews(int count, Set<String> skip, int side, double quality) {
        ContentResolver resolver = getContext().getContentResolver();
        JSArray photos = new JSArray();
        String[] columns = { MediaStore.Images.Media._ID, MediaStore.Images.Media.RELATIVE_PATH };
        try (Cursor cursor = resolver.query(collection(), columns, null, null, null)) {
            while (cursor != null && cursor.getCount() > 0 && photos.length() < count) {
                long id = randomId(cursor, skip);
                if (id < 0) break;
                skip.add(String.valueOf(id));
                // randomId leaves the cursor on the picked row.
                String folder = cursor.getString(1);
                try {
                    Bitmap thumb = fit(resolver.loadThumbnail(ContentUris.withAppendedId(collection(), id), new Size(side, side), null), side);
                    JSObject photo = new JSObject();
                    photo.put("id", String.valueOf(id));
                    photo.put("data", jpeg(thumb, quality));
                    photo.put("screenshot", folder != null && folder.toLowerCase(Locale.ROOT).contains("screenshot"));
                    photos.put(photo);
                } catch (Exception unreadable) {
                    // A broken or vanished file: the next random one takes its place.
                }
            }
        }
        JSObject result = new JSObject();
        result.put("photos", photos);
        return result;
    }

    /** The photo `id` for upload: `{ id, data }` (base64 JPEG at most `maxSide`). Rejects when it cannot be read. */
    @PluginMethod
    public void photo(PluginCall call) {
        String id = call.getString("id");
        if (!readable() || id == null) {
            call.reject("unreadable");
            return;
        }
        int maxSide = call.getInt("maxSide", 1080);
        double quality = call.getDouble("quality", 0.75);
        work.execute(() -> {
            try {
                Uri uri = ContentUris.withAppendedId(collection(), Long.parseLong(id));
                JSObject photo = new JSObject();
                photo.put("id", id);
                photo.put("data", jpeg(shrink(getContext().getContentResolver(), uri, maxSide), quality));
                call.resolve(photo);
            } catch (Exception e) {
                call.reject("unreadable");
            }
        });
    }

    /** A fresh JPEG of the bitmap's pixels (no metadata), as base64; recycles the bitmap. */
    private static String jpeg(Bitmap bitmap, double quality) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        bitmap.compress(Bitmap.CompressFormat.JPEG, (int) Math.round(quality * 100), out);
        bitmap.recycle();
        return Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP);
    }

    /** Scaled to fit `side` on its longest side (thumbnails may come larger than asked for). */
    private static Bitmap fit(Bitmap bitmap, int side) {
        if (bitmap.getConfig() == Bitmap.Config.HARDWARE) {
            // Pixels in graphics memory cannot be scaled in software: copy them out first.
            Bitmap soft = bitmap.copy(Bitmap.Config.ARGB_8888, false);
            bitmap.recycle();
            bitmap = soft;
        }
        int w = bitmap.getWidth();
        int h = bitmap.getHeight();
        double scale = (double) side / Math.max(w, h);
        if (scale >= 1.0) return bitmap;
        Bitmap scaled = Bitmap.createScaledBitmap(bitmap, Math.max(1, (int) Math.round(w * scale)), Math.max(1, (int) Math.round(h * scale)), true);
        bitmap.recycle();
        return scaled;
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
        return fit(decoded, maxSide);
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
