import { setToken, setUserInfo } from '../../utils/auth'

Page({
  data: {},

  onLoad() {},

  // 获取手机号回调
  async onGetPhoneNumber(e: WechatMiniprogram.GetPhoneNumberEventDetail & { detail: { code?: string; errMsg: string } }) {
    if (e.detail.errMsg !== 'getPhoneNumber:ok') {
      wx.showToast({
        title: '需要授权手机号才能使用',
        icon: 'none'
      })
      return
    }

    const phoneCode = e.detail.code
    if (!phoneCode) {
      wx.showToast({
        title: '获取手机号失败',
        icon: 'none'
      })
      return
    }

    wx.showLoading({ title: '登录中...' })

    try {
      // TODO: 调用登录API
      // const res = await loginWithPhone(phoneCode)
      // 占位符：模拟登录成功
      const mockResponse = {
        token: 'mock_token_xxx',
        userInfo: {
          nickname: '用户',
          phone: '138****8888'
        }
      }

      // 保存登录信息
      setToken(mockResponse.token)
      setUserInfo(mockResponse.userInfo)

      wx.hideLoading()

      // 跳转到首页
      wx.reLaunch({
        url: '/pages/index/index'
      })
    } catch (error) {
      wx.hideLoading()
      wx.showToast({
        title: '登录失败，请重试',
        icon: 'none'
      })
    }
  }
})
