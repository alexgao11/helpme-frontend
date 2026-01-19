Page({
  data: {},

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 })
    }
  },

  onPhoneTap() {
    console.log('我的手机号')
  },

  onAboutTap() {
    console.log('关于/使用说明')
  }
})
