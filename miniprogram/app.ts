// app.ts
import { isLoggedIn, getUserInfo } from './utils/auth'

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
  }
})
