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
// - Previews are quick: Photos hands over the nearest size it keeps ready (the usual choice
//   for photo grids), which is scaled here to fit exactly, like the Android twin does with
//   the phone's thumbnails; only the upload size is resized exactly by Photos.
// - Every photo of the library has the same chance: previews come from what the phone keeps
//   on the device, and a photo kept only in iCloud ("Optimize iPhone Storage", mostly older
//   photos) fetches its small preview from iCloud, at most `cloudMs` per photo and twice
//   that per batch, so one slow download never holds a batch for long. A photo that does
//   not arrive in time is only skipped in this batch. A chosen photo may download its
//   original for the upload; asked with `download: false` (the app's big versions ahead of
//   time), `photo` takes only what the phone stores and answers "unreadable" otherwise, so
//   preparing ahead never costs mobile data.
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
    /// screenshot }] }` (data: base64 JPEG). Fewer when the library has no more. A preview
    /// that is only in iCloud is fetched within `cloudMs` (and the batch's cloud budget).
    @objc func randomPhotos(_ call: CAPPluginCall) {
        guard readable else {
            call.resolve(["photos": []])
            return
        }
        let count = call.getInt("count") ?? 10
        let exclude = Set((call.getArray("exclude") ?? []).compactMap { $0 as? String })
        let side = CGFloat(call.getInt("side") ?? 480)
        let quality = CGFloat(call.getDouble("quality") ?? 0.7)
        let cloudSeconds = Double(call.getInt("cloudMs") ?? 4000) / 1000
        work.async {
            let options = PHFetchOptions()
            options.predicate = NSPredicate(format: "mediaType == %d", PHAssetMediaType.image.rawValue)
            // The fetch result is lazy: picking random positions stays cheap in big libraries.
            let assets = PHAsset.fetchAssets(with: options)
            var skip = exclude
            var photos: [[String: Any]] = []
            var cloudBudget = cloudSeconds * 2
            while photos.count < count, let asset = Self.pick(from: assets, skipping: skip) {
                skip.insert(asset.localIdentifier)
                var data = Self.jpeg(asset, side: side, quality: quality, download: false, quick: true)
                if data == nil && cloudBudget > 0 {
                    let started = Date()
                    data = Self.jpeg(asset, side: side, quality: quality, download: true, quick: true, within: min(cloudSeconds, cloudBudget))
                    cloudBudget -= Date().timeIntervalSince(started)
                }
                guard let data else { continue }
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
    /// its original from iCloud if needed (`download`, default true; false takes only what
    /// the phone stores). Rejects when it cannot be read.
    @objc func photo(_ call: CAPPluginCall) {
        guard readable, let id = call.getString("id") else {
            call.reject("unreadable")
            return
        }
        let maxSide = CGFloat(call.getInt("maxSide") ?? 1080)
        let quality = CGFloat(call.getDouble("quality") ?? 0.75)
        let download = call.getBool("download") ?? true
        work.async {
            guard let asset = PHAsset.fetchAssets(withLocalIdentifiers: [id], options: nil).firstObject,
                  let data = Self.jpeg(asset, side: maxSide, quality: quality, download: download) else {
                call.reject("unreadable")
                return
            }
            call.resolve(["id": id, "data": data.base64EncodedString()])
        }
    }

    /// The asset upright, at most `side` pixels on its longest side, as a fresh JPEG (pixels
    /// only). `quick` (the previews): Photos answers with the nearest size it keeps ready
    /// (`.fast`), scaled here to fit `side`; otherwise Photos resizes exactly (the upload
    /// size). Blocks the calling queue until the image is there (or nil). With `within`, it
    /// waits at most that many seconds and then cancels the request (a download that does
    /// not come); the request then runs asynchronously and Photos answers on another queue
    /// (never this one, so waiting here cannot block the answer).
    private static func jpeg(_ asset: PHAsset, side: CGFloat, quality: CGFloat, download: Bool, quick: Bool = false, within seconds: Double? = nil) -> Data? {
        let request = PHImageRequestOptions()
        request.isSynchronous = seconds == nil
        request.deliveryMode = .highQualityFormat
        request.resizeMode = quick ? .fast : .exact
        request.isNetworkAccessAllowed = download
        var image: UIImage?
        let arrived = DispatchSemaphore(value: 0)
        let id = PHImageManager.default().requestImage(
            for: asset, targetSize: CGSize(width: side, height: side),
            contentMode: .aspectFit, options: request
        ) { result, _ in
            image = result
            arrived.signal()
        }
        if let seconds, arrived.wait(timeout: .now() + seconds) == .timedOut {
            PHImageManager.default().cancelImageRequest(id)
            return nil
        }
        guard let image else { return nil }
        return (quick ? fit(image, side: side) : image).jpegData(compressionQuality: quality)
    }

    /// Scaled down to fit `side` pixels on its longest side (a quick answer may come a little
    /// larger than asked for), drawn upright and without any of the photo's data.
    private static func fit(_ image: UIImage, side: CGFloat) -> UIImage {
        let width = image.size.width * image.scale
        let height = image.size.height * image.scale
        let scale = side / max(width, height)
        if scale >= 1 { return image }
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        let size = CGSize(width: (width * scale).rounded(), height: (height * scale).rounded())
        return UIGraphicsImageRenderer(size: size, format: format).image { _ in
            image.draw(in: CGRect(origin: .zero, size: size))
        }
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
