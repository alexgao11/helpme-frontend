import { getUserInfo } from '../../utils/auth'
import { needsSubscribeAuth, requestAlarmSubscribe } from '../../utils/subscribe'

Page({
  data: {
    nickname: '微信用户',
    phoneDisplay: '',
    showSubscribeAuth: false
  },

  onShow() {
    const needsAuth = this.refreshSubscribeAuth()
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1, showProfileDot: needsAuth })
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
    wx.navigateTo({ url: '/pages/userinfo/userinfo' })
  },

  onEmergencyContactsTap() {
    console.log('紧急联系人')
    wx.navigateTo({ url: '/pages/emergencyContacts/emergencyContacts' })
  },

  onAboutTap() {
    console.log('关于/使用说明')
  },

  async onSubscribeTap() {
    await requestAlarmSubscribe()
    const needsAuth = this.refreshSubscribeAuth()
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1, showProfileDot: needsAuth })
    }
  },

  refreshSubscribeAuth() {
    const needsAuth = needsSubscribeAuth()
    this.setData({ showSubscribeAuth: needsAuth })
    return needsAuth
  }
})
