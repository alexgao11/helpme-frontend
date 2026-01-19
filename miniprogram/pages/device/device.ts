interface BluetoothDevice {
  deviceId: string
  name: string
  RSSI: number
}

// 目标 Service 和 Characteristic UUID（与脚本一致）
const TARGET_SERVICE_UUID = '12345678-1234-1234-1234-123456789ABC'
const TARGET_CHARACTERISTIC_UUID = '87654321-4321-4321-4321-CBA987654321'

Page({
  data: {
    isScanning: false,
    scanStatus: '点击添加设备开始扫描',
    connectedDevice: null as BluetoothDevice | null,
    deviceList: [] as BluetoothDevice[],
    // BLE 连接信息
    bleConnected: false,
    bleServiceId: '',
    bleCharacteristicId: '',
    receivedMessage: '',
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 })
    }
  },

  onUnload() {
    // 页面卸载时清理蓝牙
    this.cleanupBluetooth()
  },

  onAddButton() {
    if (this.data.isScanning) {
      this.stopScan()
    } else {
      this.startScan()
    }
  },

  // 清理蓝牙资源
  cleanupBluetooth() {
    wx.offBluetoothDeviceFound(() => {
      console.log('结束')
    })
    wx.offBluetoothAdapterStateChange(() => {})
    wx.stopBluetoothDevicesDiscovery()
    wx.closeBluetoothAdapter()
  },

  // 开始扫描
  startScan() {
    this.setData({
      isScanning: true,
      scanStatus: '正在初始化蓝牙...',
      deviceList: []
    })

    // 初始化蓝牙适配器
    wx.openBluetoothAdapter({
      mode: 'central',
      success: () => {
        this.setData({ scanStatus: '正在扫描设备...' })
        this.startDiscovery()
      },
      fail: (err) => {
        console.error('蓝牙初始化失败', err)
        if (err.errCode === 10001) {
          // 蓝牙未开启，监听蓝牙状态变化
          this.setData({ scanStatus: '请打开蓝牙' })
          wx.onBluetoothAdapterStateChange((res) => {
            if (res.available) {
              this.setData({ scanStatus: '正在扫描设备...' })
              this.startDiscovery()
            }
          })
        } else if (err.errMsg?.includes('already opened')) {
          // 蓝牙适配器已打开，直接开始扫描
          this.setData({ scanStatus: '正在扫描设备...' })
          this.startDiscovery()
        } else {
          this.setData({
            isScanning: false,
            scanStatus: '蓝牙初始化失败'
          })
          wx.showToast({
            title: '蓝牙初始化失败',
            icon: 'none'
          })
        }
      }
    })
  },

  // 开始搜索设备
  startDiscovery() {
    // 先移除之前的监听，避免重复
    wx.offBluetoothDeviceFound(() => {
      console.log('结束')
    })

    // 监听设备发现事件
    wx.onBluetoothDeviceFound((res) => {
      res.devices.forEach((device) => {
        // 调试：打印所有发现的设备
        console.log('发现设备:', {
          deviceId: device.deviceId,
          name: device.name,
          localName: device.localName,
          RSSI: device.RSSI,
          advertisServiceUUIDs: device.advertisServiceUUIDs
        })

        // 只显示有名称的设备
        const deviceName = device.name || device.localName
        if (!deviceName) return

        // 检查是否已存在
        const existIndex = this.data.deviceList.findIndex(d => d.deviceId === device.deviceId)
        const newDevice: BluetoothDevice = {
          deviceId: device.deviceId,
          name: deviceName,
          RSSI: device.RSSI
        }

        if (existIndex === -1) {
          // 新设备，添加到列表
          this.setData({
            deviceList: [...this.data.deviceList, newDevice]
          })
        } else {
          // 已存在，更新信号强度
          const deviceList = [...this.data.deviceList]
          deviceList[existIndex] = newDevice
          this.setData({ deviceList })
        }
      })
    })

    // 开始扫描
    wx.startBluetoothDevicesDiscovery({
      allowDuplicatesKey: true, // 允许重复上报以更新信号强度
      success: () => {
        console.log('开始扫描蓝牙设备')
      },
      fail: (err) => {
        console.error('扫描失败', err)
        this.setData({
          isScanning: false,
          scanStatus: '扫描失败，请重试'
        })
      }
    })
  },

  // 选择设备并连接
  onSelectDevice(e: WechatMiniprogram.TouchEvent) {
    const device = e.currentTarget.dataset.device as BluetoothDevice
    if (!device) return

    // 停止扫描
    wx.stopBluetoothDevicesDiscovery()
    wx.offBluetoothDeviceFound(() => {
      console.log('结束')
    })

    this.setData({
      scanStatus: `正在连接 ${device.name}...`
    })

    this.connectDevice(device)
  },

  // 连接设备
  connectDevice(device: BluetoothDevice) {
    wx.createBLEConnection({
      deviceId: device.deviceId,
      success: () => {
        console.log('连接成功')
        this.setData({
          isScanning: false,
          scanStatus: '连接成功！',
          connectedDevice: device,
          deviceList: []
        })
        wx.showToast({
          title: '设备连接成功',
          icon: 'success'
        })
        // 获取设备服务
        this.getDeviceServices(device.deviceId)
      },
      fail: (err) => {
        console.error('连接失败', err)
        this.setData({
          isScanning: false,
          scanStatus: '连接失败，请重试'
        })
        wx.showToast({
          title: '连接失败',
          icon: 'none'
        })
      }
    })
  },

  // 获取设备服务
  getDeviceServices(deviceId: string) {
    wx.getBLEDeviceServices({
      deviceId,
      success: (res) => {
        console.log('设备服务列表', res.services)

        // 查找目标服务
        const targetService = res.services.find(s =>
          s.uuid.toUpperCase() === TARGET_SERVICE_UUID.toUpperCase()
        )

        if (targetService) {
          console.log('找到目标服务:', targetService.uuid)
          this.getCharacteristics(deviceId, targetService.uuid)
        } else {
          console.log('未找到目标服务，可用服务:', res.services.map(s => s.uuid))
        }
      },
      fail: (err) => {
        console.error('获取服务失败', err)
      }
    })
  },

  // 获取特征值
  getCharacteristics(deviceId: string, serviceId: string) {
    wx.getBLEDeviceCharacteristics({
      deviceId,
      serviceId,
      success: (res) => {
        console.log('特征值列表', res.characteristics)

        // 查找目标特征值
        const targetChar = res.characteristics.find(c =>
          c.uuid.toUpperCase() === TARGET_CHARACTERISTIC_UUID.toUpperCase()
        )

        if (targetChar) {
          console.log('找到目标特征值:', targetChar.uuid)
          // 先订阅通知，再读取数据
          this.enableNotify(deviceId, serviceId, targetChar.uuid)
        } else {
          console.log('未找到目标特征值')
        }
      },
      fail: (err) => {
        console.error('获取特征值失败', err)
      }
    })
  },

  // 开启通知
  enableNotify(deviceId: string, serviceId: string, characteristicId: string) {
    wx.notifyBLECharacteristicValueChange({
      deviceId,
      serviceId,
      characteristicId,
      state: true,
      success: () => {
        console.log('通知已开启')

        // 保存连接信息
        this.setData({
          bleConnected: true,
          bleServiceId: serviceId,
          bleCharacteristicId: characteristicId
        })

        // 监听特征值变化
        wx.onBLECharacteristicValueChange((res) => {
          const value = this.arrayBufferToString(res.value)
          console.log('收到数据:', value)

          // 显示收到的消息
          this.setData({ receivedMessage: value })
          wx.showToast({
            title: `收到: ${value}`,
            icon: 'none',
            duration: 2000
          })

          // 如果收到 "1,test"，自动发送 "123|hello"
          if (value === '1,test') {
            setTimeout(() => {
              this.sendMessage('123|hello')
            }, 500)
          }
        })

        wx.showToast({
          title: '连接就绪',
          icon: 'success'
        })
      },
      fail: (err) => {
        console.error('开启通知失败', err)
        wx.showToast({
          title: '通知开启失败',
          icon: 'none'
        })
      }
    })
  },

  // 发送 getinfo 命令
  onGetInfo() {
    if (!this.data.bleConnected || !this.data.connectedDevice) {
      wx.showToast({
        title: '请先连接设备',
        icon: 'none'
      })
      return
    }
    this.sendMessage('getinfo')
  },

  // 发送消息
  sendMessage(message: string) {
    const device = this.data.connectedDevice
    if (!device) return

    const buffer = this.stringToArrayBuffer(message)
    wx.writeBLECharacteristicValue({
      deviceId: device.deviceId,
      serviceId: this.data.bleServiceId,
      characteristicId: this.data.bleCharacteristicId,
      value: buffer,
      success: () => {
        console.log('发送成功:', message)
        wx.showToast({
          title: `已发送: ${message}`,
          icon: 'none'
        })
      },
      fail: (err) => {
        console.error('发送失败', err)
        wx.showToast({
          title: '发送失败',
          icon: 'none'
        })
      }
    })
  },

  // 工具函数：ArrayBuffer 转字符串
  arrayBufferToString(buffer: ArrayBuffer): string {
    const uint8Array = new Uint8Array(buffer)
    let str = ''
    for (let i = 0; i < uint8Array.length; i++) {
      str += String.fromCharCode(uint8Array[i])
    }
    return str
  },

  // 工具函数：字符串转 ArrayBuffer
  stringToArrayBuffer(str: string): ArrayBuffer {
    const buffer = new ArrayBuffer(str.length)
    const uint8Array = new Uint8Array(buffer)
    for (let i = 0; i < str.length; i++) {
      uint8Array[i] = str.charCodeAt(i)
    }
    return buffer
  },

  // 断开设备连接
  disconnectDevice() {
    const device = this.data.connectedDevice
    if (!device) return

    wx.closeBLEConnection({
      deviceId: device.deviceId,
      complete: () => {
        // 移除监听
        wx.offBluetoothDeviceFound(() => {})
        wx.offBluetoothAdapterStateChange(() => {})
        wx.offBLECharacteristicValueChange(() => {})
        wx.stopBluetoothDevicesDiscovery()

        this.setData({
          connectedDevice: null,
          scanStatus: '点击添加设备开始扫描',
          deviceList: [],
          bleConnected: false,
          bleServiceId: '',
          bleCharacteristicId: '',
          receivedMessage: ''
        })
        wx.showToast({
          title: '已断开连接',
          icon: 'none'
        })
      }
    })
  },

  // 停止扫描
  stopScan() {
    this.cleanupBluetooth()
    this.setData({
      isScanning: false,
      scanStatus: '点击添加设备开始扫描',
      deviceList: []
    })
  }
})
