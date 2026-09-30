import ExpoModulesCore
import Security
import WidgetKit

// Bridge between the app and the ChrpWidget extension. Both read and write the
// same App Group defaults, so the keys below must match ChrpWidget/Shared.swift.
private let appGroup = "group.com.chrp.app"
private let configKey = "chrp.widget.config"
private let deviceKeyKey = "chrp.widget.deviceKey"
private let cacheKey = "chrp.widget.cache"

public class ChrpWidgetModule: Module {
  private var defaults: UserDefaults? { UserDefaults(suiteName: appGroup) }

  public func definition() -> ModuleDefinition {
    Name("ChrpWidget")

    // A random per-device key the widget presents to the widgetApi function.
    // Created once and kept in the App Group, so it survives app restarts.
    Function("getDeviceKey") { () -> String in
      if let existing = self.defaults?.string(forKey: deviceKeyKey), !existing.isEmpty {
        return existing
      }
      var bytes = [UInt8](repeating: 0, count: 32)
      let status = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
      let key: String
      if status == errSecSuccess {
        key = bytes.map { String(format: "%02x", $0) }.joined()
      } else {
        key = (UUID().uuidString + UUID().uuidString).replacingOccurrences(of: "-", with: "")
      }
      self.defaults?.set(key, forKey: deviceKeyKey)
      return key
    }

    Function("setConfig") { (json: String) in
      let previous = self.defaults?.string(forKey: configKey)
      self.defaults?.set(json, forKey: configKey)
      if previous != json {
        // Another player or team: whatever the widget cached is for someone else.
        self.defaults?.removeObject(forKey: cacheKey)
      }
      WidgetCenter.shared.reloadAllTimelines()
    }

    Function("clear") {
      self.defaults?.removeObject(forKey: configKey)
      self.defaults?.removeObject(forKey: cacheKey)
      WidgetCenter.shared.reloadAllTimelines()
    }

    Function("reload") {
      WidgetCenter.shared.reloadAllTimelines()
    }
  }
}
