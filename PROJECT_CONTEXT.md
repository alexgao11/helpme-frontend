# Project Context for Claude Code

Last updated: 2026-01-19
Project version: 1.0.0

---

## Project Purpose

This is the **WeChat Mini Program frontend** for the HelpMe emergency assistance application.

The frontend is responsible for:
- User authentication UI (WeChat phone number authorization)
- Device/button binding and management UI
- User profile management UI
- Token-based session management (local storage)

The frontend does NOT handle:
- Actual emergency triggering logic (handled by backend)
- Notification sending (handled by backend/other services)
- Business logic validation (server-side)

---

## Core Constraints (Must Follow)

- This is a **WeChat Mini Program** project
- Must use WeChat Mini Program native APIs (`wx.*`)
- All sensitive operations require valid Token
- Token expires after 7 days, user must re-login
- Authentication flow: phone number authorization is MANDATORY
- UI must remain consistent with existing color scheme (primary: `#3478F6`)

---

## Directory Responsibilities (Strict Boundaries)

- `miniprogram/app.ts`
  - Application lifecycle only
  - Initial auth check and routing
  - No business logic

- `miniprogram/utils/auth.ts`
  - Token management (get/set/clear)
  - User info management (get/set)
  - Login state check (`isLoggedIn()`)
  - No UI logic, no wx.request calls

- `miniprogram/utils/util.ts`
  - Stateless helper functions only
  - No side effects

- `miniprogram/pages/*/`
  - Each page is self-contained (ts, wxml, wxss, json)
  - Page-specific logic only
  - Use `utils/auth.ts` for auth operations

- `miniprogram/custom-tab-bar/`
  - Custom TabBar component
  - Navigation logic only
  - Must update `selected` state via `getTabBar().setData()`

- `miniprogram/assets/`
  - Static assets only (icons, images)
  - No code files

⚠️ Do NOT put business logic in utils. Keep pages self-contained.

---

## Page Responsibilities

| Page | Purpose | TabBar |
|------|---------|--------|
| `/pages/login/login` | Phone authorization, login flow | No |
| `/pages/device/device` | Device/button management | Yes (index 0) |
| `/pages/profile/profile` | User profile, settings | Yes (index 1) |
| `/pages/index/index` | Legacy/unused | No |
| `/pages/logs/logs` | Template/unused | No |

---

## Navigation Flow

```
App Launch
    │
    ├─ Token expired/missing → /pages/login/login
    │
    └─ Token valid
           │
           ├─ No nickname → /pages/profile/profile
           │
           └─ Has nickname → /pages/device/device
```

After login success:
- Has nickname → `wx.switchTab` to `/pages/device/device`
- No nickname → `wx.switchTab` to `/pages/profile/profile`

---

## Platform & Tech Constraints

- Platform: WeChat Mini Program
- Language: TypeScript (strict mode)
- Styling: WXSS (WeChat CSS subset)
- No npm packages at runtime (only type definitions)
- All API calls use `wx.request`
- Local storage via `wx.getStorageSync` / `wx.setStorageSync`

---

## Coding Rules (Non-negotiable)

- TypeScript strict mode is mandatory
- No `any` unless explicitly justified
- Keep consistent styling:
  - Primary color: `#3478F6`
  - Text colors: `#000000`, `#333333`, `#666666`, `#999999`
  - Background: `#ffffff` (pages), `#F5F5F5` (sections)
- All button clicks must have console.log during development
- TabBar pages must call `getTabBar().setData({ selected: N })` in `onShow`

---

## Known Pitfalls (Do NOT Repeat)

- `wx.switchTab` can ONLY navigate to TabBar pages
- `wx.reLaunch` closes all pages, use for login redirect only
- TabBar icons must be PNG (not SVG), hence we use custom TabBar with CSS icons
- WeChat does NOT provide nickname/avatar automatically since 2022
- Token expiration check is client-side only, server may still reject

---

## How Claude Code Should Work on This Repo

When working on new tasks:

1. Read **this file only** as initial context
2. Only read files explicitly mentioned or directly relevant
3. Do NOT scan the whole repository
4. Maintain UI consistency with existing pages (check `/pages/login/login.wxss` for reference)
5. Prefer minimal, targeted diffs
6. Always update TabBar `selected` state when adding new TabBar pages

---

## Explicit Non-Goals

- No state management library (use page data directly)
- No component library (use native components)
- No cloud functions (use external BFF)
- No complex animations
- No internationalization (Chinese only)

---

## API Reference

Backend BFF: `http://127.0.0.1:3000` (dev)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/auth/login` | POST | Login with WeChat code + encrypted phone data |

Request body for login:
```json
{
  "code": "wx.login code",
  "encryptedData": "phone encrypted data",
  "iv": "encryption iv"
}
```

Response:
```json
{
  "code": 0,
  "data": {
    "token": "jwt_token",
    "user": { "nickname": "...", "phone": "..." }
  }
}
```

---

## Maintenance Rule

Update this file ONLY when:
- Directory responsibilities change
- New pages are added to TabBar
- Core navigation flow changes
- API endpoints change
- Major architectural decisions are made
