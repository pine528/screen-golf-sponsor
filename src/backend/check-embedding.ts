import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const templates = await prisma.logoTemplate.findMany();
  console.log('Total templates:', templates.length);

  for (const t of templates) {
    console.log('---');
    console.log('ID:', t.id);
    console.log('Name:', t.name);
    console.log('FileKey:', t.fileKey);
    console.log('Embedding:', t.embedding ? `EXISTS (${(t.embedding as number[]).length} dims)` : 'NULL');
  }

  await prisma.$disconnect();
}

main();
