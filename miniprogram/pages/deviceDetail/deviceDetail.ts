import { getUserInfo, isLoggedIn } from '../../utils/auth';

interface ApiDevice {
  id: string;
  name: string | null;
  deviceTypeId: number;
  status: number;
  location: string | null;
  sharedTo: Array<{ id: string; name: string }>;
  activeAlarmCount: number;
}

Page({
  data: {
    device: null as ApiDevice | null,
    detailScrollable: false,
    detailScrollReady: false,
    shareNotice: '',
    canShare: false,
  },

  onLoad(options: Record<string, string>) {
    if (options?.id) {
      const name = options.name ? decodeURIComponent(options.name) : null;
      const shareFromName = options.fromName
        ? decodeURIComponent(options.fromName)
        : '';
      const shareFromId = options.fromId || '';
      const shareNotice =
        shareFromName || shareFromId
          ? `通过用户${shareFromName || shareFromId}分享的设备ID：${options.id}`
          : '';
      this.setData(
        {
          device: {
            id: options.id,
            name,
            deviceTypeId: 0,
            status: 0,
            location: null,
            sharedTo: [],
            activeAlarmCount: 0,
          },
          shareNotice,
        },
        () => {
          this.updateScrollState();
        },
      );
      wx.setNavigationBarTitle({
        title: name || '设备详情',
      });
    }

    const eventChannel = this.getOpenerEventChannel();
    eventChannel.on('device', (device: ApiDevice) => {
      const normalizedDevice = {
        ...device,
        sharedTo: Array.isArray(device.sharedTo) ? device.sharedTo : [],
      };
      this.setData({ device: normalizedDevice }, () => {
        this.updateScrollState();
      });
      this.setData({ shareNotice: '' });
      wx.setNavigationBarTitle({
        title: device?.name || '设备详情',
      });
    });
  },

  onShow() {
    this.setData({ canShare: isLoggedIn() });
    if (this.data.device) {
      this.updateScrollState();
    }
  },

  updateScrollState() {
    wx.nextTick(() => {
      const query = wx.createSelectorQuery();
      query.select('.detail-scroll').boundingClientRect();
      query.select('.device-detail').boundingClientRect();
      query.exec((res) => {
        const container = res[0] as
          | WechatMiniprogram.BoundingClientRectCallbackResult
          | undefined;
        const content = res[1] as
          | WechatMiniprogram.BoundingClientRectCallbackResult
          | undefined;
        if (!container || !content) {
          this.setData({ detailScrollable: false, detailScrollReady: true });
          return;
        }
        const shouldScroll = content.height - container.height > 2;
        this.setData({
          detailScrollable: shouldScroll,
          detailScrollReady: true,
        });
      });
    });
  },

  buildSharePayload() {
    const device = this.data.device;
    const name = device?.name || '设备';
    const nickname =
      (wx.getStorageSync('nickname') as string | undefined) ||
      getUserInfo()?.nickname;
    const shareTitle = `${nickname || '好友'}想分享给您以下设备`;
    const userInfo = getUserInfo() as { id?: string; userId?: string } | null;
    const userId = userInfo?.id || userInfo?.userId || '';
    const encodedName = encodeURIComponent(name);
    const encodedNickname = encodeURIComponent(nickname || '');
    const path = device?.id
      ? `/pages/shareReceive/shareReceive?fromId=${userId}&fromName=${encodedNickname}&deviceId=${device.id}&deviceName=${encodedName}`
      : '/pages/device/device';

    return {
      title: shareTitle,
      path,
      imageUrl: '/assets/share/device-share.png',
    };
  },

  onShareToFamily() {
    wx.showToast({ title: '请先登录后再分享', icon: 'none' });
    wx.navigateTo({ url: '/pages/login/login' });
  },

  onShareAppMessage() {
    if (!isLoggedIn()) {
      return {
        title: '请先登录后再分享',
        path: '/pages/login/login',
      };
    }
    return this.buildSharePayload();
  },

  onRemoveUser(e: WechatMiniprogram.TouchEvent) {
    const userId = e.currentTarget.dataset.id as string;
    const device = this.data.device;
    if (!device) return;

    const user = device.sharedTo.find((u) => u.id === userId);
    if (!user) return;

    wx.showModal({
      title: '确认移除',
      content: `确定要移除 ${user.name || '该用户'} 吗？`,
      success: (res) => {
        if (res.confirm) {
          const nextSharedTo = device.sharedTo.filter((u) => u.id !== userId);
          this.setData(
            { device: { ...device, sharedTo: nextSharedTo } },
            () => {
              this.updateScrollState();
            },
          );
        }
      },
    });
  },

  onDeleteDevice() {
    wx.showModal({
      title: '删除设备',
      content: '删除后该设备将无法再触发你的通知',
      confirmColor: '#FF3B30',
      success: (res) => {
        if (res.confirm) {
          wx.showToast({ title: '设备已删除', icon: 'success' });
          setTimeout(() => {
            wx.navigateBack();
          }, 1500);
        }
      },
    });
  },

  onEditDevice() {
    wx.showToast({ title: '编辑功能开发中', icon: 'none' });
  },
});
