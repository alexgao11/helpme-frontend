#!/usr/bin/env swift

import CoreBluetooth
import Foundation

// 自定义 Service 和 Characteristic UUID
let serviceUUID = CBUUID(string: "12345678-1234-1234-1234-123456789ABC")
let characteristicUUID = CBUUID(string: "87654321-4321-4321-4321-CBA987654321")

class BLEPeripheral: NSObject, CBPeripheralManagerDelegate {
    var peripheralManager: CBPeripheralManager!
    var characteristic: CBMutableCharacteristic!
    var subscribedCentral: CBCentral?

    override init() {
        super.init()
        peripheralManager = CBPeripheralManager(delegate: self, queue: nil)
    }

    func peripheralManagerDidUpdateState(_ peripheral: CBPeripheralManager) {
        switch peripheral.state {
        case .poweredOn:
            print("✓ 蓝牙已开启")
            setupService()
        case .poweredOff:
            print("✗ 请打开蓝牙")
        case .unauthorized:
            print("✗ 需要蓝牙权限，请在系统设置中授权")
        case .unsupported:
            print("✗ 此设备不支持蓝牙")
        default:
            print("蓝牙状态: \(peripheral.state.rawValue)")
        }
    }

    func setupService() {
        // 创建 Characteristic (可读、可写、可通知)
        characteristic = CBMutableCharacteristic(
            type: characteristicUUID,
            properties: [.read, .write, .notify],
            value: nil,
            permissions: [.readable, .writeable]
        )

        // 创建 Service
        let service = CBMutableService(type: serviceUUID, primary: true)
        service.characteristics = [characteristic]

        // 添加服务
        peripheralManager.add(service)
    }

    func peripheralManager(_ peripheral: CBPeripheralManager, didAdd service: CBService, error: Error?) {
        if let error = error {
            print("✗ 添加服务失败: \(error.localizedDescription)")
            return
        }

        print("✓ 服务已添加")
        startAdvertising()
    }

    func startAdvertising() {
        let advertisementData: [String: Any] = [
            CBAdvertisementDataLocalNameKey: "HelpMe-Device",
            CBAdvertisementDataServiceUUIDsKey: [serviceUUID]
        ]

        peripheralManager.startAdvertising(advertisementData)
    }

    func peripheralManagerDidStartAdvertising(_ peripheral: CBPeripheralManager, error: Error?) {
        if let error = error {
            print("✗ 广播启动失败: \(error.localizedDescription)")
            return
        }

        print("✓ 正在广播...")
        print("")
        print("========================================")
        print("设备名称: HelpMe-Device")
        print("Service UUID: \(serviceUUID.uuidString)")
        print("Characteristic UUID: \(characteristicUUID.uuidString)")
        print("========================================")
        print("")
        print("等待小程序连接...")
        print("按 Ctrl+C 停止")
        print("")
    }

    // 处理读请求
    func peripheralManager(_ peripheral: CBPeripheralManager, didReceiveRead request: CBATTRequest) {
        print("← 收到读取请求")
        request.value = "ready".data(using: .utf8)
        peripheral.respond(to: request, withResult: .success)
    }

    // 处理写请求
    func peripheralManager(_ peripheral: CBPeripheralManager, didReceiveWrite requests: [CBATTRequest]) {
        for request in requests {
            if let value = request.value, let message = String(data: value, encoding: .utf8) {
                print("→ 收到消息: \(message)")

                // 处理不同的命令
                if message == "getinfo" {
                    print("  处理 getinfo 命令，发送响应: 1,test")
                    sendNotification("1,test")
                } else {
                    // 其他消息直接打印
                    print("  已收到: \(message)")
                }
            }
            peripheral.respond(to: request, withResult: .success)
        }
    }

    // 发送通知给订阅的客户端
    func sendNotification(_ message: String) {
        guard let central = subscribedCentral else {
            print("  ⚠️ 没有订阅的客户端，无法发送通知")
            return
        }

        if let data = message.data(using: .utf8) {
            let success = peripheralManager.updateValue(data, for: characteristic, onSubscribedCentrals: [central])
            if success {
                print("  ✓ 通知已发送: \(message)")
            } else {
                print("  ⚠️ 通知发送失败（队列满），稍后重试")
            }
        }
    }

    // 订阅通知
    func peripheralManager(_ peripheral: CBPeripheralManager, central: CBCentral, didSubscribeTo characteristic: CBCharacteristic) {
        subscribedCentral = central
        print("")
        print("🎉 客户端已连接并订阅通知")
        print("   等待小程序发送命令...")
        print("")
    }

    func peripheralManager(_ peripheral: CBPeripheralManager, central: CBCentral, didUnsubscribeFrom characteristic: CBCharacteristic) {
        subscribedCentral = nil
        print("✗ 客户端取消订阅")
    }
}

print("")
print("BLE 外围设备模拟器")
print("==================")
print("")

let peripheral = BLEPeripheral()

// 保持运行
RunLoop.main.run()
