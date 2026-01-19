import { getToken } from '../../utils/auth'

const API_BASE = 'http://192.168.86.156:3000'

interface Contact {
  id: string
  displayName: string
  countryCode: string
  phoneNumber: string
  position: number
}

interface ContactForm {
  id?: string
  name: string
  countryCode: string
  phoneNumber: string
}

Page({
  data: {
    contacts: [] as Contact[],
    showModal: false,
    isEdit: false,
    editingContact: {
      id: '',
      name: '',
      countryCode: '86',
      phoneNumber: ''
    } as ContactForm
  },

  onShow() {
    this.loadContacts()
  },

  loadContacts() {
    const token = getToken()
    wx.request({
      url: `${API_BASE}/api/user/emergency-contacts`,
      method: 'GET',
      header: {
        'Authorization': `Bearer ${token}`
      },
      success: (res: WechatMiniprogram.RequestSuccessCallbackResult) => {
        const data = res.data as Contact[];
          const contacts = data.sort((a, b) => a.position - b.position)
          this.setData({ contacts })
      },
      fail: (err) => {
        console.error('获取紧急联系人失败', err)
        wx.showToast({ title: '获取联系人失败', icon: 'none' })
      }
    })
  },

  onContactTap(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string
    const contact = this.data.contacts.find(c => c.id === id)
    if (contact) {
      this.setData({
        showModal: true,
        isEdit: true,
        editingContact: {
          id: contact.id,
          name: contact.displayName,
          countryCode: contact.countryCode,
          phoneNumber: contact.phoneNumber
        }
      })
    }
  },

  onAddTap() {
    console.log('添加紧急联系人')
    this.setData({
      showModal: true,
      isEdit: false,
      editingContact: {
        id: '',
        name: '',
        countryCode: '86',
        phoneNumber: ''
      }
    })
  },

  onDeleteTap(e: WechatMiniprogram.TouchEvent) {
    const id = e.currentTarget.dataset.id as string
    const contact = this.data.contacts.find(c => c.id === id)

    wx.showModal({
      title: '确认删除',
      content: `确定要删除紧急联系人"${contact?.displayName}"吗？`,
      confirmColor: '#FF4D4F',
      success: (res) => {
        if (res.confirm) {
          this.deleteContact(id)
        }
      }
    })
  },

  deleteContact(id: string) {
    const token = getToken()
    wx.request({
      url: `${API_BASE}/api/user/emergency-contacts`,
      method: 'DELETE',
      header: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      data: { id },
      success: (res: WechatMiniprogram.RequestSuccessCallbackResult) => {
        if (res.statusCode === 200) {
          wx.showToast({ title: '删除成功', icon: 'success' })
          this.loadContacts()
        } else {
          wx.showToast({ title: '删除失败', icon: 'none' })
        }
      },
      fail: () => {
        wx.showToast({ title: '删除失败', icon: 'none' })
      }
    })
  },

  onModalClose() {
    this.setData({ showModal: false })
  },

  onNameInput(e: WechatMiniprogram.Input) {
    this.setData({ 'editingContact.name': e.detail.value })
  },

  onCountryCodeInput(e: WechatMiniprogram.Input) {
    this.setData({ 'editingContact.countryCode': e.detail.value })
  },

  onPhoneInput(e: WechatMiniprogram.Input) {
    this.setData({ 'editingContact.phoneNumber': e.detail.value })
  },

  onModalConfirm() {
    const { isEdit, editingContact } = this.data

    if (!editingContact.name.trim()) {
      wx.showToast({ title: '请输入姓名', icon: 'none' })
      return
    }
    if (!editingContact.countryCode.trim()) {
      wx.showToast({ title: '请输入国家号', icon: 'none' })
      return
    }
    if (!editingContact.phoneNumber.trim()) {
      wx.showToast({ title: '请输入手机号', icon: 'none' })
      return
    }

    if (isEdit) {
      this.updateContact()
    } else {
      this.addContact()
    }
  },

  addContact() {
    const token = getToken()
    const { editingContact } = this.data

    wx.request({
      url: `${API_BASE}/api/user/emergency-contacts`,
      method: 'POST',
      header: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      data: {
        name: editingContact.name,
        countryCode: editingContact.countryCode,
        phoneNumber: editingContact.phoneNumber
      },
      success: (res: WechatMiniprogram.RequestSuccessCallbackResult) => {
        if (res.statusCode === 201) {
          wx.showToast({ title: '添加成功', icon: 'success' })
          this.setData({ showModal: false })
          this.loadContacts()
        } else {
          wx.showToast({ title: '添加失败', icon: 'none' })
        }
      },
      fail: () => {
        wx.showToast({ title: '添加失败', icon: 'none' })
      }
    })
  },

  updateContact() {
    const token = getToken()
    const { editingContact } = this.data

    wx.request({
      url: `${API_BASE}/api/user/emergency-contacts`,
      method: 'PUT',
      header: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      data: {
        id: editingContact.id,
        name: editingContact.name,
        countryCode: editingContact.countryCode,
        phoneNumber: editingContact.phoneNumber
      },
      success: (res: WechatMiniprogram.RequestSuccessCallbackResult) => {
        if (res.statusCode === 200) {
          wx.showToast({ title: '更新成功', icon: 'success' })
          this.setData({ showModal: false })
          this.loadContacts()
        } else {
          wx.showToast({ title: '更新失败', icon: 'none' })
        }
      },
      fail: () => {
        wx.showToast({ title: '更新失败', icon: 'none' })
      }
    })
  }
})
