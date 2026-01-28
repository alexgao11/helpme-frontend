Page({
  data: {
    fromId: '',
    deviceId: '',
    shareCode: '',
    deviceName: '',
  },

  onLoad(options: Record<string, string>) {
    const fromId = options.fromId || '';
    const deviceId = options.deviceId || '';
    const shareCode = options.shareCode || '';
    const deviceName = options.deviceName
      ? decodeURIComponent(options.deviceName)
      : '';

    this.setData({
      fromId,
      deviceId,
      shareCode,
      deviceName,
    });

    wx.setNavigationBarTitle({ title: '分享设备' });
  },
});
