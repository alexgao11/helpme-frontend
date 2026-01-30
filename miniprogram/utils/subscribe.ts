const SUBSCRIBE_STATUS_KEY = 'subscribe_message_status';
const SUBSCRIBE_PROMPT_AT_KEY = 'subscribe_message_prompt_at';
const ALARM_TEMPLATE_ID = 'hpxcTOI19Qx6QhW6rbRVaH-N4NxX5u9J8QMsi5v-ujs';

export type SubscribeStatus = 'accept' | 'reject' | 'ban' | 'unknown';

export function getSubscribeStatus(): SubscribeStatus {
  return (
    (wx.getStorageSync(SUBSCRIBE_STATUS_KEY) as SubscribeStatus) || 'unknown'
  );
}

export function setSubscribeStatus(status: SubscribeStatus): void {
  wx.setStorageSync(SUBSCRIBE_STATUS_KEY, status);
}

export function getLastSubscribePromptAt(): number {
  return Number(wx.getStorageSync(SUBSCRIBE_PROMPT_AT_KEY)) || 0;
}

export function setLastSubscribePromptAt(timestamp: number): void {
  wx.setStorageSync(SUBSCRIBE_PROMPT_AT_KEY, timestamp);
}

export function needsSubscribeAuth(): boolean {
  return getSubscribeStatus() !== 'accept';
}

export function refreshSubscribeStatus(): Promise<SubscribeStatus> {
  return new Promise((resolve) => {
    wx.getSetting({
      withSubscriptions: true,
      success: (res) => {
        const setting = res.subscriptionsSetting;
        const itemSettings =
          setting && setting.itemSettings ? setting.itemSettings : undefined;
        const itemStatus = itemSettings
          ? (itemSettings[ALARM_TEMPLATE_ID] as SubscribeStatus | undefined)
          : undefined;
        let status: SubscribeStatus = getSubscribeStatus();
        console.log('refreshSubscribeStatus', setting, itemStatus);
        if (setting && setting.mainSwitch === false) {
          status = 'reject';
        } else if (
          itemStatus === 'accept' ||
          itemStatus === 'reject' ||
          itemStatus === 'ban'
        ) {
          status = itemStatus;
        }
        setSubscribeStatus(status);
        resolve(status);
      },
      fail: () => {
        resolve(getSubscribeStatus());
      },
    });
  });
}

export function requestAlarmSubscribe(): Promise<SubscribeStatus> {
  return new Promise((resolve) => {
    console.log('requestAlarmSubscribe');
    wx.requestSubscribeMessage({
      tmplIds: [ALARM_TEMPLATE_ID],
      success: (res) => {
        const result = res[ALARM_TEMPLATE_ID] as SubscribeStatus | undefined;
        const status: SubscribeStatus =
          result === 'accept' || result === 'reject' || result === 'ban'
            ? result
            : 'unknown';
        setSubscribeStatus(status);
        resolve(status);
      },
      fail: () => {
        setSubscribeStatus('reject');
        resolve('reject');
      },
    });
  });
}
