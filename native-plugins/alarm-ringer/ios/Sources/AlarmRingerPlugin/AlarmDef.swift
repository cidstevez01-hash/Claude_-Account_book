import Foundation

// 跟JS端 rearmNativeAlarms() 发过来的payload字段一一对应,repeatType='once'时
// weekdays为空、='weekly'时onceDate为空,两个字段都设成可选,JS那边没传/传null都能解出来
struct AlarmDef: Codable {
    let id: String
    let time: String
    let label: String
    let repeatType: String
    let onceDate: String?
    let weekdays: [Int]?
    let skipJpHolidays: Bool
    let soundUri: String?
    let vibrate: Bool
}

struct SetAlarmsPayload: Decodable {
    let alarms: [AlarmDef]
    let jpHolidays: [String]
}
