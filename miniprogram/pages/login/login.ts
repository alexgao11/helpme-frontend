import { setToken, setUserInfo } from '../../utils/auth'

Page({
  data: {},

  onLoad() {},

  // 获取手机号回调
  async onGetPhoneNumber(e: WechatMiniprogram.ButtonGetUserInfo) {
    if (e.detail.errMsg !== 'getPhoneNumber:ok') {
      wx.showToast({
        title: '需要授权手机号才能使用',
        icon: 'none'
      })
      return
    }

    if (!e.detail.encryptedData || !e.detail.iv) {
      wx.showToast({
        title: '获取手机号失败',
        icon: 'none'
      })
      return
    }

    wx.showLoading({ title: '登录中...' })

    try {
      // 获取微信登录凭证
      const loginRes = await new Promise<WechatMiniprogram.LoginSuccessCallbackResult>((resolve, reject) => {
        wx.login({
          success: resolve,
          fail: reject
        })
      })

      // 调用登录API
      const response = await new Promise<{ token: string; user: any  }>((resolve, reject) => {
        wx.request({
          url: 'http://192.168.86.156:3000/api/user/login',
          method: 'POST',
          data: {
            code: loginRes.code,
            encryptedData: e.detail.encryptedData,
            iv: e.detail.iv
          },
          success: (res) => {
            if (res.statusCode === 200) {
              resolve(res.data as any)
            } else {
              reject(new Error((res.data as any).message || '登录失败'))
            }
          },
          fail: reject
        })
      })

      // 保存登录信息
      setToken(response.token)
      setUserInfo(response.user)

      wx.hideLoading()

      // 根据 nickname 决定跳转页面
      if (!response.user.nickname) {
        wx.switchTab({
          url: '/pages/profile/profile'
        })
      } else {
        wx.switchTab({
          url: '/pages/device/device'
        })
      }
    } catch (error) {
      console.log(error)
      wx.hideLoading()
      wx.showToast({
        title: '登录失败，请重试',
        icon: 'none'
      })
    }
  }
})
