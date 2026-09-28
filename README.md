# 关系引力

手机自适应 HTML 网页：**你和 TA 是什么关系？**

双人关系测试。购买者使用小红书订单收到的六位验证码进入网页，发起测试并邀请 TA；双方完成后自动生成完整关系报告。

销售阶段通过小红书等平台订单自动发放六位验证码。验证码可重复使用，也可以在管理后台单独停用。

## 产品闭环

1. A 在小红书购买后收到固定网址和独立六位验证码
2. A 输入验证码，完成 30 道题并获得邀请链接
3. B 打开邀请链接，无需验证码即可完成同一套题
4. 服务端计算双人关系，双方均可查看完整报告
5. A 可用同一个验证码跨设备、长期、重复发起新的测试
6. 运营人员可在管理后台查询使用情况、批量生成或停用验证码

## 本地开发

```bash
cp server/.env.example server/.env
docker compose up -d postgres redis
cd server && npm install
npx prisma migrate dev
npx prisma db seed
npm run dev
```

浏览器访问 `http://127.0.0.1:3000/` 打开客户网页，访问 `http://127.0.0.1:3000/admin` 打开管理后台。

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

## 目录

- `server/web/` 手机自适应客户网页
- `server/admin/` 运营管理后台
- `server/` Fastify + Prisma + 关系算法
- `database/` schema / seed 备份
- `docs/` API、数据库、算法、部署

售卖、解锁码和价格实验操作见 [`docs/SALES.md`](docs/SALES.md)。

运营管理台部署后位于 `/admin`，账号密码通过服务端的 `ADMIN_USERNAME` 和 `ADMIN_PASSWORD` 环境变量配置。

## 声明

本测试仅供娱乐和自我探索，不构成心理、医疗或专业诊断。
