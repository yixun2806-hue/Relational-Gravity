# 数据库

PostgreSQL + Prisma。权威 schema：`server/prisma/schema.prisma`。

核心表：users、sessions、questions、question_options、tests、test_answers、personality_results、relationship_results、result_unlocks、share_records、events、report_access_codes、agents、system_settings。

`result_unlocks` 对 `(test_id, user_id, unlock_type)` 唯一。购买验证码发起的测试在双方完成后，为 A、B 自动写入完整报告授权。

`report_access_codes` 保存可重复使用的六位验证码、实际售价、价格版本、销售渠道和使用次数。一个有效码可以发起多组测试。

不做支付表。
