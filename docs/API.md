# API

统一信封：`{ "code": 0, "message": "success", "data": {} }`。

鉴权：`Authorization: Bearer <jwt>`。

## 鉴权

- `POST /api/web/auth/activate` `{ code }`：六位购买验证码，返回购买者网页会话
- `POST /api/web/auth/guest`：为邀请链接访问者创建访客会话
- `GET /api/me`

## 测试

- `GET /api/questions`
- `POST /api/tests`
- `POST /api/tests/join` `{ inviteCode }`
- `GET /api/tests/:id`
- `PUT /api/tests/:id/answers`
- `POST /api/tests/:id/complete`
- `GET /api/tests/:id/result`
- `GET /api/tests/:id/relationship` 按解锁裁剪，含 `unlocked` / `peerUnlocked`
- `GET /api/tests/:id/card` 未解锁 403
- `GET /api/tests/mine`

## 其它

- `POST /api/share`
- `POST /api/events`
- `GET /api/health`

## 错误码

40001 邀请码不存在 · 40003 邀请码已被使用 · 40004 不能加入自己的测试 · 40302 未解锁 · 40901 关系尚未生成 · 42901 限流
