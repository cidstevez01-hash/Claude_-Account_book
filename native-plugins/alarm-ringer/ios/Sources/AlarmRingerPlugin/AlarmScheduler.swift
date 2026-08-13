import Foundation
import UIKit
import AVFoundation
import AudioToolbox
import UserNotifications

// 持续响铃的核心机制:iOS允许App声明UIBackgroundModes=audio、只要保持一个AVAudioPlayer
// 在后台不间断播放,进程就不会被系统挂起,定时器能照常跑——这是Alarmy等三方闹钟App的通用做法。
// 具体分两段:
// 1. 保活循环:App进后台且还有启用中的闹钟时,循环播放一段自己合成的近乎无声的音频(不占带宽、
//    不需要打包资源文件),仅用来维持进程活跃、让下面的轮询定时器能继续按时触发。
// 2. 真正响铃:轮询定时器每15秒检查一次当前时间是否命中某个闹钟,命中就切换成用户设置的铃声
//    (或者内置的合成蜂鸣音兜底)在AVAudioSession .playback分类下循环播放——这个分类的关键
//    作用是就算手机侧边静音键打开也照样出声,这对"闹钟"这个场景是必须的。
// 另外调用UNUserNotificationCenter排了一批兜底的本地通知(不是主要机制,只是万一后台音频这套
// 因为极端情况——比如手机长期不重开App导致系统在内存紧张时把进程整个杀掉——失效时的兜底)。
final class AlarmScheduler: NSObject {
    static let notificationIdPrefix = "alarmringer_"
    private let defaults = UserDefaults.standard
    private let alarmsKey = "alarm_ringer_alarms_v1"
    private let holidaysKey = "alarm_ringer_holidays_v1"

    private(set) var alarms: [AlarmDef] = []
    private var jpHolidays: Set<String> = []

    private var pollTimer: Timer?
    private var vibrateTimer: Timer?
    private var keepAlivePlayer: AVAudioPlayer?
    private var ringPlayer: AVAudioPlayer?

    private(set) var isRinging = false
    private(set) var currentRingingAlarm: AlarmDef?

    private var lastFiredKeys: Set<String> = []
    private var lastFiredCheckYmd: String = ""

    // ringing状态变化时回调给插件层,再由插件层notifyListeners到JS
    var onRingingChanged: ((Bool, String?, String?) -> Void)?

    override init() {
        super.init()
        loadPersisted()
        UNUserNotificationCenter.current().delegate = self
        NotificationCenter.default.addObserver(self, selector: #selector(appDidEnterBackground), name: UIApplication.didEnterBackgroundNotification, object: nil)
        NotificationCenter.default.addObserver(self, selector: #selector(appDidBecomeActive), name: UIApplication.didBecomeActiveNotification, object: nil)
        if !alarms.isEmpty { startPollingTimer() }
    }

    // MARK: - 对外接口

    func setAlarms(_ newAlarms: [AlarmDef], jpHolidays: [String]) {
        self.alarms = newAlarms
        self.jpHolidays = Set(jpHolidays)
        persist()
        rescheduleFallbackNotifications()
        if newAlarms.isEmpty {
            stopPollingTimer()
            stopKeepAliveLoop()
        } else {
            startPollingTimer()
            if UIApplication.shared.applicationState != .active {
                startKeepAliveLoop()
            }
        }
    }

    func stopRinging() {
        guard isRinging else { return }
        isRinging = false
        ringPlayer?.stop()
        ringPlayer = nil
        stopVibrateTimer()
        currentRingingAlarm = nil
        onRingingChanged?(false, nil, nil)
        if !alarms.isEmpty {
            if UIApplication.shared.applicationState != .active {
                startKeepAliveLoop()
            }
        } else {
            stopPollingTimer()
        }
    }

    func ringingStateDict() -> [String: Any] {
        if isRinging, let a = currentRingingAlarm {
            return ["ringing": true, "alarmId": a.id, "label": a.label]
        }
        return ["ringing": false]
    }

    // MARK: - App生命周期

    @objc private func appDidEnterBackground() {
        guard !alarms.isEmpty else { return }
        startKeepAliveLoop()
    }

    @objc private func appDidBecomeActive() {
        if !isRinging { stopKeepAliveLoop() }
        if !alarms.isEmpty {
            startPollingTimer()
            rescheduleFallbackNotifications()
        }
    }

    // MARK: - 轮询触发检查

    private func startPollingTimer() {
        pollTimer?.invalidate()
        let timer = Timer(timeInterval: 15.0, repeats: true) { [weak self] _ in
            self?.checkForTrigger()
        }
        RunLoop.main.add(timer, forMode: .common)
        pollTimer = timer
        checkForTrigger()
    }

    private func stopPollingTimer() {
        pollTimer?.invalidate()
        pollTimer = nil
    }

    private func checkForTrigger() {
        guard !isRinging else { return }
        let now = Date()
        let cal = Calendar.current
        let todayYmd = AlarmScheduler.formatYMD(now)
        if todayYmd != lastFiredCheckYmd {
            lastFiredCheckYmd = todayYmd
            lastFiredKeys.removeAll()
        }
        for alarm in alarms {
            guard let (h, m) = AlarmScheduler.parseTime(alarm.time) else { continue }
            var dc = cal.dateComponents([.year, .month, .day], from: now)
            dc.hour = h
            dc.minute = m
            dc.second = 0
            guard let candidate = cal.date(from: dc) else { continue }
            let delta = now.timeIntervalSince(candidate)
            guard delta >= 0 && delta < 20 else { continue }
            let fireKey = alarm.id + "_" + todayYmd
            guard !lastFiredKeys.contains(fireKey) else { continue }

            var matchesToday = false
            if alarm.repeatType == "once" {
                matchesToday = (alarm.onceDate == todayYmd)
            } else if alarm.repeatType == "weekly" {
                let wd = cal.component(.weekday, from: now) // Sun=1...Sat=7
                let jsWd = (wd == 1) ? 7 : wd - 1 // 转成Mon=1...Sun=7,跟JS这边的约定一致
                if let weekdays = alarm.weekdays, weekdays.contains(jsWd) {
                    matchesToday = !(alarm.skipJpHolidays && jpHolidays.contains(todayYmd))
                }
            }
            guard matchesToday else { continue }

            lastFiredKeys.insert(fireKey)
            startRinging(alarm: alarm)
            break // 一次只响一个,够用了
        }
    }

    // MARK: - 响铃/震动

    private func startRinging(alarm: AlarmDef) {
        isRinging = true
        currentRingingAlarm = alarm
        stopKeepAliveLoop()
        playRealAlarmSound(uri: alarm.soundUri)
        if alarm.vibrate { startVibrateTimer() }
        onRingingChanged?(true, alarm.id, alarm.label)
    }

    private func playRealAlarmSound(uri: String?) {
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.playback, mode: .default, options: [])
            try session.setActive(true)
            if let uriStr = uri, let url = URL(string: uriStr), FileManager.default.fileExists(atPath: url.path) {
                ringPlayer = try AVAudioPlayer(contentsOf: url)
            } else {
                ringPlayer = try AVAudioPlayer(data: AlarmScheduler.makeBeepWavData())
            }
            ringPlayer?.numberOfLoops = -1
            ringPlayer?.volume = 1.0
            ringPlayer?.prepareToPlay()
            ringPlayer?.play()
        } catch {
            print("AlarmRinger: 播放响铃失败 \(error)")
        }
    }

    private func startVibrateTimer() {
        stopVibrateTimer()
        AudioServicesPlaySystemSound(kSystemSoundID_Vibrate)
        let timer = Timer(timeInterval: 1.3, repeats: true) { _ in
            AudioServicesPlaySystemSound(kSystemSoundID_Vibrate)
        }
        RunLoop.main.add(timer, forMode: .common)
        vibrateTimer = timer
    }

    private func stopVibrateTimer() {
        vibrateTimer?.invalidate()
        vibrateTimer = nil
    }

    // MARK: - 保活循环(仅后台需要)

    private func startKeepAliveLoop() {
        guard keepAlivePlayer == nil, !isRinging else { return }
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.playback, mode: .default, options: [])
            try session.setActive(true)
            let data = AlarmScheduler.makeSilentWavData(durationSeconds: 1.0)
            let player = try AVAudioPlayer(data: data)
            player.numberOfLoops = -1
            player.volume = 0.01
            player.prepareToPlay()
            player.play()
            keepAlivePlayer = player
        } catch {
            print("AlarmRinger: 保活音频启动失败 \(error)")
        }
        startPollingTimer()
    }

    private func stopKeepAliveLoop() {
        keepAlivePlayer?.stop()
        keepAlivePlayer = nil
    }

    // MARK: - 本地通知兜底
    //
    // 之前这里每次occurrence只排一条通知,系统一条通知只响一声、震一下就完事,如果后台保活
    // 循环因为App被用户手动划掉/系统内存紧张整个杀掉而失效,用户体验就是"来了条通知要点进去
    // 才有反应",不是"闹钟响了"。改成给每个闹钟最近的下一次触发排一串密集通知(隔几秒一条,
    // 连续响约1分钟),模拟持续响铃/震动的效果——静音模式下声音会被系统吞掉,但震动不受静音键
    // 影响,照样能连续震醒人,不需要打开App。iOS本身有"最多64条待发通知"的硬限制,预算按"每个
    // 闹钟的下一次触发优先给足密集通知,更靠后的几次触发退化成单条兜底"来分配。
    private static let maxPendingNotifications = 64
    private static let burstNotificationCount = 12
    private static let burstIntervalSeconds: TimeInterval = 5

    private func rescheduleFallbackNotifications() {
        let center = UNUserNotificationCenter.current()
        center.removeAllPendingNotificationRequests()
        var totalScheduled = 0
        let now = Date()

        // 第一轮:每个闹钟的下一次触发,安排一串密集通知
        for alarm in alarms {
            guard totalScheduled < AlarmScheduler.maxPendingNotifications else { break }
            guard let nextOcc = nextOccurrences(for: alarm, from: now, limit: 1, withinDays: 30).first else { continue }
            let budget = min(AlarmScheduler.burstNotificationCount, AlarmScheduler.maxPendingNotifications - totalScheduled)
            for i in 0..<budget {
                let fireDate = nextOcc.addingTimeInterval(Double(i) * AlarmScheduler.burstIntervalSeconds)
                scheduleFallbackNotification(center: center, alarm: alarm, fireDate: fireDate, idSuffix: "_b\(i)")
                totalScheduled += 1
            }
        }

        // 第二轮:剩余预算覆盖更靠后的几次触发,退化成单条兜底——用户下次打开App时会
        // 重新走一遍这个函数,把最近的一次重新排成密集通知,这里只是保证"很久不开App"
        // 也至少还有条提示,不会完全没反应
        for alarm in alarms {
            guard totalScheduled < AlarmScheduler.maxPendingNotifications else { break }
            let occurrences = nextOccurrences(for: alarm, from: now, limit: 6, withinDays: 30)
            for occ in occurrences.dropFirst() {
                guard totalScheduled < AlarmScheduler.maxPendingNotifications else { break }
                scheduleFallbackNotification(center: center, alarm: alarm, fireDate: occ, idSuffix: "_single")
                totalScheduled += 1
            }
        }
    }

    private func scheduleFallbackNotification(center: UNUserNotificationCenter, alarm: AlarmDef, fireDate: Date, idSuffix: String) {
        let content = UNMutableNotificationContent()
        content.title = alarm.label.isEmpty ? alarm.time : alarm.label
        content.body = alarm.time
        content.sound = .default
        let interval = max(1, fireDate.timeIntervalSinceNow)
        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: interval, repeats: false)
        let identifier = AlarmScheduler.notificationIdPrefix + alarm.id + "_" + String(Int(fireDate.timeIntervalSince1970)) + idSuffix
        let request = UNNotificationRequest(identifier: identifier, content: content, trigger: trigger)
        center.add(request, withCompletionHandler: nil)
    }

    // 算出某个闹钟从from往后、withinDays天以内的最多limit个下一次触发时间点
    private func nextOccurrences(for alarm: AlarmDef, from: Date, limit: Int, withinDays: Int) -> [Date] {
        var results: [Date] = []
        let cal = Calendar.current
        guard let (h, m) = AlarmScheduler.parseTime(alarm.time) else { return results }

        if alarm.repeatType == "once" {
            guard let dateStr = alarm.onceDate, let day = AlarmScheduler.parseYMD(dateStr) else { return results }
            var dc = cal.dateComponents([.year, .month, .day], from: day)
            dc.hour = h
            dc.minute = m
            dc.second = 0
            if let d = cal.date(from: dc), d > from { results.append(d) }
            return results
        }

        guard alarm.repeatType == "weekly", let weekdaysJs = alarm.weekdays, !weekdaysJs.isEmpty else { return results }
        let swiftWeekdays = Set(weekdaysJs.map { $0 == 7 ? 1 : $0 + 1 })
        var cursor = cal.startOfDay(for: from)
        guard let maxDate = cal.date(byAdding: .day, value: withinDays, to: from) else { return results }
        var guardCount = 0
        while results.count < limit && cursor <= maxDate && guardCount < withinDays + 2 {
            guardCount += 1
            let wd = cal.component(.weekday, from: cursor)
            if swiftWeekdays.contains(wd) {
                var dc = cal.dateComponents([.year, .month, .day], from: cursor)
                dc.hour = h
                dc.minute = m
                dc.second = 0
                if let d = cal.date(from: dc), d > from {
                    let ymd = AlarmScheduler.formatYMD(cursor)
                    if !(alarm.skipJpHolidays && jpHolidays.contains(ymd)) {
                        results.append(d)
                    }
                }
            }
            guard let next = cal.date(byAdding: .day, value: 1, to: cursor) else { break }
            cursor = next
        }
        return results
    }

    // MARK: - 持久化(原生这边自己也存一份,App冷启动、JS层还没来得及重新调setAlarms之前
    // 也能凭上一次存的数据继续工作)

    private func persist() {
        if let data = try? JSONEncoder().encode(alarms) { defaults.set(data, forKey: alarmsKey) }
        defaults.set(Array(jpHolidays), forKey: holidaysKey)
    }

    private func loadPersisted() {
        if let data = defaults.data(forKey: alarmsKey), let decoded = try? JSONDecoder().decode([AlarmDef].self, from: data) {
            alarms = decoded
        }
        if let arr = defaults.array(forKey: holidaysKey) as? [String] {
            jpHolidays = Set(arr)
        }
    }

    // MARK: - 小工具

    private static func parseTime(_ time: String) -> (Int, Int)? {
        let parts = time.split(separator: ":")
        guard parts.count == 2, let h = Int(parts[0]), let m = Int(parts[1]) else { return nil }
        return (h, m)
    }

    private static func parseYMD(_ ymd: String) -> Date? {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.timeZone = TimeZone.current
        return formatter.date(from: ymd)
    }

    private static func formatYMD(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.timeZone = TimeZone.current
        return formatter.string(from: date)
    }

    // 自己合成WAV数据,不需要额外打包音频资源文件:保活用近乎无声的一段静音循环,
    // 没设置自定义铃声时用一段简单的蜂鸣音兜底,保证"没上传铃声"也真的会响
    private static func makeWavData(samples: [Int16], sampleRate: Int32) -> Data {
        var data = Data()
        let numChannels: Int16 = 1
        let bitsPerSample: Int16 = 16
        let byteRate = sampleRate * Int32(numChannels) * Int32(bitsPerSample / 8)
        let blockAlign = numChannels * (bitsPerSample / 8)
        let subchunk2Size = Int32(samples.count * 2)
        let chunkSize = 36 + subchunk2Size

        func appendString(_ s: String) { data.append(s.data(using: .ascii)!) }
        func appendLE32(_ v: Int32) { var le = v.littleEndian; withUnsafeBytes(of: &le) { data.append(contentsOf: $0) } }
        func appendLE16(_ v: Int16) { var le = v.littleEndian; withUnsafeBytes(of: &le) { data.append(contentsOf: $0) } }

        appendString("RIFF"); appendLE32(chunkSize); appendString("WAVE")
        appendString("fmt "); appendLE32(16); appendLE16(1); appendLE16(numChannels)
        appendLE32(sampleRate); appendLE32(byteRate); appendLE16(blockAlign); appendLE16(bitsPerSample)
        appendString("data"); appendLE32(subchunk2Size)
        for s in samples { appendLE16(s) }
        return data
    }

    private static func makeSilentWavData(durationSeconds: Double) -> Data {
        let sampleRate: Int32 = 8000
        let n = Int(Double(sampleRate) * durationSeconds)
        return makeWavData(samples: [Int16](repeating: 0, count: n), sampleRate: sampleRate)
    }

    private static func makeBeepWavData() -> Data {
        let sampleRate: Int32 = 8000
        let toneDuration = 0.5
        let silenceDuration = 0.35
        let freq = 880.0
        var samples: [Int16] = []
        let toneN = Int(Double(sampleRate) * toneDuration)
        for i in 0..<toneN {
            let t = Double(i) / Double(sampleRate)
            let v = sin(2.0 * Double.pi * freq * t) * 0.6
            samples.append(Int16(v * Double(Int16.max)))
        }
        let silN = Int(Double(sampleRate) * silenceDuration)
        samples.append(contentsOf: [Int16](repeating: 0, count: silN))
        return makeWavData(samples: samples, sampleRate: sampleRate)
    }
}

extension AlarmScheduler: UNUserNotificationCenterDelegate {
    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification, withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        // App在前台时,真正的响铃机制(轮询命中+切换铃声循环播放)已经在响了,这批兜底通知
        // 密集排的那些如果原样弹出来,会跟真正响铃的声音叠在一起变成"又响又叮咚"很吵——
        // isRinging为true时就不再展示这条通知了
        completionHandler(isRinging ? [] : [.alert, .sound])
    }
}
