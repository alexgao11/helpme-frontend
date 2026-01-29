import { setToken, setUserInfo } from '../../utils/auth'
import { requestAlarmSubscribe } from '../../utils/subscribe'
import { API_BASE, PENDING_SHARE_KEY } from '../../utils/constant'

Page({
  data: {
    loginCode: ''
  },

  onLoad() {
    this.refreshLoginCode()
  },

  async refreshLoginCode() {
    try {
      const loginRes = await new Promise<WechatMiniprogram.LoginSuccessCallbackResult>((resolve, reject) => {
        wx.login({
          success: resolve,
          fail: reject
        })
      })
      this.setData({ loginCode: loginRes.code })
    } catch (error) {
      console.log(error)
      this.setData({ loginCode: '' })
    }
  },

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
      // 复用按钮点击前获取到的 code，避免与本次 encryptedData/iv 不匹配
      let loginCode = this.data.loginCode
      if (!loginCode) {
        await this.refreshLoginCode()
        loginCode = this.data.loginCode
      }
      if (!loginCode) {
        throw new Error('无法获取登录凭证')
      }

      // 调用登录API
      const response = await new Promise<{ token: string; user: any  }>((resolve, reject) => {
        wx.request({
          url: `${API_BASE}/api/user/login`,
          method: 'POST',
          header: {
            'content-type': 'application/json'
          },
          data: {
            code: loginCode,
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

      // code 只能用一次，消费后清空
      this.setData({ loginCode: '' })

      // 保存登录信息
      setToken(response.token)
      setUserInfo(response.user)

      wx.hideLoading()

      const pendingShare = wx.getStorageSync(PENDING_SHARE_KEY) as
        | { deviceId?: string; shareCode?: string }
        | undefined
      if (pendingShare?.deviceId && pendingShare.shareCode) {
        try {
          await new Promise<void>((resolve, reject) => {
            wx.request({
              url: `${API_BASE}/api/devices/${pendingShare.deviceId}/share/accept`,
              method: 'POST',
              header: {
                Authorization: `Bearer ${response.token}`,
                'content-type': 'application/json'
              },
              data: {
                shareCode: pendingShare.shareCode
              },
              success: (res) => {
                if (res.statusCode === 201) {
                  resolve()
                } else {
                  reject(new Error((res.data as any)?.message || '领取失败'))
                }
              },
              fail: reject
            })
          })
          wx.removeStorageSync(PENDING_SHARE_KEY)
          wx.showToast({ title: '领取成功', icon: 'success' })
        } catch (error) {
          console.log(error)
          wx.removeStorageSync(PENDING_SHARE_KEY)
          wx.showToast({
            title: '领取失败，请稍后重试',
            icon: 'none'
          })
        }
      }

      await requestAlarmSubscribe()

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
      this.setData({ loginCode: '' })
      wx.hideLoading()
      wx.showToast({
        title: '登录失败，请重试',
        icon: 'none'
      })
    }
  }
})
