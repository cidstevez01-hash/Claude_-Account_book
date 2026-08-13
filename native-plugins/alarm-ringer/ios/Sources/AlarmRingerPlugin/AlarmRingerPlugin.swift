import Foundation
import Capacitor
import UserNotifications

@objc(AlarmRingerPlugin)
public class AlarmRingerPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AlarmRingerPlugin"
    public let jsName = "AlarmRinger"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setAlarms", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stopRinging", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getRingingState", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "checkNotificationPermission", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestNotificationPermission", returnType: CAPPluginReturnPromise)
    ]

    private lazy var scheduler: AlarmScheduler = {
        let s = AlarmScheduler()
        s.onRingingChanged = { [weak self] ringing, alarmId, label in
            DispatchQueue.main.async {
                self?.notifyListeners("ringingChanged", data: [
                    "ringing": ringing,
                    "alarmId": alarmId as Any,
                    "label": label as Any
                ])
            }
        }
        return s
    }()

    override public func load() {
        _ = scheduler
    }

    @objc func setAlarms(_ call: CAPPluginCall) {
        do {
            let payload = try call.decode(SetAlarmsPayload.self)
            scheduler.setAlarms(payload.alarms, jpHolidays: payload.jpHolidays)
            call.resolve()
        } catch {
            call.reject("闹钟数据解析失败", nil, error)
        }
    }

    @objc func stopRinging(_ call: CAPPluginCall) {
        scheduler.stopRinging()
        call.resolve()
    }

    @objc func getRingingState(_ call: CAPPluginCall) {
        call.resolve(scheduler.ringingStateDict())
    }

    @objc func checkNotificationPermission(_ call: CAPPluginCall) {
        UNUserNotificationCenter.current().getNotificationSettings { settings in
            let granted = settings.authorizationStatus == .authorized || settings.authorizationStatus == .provisional
            DispatchQueue.main.async { call.resolve(["granted": granted]) }
        }
    }

    @objc func requestNotificationPermission(_ call: CAPPluginCall) {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { granted, _ in
            DispatchQueue.main.async { call.resolve(["granted": granted]) }
        }
    }
}
