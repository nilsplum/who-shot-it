// The app's own native plugin "Phone" on iPhone: photo access, one random photo at a
// time, the app's page in Settings, and keeping the screen on. JavaScript reaches it as
// `window.Capacitor.Plugins.Phone` (`web/js/phone.js` documents every method; the
// Android twin is `android/app/src/main/java/com/hivedone/whoshotit/PhonePlugin.java`).
//
// Invariants:
// - Photos are read only on the phone. A photo leaves this file as a JPEG at most
//   `maxSide` pixels on its longest side, re-encoded from its pixels only, so location
//   and all other metadata never reach JavaScript, and so never the server.
// - Screenshots and hidden photos are never picked (screenshots often show private
//   messages or banking apps).
// - Slow work (shrinking a photo, possibly downloading its original from iCloud) runs on
//   the plugin's own concurrent queue, never on Capacitor's serial plugin queue or the
//   main thread, so one slow photo never blocks the next call.

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
        CAPPluginMethod(name: "randomPhoto", returnType: CAPPluginReturnPromise),
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

    /// One random photo not in `exclude`: `{ id, data }` (base64 JPEG), or `{}` when none is
    /// left. Without photo access it answers `{}` at once: touching the library would make
    /// iOS ask on its own, outside the app's "Continue" step.
    @objc func randomPhoto(_ call: CAPPluginCall) {
        let status = PHPhotoLibrary.authorizationStatus(for: .readWrite)
        guard status == .authorized || status == .limited else {
            call.resolve([:])
            return
        }
        let exclude = Set((call.getArray("exclude") ?? []).compactMap { $0 as? String })
        let maxSide = CGFloat(call.getInt("maxSide") ?? 1080)
        let quality = CGFloat(call.getDouble("quality") ?? 0.75)
        work.async {
            let options = PHFetchOptions()
            options.predicate = NSPredicate(
                format: "mediaType == %d AND (mediaSubtypes & %d) == 0",
                PHAssetMediaType.image.rawValue, PHAssetMediaSubtype.photoScreenshot.rawValue)
            // The fetch result is lazy: picking random positions stays cheap in big libraries.
            let assets = PHAsset.fetchAssets(with: options)
            guard let asset = Self.pick(from: assets, skipping: exclude) else {
                call.resolve([:])
                return
            }
            let request = PHImageRequestOptions()
            request.isSynchronous = true
            request.deliveryMode = .highQualityFormat
            request.resizeMode = .exact
            request.isNetworkAccessAllowed = true
            var image: UIImage?
            PHImageManager.default().requestImage(
                for: asset, targetSize: CGSize(width: maxSide, height: maxSide),
                contentMode: .aspectFit, options: request
            ) { result, _ in image = result }
            guard let data = image?.jpegData(compressionQuality: quality) else {
                call.reject("unreadable")
                return
            }
            call.resolve(["id": asset.localIdentifier, "data": data.base64EncodedString()])
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
