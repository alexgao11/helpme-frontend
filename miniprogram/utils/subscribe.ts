const SUBSCRIBE_STATUS_KEY = 'subscribe_message_status'
const ALARM_TEMPLATE_ID = 'hpxcTOI19Qx6QhW6rbRVaH-N4NxX5u9J8QMsi5v-ujs'

export type SubscribeStatus = 'accept' | 'reject' | 'ban' | 'unknown'

export function getSubscribeStatus(): SubscribeStatus {
  return (wx.getStorageSync(SUBSCRIBE_STATUS_KEY) as SubscribeStatus) || 'unknown'
}

export function setSubscribeStatus(status: SubscribeStatus): void {
  wx.setStorageSync(SUBSCRIBE_STATUS_KEY, status)
}

export function needsSubscribeAuth(): boolean {
  return getSubscribeStatus() !== 'accept'
}

export function requestAlarmSubscribe(): Promise<SubscribeStatus> {
  return new Promise((resolve) => {
    wx.requestSubscribeMessage({
      tmplIds: [ALARM_TEMPLATE_ID],
      success: (res) => {
        const result = res[ALARM_TEMPLATE_ID] as SubscribeStatus | undefined
        const status: SubscribeStatus =
          result === 'accept' || result === 'reject' || result === 'ban' ? result : 'unknown'
        setSubscribeStatus(status)
        resolve(status)
      },
      fail: () => {
        setSubscribeStatus('reject')
        resolve('reject')
      }
    })
  })
}
