import { PrismaClient } from "@prisma/client";
import { QUESTIONS, QUESTION_VERSION } from "../src/content/questions.js";

const prisma = new PrismaClient();

async function main() {
  await prisma.questionOption.deleteMany();
  await prisma.question.deleteMany();

  for (const question of QUESTIONS) {
    await prisma.question.create({
      data: {
        id: question.id,
        version: QUESTION_VERSION,
        sortOrder: question.order,
        sceneLabel: question.scene,
        stem: question.stem,
        status: "active",
        options: {
          create: question.options.map((option) => ({
            key: option.key,
            text: option.text,
            scoreVector: option.scores,
          })),
        },
      },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
