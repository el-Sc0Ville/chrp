import UIKit
import UserNotifications
import UserNotificationsUI

class NotificationViewController: UIViewController, UNNotificationContentExtension {

    private let titleLabel = UILabel()
    private let bodyLabel  = UILabel()

    // #070B14 navy
    private let navyColor = UIColor(red: 7/255.0, green: 11/255.0, blue: 20/255.0, alpha: 1)
    private let subWhite  = UIColor(white: 1, alpha: 0.65)

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = navyColor
        setupUI()
    }

    func didReceive(_ notification: UNNotification) {
        titleLabel.text = notification.request.content.title
        bodyLabel.text  = notification.request.content.body
    }

    // Called when a system action button (IN / OUT / MAYBE) is tapped.
    // .dismissAndForwardAction dismisses the NCE and forwards the action identifier
    // to the app's UNUserNotificationCenterDelegate (App.tsx addNotificationResponseReceivedListener),
    // which writes the response to Firestore without bringing the app to the foreground.
    func didReceive(
        _ response: UNNotificationResponse,
        completionHandler completion: @escaping (UNNotificationContentExtensionResponseOption) -> Void
    ) {
        completion(.dismissAndForwardAction)
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

        [titleLabel, bodyLabel].forEach { view.addSubview($0) }

        NSLayoutConstraint.activate([
            titleLabel.topAnchor.constraint(equalTo: view.topAnchor, constant: 14),
            titleLabel.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
            titleLabel.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),

            bodyLabel.topAnchor.constraint(equalTo: titleLabel.bottomAnchor, constant: 4),
            bodyLabel.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
            bodyLabel.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),
            bodyLabel.bottomAnchor.constraint(lessThanOrEqualTo: view.bottomAnchor, constant: -14),
        ])
    }
}
