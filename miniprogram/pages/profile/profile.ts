import { getUserInfo } from '../../utils/auth'

Page({
  data: {
    nickname: '微信用户',
    phoneDisplay: ''
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 })
    }
    this.loadUserInfo()
  },

  loadUserInfo() {
    const userInfo = getUserInfo()
    if (userInfo) {
      const nickname = userInfo.nickname || '微信用户'
      let phoneDisplay = ''
      if (userInfo.phoneNumber) {
        const countryCode = userInfo.countryCode || '86'
        phoneDisplay = `+${countryCode}-${userInfo.phoneNumber}`
      }
      this.setData({ nickname, phoneDisplay })
    }
  },

  onPhoneTap() {
    console.log('我的手机号')
    wx.navigateTo({ url: '/pages/userinfo/userinfo' })
  },

  onAboutTap() {
    console.log('关于/使用说明')
  }
})
