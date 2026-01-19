const TOKEN_KEY = 'auth_token'
const USER_INFO_KEY = 'user_info'
const TOKEN_EXPIRE_KEY = 'token_expire_time'

// Token 有效期（毫秒），这里设置为 7 天
const TOKEN_EXPIRE_DURATION = 7 * 24 * 60 * 60 * 1000

export interface UserInfo {
  nickname: string
  phone: string
  countryCode?: string
  phoneNumber?: string
  [key: string]: any
}

/**
 * 保存 token
 */
export function setToken(token: string): void {
  wx.setStorageSync(TOKEN_KEY, token)
  wx.setStorageSync(TOKEN_EXPIRE_KEY, Date.now() + TOKEN_EXPIRE_DURATION)
}

/**
 * 获取 token
 */
export function getToken(): string | null {
  return wx.getStorageSync(TOKEN_KEY) || null
}

/**
 * 保存用户信息
 */
export function setUserInfo(userInfo: UserInfo): void {
  wx.setStorageSync(USER_INFO_KEY, userInfo)
}

/**
 * 获取用户信息
 */
export function getUserInfo(): UserInfo | null {
  return wx.getStorageSync(USER_INFO_KEY) || null
}

/**
 * 检查是否已登录且 token 未过期
 */
export function isLoggedIn(): boolean {
  const token = getToken()
  if (!token) {
    return false
  }

  const expireTime = wx.getStorageSync(TOKEN_EXPIRE_KEY)
  if (!expireTime || Date.now() > expireTime) {
    // Token 已过期，清除登录信息
    clearAuth()
    return false
  }

  return true
}

/**
 * 清除登录信息
 */
export function clearAuth(): void {
  wx.removeStorageSync(TOKEN_KEY)
  wx.removeStorageSync(USER_INFO_KEY)
  wx.removeStorageSync(TOKEN_EXPIRE_KEY)
}

/**
 * 退出登录
 */
export function logout(): void {
  clearAuth()
  wx.reLaunch({
    url: '/pages/login/login'
  })
}
