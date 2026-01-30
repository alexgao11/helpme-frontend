import { API_BASE, PENDING_SHARE_KEY } from '../../utils/constant';
import { getToken, isLoggedIn } from '../../utils/auth';
import {
  needsSubscribeAuth,
  refreshSubscribeStatus,
  requestAlarmSubscribe,
} from '../../utils/subscribe';

interface BluetoothDevice {
  deviceId: string;
  name: string;
  RSSI: number;
}

interface ApiDevice {
  id: string;
  name: string | null;
  deviceTypeId: number;
  status: number;
  location: string | null;
  sharedTo: Array<{ id: string; name: string }>;
  activeAlarmCount: number;
  totalAlarmsCount?: number;
}

interface DevicesResponse {
  devices?: ApiDevice[];
  remainingWeChatMessageCount?: number;
}

// 目标设备名称
const TARGET_DEVICE_NAME = 'Xiao_Alarm_Config';

// 配置步骤
type ConfigStep =
  | 'idle'
  | 'scanning'
  | 'connecting'
  | 'sending_wifi'
  | 'sending_getinfo'
  | 'done'
  | 'error';

Page({
  configCloseTimer: undefined as number | undefined,
  readInfoTimer: undefined as number | undefined,
  readInfoAttempts: 0,
  subscribeQuotaChecking: false,
  hasLoadedDevices: false,
  data: {
    // 设备列表
    devices: [] as ApiDevice[],
    isLoading: false,
    loadError: '',
    isRefreshing: false,
    showConfig: false,
    configClosing: false,
    pageScrollable: false,
    pageScrollReady: false,

    // WiFi 配置
    ssid: '',
    password: '',
    showPassword: false,

    // 配置状态
    configStep: 'idle' as ConfigStep,
    statusText: '',
    resultMessage: '',

    // 设备信息
    connectedDevice: null as BluetoothDevice | null,

    // BLE 连接信息（内部使用）
    bleServiceId: '',
    bleCharacteristicId: '',
    bleReadServiceId: '',
    bleReadCharacteristicId: '',
    isAcceptingShare: false,

    // 订阅消息额度
    remainingWeChatMessageCount: undefined as number | undefined,
    showSubscribeButton: false,
    isIncrementingQuota: false,
  },

  onLoad(options: Record<string, string>) {
    const deviceId = options.deviceId || '';
    const shareCode = options.shareCode || '';
    const deviceName = options.deviceName
      ? decodeURIComponent(options.deviceName)
      : '';
    const fromId = options.fromId || '';
    const fromName = options.fromName || '';

    if (deviceId && shareCode) {
      wx.setStorageSync(PENDING_SHARE_KEY, {
        deviceId,
        shareCode,
        deviceName,
        fromId,
        fromName,
      });
      if (isLoggedIn()) {
        this.acceptShare(deviceId, shareCode);
      }
    }
  },

  onShow() {
    if (!isLoggedIn()) {
      wx.reLaunch({ url: '/pages/login/login' });
      return;
    }
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 });
    }
    wx.setNavigationBarTitle({ title: '我的设备' });
    if (this.hasLoadedDevices) return;
    this.loadDevices();
  },

  onPullDownRefresh() {
    this.onScrollRefresh();
  },

  onScrollRefresh() {
    if (this.data.isRefreshing) return;
    this.setData({ isRefreshing: true });
    this.loadDevices({ stopPullDown: true, stopRefresh: true });
  },

  onUnload() {
    if (this.configCloseTimer) {
      clearTimeout(this.configCloseTimer);
      this.configCloseTimer = undefined;
    }
    this.clearReadInfoTimer();
    this.cleanupBluetooth();
  },

  checkSubscribeAuth() {
    refreshSubscribeStatus().then(() => {
      if (!needsSubscribeAuth()) {
        this.setData({ showSubscribeButton: false });
        return;
      }
      this.setData({ showSubscribeButton: true });
    });
  },

  handleSubscribeQuota(remaining?: number) {
    const shouldPrompt = remaining === undefined || remaining <= 1;
    if (!shouldPrompt) {
      this.setData({ showSubscribeButton: false });
      return;
    }
    if (this.subscribeQuotaChecking) return;
    this.subscribeQuotaChecking = true;
    this.tryAutoSubscribe().finally(() => {
      this.subscribeQuotaChecking = false;
    });
  },

  tryAutoSubscribe() {
    return this.requestSubscribeAndIncrement({ showToastOnReject: false });
  },

  requestSubscribeAndIncrement(options?: { showToastOnReject?: boolean }) {
    const showToast = options?.showToastOnReject ?? true;
    return requestAlarmSubscribe().then((status) => {
      if (status === 'accept') {
        this.incrementWeChatQuotaOnce();
        this.setData({ showSubscribeButton: false });
        return true;
      }
      this.setData({ showSubscribeButton: true });
      if (showToast) {
        wx.showToast({ title: '需要授权后才能接收通知', icon: 'none' });
      }
      return false;
    });
  },

  incrementWeChatQuotaOnce() {
    const token = getToken();
    if (!token) return;
    if (this.data.isIncrementingQuota) return;

    this.setData({ isIncrementingQuota: true });
    wx.request({
      url: `${API_BASE}/api/user/wechat-message-quota/increment`,
      method: 'POST',
      header: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      success: (res) => {
        if (res.statusCode === 200) {
          const remainingCount = Number(
            (res.data as { remainingCount?: number })?.remainingCount,
          );
          if (!Number.isNaN(remainingCount)) {
            this.setData({ remainingWeChatMessageCount: remainingCount });
          }
        } else {
          this.setData({ showSubscribeButton: true });
        }
      },
      fail: () => {
        this.setData({ showSubscribeButton: true });
      },
      complete: () => {
        this.setData({ isIncrementingQuota: false });
      },
    });
  },

  onSubscribeButtonTap() {
    this.requestSubscribeAndIncrement();
  },

  acceptShare(deviceId: string, shareCode: string) {
    if (this.data.isAcceptingShare) return;
    const token = getToken();
    if (!token) {
      wx.showToast({ title: '请先登录后添加', icon: 'none' });
      return;
    }
    this.setData({ isAcceptingShare: true });
    wx.request({
      url: `${API_BASE}/api/devices/${deviceId}/share/accept`,
      method: 'POST',
      header: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      data: { shareCode },
      success: (res: WechatMiniprogram.RequestSuccessCallbackResult) => {
        if (res.statusCode === 201) {
          wx.removeStorageSync(PENDING_SHARE_KEY);
          wx.showToast({ title: '设备已添加', icon: 'success' });
          this.loadDevices();
        } else {
          const message =
            (res.data as { message?: string })?.message || '添加失败';
          wx.showToast({ title: message, icon: 'none' });
        }
      },
      fail: () => {
        wx.showToast({ title: '添加失败', icon: 'none' });
      },
      complete: () => {
        this.setData({ isAcceptingShare: false });
      },
    });
  },

  // 输入框绑定
  onSsidInput(e: WechatMiniprogram.Input) {
    this.setData({ ssid: e.detail.value });
  },

  onPasswordInput(e: WechatMiniprogram.Input) {
    this.setData({ password: e.detail.value });
  },

  onTogglePassword() {
    this.setData({ showPassword: !this.data.showPassword });
  },

  // 加载设备列表
  loadDevices(options?: { stopPullDown?: boolean; stopRefresh?: boolean }) {
    const token = getToken();
    this.setData({ isLoading: true, loadError: '' });

    wx.request({
      url: `${API_BASE}/api/devices`,
      method: 'GET',
      header: token ? { Authorization: `Bearer ${token}` } : {},
      success: (res) => {
        if (res.statusCode === 200) {
          const payload = res.data as ApiDevice[] | DevicesResponse;
          const devices = (Array.isArray(payload)
            ? payload
            : Array.isArray(payload?.devices)
              ? payload.devices
              : []
          ).map((device) => {
            const typedDevice = device as ApiDevice & { deviceId?: string };
            return {
              ...typedDevice,
              id: typedDevice.id || typedDevice.deviceId || '',
            };
          });
          const remainingCount = Array.isArray(payload)
            ? undefined
            : payload?.remainingWeChatMessageCount;
          this.setData(
            { devices, remainingWeChatMessageCount: remainingCount },
            () => {
              this.updatePageScrollState();
              this.handleSubscribeQuota(remainingCount);
            },
          );
          this.hasLoadedDevices = true;
        } else {
          this.setData({ loadError: '设备加载失败' }, () => {
            this.updatePageScrollState();
          });
          wx.showToast({ title: '设备加载失败', icon: 'none' });
        }
      },
      fail: () => {
        this.setData({ loadError: '网络错误，无法加载设备' }, () => {
          this.updatePageScrollState();
        });
        wx.showToast({ title: '网络错误', icon: 'none' });
      },
      complete: () => {
        this.setData({ isLoading: false }, () => {
          this.updatePageScrollState();
        });
        if (options?.stopRefresh) {
          this.setData({ isRefreshing: false });
        }
        if (options?.stopPullDown) {
          wx.stopPullDownRefresh();
        }
      },
    });
  },

  onDeviceTap(e: WechatMiniprogram.TouchEvent) {
    const index = Number(e.currentTarget.dataset.index);
    if (Number.isNaN(index)) return;
    const device = this.data.devices[index];
    if (!device) return;

    const deviceId =
      (device as ApiDevice & { deviceId?: string })?.id ||
      (device as ApiDevice & { deviceId?: string })?.deviceId ||
      '';
    if (!deviceId) {
      wx.showToast({ title: '设备ID无效', icon: 'none' });
      return;
    }

    const encodedName = encodeURIComponent(device.name || '');
    const detailUrl =
      device.deviceTypeId === 9
        ? `/pages/deviceDetail/9/index?id=${deviceId}&name=${encodedName}`
        : `/pages/deviceDetail/deviceDetail?id=${deviceId}&name=${encodedName}`;
    wx.navigateTo({
      url: detailUrl,
      success: (res) => {
        res.eventChannel.emit('device', device);
      },
    });
  },

  onShowConfig() {
    if (this.configCloseTimer) {
      clearTimeout(this.configCloseTimer);
      this.configCloseTimer = undefined;
    }
    this.setData({ showConfig: true, configClosing: false }, () => {
      this.updatePageScrollState();
    });
  },

  onHideConfig() {
    this.onReset();
    if (this.data.configClosing) return;
    this.setData({ configClosing: true }, () => {
      this.configCloseTimer = setTimeout(() => {
        this.setData({ showConfig: false, configClosing: false }, () => {
          this.updatePageScrollState();
        });
        this.configCloseTimer = undefined;
      }, 380);
    });
  },

  updatePageScrollState() {
    wx.nextTick(() => {
      const query = wx.createSelectorQuery();
      query.select('.page-scroll').boundingClientRect();
      query.select('.page-content').boundingClientRect();
      query.exec((res) => {
        const container = res[0] as
          | WechatMiniprogram.BoundingClientRectCallbackResult
          | undefined;
        const content = res[1] as
          | WechatMiniprogram.BoundingClientRectCallbackResult
          | undefined;
        if (!container || !content) {
          this.setData({ pageScrollable: false, pageScrollReady: true });
          return;
        }
        const shouldScroll = content.height - container.height > 2;
        this.setData({
          pageScrollable: shouldScroll,
          pageScrollReady: true,
        });
      });
    });
  },

  // 开始配置
  onStartConfig() {
    const { ssid, password } = this.data;

    if (!ssid.trim()) {
      wx.showToast({ title: '请输入 WiFi 名称', icon: 'none' });
      return;
    }

    if (!password.trim()) {
      wx.showToast({ title: '请输入 WiFi 密码', icon: 'none' });
      return;
    }

    this.setData(
      {
        configStep: 'scanning',
        statusText: '正在搜索设备...',
        resultMessage: '',
      },
      () => {
        this.updatePageScrollState();
      },
    );

    this.initBluetooth();
  },

  // 初始化蓝牙
  initBluetooth() {
    wx.openBluetoothAdapter({
      mode: 'central',
      success: () => {
        this.startScan();
      },
      fail: (err) => {
        console.error('蓝牙初始化失败', err);
        if (err.errCode === 10001) {
          this.setData({
            statusText: '请打开蓝牙后重试',
          });
          // 监听蓝牙开启
          wx.onBluetoothAdapterStateChange((res) => {
            if (res.available && this.data.configStep === 'scanning') {
              this.startScan();
            }
          });
        } else if (err.errMsg?.includes('already opened')) {
          this.startScan();
        } else {
          this.onConfigError('蓝牙初始化失败');
        }
      },
    });
  },

  // 开始扫描
  startScan() {
    this.setData({ statusText: `正在搜索 ${TARGET_DEVICE_NAME}...` });

    wx.offBluetoothDeviceFound(() => {});

    wx.onBluetoothDeviceFound((res) => {
      for (const device of res.devices) {
        const deviceName = device.name || device.localName;
        console.log('发现设备:', deviceName);

        // 找到目标设备
        if (deviceName === TARGET_DEVICE_NAME) {
          console.log('找到目标设备:', device);
          wx.stopBluetoothDevicesDiscovery();
          wx.offBluetoothDeviceFound(() => {});

          const targetDevice: BluetoothDevice = {
            deviceId: device.deviceId,
            name: deviceName,
            RSSI: device.RSSI,
          };

          this.setData({
            configStep: 'connecting',
            statusText: '正在连接设备...',
            connectedDevice: targetDevice,
          });

          this.connectDevice(targetDevice);
          return;
        }
      }
    });

    wx.startBluetoothDevicesDiscovery({
      allowDuplicatesKey: false,
      success: () => {
        console.log('开始扫描');
        // 设置超时
        setTimeout(() => {
          if (this.data.configStep === 'scanning') {
            wx.stopBluetoothDevicesDiscovery();
            this.onConfigError('未找到设备，请确保设备已开启');
          }
        }, 15000); // 15秒超时
      },
      fail: () => {
        this.onConfigError('扫描失败');
      },
    });
  },

  // 连接设备
  connectDevice(device: BluetoothDevice) {
    wx.createBLEConnection({
      deviceId: device.deviceId,
      success: () => {
        console.log('连接成功');
        // 延迟获取服务，等待连接稳定
        setTimeout(() => {
          this.getDeviceServices(device.deviceId);
        }, 500);
      },
      fail: (err) => {
        console.error('连接失败', err);
        this.onConfigError('连接设备失败');
      },
    });
  },

  // 获取设备服务
  getDeviceServices(deviceId: string) {
    wx.getBLEDeviceServices({
      deviceId,
      success: (res) => {
        console.log('服务列表:', res.services);

        // 通常第一个自定义服务就是我们需要的
        // 过滤掉标准服务（以 0000 开头的通常是标准服务）
        const customServices = res.services.filter(
          (s) => !s.uuid.toUpperCase().startsWith('0000'),
        );
        const services =
          customServices.length > 0 ? customServices : res.services;

        if (services.length > 0) {
          this.findBleCharacteristics(deviceId, services);
        } else {
          this.onConfigError('未找到可用服务');
        }
      },
      fail: (err) => {
        console.error('获取服务失败', err);
        this.onConfigError('获取设备服务失败');
      },
    });
  },

  // 在所有服务中寻找可写/可读特征值
  findBleCharacteristics(
    deviceId: string,
    services: WechatMiniprogram.BLEService[],
  ) {
    let writableChar: WechatMiniprogram.BLECharacteristic | null = null;
    let readableChar: WechatMiniprogram.BLECharacteristic | null = null;
    let writableServiceId = '';
    let readableServiceId = '';

    const scanNext = (index: number) => {
      if (index >= services.length) {
        if (writableChar && readableChar) {
          console.log(
            '写入特征值:',
            writableChar.uuid,
            writableChar.properties,
            'service:',
            writableServiceId,
          );
          console.log(
            '读取特征值:',
            readableChar.uuid,
            readableChar.properties,
            'service:',
            readableServiceId,
          );
          this.setData({
            bleServiceId: writableServiceId,
            bleCharacteristicId: writableChar.uuid,
            bleReadServiceId: readableServiceId,
            bleReadCharacteristicId: readableChar.uuid,
          });

          this.setupBleValueListener();

          // 开启通知（如果支持）
          if (
            readableChar.properties.notify ||
            readableChar.properties.indicate
          ) {
            this.enableNotifyAndSendWifi(
              deviceId,
              readableServiceId,
              readableChar.uuid,
            );
          } else {
            // 不支持通知，直接发送
            this.sendWifiConfig();
          }
        } else {
          this.onConfigError('未找到可读写的特征值');
        }
        return;
      }

      const serviceId = services[index].uuid;
      wx.getBLEDeviceCharacteristics({
        deviceId,
        serviceId,
        success: (res) => {
          console.log('特征值列表:', serviceId, res.characteristics);

          if (!writableChar) {
            const foundWritable = res.characteristics.find(
              (c) => c.properties.write,
            );
            if (foundWritable) {
              writableChar = foundWritable;
              writableServiceId = serviceId;
            }
          }

          if (!readableChar) {
            const foundReadable =
              res.characteristics.find(
                (c) => c.properties.read && !c.properties.write,
              ) ||
              res.characteristics.find(
                (c) =>
                  c.properties.read ||
                  c.properties.notify ||
                  c.properties.indicate,
              );
            if (foundReadable) {
              readableChar = foundReadable;
              readableServiceId = serviceId;
            }
          }

          scanNext(index + 1);
        },
        fail: (err) => {
          console.error('获取特征值失败', err);
          scanNext(index + 1);
        },
      });
    };

    scanNext(0);
  },

  // 开启通知并发送 WiFi 配置
  enableNotifyAndSendWifi(
    deviceId: string,
    serviceId: string,
    characteristicId: string,
  ) {
    wx.notifyBLECharacteristicValueChange({
      deviceId,
      serviceId,
      characteristicId,
      state: true,
      success: () => {
        console.log('通知已开启');

        this.sendWifiConfig();
      },
      fail: (err) => {
        console.error('开启通知失败', err);
        // 即使通知失败也尝试发送
        this.sendWifiConfig();
      },
    });
  },

  // 发送 WiFi 配置
  sendWifiConfig() {
    const {
      ssid,
      password,
      connectedDevice,
      bleServiceId,
      bleCharacteristicId,
    } = this.data;
    if (!connectedDevice) return;

    this.setData({
      configStep: 'sending_wifi',
      statusText: '正在发送 WiFi 配置...',
    });

    const message = `setwifi:${ssid.trim()}|${password.trim()}`;
    const buffer = this.stringToArrayBuffer(message);

    wx.writeBLECharacteristicValue({
      deviceId: connectedDevice.deviceId,
      serviceId: bleServiceId,
      characteristicId: bleCharacteristicId,
      value: buffer,
      success: () => {
        console.log('WiFi 配置已发送');
        this.sendGetInfoOnce();
        setTimeout(() => {
          this.startReadInfoPolling();
        }, 1000);
      },
      fail: (err) => {
        console.error('发送 WiFi 配置失败', err);
        this.onConfigError('发送配置失败');
      },
    });
  },

  // 开始轮询读取设备信息
  startReadInfoPolling() {
    this.clearReadInfoTimer();
    this.readInfoAttempts = 0;
    this.setData({
      configStep: 'sending_getinfo',
      statusText: '正在读取设备信息...',
    });
    console.log('开始读取设备信息轮询');
    this.pollReadInfo();
  },

  pollReadInfo() {
    if (this.data.configStep !== 'sending_getinfo') return;

    if (this.readInfoAttempts >= 30) {
      console.warn('读取设备信息超过最大次数');
      this.disconnectDevice();
      this.onConfigError('获取设备信息失败');
      return;
    }

    this.readInfoAttempts += 1;
    console.log('读取设备信息尝试次数:', this.readInfoAttempts);
    this.sendGetInfoOnce();
    this.readDeviceInfoOnce();
    this.readInfoTimer = setTimeout(() => {
      this.pollReadInfo();
    }, 1000);
  },

  // 发送 getinfo
  sendGetInfoOnce() {
    const { connectedDevice, bleServiceId, bleCharacteristicId } = this.data;
    if (!connectedDevice) return;

    const buffer = this.stringToArrayBuffer('getinfo');

    wx.writeBLECharacteristicValue({
      deviceId: connectedDevice.deviceId,
      serviceId: bleServiceId,
      characteristicId: bleCharacteristicId,
      value: buffer,
      success: () => {
        console.log('getinfo 已发送');
      },
      fail: (err) => {
        console.error('发送 getinfo 失败', err);
      },
    });
  },

  // 读取设备信息
  readDeviceInfoOnce() {
    const { connectedDevice, bleReadServiceId, bleReadCharacteristicId } =
      this.data;
    if (!connectedDevice) return;
    if (!bleReadCharacteristicId) {
      console.error('读取设备信息失败: 缺少读取特征值');
      return;
    }

    wx.readBLECharacteristicValue({
      deviceId: connectedDevice.deviceId,
      serviceId: bleReadServiceId,
      characteristicId: bleReadCharacteristicId,
      success: (res) => {
        console.log('读取设备信息请求成功:', res.errCode);
      },
      fail: (err) => {
        console.error('读取设备信息失败', err);
      },
    });
  },

  // 处理设备响应
  handleDeviceResponse(value: string) {
    const trimmedValue = value.trim();
    console.log('处理响应:', trimmedValue, '当前步骤:', this.data.configStep);

    if (this.data.configStep === 'sending_getinfo') {
      const parts = trimmedValue.split(',');
      if (parts.length < 3) {
        return;
      }

      const deviceTypeId = Number(parts[0].trim());
      const macAddress = parts[1].trim().replace(/:/g, '').toLowerCase();
      const readyFlag = Number(parts[2].trim());
      if (!Number.isFinite(deviceTypeId) || !macAddress) {
        return;
      }

      if (readyFlag === 1) {
        this.clearReadInfoTimer();
        this.postDeviceInfo(deviceTypeId, macAddress);
      } else {
        this.setData({
          statusText: '等待设备联网...',
        });
      }
    }
  },

  postDeviceInfo(deviceTypeId: number, macAddress: string) {
    const token = getToken();
    const payload = {
      macAddress,
      deviceTypeId,
    };

    this.setData({
      statusText: '正在创建设备...',
    });

    wx.request({
      url: `${API_BASE}/api/devices`,
      method: 'POST',
      data: payload,
      header: token ? { Authorization: `Bearer ${token}` } : {},
      success: (res) => {
        if (
          res.statusCode === 419 ||
          (res.statusCode >= 200 && res.statusCode < 300)
        ) {
          this.onConfigComplete(`${deviceTypeId} ${macAddress}`);
        } else {
          console.error('保存设备信息失败', res);
          this.onConfigError('保存设备信息失败');
        }
      },
      fail: (err) => {
        console.error('保存设备信息失败', err);
        this.onConfigError('保存设备信息失败');
      },
    });
  },

  // 配置完成
  onConfigComplete(result: string) {
    this.clearReadInfoTimer();
    this.setData(
      {
        configStep: 'done',
        statusText: '配置完成',
        resultMessage: result,
      },
      () => {
        this.updatePageScrollState();
      },
    );

    // 断开连接
    this.disconnectDevice();
    this.loadDevices();

    wx.showToast({
      title: '配置成功',
      icon: 'success',
    });
  },

  // 配置出错
  onConfigError(message: string) {
    this.clearReadInfoTimer();
    this.setData(
      {
        configStep: 'error',
        statusText: message,
      },
      () => {
        this.updatePageScrollState();
      },
    );

    this.cleanupBluetooth();

    wx.showToast({
      title: message,
      icon: 'none',
    });
  },

  // 断开设备连接
  disconnectDevice() {
    const device = this.data.connectedDevice;
    if (!device) return;

    wx.closeBLEConnection({
      deviceId: device.deviceId,
      complete: () => {
        this.cleanupBluetooth();
        this.setData({
          connectedDevice: null,
          bleServiceId: '',
          bleCharacteristicId: '',
          bleReadServiceId: '',
          bleReadCharacteristicId: '',
        });
      },
    });
  },

  // 清理蓝牙资源
  cleanupBluetooth() {
    this.clearReadInfoTimer();
    wx.offBluetoothDeviceFound(() => {});
    wx.offBluetoothAdapterStateChange(() => {});
    wx.offBLECharacteristicValueChange(() => {});
    wx.stopBluetoothDevicesDiscovery();
    wx.closeBluetoothAdapter();
  },

  // 重新开始
  onReset() {
    this.cleanupBluetooth();
    this.setData(
      {
        configStep: 'idle',
        statusText: '',
        resultMessage: '',
        connectedDevice: null,
        bleServiceId: '',
        bleCharacteristicId: '',
        bleReadServiceId: '',
        bleReadCharacteristicId: '',
        showPassword: false,
      },
      () => {
        this.updatePageScrollState();
      },
    );
  },

  setupBleValueListener() {
    wx.onBLECharacteristicValueChange((res) => {
      console.log('收到蓝牙原始数据:', res);
      const value = this.arrayBufferToString(res.value);
      console.log('收到数据:', value);
      this.handleDeviceResponse(value);
    });
  },

  clearReadInfoTimer() {
    if (this.readInfoTimer) {
      clearTimeout(this.readInfoTimer);
      this.readInfoTimer = undefined;
    }
  },

  // 工具函数
  arrayBufferToString(buffer: ArrayBuffer): string {
    const uint8Array = new Uint8Array(buffer);
    let str = '';
    for (let i = 0; i < uint8Array.length; i++) {
      str += String.fromCharCode(uint8Array[i]);
    }
    return str;
  },

  stringToArrayBuffer(str: string): ArrayBuffer {
    const buffer = new ArrayBuffer(str.length);
    const uint8Array = new Uint8Array(buffer);
    for (let i = 0; i < str.length; i++) {
      uint8Array[i] = str.charCodeAt(i);
    }
    return buffer;
  },
});

// Vodafone-96B4C
// cakKfFtSSsc6a9ca
// setwifi:Vodafone-96B4C|cakKfFtSSsc6a9ca
// setip:192.168.86.156
// getinfo
