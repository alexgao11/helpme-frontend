# HelpMe 微信小程序

一键求助微信小程序前端，用于紧急情况下快速通知家人并电话联系。

## 功能概述

- **用户登录**：通过微信授权手机号登录
- **设备管理**：绑定外部按钮/设备，支持一键触发求助
- **个人中心**：查看和管理个人信息

## 技术栈

- 微信小程序原生开发
- TypeScript
- 自定义 TabBar 组件

## 项目结构

```
miniprogram/
├── app.ts                    # 应用入口
├── app.json                  # 应用配置
├── app.wxss                  # 全局样式
├── custom-tab-bar/           # 自定义底部导航栏
├── utils/
│   ├── auth.ts               # 认证工具（Token、用户信息管理）
│   └── util.ts               # 通用工具函数
├── pages/
│   ├── login/                # 登录页面
│   ├── device/               # 设备管理页面
│   └── profile/              # 个人中心页面
└── assets/
    └── icons/                # 图标资源
```

## 开发环境

1. 安装依赖
```bash
npm install
```

2. 使用微信开发者工具打开项目

3. 在开发者工具中构建 npm

## 页面说明

### 登录页 (`/pages/login/login`)
- 授权微信手机号登录
- 登录成功后根据是否有 nickname 跳转到对应页面

### 设备页 (`/pages/device/device`)
- 显示已绑定的设备列表
- 支持添加新设备

### 个人中心 (`/pages/profile/profile`)
- 显示用户信息
- 管理手机号
- 查看关于/使用说明

## 认证流程

1. 应用启动时检查本地 Token 是否过期（7天有效期）
2. Token 过期则跳转登录页
3. 登录成功后检查用户是否有 nickname
   - 有 nickname → 跳转设备页
   - 无 nickname → 跳转个人中心完善信息

## 后端 API

后端服务地址配置在 `login.ts` 中，默认为 `http://127.0.0.1:3000`

## 相关项目

- [helpme-bff](../helpme-bff) - 后端 BFF 服务
