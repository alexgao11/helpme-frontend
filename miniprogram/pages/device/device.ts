import { API_BASE } from '../../utils/constant'
import { getToken } from '../../utils/auth'

interface BluetoothDevice {
  deviceId: string
  name: string
  RSSI: number
}

interface ApiDevice {
  id: string
  name: string | null
  deviceTypeId: number
  status: number
  location: string | null
  sharedTo: Array<{ id: string, name: string }>
  activeAlarmCount: number
}

// 目标设备名称
const TARGET_DEVICE_NAME = 'Xiao_Alarm_Config'

// 配置步骤
type ConfigStep = 'idle' | 'scanning' | 'connecting' | 'sending_wifi' | 'sending_getinfo' | 'done' | 'error'

Page({
  configCloseTimer: undefined as number | undefined,
  data: {
    // 设备列表
    devices: [] as ApiDevice[],
    isLoading: false,
    loadError: '',
    showConfig: false,
    configClosing: false,
    pageScrollable: false,
    pageScrollReady: false,

    // WiFi 配置
    ssid: '',
    password: '',

    // 配置状态
    configStep: 'idle' as ConfigStep,
    statusText: '',
    resultMessage: '',

    // 设备信息
    connectedDevice: null as BluetoothDevice | null,

    // BLE 连接信息（内部使用）
    bleServiceId: '',
    bleCharacteristicId: '',
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 })
    }
    wx.setNavigationBarTitle({ title: '我的设备' })
    this.loadDevices()
  },

  onUnload() {
    if (this.configCloseTimer) {
      clearTimeout(this.configCloseTimer)
      this.configCloseTimer = undefined
    }
    this.cleanupBluetooth()
  },

  // 输入框绑定
  onSsidInput(e: WechatMiniprogram.Input) {
    this.setData({ ssid: e.detail.value })
  },

  onPasswordInput(e: WechatMiniprogram.Input) {
    this.setData({ password: e.detail.value })
  },

  // 加载设备列表
  loadDevices() {
    const token = getToken()
    this.setData({ isLoading: true, loadError: '' })

    wx.request({
      url: `${API_BASE}/api/devices`,
      method: 'GET',
      header: token ? { Authorization: `Bearer ${token}` } : {},
      success: (res) => {
        if (res.statusCode === 200 && Array.isArray(res.data)) {
          this.setData({ devices: res.data }, () => {
            this.updatePageScrollState()
          })
        } else {
          this.setData({ loadError: '设备加载失败' }, () => {
            this.updatePageScrollState()
          })
          wx.showToast({ title: '设备加载失败', icon: 'none' })
        }
      },
      fail: () => {
        this.setData({ loadError: '网络错误，无法加载设备' }, () => {
          this.updatePageScrollState()
        })
        wx.showToast({ title: '网络错误', icon: 'none' })
      },
      complete: () => {
        this.setData({ isLoading: false }, () => {
          this.updatePageScrollState()
        })
      }
    })
  },

  onDeviceTap(e: WechatMiniprogram.TouchEvent) {
    const index = Number(e.currentTarget.dataset.index)
    if (Number.isNaN(index)) return
    const device = this.data.devices[index]
    if (!device) return

    wx.navigateTo({
      url: '/pages/deviceDetail/deviceDetail',
      success: (res) => {
        res.eventChannel.emit('device', device)
      }
    })
  },

  onShowConfig() {
    if (this.configCloseTimer) {
      clearTimeout(this.configCloseTimer)
      this.configCloseTimer = undefined
    }
    this.setData({ showConfig: true, configClosing: false }, () => {
      this.updatePageScrollState()
    })
  },

  onHideConfig() {
    this.onReset()
    if (this.data.configClosing) return
    this.setData({ configClosing: true }, () => {
      this.configCloseTimer = setTimeout(() => {
        this.setData({ showConfig: false, configClosing: false }, () => {
          this.updatePageScrollState()
        })
        this.configCloseTimer = undefined
      }, 380)
    })
  },

  updatePageScrollState() {
    wx.nextTick(() => {
      const query = wx.createSelectorQuery()
      query.select('.page-scroll').boundingClientRect()
      query.select('.page-content').boundingClientRect()
      query.exec((res) => {
        const container = res[0] as WechatMiniprogram.BoundingClientRectCallbackResult | undefined
        const content = res[1] as WechatMiniprogram.BoundingClientRectCallbackResult | undefined
        if (!container || !content) {
          this.setData({ pageScrollable: false, pageScrollReady: true })
          return
        }
        const shouldScroll = content.height - container.height > 2
        this.setData({
          pageScrollable: shouldScroll,
          pageScrollReady: true
        })
      })
    })
  },

  // 开始配置
  onStartConfig() {
    const { ssid, password } = this.data

    if (!ssid.trim()) {
      wx.showToast({ title: '请输入 WiFi 名称', icon: 'none' })
      return
    }

    if (!password.trim()) {
      wx.showToast({ title: '请输入 WiFi 密码', icon: 'none' })
      return
    }

    this.setData({
      configStep: 'scanning',
      statusText: '正在搜索设备...',
      resultMessage: ''
    }, () => {
      this.updatePageScrollState()
    })

    this.initBluetooth()
  },

  // 初始化蓝牙
  initBluetooth() {
    wx.openBluetoothAdapter({
      mode: 'central',
      success: () => {
        this.startScan()
      },
      fail: (err) => {
        console.error('蓝牙初始化失败', err)
        if (err.errCode === 10001) {
          this.setData({
            statusText: '请打开蓝牙后重试'
          })
          // 监听蓝牙开启
          wx.onBluetoothAdapterStateChange((res) => {
            if (res.available && this.data.configStep === 'scanning') {
              this.startScan()
            }
          })
        } else if (err.errMsg?.includes('already opened')) {
          this.startScan()
        } else {
          this.onConfigError('蓝牙初始化失败')
        }
      }
    })
  },

  // 开始扫描
  startScan() {
    this.setData({ statusText: `正在搜索 ${TARGET_DEVICE_NAME}...` })

    wx.offBluetoothDeviceFound(() => {})

    wx.onBluetoothDeviceFound((res) => {
      for (const device of res.devices) {
        const deviceName = device.name || device.localName
        console.log('发现设备:', deviceName)

        // 找到目标设备
        if (deviceName === TARGET_DEVICE_NAME) {
          console.log('找到目标设备:', device)
          wx.stopBluetoothDevicesDiscovery()
          wx.offBluetoothDeviceFound(() => {})

          const targetDevice: BluetoothDevice = {
            deviceId: device.deviceId,
            name: deviceName,
            RSSI: device.RSSI
          }

          this.setData({
            configStep: 'connecting',
            statusText: '正在连接设备...',
            connectedDevice: targetDevice
          })

          this.connectDevice(targetDevice)
          return
        }
      }
    })

    wx.startBluetoothDevicesDiscovery({
      allowDuplicatesKey: false,
      success: () => {
        console.log('开始扫描')
        // 设置超时
        setTimeout(() => {
          if (this.data.configStep === 'scanning') {
            wx.stopBluetoothDevicesDiscovery()
            this.onConfigError('未找到设备，请确保设备已开启')
          }
        }, 15000) // 15秒超时
      },
      fail: () => {
        this.onConfigError('扫描失败')
      }
    })
  },

  // 连接设备
  connectDevice(device: BluetoothDevice) {
    wx.createBLEConnection({
      deviceId: device.deviceId,
      success: () => {
        console.log('连接成功')
        // 延迟获取服务，等待连接稳定
        setTimeout(() => {
          this.getDeviceServices(device.deviceId)
        }, 500)
      },
      fail: (err) => {
        console.error('连接失败', err)
        this.onConfigError('连接设备失败')
      }
    })
  },

  // 获取设备服务
  getDeviceServices(deviceId: string) {
    wx.getBLEDeviceServices({
      deviceId,
      success: (res) => {
        console.log('服务列表:', res.services)

        // 通常第一个自定义服务就是我们需要的
        // 过滤掉标准服务（以 0000 开头的通常是标准服务）
        const customService = res.services.find(s =>
          !s.uuid.toUpperCase().startsWith('0000')
        ) || res.services[0]

        if (customService) {
          console.log('使用服务:', customService.uuid)
          this.getCharacteristics(deviceId, customService.uuid)
        } else {
          this.onConfigError('未找到可用服务')
        }
      },
      fail: (err) => {
        console.error('获取服务失败', err)
        this.onConfigError('获取设备服务失败')
      }
    })
  },

  // 获取特征值
  getCharacteristics(deviceId: string, serviceId: string) {
    wx.getBLEDeviceCharacteristics({
      deviceId,
      serviceId,
      success: (res) => {
        console.log('特征值列表:', res.characteristics)

        // 找到可写入的特征值
        const writableChar = res.characteristics.find(c =>
          c.properties.write
        )

        if (writableChar) {
          console.log('使用特征值:', writableChar.uuid)
          this.setData({
            bleServiceId: serviceId,
            bleCharacteristicId: writableChar.uuid
          })

          // 开启通知（如果支持）
          if (writableChar.properties.notify || writableChar.properties.indicate) {
            this.enableNotifyAndSendWifi(deviceId, serviceId, writableChar.uuid)
          } else {
            // 不支持通知，直接发送
            this.sendWifiConfig()
          }
        } else {
          this.onConfigError('未找到可写入的特征值')
        }
      },
      fail: (err) => {
        console.error('获取特征值失败', err)
        this.onConfigError('获取特征值失败')
      }
    })
  },

  // 开启通知并发送 WiFi 配置
  enableNotifyAndSendWifi(deviceId: string, serviceId: string, characteristicId: string) {
    wx.notifyBLECharacteristicValueChange({
      deviceId,
      serviceId,
      characteristicId,
      state: true,
      success: () => {
        console.log('通知已开启')

        // 监听设备返回的数据
        wx.onBLECharacteristicValueChange((res) => {
          const value = this.arrayBufferToString(res.value)
          console.log('收到数据:', value)
          this.handleDeviceResponse(value)
        })

        this.sendWifiConfig()
      },
      fail: (err) => {
        console.error('开启通知失败', err)
        // 即使通知失败也尝试发送
        this.sendWifiConfig()
      }
    })
  },

  // 发送 WiFi 配置
  sendWifiConfig() {
    const { ssid, password, connectedDevice, bleServiceId, bleCharacteristicId } = this.data
    if (!connectedDevice) return

    this.setData({
      configStep: 'sending_wifi',
      statusText: '正在发送 WiFi 配置...'
    })

    const message = `${ssid}|${password}`
    const buffer = this.stringToArrayBuffer(message)

    wx.writeBLECharacteristicValue({
      deviceId: connectedDevice.deviceId,
      serviceId: bleServiceId,
      characteristicId: bleCharacteristicId,
      value: buffer,
      success: () => {
        console.log('WiFi 配置已发送')
        // 延迟发送 getinfo
        setTimeout(() => {
          this.sendGetInfo()
        }, 1000)
      },
      fail: (err) => {
        console.error('发送 WiFi 配置失败', err)
        this.onConfigError('发送配置失败')
      }
    })
  },

  // 发送 getinfo
  sendGetInfo() {
    const { connectedDevice, bleServiceId, bleCharacteristicId } = this.data
    if (!connectedDevice) return

    this.setData({
      configStep: 'sending_getinfo',
      statusText: '正在获取设备信息...'
    })

    const buffer = this.stringToArrayBuffer('getinfo')

    wx.writeBLECharacteristicValue({
      deviceId: connectedDevice.deviceId,
      serviceId: bleServiceId,
      characteristicId: bleCharacteristicId,
      value: buffer,
      success: () => {
        console.log('getinfo 已发送')
        // 设置超时，如果没有收到响应
        setTimeout(() => {
          if (this.data.configStep === 'sending_getinfo') {
            this.onConfigComplete('配置完成（未收到设备响应）')
          }
        }, 5000)
      },
      fail: (err) => {
        console.error('发送 getinfo 失败', err)
        this.onConfigError('获取设备信息失败')
      }
    })
  },

  // 处理设备响应
  handleDeviceResponse(value: string) {
    console.log('处理响应:', value, '当前步骤:', this.data.configStep)

    if (this.data.configStep === 'sending_getinfo') {
      // 收到 getinfo 的响应
      this.onConfigComplete(value)
    }
  },

  // 配置完成
  onConfigComplete(result: string) {
    this.setData({
      configStep: 'done',
      statusText: '配置完成',
      resultMessage: result
    }, () => {
      this.updatePageScrollState()
    })

    // 断开连接
    this.disconnectDevice()

    wx.showToast({
      title: '配置成功',
      icon: 'success'
    })
  },

  // 配置出错
  onConfigError(message: string) {
    this.setData({
      configStep: 'error',
      statusText: message
    }, () => {
      this.updatePageScrollState()
    })

    this.cleanupBluetooth()

    wx.showToast({
      title: message,
      icon: 'none'
    })
  },

  // 断开设备连接
  disconnectDevice() {
    const device = this.data.connectedDevice
    if (!device) return

    wx.closeBLEConnection({
      deviceId: device.deviceId,
      complete: () => {
        this.cleanupBluetooth()
        this.setData({
          connectedDevice: null,
          bleServiceId: '',
          bleCharacteristicId: ''
        })
      }
    })
  },

  // 清理蓝牙资源
  cleanupBluetooth() {
    wx.offBluetoothDeviceFound(() => {})
    wx.offBluetoothAdapterStateChange(() => {})
    wx.offBLECharacteristicValueChange(() => {})
    wx.stopBluetoothDevicesDiscovery()
    wx.closeBluetoothAdapter()
  },

  // 重新开始
  onReset() {
    this.cleanupBluetooth()
    this.setData({
      configStep: 'idle',
      statusText: '',
      resultMessage: '',
      connectedDevice: null,
      bleServiceId: '',
      bleCharacteristicId: ''
    }, () => {
      this.updatePageScrollState()
    })
  },

  // 工具函数
  arrayBufferToString(buffer: ArrayBuffer): string {
    const uint8Array = new Uint8Array(buffer)
    let str = ''
    for (let i = 0; i < uint8Array.length; i++) {
      str += String.fromCharCode(uint8Array[i])
    }
    return str
  },

  stringToArrayBuffer(str: string): ArrayBuffer {
    const buffer = new ArrayBuffer(str.length)
    const uint8Array = new Uint8Array(buffer)
    for (let i = 0; i < str.length; i++) {
      uint8Array[i] = str.charCodeAt(i)
    }
    return buffer
  }
})
