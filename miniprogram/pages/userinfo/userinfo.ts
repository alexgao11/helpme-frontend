import { getUserInfo, setUserInfo, getToken } from '../../utils/auth'

Page({
  data: {
    nickname: '',
    phoneDisplay: ''
  },

  onLoad() {
    this.loadUserInfo()
  },

  loadUserInfo() {
    const userInfo = getUserInfo()
    if (userInfo) {
      let phoneDisplay = ''
      if (userInfo.phoneNumber) {
        if (userInfo.countryCode) {
          phoneDisplay = `+${userInfo.countryCode}-${userInfo.phoneNumber}`
        } else {
          phoneDisplay = userInfo.phoneNumber
        }
      }
      this.setData({
        nickname: userInfo.nickname || '',
        phoneDisplay
      })
    }
  },

  onNicknameInput(e: WechatMiniprogram.Input) {
    this.setData({ nickname: e.detail.value })
  },

  onSave() {
    console.log('保存用户信息')
    const { nickname } = this.data

    if (!nickname.trim()) {
      wx.showToast({ title: '请输入显示名称', icon: 'none' })
      return
    }

    const token = getToken()
    wx.request({
      url: 'http://127.0.0.1:3000/api/user/me',
      method: 'PUT',
      header: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      data: {
        nickname: nickname.trim()
      },
      success: (res) => {
        if (res.statusCode === 200) {
          const userInfo = getUserInfo() || { nickname: '', phone: '' }
          userInfo.nickname = nickname.trim()
          setUserInfo(userInfo)

          wx.showToast({ title: '保存成功', icon: 'success' })
          setTimeout(() => {
            wx.navigateBack()
          }, 1500)
        } else {
          wx.showToast({ title: '保存失败', icon: 'none' })
        }
      },
      fail: () => {
        wx.showToast({ title: '网络错误', icon: 'none' })
      }
    })
  },

  onCancel() {
    console.log('取消')
    wx.navigateBack()
  }
})
