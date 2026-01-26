// app.ts
import { isLoggedIn, getUserInfo } from './utils/auth'
import { needsSubscribeAuth, requestAlarmSubscribe } from './utils/subscribe'

App<IAppOption>({
  globalData: {},

  onLaunch() {
    // 检查登录状态
    if (!isLoggedIn()) {
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

    if (!needsSubscribeAuth()) {
      return
    }

    wx.showModal({
      title: '告警通知',
      content: '授权小程序发送告警通知',
      confirmText: '去授权',
      success: async (res) => {
        if (!res.confirm) {
          return
        }
        await requestAlarmSubscribe()
      }
    })
  }
})
