// index.ts
import { isLoggedIn, getUserInfo } from '../../utils/auth'

Page({
  data: {
    nickname: ''
  },

  onLoad() {
    // 检查登录状态
    if (!isLoggedIn()) {
      wx.reLaunch({
        url: '/pages/login/login'
      })
      return
    }

    // 获取用户信息
    const userInfo = getUserInfo()
    if (userInfo) {
      this.setData({
        nickname: userInfo.nickname
      })
    }
  },

  onShow() {
    // 每次显示页面时检查登录状态
    if (!isLoggedIn()) {
      wx.reLaunch({
        url: '/pages/login/login'
      })
    }
  }
})
