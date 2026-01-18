// app.ts
import { isLoggedIn } from './utils/auth'

App<IAppOption>({
  globalData: {},

  onLaunch() {
    // 检查登录状态，决定跳转页面
    if (!isLoggedIn()) {
      wx.reLaunch({
        url: '/pages/login/login'
      })
    }
  }
})
