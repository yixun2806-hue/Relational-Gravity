import { readFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import type { FastifyInstance, FastifyReply } from "fastify";

const webPage = join(process.cwd(), "web/index.html");
const assetRoot = resolve(process.cwd(), "web/assets");
const mime: Record<string, string> = {
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".js": "text/javascript",
  ".css": "text/css",
};

export async function webRoutes(app: FastifyInstance) {
  const renderWeb = async (_request: unknown, reply: FastifyReply) => {
    const html = await readFile(webPage, "utf8");
    return reply.type("text/html; charset=utf-8").send(html);
  };
  app.get("/", renderWeb);
  app.get("/app", renderWeb);

  app.get("/web-assets/*", async (request, reply) => {
    const relative = String((request.params as { "*": string })["*"] || "");
    const path = resolve(assetRoot, relative);
    if (!path.startsWith(`${assetRoot}/`)) return reply.status(404).send("Not found");
    try {
      return reply.type(mime[extname(path).toLowerCase()] || "application/octet-stream").send(await readFile(path));
    } catch {
      return reply.status(404).send("Not found");
    }
  });
}
