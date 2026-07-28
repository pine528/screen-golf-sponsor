/**
 * 로고 검출 디버깅 스크립트
 * 실행: npx ts-node debug-detection.ts
 */
import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function debug() {
  console.log('=== 로고 검출 디버깅 시작 ===\n');

  // 1. 환경변수 확인
  console.log('1. 환경변수 확인:');
  console.log(`   USE_GPU_SERVER: ${process.env.USE_GPU_SERVER}`);
  console.log(`   GPU_SERVER_URL: ${process.env.GPU_SERVER_URL}`);
  console.log(`   LOGO_DETECT_THRESHOLD: ${process.env.LOGO_DETECT_THRESHOLD || '0.5 (default)'}`);

  // 2. GPU 서버 연결 확인
  console.log('\n2. GPU 서버 연결 확인:');
  const gpuUrl = process.env.GPU_SERVER_URL || 'http://localhost:8001';
  try {
    const health = await axios.get(`${gpuUrl}/health`, { timeout: 10000 });
    console.log(`   상태: ${JSON.stringify(health.data)}`);
  } catch (err: any) {
    console.log(`   에러: ${err.message}`);
    return;
  }

  // 3. 로고 템플릿 확인
  console.log('\n3. 로고 템플릿 확인:');
  const templates = await prisma.logoTemplate.findMany({
    where: { isActive: true },
    include: { brand: { select: { id: true, name: true } } },
  });
  console.log(`   총 ${templates.length}개 템플릿`);

  for (const t of templates) {
    const hasEmbedding = t.embedding && Array.isArray(t.embedding) && (t.embedding as number[]).length > 0;
    console.log(`   - ${t.brand.name}: ${t.name}`);
    console.log(`     파일: ${t.fileUrl || t.fileKey}`);
    console.log(`     임베딩: ${hasEmbedding ? `있음 (${(t.embedding as number[]).length} dims)` : '없음 ❌'}`);
  }

  // 4. 프레임 확인
  console.log('\n4. 프레임 확인:');
  const frame = await prisma.vodFrame.findFirst({
    orderBy: { createdAt: 'desc' },
    include: {
      vodAsset: {
        include: {
          campaign: { select: { brandId: true } },
        },
      },
    },
  });

  if (!frame) {
    console.log('   프레임 없음');
    return;
  }

  console.log(`   프레임 ID: ${frame.id}`);
  console.log(`   thumbnailKey: ${frame.thumbnailKey}`);

  // 파일 경로 확인
  let framePath = frame.thumbnailKey;
  if (!framePath.startsWith('/')) {
    framePath = `/uploads/${framePath}`;
  }
  const fullPath = path.join(process.cwd(), framePath);
  console.log(`   전체 경로: ${fullPath}`);
  console.log(`   파일 존재: ${fs.existsSync(fullPath) ? '✅' : '❌'}`);

  if (!fs.existsSync(fullPath)) {
    console.log('   파일이 존재하지 않습니다!');
    return;
  }

  // 5. GPU 서버에 직접 요청 테스트
  console.log('\n5. GPU 서버 직접 테스트:');

  const templatesWithEmbedding = templates.filter(t =>
    t.embedding && Array.isArray(t.embedding) && (t.embedding as number[]).length > 0
  );

  if (templatesWithEmbedding.length === 0) {
    console.log('   임베딩이 있는 템플릿이 없습니다!');
    return;
  }

  const logoEmbeddings = templatesWithEmbedding.map(t => ({
    brandId: t.brand.id,
    name: t.brand.name,
    embedding: t.embedding as number[],
  }));

  console.log(`   테스트할 로고: ${logoEmbeddings.map(l => l.name).join(', ')}`);

  const formData = new FormData();
  formData.append('file', fs.createReadStream(fullPath));
  formData.append('logo_embeddings', JSON.stringify(logoEmbeddings));
  formData.append('threshold', '0.3');  // 매우 낮은 threshold로 테스트
  formData.append('window_sizes', '80,120,160');
  formData.append('stride', '0.5');

  try {
    console.log(`   요청 중... (threshold: 0.3)`);
    const response = await axios.post(`${gpuUrl}/detect/logos`, formData, {
      headers: formData.getHeaders(),
      timeout: 120000,
    });

    console.log(`   응답:`);
    console.log(`   - 검출 수: ${response.data.detections?.length || 0}`);
    console.log(`   - 처리 시간: ${response.data.elapsed_ms}ms`);
    console.log(`   - 처리 영역: ${response.data.regions_processed}`);

    if (response.data.detections?.length > 0) {
      console.log(`   - 검출 결과:`);
      for (const d of response.data.detections) {
        console.log(`     * ${d.brandName}: confidence=${d.confidence.toFixed(3)}, bbox=${JSON.stringify(d.bbox)}`);
      }
    } else {
      console.log(`   - 로고가 검출되지 않았습니다.`);
      console.log(`   - 가능한 원인:`);
      console.log(`     1. 로고가 프레임에 실제로 없음`);
      console.log(`     2. 로고 템플릿 이미지 품질 문제`);
      console.log(`     3. 프레임에서 로고가 너무 작거나 가려짐`);
    }
  } catch (err: any) {
    console.log(`   에러: ${err.message}`);
    if (err.response) {
      console.log(`   응답 데이터: ${JSON.stringify(err.response.data)}`);
    }
  }

  console.log('\n=== 디버깅 완료 ===');
  await prisma.$disconnect();
}

debug().catch(console.error);
