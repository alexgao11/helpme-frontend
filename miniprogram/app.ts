// app.ts
import { isLoggedIn, getUserInfo } from './utils/auth'
import { PENDING_SHARE_KEY } from './utils/constant'

App<IAppOption>({
  globalData: {},
  onLaunch(options: WechatMiniprogram.App.LaunchShowOption) {
    // 检查登录状态
    if (!isLoggedIn()) {
      const path = options?.path || ''
      const query = (options?.query || {}) as Record<string, string>
      if (path === 'pages/shareReceive/shareReceive' && query.deviceId && query.shareCode) {
        wx.setStorageSync(PENDING_SHARE_KEY, {
          deviceId: query.deviceId,
          shareCode: query.shareCode,
          deviceName: query.deviceName || '',
          fromId: query.fromId || '',
          fromName: query.fromName || ''
        })
      }
      wx.reLaunch({
        url: '/pages/login/login'
      })
      return
    }

    // 已登录，检查 nickname 决定跳转页面
    const userInfo = getUserInfo()
    if (!userInfo?.nickname) {
      wx.switchTab({
        url: '/pages/profile/profile'
      })
    } else {
      wx.switchTab({
        url: '/pages/device/device'
      })
    }
  },

  onShow() {
    if (!isLoggedIn()) {
      return
    }
  }
})
