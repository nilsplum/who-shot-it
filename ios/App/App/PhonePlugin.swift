// The app's own native plugin "Phone" on iPhone: photo access, random previews to choose
// from and the chosen photos for upload, the app's page in Settings, and keeping the screen
// on. JavaScript reaches it as `window.Capacitor.Plugins.Phone` (`web/js/phone.js`
// documents every method; the Android twin is
// `android/app/src/main/java/com/hivedone/whoshotit/PhonePlugin.java`).
//
// Invariants:
// - Photos are read only on the phone. Previews and photos leave this file as JPEGs at
//   most `side` / `maxSide` pixels on their longest side, re-encoded from their pixels only,
//   so location and all other metadata never reach JavaScript, and so never the server.
// - Previews come from what the phone keeps on the device (never downloaded from iCloud),
//   so a batch of them is quick; only a chosen photo may download its original.
// - Hidden photos are never picked. Screenshots are marked, so the game can leave them out.
// - Without photo access nothing touches the library: that would make iOS ask on its own,
//   outside the app's "Continue" step.
// - Slow work runs on the plugin's own concurrent queue, never on Capacitor's serial plugin
//   queue or the main thread, so one slow photo never blocks the next call.

import Capacitor
import Photos
import UIKit

@objc(PhonePlugin)
public class PhonePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "PhonePlugin"
    public let jsName = "Phone"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "photoAccess", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestPhotoAccess", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "randomPhotos", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "photo", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "openSettings", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "keepAwake", returnType: CAPPluginReturnPromise),
    ]

    private let work = DispatchQueue(label: "com.hivedone.whoshotit.photos", qos: .userInitiated, attributes: .concurrent)

    /// The access names both platforms report: full, limited, ask (never asked) or denied.
    private func accessName(_ status: PHAuthorizationStatus) -> String {
        switch status {
        case .authorized: return "full"
        case .limited: return "limited"
        case .notDetermined: return "ask"
        default: return "denied"
        }
    }

    @objc func photoAccess(_ call: CAPPluginCall) {
        call.resolve(["access": accessName(PHPhotoLibrary.authorizationStatus(for: .readWrite))])
    }

    @objc func requestPhotoAccess(_ call: CAPPluginCall) {
        PHPhotoLibrary.requestAuthorization(for: .readWrite) { status in
            call.resolve(["access": self.accessName(status)])
        }
    }

    private var readable: Bool {
        let status = PHPhotoLibrary.authorizationStatus(for: .readWrite)
        return status == .authorized || status == .limited
    }

    /// Up to `count` random photos not in `exclude`, as previews: `{ photos: [{ id, data,
    /// screenshot }] }` (data: base64 JPEG). Fewer when the library has no more; a photo the
    /// phone keeps only in iCloud (no preview on the device) is skipped.
    @objc func randomPhotos(_ call: CAPPluginCall) {
        guard readable else {
            call.resolve(["photos": []])
            return
        }
        let count = call.getInt("count") ?? 10
        let exclude = Set((call.getArray("exclude") ?? []).compactMap { $0 as? String })
        let side = CGFloat(call.getInt("side") ?? 480)
        let quality = CGFloat(call.getDouble("quality") ?? 0.7)
        work.async {
            let options = PHFetchOptions()
            options.predicate = NSPredicate(format: "mediaType == %d", PHAssetMediaType.image.rawValue)
            // The fetch result is lazy: picking random positions stays cheap in big libraries.
            let assets = PHAsset.fetchAssets(with: options)
            var skip = exclude
            var photos: [[String: Any]] = []
            while photos.count < count, let asset = Self.pick(from: assets, skipping: skip) {
                skip.insert(asset.localIdentifier)
                guard let data = Self.jpeg(asset, side: side, quality: quality, download: false) else { continue }
                photos.append([
                    "id": asset.localIdentifier,
                    "data": data.base64EncodedString(),
                    "screenshot": asset.mediaSubtypes.contains(.photoScreenshot),
                ])
            }
            call.resolve(["photos": photos])
        }
    }

    /// The photo `id` for upload: `{ id, data }` (base64 JPEG at most `maxSide`), downloading
    /// its original from iCloud if needed. Rejects when it cannot be read.
    @objc func photo(_ call: CAPPluginCall) {
        guard readable, let id = call.getString("id") else {
            call.reject("unreadable")
            return
        }
        let maxSide = CGFloat(call.getInt("maxSide") ?? 1080)
        let quality = CGFloat(call.getDouble("quality") ?? 0.75)
        work.async {
            guard let asset = PHAsset.fetchAssets(withLocalIdentifiers: [id], options: nil).firstObject,
                  let data = Self.jpeg(asset, side: maxSide, quality: quality, download: true) else {
                call.reject("unreadable")
                return
            }
            call.resolve(["id": id, "data": data.base64EncodedString()])
        }
    }

    /// The asset upright, at most `side` pixels on its longest side, as a fresh JPEG (pixels
    /// only). Blocks the calling queue until the image is there (or nil).
    private static func jpeg(_ asset: PHAsset, side: CGFloat, quality: CGFloat, download: Bool) -> Data? {
        let request = PHImageRequestOptions()
        request.isSynchronous = true
        request.deliveryMode = .highQualityFormat
        request.resizeMode = .exact
        request.isNetworkAccessAllowed = download
        var image: UIImage?
        PHImageManager.default().requestImage(
            for: asset, targetSize: CGSize(width: side, height: side),
            contentMode: .aspectFit, options: request
        ) { result, _ in image = result }
        return image?.jpegData(compressionQuality: quality)
    }

    /// A few random tries first; when nearly everything is excluded, one pass from a random start.
    private static func pick(from assets: PHFetchResult<PHAsset>, skipping exclude: Set<String>) -> PHAsset? {
        let count = assets.count
        guard count > 0 else { return nil }
        for _ in 0..<min(count, 40) {
            let asset = assets.object(at: Int.random(in: 0..<count))
            if !exclude.contains(asset.localIdentifier) { return asset }
        }
        let start = Int.random(in: 0..<count)
        for offset in 0..<count {
            let asset = assets.object(at: (start + offset) % count)
            if !exclude.contains(asset.localIdentifier) { return asset }
        }
        return nil
    }

    @objc func openSettings(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            if let url = URL(string: UIApplication.openSettingsURLString) {
                UIApplication.shared.open(url)
            }
            call.resolve()
        }
    }

    @objc func keepAwake(_ call: CAPPluginCall) {
        let on = call.getBool("on") ?? false
        DispatchQueue.main.async {
            UIApplication.shared.isIdleTimerDisabled = on
            call.resolve()
        }
    }
}

/// The app's screen: Capacitor's web view controller, plus the app's own plugin.
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(PhonePlugin())
    }
}
