import { getToken, getUserInfo, isLoggedIn } from '../../../utils/auth';
import { API_BASE } from '../../../utils/constant';

interface ApiAlarmButton {
  id: string;
  alarmsCount: number;
  location?: string | null;
  note?: string | null;
}

interface ApiDevice {
  id: string;
  name: string | null;
  deviceTypeId: number;
  status: number;
  location: string | null;
  sharedTo: Array<{ id: string; name: string }>;
  shareTo?: Array<{ id: string; name: string }>;
  activeAlarmCount: number;
  buttons?: ApiAlarmButton[];
}

interface EditDeviceForm {
  name: string;
  location: string;
}

interface EditAlarmButtonForm {
  id: string;
  location: string;
  note: string;
}

const generateShareCode = (length = 12) => {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let code = '';
  for (let i = 0; i < length; i += 1) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

const registerShareCode = (
  deviceId: string,
  token: string,
  shareCode: string,
) =>
  new Promise<void>((resolve, reject) => {
    wx.request({
      url: `${API_BASE}/api/devices/${deviceId}/share`,
      method: 'POST',
      header: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      data: {
        shareCode,
      },
      success: (res: WechatMiniprogram.RequestSuccessCallbackResult) => {
        if (res.statusCode === 201) {
          resolve();
          return;
        }
        reject(new Error('分享码登记失败'));
      },
      fail: reject,
    });
  });

const getCurrentUserId = () => {
  const userInfo = getUserInfo() as { id?: string; userId?: string } | null;
  return userInfo?.id || userInfo?.userId || '';
};

const normalizeSharedTo = (device: ApiDevice) => {
  if (Array.isArray(device.sharedTo)) {
    return device.sharedTo;
  }
  if (Array.isArray(device.shareTo)) {
    return device.shareTo;
  }
  return [];
};

const isSharedUser = (device: ApiDevice) => {
  const currentUserId = getCurrentUserId();
  if (!currentUserId) return false;
  const sharedTo = normalizeSharedTo(device);
  return sharedTo.some((user) => user.id === currentUserId);
};

Page({
  data: {
    device: null as ApiDevice | null,
    detailScrollable: false,
    detailScrollReady: false,
    shareNotice: '',
    canShare: false,
    isReadOnly: false,
    shareCode: '',
    isRefreshing: false,
    showEditModal: false,
    isUpdatingDevice: false,
    editingDevice: {
      name: '',
      location: '',
    } as EditDeviceForm,
    showButtonModal: false,
    isUpdatingButton: false,
    editingButton: {
      id: '',
      location: '',
      note: '',
    } as EditAlarmButtonForm,
  },

  onLoad(options: Record<string, string>) {
    if (options?.id) {
      const name = options.name ? decodeURIComponent(options.name) : null;
      const shareFromName = options.fromName
        ? decodeURIComponent(options.fromName)
        : '';
      const shareFromId = options.fromId || '';
      const shareNotice =
        shareFromName || shareFromId
          ? `通过用户${shareFromName || shareFromId}分享的设备ID：${options.id}`
          : '';
      this.setData(
        {
          device: {
            id: options.id,
            name,
            deviceTypeId: 9,
            status: 0,
            location: null,
            sharedTo: [],
            activeAlarmCount: 0,
            buttons: [],
          },
          shareNotice,
          shareCode: generateShareCode(),
          isReadOnly: false,
        },
        () => {
          this.updateScrollState();
        },
      );
      this.fetchDeviceDetail();
      wx.setNavigationBarTitle({
        title: name || '设备详情',
      });
    }

    const eventChannel = this.getOpenerEventChannel();
    eventChannel.on('device', (device: ApiDevice) => {
      if (device?.deviceTypeId !== 9) {
        const encodedName = encodeURIComponent(device?.name || '');
        wx.redirectTo({
          url: `/pages/deviceDetail/deviceDetail?id=${device.id}&name=${encodedName}`,
        });
        return;
      }
      const normalizedDevice = {
        ...device,
        sharedTo: normalizeSharedTo(device),
        buttons: Array.isArray(device.buttons) ? device.buttons : [],
      };
      this.setData(
        {
          device: normalizedDevice,
          shareCode: generateShareCode(),
          isReadOnly: isSharedUser(normalizedDevice),
        },
        () => {
          this.updateScrollState();
        },
      );
      this.fetchDeviceDetail();
      this.setData({ shareNotice: '' });
      wx.setNavigationBarTitle({
        title: device?.name || '设备详情',
      });
    });
  },

  onShow() {
    this.setData({ canShare: isLoggedIn() });
    if (this.data.device) {
      this.updateScrollState();
    }
    if (this.data.device?.id) {
      this.fetchDeviceDetail();
    }
  },

  onPullDownRefresh() {
    this.onScrollRefresh();
  },

  onScrollRefresh() {
    if (this.data.isRefreshing) return;
    this.setData({ isRefreshing: true });
    this.fetchDeviceDetail({ stopRefresh: true, stopPullDown: true });
  },

  fetchDeviceDetail(options?: {
    stopRefresh?: boolean;
    stopPullDown?: boolean;
  }) {
    const deviceId = this.data.device?.id;
    if (!deviceId) {
      console.log('[alarmDetail] missing deviceId, skip fetch');
      if (options?.stopRefresh) {
        this.setData({ isRefreshing: false });
      }
      if (options?.stopPullDown) {
        wx.stopPullDownRefresh();
      }
      return;
    }
    const token = getToken();
    if (!token) {
      console.log('[alarmDetail] missing token, skip fetch');
      if (options?.stopRefresh) {
        this.setData({ isRefreshing: false });
      }
      if (options?.stopPullDown) {
        wx.stopPullDownRefresh();
      }
      return;
    }

    console.log('[alarmDetail] fetch device detail', { deviceId });
    wx.request({
      url: `${API_BASE}/api/devices/${deviceId}`,
      method: 'GET',
      header: {
        Authorization: `Bearer ${token}`,
      },
      success: (res: WechatMiniprogram.RequestSuccessCallbackResult) => {
        if (res.statusCode === 200 && res.data) {
          const device = res.data as ApiDevice;
          const normalizedDevice = {
            ...device,
            sharedTo: normalizeSharedTo(device),
            buttons: Array.isArray(device.buttons) ? device.buttons : [],
          };
          if (normalizedDevice.deviceTypeId !== 9) {
            const encodedName = encodeURIComponent(normalizedDevice.name || '');
            wx.redirectTo({
              url: `/pages/deviceDetail/deviceDetail?id=${normalizedDevice.id}&name=${encodedName}`,
            });
            return;
          }
          this.setData(
            {
              device: normalizedDevice,
              shareCode: generateShareCode(),
              isReadOnly: isSharedUser(normalizedDevice),
            },
            () => {
              this.updateScrollState();
            },
          );
          wx.setNavigationBarTitle({
            title: normalizedDevice?.name || '设备详情',
          });
        } else {
          wx.showToast({ title: '设备加载失败', icon: 'none' });
        }
      },
      fail: () => {
        wx.showToast({ title: '设备加载失败', icon: 'none' });
      },
      complete: () => {
        if (options?.stopRefresh) {
          this.setData({ isRefreshing: false });
        }
        if (options?.stopPullDown) {
          wx.stopPullDownRefresh();
        }
      },
    });
  },

  updateScrollState() {
    wx.nextTick(() => {
      const query = wx.createSelectorQuery();
      query.select('.detail-scroll').boundingClientRect();
      query.select('.device-detail').boundingClientRect();
      query.exec((res) => {
        const container = res[0] as
          | WechatMiniprogram.BoundingClientRectCallbackResult
          | undefined;
        const content = res[1] as
          | WechatMiniprogram.BoundingClientRectCallbackResult
          | undefined;
        if (!container || !content) {
          this.setData({ detailScrollable: false, detailScrollReady: true });
          return;
        }
        const shouldScroll = content.height - container.height > 2;
        this.setData({
          detailScrollable: shouldScroll,
          detailScrollReady: true,
        });
      });
    });
  },

  buildSharePayload(shareCode: string) {
    const device = this.data.device;
    const name = device?.name || '设备';
    const nickname =
      (wx.getStorageSync('nickname') as string | undefined) ||
      getUserInfo()?.nickname;
    const shareTitle = `${nickname || '好友'}想分享给您以下设备`;
    const userInfo = getUserInfo() as { id?: string; userId?: string } | null;
    const userId = userInfo?.id || userInfo?.userId || '';
    const encodedName = encodeURIComponent(name);
    const encodedNickname = encodeURIComponent(nickname || '');
    const encodedShareCode = encodeURIComponent(shareCode);
    const path = device?.id
      ? `/pages/device/device?fromId=${userId}&fromName=${encodedNickname}&deviceId=${device.id}&shareCode=${encodedShareCode}&deviceName=${encodedName}`
      : '/pages/device/device';

    return {
      title: shareTitle,
      path,
      imageUrl: '/assets/share/device-share.png',
    };
  },

  onShareToFamily() {
    wx.showToast({ title: '请先登录后再分享', icon: 'none' });
    wx.navigateTo({ url: '/pages/login/login' });
  },

  onPrepareShare() {
    if (this.data.isReadOnly) return;
    if (!isLoggedIn()) {
      this.onShareToFamily();
      return;
    }
    const deviceId = this.data.device?.id;
    if (!deviceId) {
      wx.showToast({ title: '设备信息缺失', icon: 'none' });
      return;
    }
    const token = getToken();
    if (!token) {
      this.onShareToFamily();
      return;
    }
    const shareCode = this.data.shareCode || generateShareCode();
    this.setData({ shareCode });
    registerShareCode(deviceId, token, shareCode).catch((error) => {
      console.log('[deviceDetail9] register share code failed', error);
    });
  },

  onShareAppMessage(options: WechatMiniprogram.Page.IShareAppMessageOption) {
    if (this.data.isReadOnly) {
      return {
        title: '设备详情',
        path: '/pages/device/device',
      };
    }
    if (!isLoggedIn()) {
      return {
        title: '请先登录后再分享',
        path: '/pages/login/login',
      };
    }
    const deviceId = this.data.device?.id;
    if (!deviceId) {
      return {
        title: '设备分享',
        path: '/pages/device/device',
      };
    }
    const shareCode = this.data.shareCode || generateShareCode();
    if (shareCode !== this.data.shareCode) {
      this.setData({ shareCode });
    }
    const payload: WechatMiniprogram.Page.ICustomShareContent & {
      success?: () => void;
      fail?: () => void;
    } = this.buildSharePayload(shareCode);
    const token = getToken();
    if (!token) {
      return payload;
    }
    payload.success = () => {
      if (options?.from !== 'button') {
        registerShareCode(deviceId, token, shareCode).catch((error) => {
          console.log('[deviceDetail9] register share code failed', error);
        });
      }
      this.setData({ shareCode: generateShareCode() });
    };
    payload.fail = () => {
      console.log('[deviceDetail9] share canceled');
    };
    return payload;
  },

  onRemoveUser(e: WechatMiniprogram.TouchEvent) {
    if (this.data.isReadOnly) return;
    const userId = e.currentTarget.dataset.id as string;
    const device = this.data.device;
    if (!device) return;

    const user = device.sharedTo.find((u) => u.id === userId);
    if (!user) return;

    wx.showModal({
      title: '确认移除',
      content: `确定要移除 ${user.name || '该用户'} 吗？`,
      success: (res) => {
        if (res.confirm) {
          this.removeSharedUser(userId);
        }
      },
    });
  },

  removeSharedUser(userId: string) {
    const device = this.data.device;
    if (!device) return;
    const token = getToken();
    if (!token) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }

    wx.request({
      url: `${API_BASE}/api/devices/${device.id}/share`,
      method: 'DELETE',
      header: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      data: { userId },
      success: (res: WechatMiniprogram.RequestSuccessCallbackResult) => {
        if (res.statusCode === 200) {
          const nextSharedTo = device.sharedTo.filter((u) => u.id !== userId);
          this.setData(
            { device: { ...device, sharedTo: nextSharedTo } },
            () => {
              this.updateScrollState();
            },
          );
          wx.showToast({ title: '移除成功', icon: 'success' });
        } else {
          wx.showToast({ title: '移除失败', icon: 'none' });
        }
      },
      fail: () => {
        wx.showToast({ title: '移除失败', icon: 'none' });
      },
    });
  },

  onDeleteDevice() {
    if (this.data.isReadOnly) return;
    wx.showModal({
      title: '删除设备',
      content: '删除后该设备将无法再触发你的通知',
      confirmColor: '#FF3B30',
      success: (res) => {
        if (res.confirm) {
          const device = this.data.device;
          if (!device) return;
          const token = getToken();
          if (!token) {
            wx.showToast({ title: '请先登录', icon: 'none' });
            return;
          }

          wx.request({
            url: `${API_BASE}/api/devices/${device.id}`,
            method: 'DELETE',
            header: {
              Authorization: `Bearer ${token}`,
            },
            success: (res: WechatMiniprogram.RequestSuccessCallbackResult) => {
              if (res.statusCode === 200 || res.statusCode === 204) {
                wx.showToast({ title: '设备已删除', icon: 'success' });
                setTimeout(() => {
                  wx.navigateBack();
                }, 1500);
              } else {
                wx.showToast({ title: '删除失败', icon: 'none' });
              }
            },
            fail: () => {
              wx.showToast({ title: '删除失败', icon: 'none' });
            },
          });
        }
      },
    });
  },

  onEditDevice() {
    if (this.data.isReadOnly) return;
    const device = this.data.device;
    if (!device) return;
    this.setData({
      showEditModal: true,
      editingDevice: {
        name: device.name || '',
        location: device.location || '',
      },
    });
  },

  onEditModalClose() {
    if (this.data.isUpdatingDevice) return;
    this.setData({ showEditModal: false });
  },

  onEditNameInput(e: WechatMiniprogram.Input) {
    this.setData({ 'editingDevice.name': e.detail.value });
  },

  onEditLocationInput(e: WechatMiniprogram.Input) {
    this.setData({ 'editingDevice.location': e.detail.value });
  },

  onEditModalConfirm() {
    const device = this.data.device;
    if (!device) return;
    const name = this.data.editingDevice.name.trim();
    const location = this.data.editingDevice.location.trim();

    if (!name) {
      wx.showToast({ title: '请输入设备名称', icon: 'none' });
      return;
    }
    if (!location) {
      wx.showToast({ title: '请输入设备位置', icon: 'none' });
      return;
    }

    const token = getToken();
    if (!token) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }

    this.setData({ isUpdatingDevice: true });
    wx.request({
      url: `${API_BASE}/api/devices/${device.id}`,
      method: 'PUT',
      header: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      data: {
        name,
        location,
      },
      success: (res: WechatMiniprogram.RequestSuccessCallbackResult) => {
        if (res.statusCode === 200) {
          const nextDevice = { ...device, name, location };
          this.setData({ device: nextDevice, showEditModal: false }, () => {
            this.updateScrollState();
          });
          wx.setNavigationBarTitle({
            title: name || '设备详情',
          });
          wx.showToast({ title: '更新成功', icon: 'success' });
        } else {
          wx.showToast({ title: '更新失败', icon: 'none' });
        }
      },
      fail: () => {
        wx.showToast({ title: '更新失败', icon: 'none' });
      },
      complete: () => {
        this.setData({ isUpdatingDevice: false });
      },
    });
  },

  onAlarmEdit(e: WechatMiniprogram.TouchEvent) {
    if (this.data.isReadOnly) return;
    const buttonId = e.currentTarget.dataset.id as string;
    const device = this.data.device;
    if (!device?.buttons || !buttonId) return;

    const button = device.buttons.find((item) => item.id === buttonId);
    if (!button) return;

    this.setData({
      showButtonModal: true,
      editingButton: {
        id: button.id,
        location: button.location || '',
        note: button.note || '',
      },
    });
  },

  onButtonModalClose() {
    if (this.data.isUpdatingButton) return;
    this.setData({ showButtonModal: false });
  },

  onButtonLocationInput(e: WechatMiniprogram.Input) {
    this.setData({ 'editingButton.location': e.detail.value });
  },

  onButtonNoteInput(e: WechatMiniprogram.Input) {
    this.setData({ 'editingButton.note': e.detail.value });
  },

  onButtonModalConfirm() {
    if (this.data.isReadOnly) return;
    const device = this.data.device;
    const buttonId = this.data.editingButton.id;
    if (!device || !buttonId) return;

    const location = this.data.editingButton.location.trim();
    const note = this.data.editingButton.note.trim();
    const payload: Record<string, string> = {};

    if (location) {
      payload.location = location;
    }
    if (note) {
      payload.note = note;
    }

    if (!payload.location && !payload.note) {
      wx.showToast({ title: '请输入位置或注释', icon: 'none' });
      return;
    }

    const token = getToken();
    if (!token) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }

    this.setData({ isUpdatingButton: true });
    wx.request({
      url: `${API_BASE}/api/devices/${device.id}/button/${buttonId}`,
      method: 'PUT',
      header: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      data: payload,
      success: (res: WechatMiniprogram.RequestSuccessCallbackResult) => {
        if (res.statusCode === 200) {
          const nextButtons = (device.buttons || []).map((item) => {
            if (item.id !== buttonId) return item;
            return {
              ...item,
              location: payload.location ?? item.location,
              note: payload.note ?? item.note,
            };
          });
          this.setData(
            {
              device: { ...device, buttons: nextButtons },
              showButtonModal: false,
            },
            () => {
              this.updateScrollState();
            },
          );
          wx.showToast({ title: '更新成功', icon: 'success' });
        } else {
          wx.showToast({ title: '更新失败', icon: 'none' });
        }
      },
      fail: () => {
        wx.showToast({ title: '更新失败', icon: 'none' });
      },
      complete: () => {
        this.setData({ isUpdatingButton: false });
      },
    });
  },

  onAlarmDelete(e: WechatMiniprogram.TouchEvent) {
    if (this.data.isReadOnly) return;
    const buttonId = e.currentTarget.dataset.id as string;
    const device = this.data.device;
    if (!device?.buttons || !buttonId) return;

    wx.showModal({
      title: '删除按钮',
      content: '确定要删除该按钮吗？',
      confirmColor: '#FF3B30',
      success: (res) => {
        if (res.confirm) {
          this.deleteAlarmButton(buttonId);
        }
      },
    });
  },

  deleteAlarmButton(buttonId: string) {
    if (this.data.isReadOnly) return;
    const device = this.data.device;
    if (!device) return;
    const token = getToken();
    if (!token) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }

    wx.request({
      url: `${API_BASE}/api/devices/${device.id}/button/${buttonId}`,
      method: 'DELETE',
      header: {
        Authorization: `Bearer ${token}`,
      },
      success: (res: WechatMiniprogram.RequestSuccessCallbackResult) => {
        if (res.statusCode === 200) {
          const nextButtons = (device.buttons || []).filter(
            (item) => item.id !== buttonId,
          );
          this.setData({ device: { ...device, buttons: nextButtons } }, () => {
            this.updateScrollState();
          });
          wx.showToast({ title: '删除成功', icon: 'success' });
        } else {
          wx.showToast({ title: '删除失败', icon: 'none' });
        }
      },
      fail: () => {
        wx.showToast({ title: '删除失败', icon: 'none' });
      },
    });
  },
});
