'use strict';
/**
 * Expo config plugin — ChrpNotificationExtension
 *
 * Adds a UNNotificationContentExtension iOS target so the In/Out/Maybe
 * action buttons are visible immediately on the lock screen without
 * requiring a long-press.
 *
 * Usage in app.json:
 *   "plugins": [ ["./plugins/withNotificationExtension"] ]
 *
 * Build entirely via EAS Build (no local Xcode required).
 */

const {
  withXcodeProject,
  withDangerousMod,
  withEntitlementsPlist,
  withPlugins,
} = require('@expo/config-plugins');
const path = require('path');
const fs   = require('fs');
const os   = require('os');

// ─── Constants ────────────────────────────────────────────────────────────────

const EXTENSION_NAME  = 'ChrpNotificationExtension';
const APP_GROUP       = 'group.com.chrp.app';

// ─── Swift source ─────────────────────────────────────────────────────────────

const SWIFT_SOURCE = `\
import UIKit
import UserNotifications
import UserNotificationsUI

class NotificationViewController: UIViewController, UNNotificationContentExtension {

    private let titleLabel = UILabel()
    private let bodyLabel  = UILabel()
    private let buttonRow  = UIStackView()

    // #070B14 navy
    private let navyColor = UIColor(red: 7/255.0, green: 11/255.0, blue: 20/255.0, alpha: 1)
    // #2F6BFF signal blue
    private let blueColor = UIColor(red: 47/255.0, green: 107/255.0, blue: 255/255.0, alpha: 1)
    private let dimWhite  = UIColor(white: 1, alpha: 0.08)
    private let subWhite  = UIColor(white: 1, alpha: 0.65)

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = navyColor
        setupUI()
    }

    // Called when notification is delivered to the extension
    func didReceive(_ notification: UNNotification) {
        titleLabel.text = notification.request.content.title
        bodyLabel.text  = notification.request.content.body
    }

    // Called when a system action button (IN / OUT / MAYBE) is tapped
    func didReceive(
        _ response: UNNotificationResponse,
        completionHandler completion: @escaping (UNNotificationContentExtensionResponseOption) -> Void
    ) {
        highlight(actionId: response.actionIdentifier)
        // Dismiss without opening the app — App.tsx background handler
        // (addNotificationResponseReceivedListener) writes to Firestore.
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) {
            completion(.dismiss)
        }
    }

    // MARK: – Private

    private func setupUI() {
        titleLabel.font          = .systemFont(ofSize: 15, weight: .semibold)
        titleLabel.textColor     = .white
        titleLabel.numberOfLines = 1
        titleLabel.translatesAutoresizingMaskIntoConstraints = false

        bodyLabel.font          = .systemFont(ofSize: 13)
        bodyLabel.textColor     = subWhite
        bodyLabel.numberOfLines = 3
        bodyLabel.translatesAutoresizingMaskIntoConstraints = false

        buttonRow.axis         = .horizontal
        buttonRow.distribution = .fillEqually
        buttonRow.spacing      = 8
        buttonRow.translatesAutoresizingMaskIntoConstraints = false

        let actions: [(String, String)] = [
            ("IN",    "✅ In"),
            ("OUT",   "❌ Out"),
            ("MAYBE", "🟡 Maybe"),
        ]
        for (id, label) in actions {
            buttonRow.addArrangedSubview(makeButton(actionId: id, label: label))
        }

        [titleLabel, bodyLabel, buttonRow].forEach { view.addSubview($0) }

        NSLayoutConstraint.activate([
            titleLabel.topAnchor.constraint(equalTo: view.topAnchor, constant: 14),
            titleLabel.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
            titleLabel.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),

            bodyLabel.topAnchor.constraint(equalTo: titleLabel.bottomAnchor, constant: 4),
            bodyLabel.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
            bodyLabel.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),

            buttonRow.topAnchor.constraint(equalTo: bodyLabel.bottomAnchor, constant: 14),
            buttonRow.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
            buttonRow.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),
            buttonRow.bottomAnchor.constraint(equalTo: view.bottomAnchor, constant: -14),
            buttonRow.heightAnchor.constraint(equalToConstant: 44),
        ])
    }

    private func makeButton(actionId: String, label: String) -> UIButton {
        let btn = UIButton(type: .custom)
        btn.setTitle(label, for: .normal)
        btn.titleLabel?.font          = .systemFont(ofSize: 14, weight: .medium)
        btn.backgroundColor           = dimWhite
        btn.layer.cornerRadius        = 8
        btn.layer.borderWidth         = 0.5
        btn.layer.borderColor         = UIColor(white: 1, alpha: 0.15).cgColor
        btn.accessibilityIdentifier   = actionId
        btn.addTarget(self, action: #selector(buttonTapped(_:)), for: .touchUpInside)
        return btn
    }

    @objc private func buttonTapped(_ sender: UIButton) {
        guard let actionId = sender.accessibilityIdentifier else { return }
        highlight(actionId: actionId)
        // Pass the selected response back to the app via the default action.
        // App.tsx handles DEFAULT_ACTION_IDENTIFIER → navigates to EventDetail.
        extensionContext?.performNotificationDefaultAction()
    }

    private func highlight(actionId: String) {
        for case let btn as UIButton in buttonRow.arrangedSubviews {
            let active = btn.accessibilityIdentifier == actionId
            UIView.animate(withDuration: 0.15) {
                btn.backgroundColor = active ? self.blueColor : self.dimWhite
            }
        }
    }
}
`;

// ─── Info.plist ───────────────────────────────────────────────────────────────

const INFO_PLIST = `\
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDevelopmentRegion</key>
  <string>$(DEVELOPMENT_LANGUAGE)</string>
  <key>CFBundleDisplayName</key>
  <string>ChrpNotificationExtension</string>
  <key>CFBundleExecutable</key>
  <string>$(EXECUTABLE_NAME)</string>
  <key>CFBundleIdentifier</key>
  <string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>
  <key>CFBundleInfoDictionaryVersion</key>
  <string>6.0</string>
  <key>CFBundleName</key>
  <string>$(PRODUCT_NAME)</string>
  <key>CFBundlePackageType</key>
  <string>XPC!</string>
  <key>CFBundleShortVersionString</key>
  <string>$(MARKETING_VERSION)</string>
  <key>CFBundleVersion</key>
  <string>$(CURRENT_PROJECT_VERSION)</string>
  <key>NSExtension</key>
  <dict>
    <key>NSExtensionAttributes</key>
    <dict>
      <key>UNNotificationExtensionCategory</key>
      <string>AVAILABILITY_REQUEST</string>
      <key>UNNotificationExtensionDefaultContentHidden</key>
      <true/>
      <key>UNNotificationExtensionInitialContentSizeRatio</key>
      <real>0.5</real>
    </dict>
    <key>NSExtensionPrincipalClass</key>
    <string>$(PRODUCT_MODULE_NAME).NotificationViewController</string>
    <key>NSExtensionPointIdentifier</key>
    <string>com.apple.usernotifications.content-extension</string>
  </dict>
</dict>
</plist>
`;

// ─── Entitlements ─────────────────────────────────────────────────────────────

const extensionEntitlements = (appGroup) => `\
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>com.apple.security.application-groups</key>
  <array>
    <string>${appGroup}</string>
  </array>
</dict>
</plist>
`;

// ─── Step 1: Write source files via withDangerousMod ──────────────────────────

function withExtensionFiles(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const extDir = path.join(
        config.modRequest.projectRoot,
        'ios',
        EXTENSION_NAME,
        EXTENSION_NAME,
      );
      fs.mkdirSync(extDir, { recursive: true });

      fs.writeFileSync(
        path.join(extDir, 'NotificationViewController.swift'),
        SWIFT_SOURCE,
      );
      fs.writeFileSync(path.join(extDir, 'Info.plist'), INFO_PLIST);
      fs.writeFileSync(
        path.join(extDir, `${EXTENSION_NAME}.entitlements`),
        extensionEntitlements(APP_GROUP),
      );

      return config;
    },
  ]);
}

// ─── Step 2: Add target + configure Xcode project ─────────────────────────────

function withExtensionTarget(config) {
  return withXcodeProject(config, (config) => {
    const project    = config.modResults;
    const bundleId   = config.ios?.bundleIdentifier ?? 'com.chrp.app';
    const extBundleId = `${bundleId}.${EXTENSION_NAME}`;

    // ── Guard: only add once ────────────────────────────────────────────────
    const nativeTargets = project.pbxNativeTargetSection();
    const alreadyAdded  = Object.values(nativeTargets).some(
      (t) =>
        t &&
        typeof t === 'object' &&
        (t.name === EXTENSION_NAME || t.name === `"${EXTENSION_NAME}"`),
    );
    if (alreadyAdded) return config;

    // ── 1. Add the native target (app_extension) ───────────────────────────
    //   • Creates Debug/Release build configs for the extension
    //   • Adds a PBXCopyFilesBuildPhase (dstSubfolderSpec=13 / PlugIns) to the
    //     MAIN app target and embeds the .appex product there
    //   • Adds a PBXTargetDependency from main app → extension
    const extTarget = project.addTarget(
      EXTENSION_NAME,
      'app_extension',   // triggers PlugIns embed phase in xcode package
      EXTENSION_NAME,
      extBundleId,
    );

    // ── 2. Create a PBXGroup for the extension folder ──────────────────────
    const groupKey = project.pbxCreateGroup(EXTENSION_NAME, EXTENSION_NAME);

    // Add the new group as a child of the project's main group so it appears
    // in Xcode's file navigator.
    const mainGroupKey =
      project.getFirstProject().firstProject.mainGroup;
    const mainGroup = project.getPBXGroupByKey(mainGroupKey);
    if (mainGroup) {
      mainGroup.children.push({ value: groupKey, comment: EXTENSION_NAME });
    }

    // ── 3. Add a Sources build phase to the extension target ───────────────
    project.addBuildPhase(
      [],
      'PBXSourcesBuildPhase',
      'Sources',
      extTarget.uuid,
    );

    // ── 4. Add Swift source to the Sources phase ───────────────────────────
    project.addSourceFile(
      `${EXTENSION_NAME}/${EXTENSION_NAME}/NotificationViewController.swift`,
      { target: extTarget.uuid },
      groupKey,
    );

    // ── 5. Override / extend build settings ───────────────────────────────
    //   addTarget() pre-populates INFOPLIST_FILE as
    //   "ChrpNotificationExtension/ChrpNotificationExtension-Info.plist"
    //   We override it (and add Swift/deployment/signing settings) by iterating
    //   the two XCBuildConfiguration objects in the extension's config list.
    const configListId =
      extTarget.pbxNativeTarget.buildConfigurationList;
    const configSection = project.pbxXCBuildConfigurationSection();

    // Find the XCConfigurationList entry to get the two config UUIDs
    const configListSection = project.pbxXCConfigurationList();
    const configList        = configListSection[configListId];
    if (configList) {
      for (const entry of configList.buildConfigurations) {
        const cfg = configSection[entry.value];
        if (!cfg) continue;
        const s = cfg.buildSettings;

        s.SWIFT_VERSION                          = '5.0';
        s.IPHONEOS_DEPLOYMENT_TARGET             = '"16.0"';
        s.ALWAYS_EMBED_SWIFT_STANDARD_LIBRARIES  = 'NO';
        s.CODE_SIGN_STYLE                        = 'Manual';
        s.AUTOMATICALLY_MANAGE_SIGNING           = 'NO';
        s.DEVELOPMENT_TEAM                       = '9AR4YP352M';
        s.PRODUCT_BUNDLE_IDENTIFIER              = '"com.chrp.app.notificationextension"';
        s.CODE_SIGN_IDENTITY                     = '"iPhone Distribution"';
        s.PROVISIONING_PROFILE                   = '"61f85bda-ed28-4591-afaa-05566a2f5d17"';
        s.PROVISIONING_PROFILE_SPECIFIER         = '"ChrpNotificationExtension AdHoc"';
        // Override the plist path that addTarget() set incorrectly
        s.INFOPLIST_FILE = `"${EXTENSION_NAME}/${EXTENSION_NAME}/Info.plist"`;
        s.CODE_SIGN_ENTITLEMENTS = `"${EXTENSION_NAME}/${EXTENSION_NAME}/${EXTENSION_NAME}.entitlements"`;
        // Ensure MARKETING_VERSION / CURRENT_PROJECT_VERSION track the host app
        s.MARKETING_VERSION      = '"$(MARKETING_VERSION)"';
        s.CURRENT_PROJECT_VERSION = '"$(CURRENT_PROJECT_VERSION)"';
      }
    }

    // ── 6. Mark the embedded .appex for code-signing ──────────────────────
    //   EAS Build needs ATTRIBUTES = (CodeSignOnCopy, RemoveHeadersOnCopy)
    //   on the build-file that lives in the "Copy Files" embed phase.
    const buildFileSection = project.pbxBuildFileSection();
    for (const key of Object.keys(buildFileSection)) {
      if (key.endsWith('_comment')) continue;
      const comment = buildFileSection[`${key}_comment`];
      if (comment && comment.includes(`${EXTENSION_NAME}.appex`)) {
        buildFileSection[key].settings = {
          ATTRIBUTES: ['CodeSignOnCopy', 'RemoveHeadersOnCopy'],
        };
        break;
      }
    }

    return config;
  });
}

// ─── Step 3: Add App Group entitlement to the main app ────────────────────────

function withMainAppEntitlements(config) {
  return withEntitlementsPlist(config, (config) => {
    const entitlements = config.modResults;
    const key          = 'com.apple.security.application-groups';

    if (!Array.isArray(entitlements[key])) {
      entitlements[key] = [APP_GROUP];
    } else if (!entitlements[key].includes(APP_GROUP)) {
      entitlements[key].push(APP_GROUP);
    }

    return config;
  });
}

// ─── Step 4: Install provisioning profile from env var ───────────────────────
//
// Set EXTENSION_PROVISIONING_PROFILE to the base64-encoded contents of the
// ChrpNotificationExtension .mobileprovision file in the EAS Build secret store.
// When present the plugin:
//   1. Decodes and writes the profile to the standard macOS provisioning
//      profiles directory so Xcode can locate it during the cloud build.
//   2. Switches the extension target to Manual signing and sets
//      PROVISIONING_PROFILE_SPECIFIER to match the profile's Name field.

const PROFILE_NAME = 'ChrpNotificationExtension AdHoc';

function withProvisioningProfile(config) {
  // ── 4a. Write the .mobileprovision file (dangerous mod, runs first) ────────
  config = withDangerousMod(config, [
    'ios',
    async (config) => {
      const b64 = process.env.EXTENSION_PROVISIONING_PROFILE;
      if (!b64) return config; // no-op in local dev

      const profileDir = path.join(
        os.homedir(),
        'Library',
        'MobileDevice',
        'Provisioning Profiles',
      );
      fs.mkdirSync(profileDir, { recursive: true });

      const profileData = Buffer.from(b64, 'base64');

      // Write by name (human-readable fallback)
      const profilePath = path.join(
        profileDir,
        'ChrpNotificationExtension.mobileprovision',
      );
      fs.writeFileSync(profilePath, profileData);

      // Write by UUID — iOS/Xcode resolves profiles by UUID filename
      const uuidPath = path.join(
        profileDir,
        '61f85bda-ed28-4591-afaa-05566a2f5d17.mobileprovision',
      );
      fs.writeFileSync(uuidPath, profileData);

      console.log(`[withNotificationExtension] Installed provisioning profile → ${profilePath}`);
      console.log(`[withNotificationExtension] Installed provisioning profile → ${uuidPath}`);

      return config;
    },
  ]);

  // ── 4b. Switch extension target to Manual signing ─────────────────────────
  config = withXcodeProject(config, (config) => {
    if (!process.env.EXTENSION_PROVISIONING_PROFILE) return config;

    const project       = config.modResults;
    const configSection = project.pbxXCBuildConfigurationSection();
    const configListSection = project.pbxXCConfigurationList();

    // Find the extension target's configuration list
    const nativeTargets = project.pbxNativeTargetSection();
    const extEntry = Object.entries(nativeTargets).find(
      ([, t]) =>
        t &&
        typeof t === 'object' &&
        (t.name === EXTENSION_NAME || t.name === `"${EXTENSION_NAME}"`),
    );
    if (!extEntry) return config;

    const [, extTarget] = extEntry;
    const configList = configListSection[extTarget.buildConfigurationList];
    if (!configList) return config;

    for (const entry of configList.buildConfigurations) {
      const cfg = configSection[entry.value];
      if (!cfg) continue;
      cfg.buildSettings.CODE_SIGN_STYLE                = 'Manual';
      cfg.buildSettings.PROVISIONING_PROFILE_SPECIFIER = `"${PROFILE_NAME}"`;
    }

    return config;
  });

  return config;
}

// ─── Compose ──────────────────────────────────────────────────────────────────

module.exports = function withNotificationExtension(config) {
  return withPlugins(config, [
    withExtensionFiles,
    withExtensionTarget,
    withMainAppEntitlements,
    withProvisioningProfile,
  ]);
};
