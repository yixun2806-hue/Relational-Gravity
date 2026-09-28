import { generateAccessCodes, listAgents } from "../src/services/admin-service.js";
import { prisma } from "../src/db.js";

function argument(name: string, fallback = "") {
  const prefix = `--${name}=`;
  return process.argv.find((item) => item.startsWith(prefix))?.slice(prefix.length) ?? fallback;
}

async function main() {
  const count = Number(argument("count", "20"));
  const priceFen = Number(argument("price", process.env.REPORT_PRICE_FEN ?? "990"));
  const priceVariant = argument("variant", process.env.REPORT_PRICE_VARIANT ?? "price_9_9");
  const agentName = argument("agent");

  if (!Number.isInteger(count) || count < 1 || count > 500) throw new Error("count 必须是 1—500 的整数");
  if (!Number.isInteger(priceFen) || priceFen < 1) throw new Error("price 必须是正整数，单位为分");
  if (!agentName) throw new Error("必须指定 --agent=代理人姓名，请先创建代理人");

  const agents = await listAgents();
  const agent = agents.find((item) => item.name === agentName.trim());
  if (!agent) throw new Error(`代理人「${agentName.trim()}」不存在，请先在管理后台创建`);
  const items = await generateAccessCodes({ count, agentId: agent.id, priceFen, priceVariant });
  console.log(`已生成 ${items.length} 个六位验证码｜${agent.name}｜¥${(priceFen / 100).toFixed(2)}`);
  items.forEach((item) => console.log(item.code));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
