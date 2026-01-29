import { getToken, isLoggedIn } from '../../utils/auth';
import { API_BASE, PENDING_SHARE_KEY } from '../../utils/constant';

Page({
  data: {
    fromId: '',
    deviceId: '',
    shareCode: '',
    deviceName: '',
    isAccepting: false,
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

    if (deviceId && shareCode) {
      if (isLoggedIn()) {
        this.acceptShare(deviceId, shareCode);
      } else {
        wx.setStorageSync(PENDING_SHARE_KEY, {
          deviceId,
          shareCode,
          deviceName,
          fromId,
        });
        wx.showToast({ title: '请先登录后领取', icon: 'none' });
        wx.navigateTo({ url: '/pages/login/login' });
      }
    }
  },

  acceptShare(deviceId: string, shareCode: string) {
    if (this.data.isAccepting) return;
    const token = getToken();
    if (!token) {
      wx.showToast({ title: '请先登录后领取', icon: 'none' });
      return;
    }

    this.setData({ isAccepting: true });
    wx.request({
      url: `${API_BASE}/api/devices/${deviceId}/share/accept`,
      method: 'POST',
      header: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      data: {
        shareCode,
      },
      success: (res: WechatMiniprogram.RequestSuccessCallbackResult) => {
        if (res.statusCode === 201) {
          wx.removeStorageSync(PENDING_SHARE_KEY);
          wx.showToast({ title: '领取成功', icon: 'success' });
        } else {
          const message =
            (res.data as { message?: string })?.message || '领取失败';
          wx.showToast({ title: message, icon: 'none' });
        }
      },
      fail: () => {
        wx.showToast({ title: '领取失败', icon: 'none' });
      },
      complete: () => {
        this.setData({ isAccepting: false });
      },
    });
  },
});
