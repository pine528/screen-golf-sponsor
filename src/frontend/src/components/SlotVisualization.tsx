import { cn } from '../utils';

const DEFAULT_LOGO = '/ccubelogo.png';

interface SlotVisualizationProps {
  bodyPart: string;
  brandLogo?: string;
  brandName?: string;
  className?: string;
}

/**
 * 슬롯 부착 위치 시각화 컴포넌트
 * - 골프 셔츠/모자 도안에 로고 부착 위치 표시
 */
export function SlotVisualization({
  bodyPart,
  brandLogo = DEFAULT_LOGO,
  brandName = 'LOGO',
  className,
}: SlotVisualizationProps) {
  const normalizedPart = bodyPart?.toUpperCase().replace(/-/g, '_') || '';
  const isCap = normalizedPart.startsWith('CAP') || normalizedPart.includes('CAP');
  const isPants = normalizedPart.startsWith('PANTS') || normalizedPart.includes('PANTS');

  if (isPants) {
    return (
      <PantsVisualization
        bodyPart={normalizedPart}
        brandLogo={brandLogo}
        className={className}
      />
    );
  }

  if (isCap) {
    return (
      <CapVisualization
        bodyPart={normalizedPart}
        brandLogo={brandLogo}
        className={className}
      />
    );
  }

  return (
    <ShirtVisualization
      bodyPart={normalizedPart}
      brandLogo={brandLogo}
      brandName={brandName}
      className={className}
    />
  );
}

/**
 * bodyPart 문자열에서 위치 판별
 */
function getPosition(bodyPart: string): {
  key: string;
  x: number;
  y: number;
  label: string;
  labelX: number;
  labelY: number;
} {
  const part = bodyPart.toUpperCase();

  // 칼라 (COLLAR) - 셔츠 상단 칼라 부분
  if (part.includes('COLLAR')) {
    if (part.includes('LEFT') || part.endsWith('_L')) {
      // 입은 사람 기준 왼쪽 칼라 = 화면상 오른쪽
      return { key: 'COLLAR_L', x: 175, y: 72, label: '칼라 좌', labelX: 175, labelY: 55 };
    }
    if (part.includes('RIGHT') || part.endsWith('_R')) {
      // 입은 사람 기준 오른쪽 칼라 = 화면상 왼쪽
      return { key: 'COLLAR_R', x: 125, y: 72, label: '칼라 우', labelX: 125, labelY: 55 };
    }
  }

  // 등판 어깨 (BACK_SHOULDER) - 등쪽 어깨 부분
  if (part.includes('BACK_SHOULDER') || part.includes('BACKSHOULDER')) {
    if (part.includes('LEFT') || part.endsWith('_L')) {
      // 입은 사람 기준 왼쪽 = 화면상 오른쪽
      return { key: 'BACK_SHOULDER_L', x: 195, y: 100, label: '등판 어깨 좌', labelX: 195, labelY: 145 };
    }
    if (part.includes('RIGHT') || part.endsWith('_R')) {
      // 입은 사람 기준 오른쪽 = 화면상 왼쪽
      return { key: 'BACK_SHOULDER_R', x: 105, y: 100, label: '등판 어깨 우', labelX: 105, labelY: 145 };
    }
  }

  // 소매 (SLEEVE) - 입은 사람 기준 (화면상 반대)
  if (part.includes('SLEEVE')) {
    if (part.includes('LEFT') || part.includes('L')) {
      // 입은 사람 기준 왼쪽 소매 = 화면상 오른쪽
      return { key: 'SLEEVE_L', x: 250, y: 95, label: '왼쪽 소매', labelX: 250, labelY: 140 };
    }
    if (part.includes('RIGHT') || part.includes('R')) {
      // 입은 사람 기준 오른쪽 소매 = 화면상 왼쪽
      return { key: 'SLEEVE_R', x: 50, y: 95, label: '오른쪽 소매', labelX: 50, labelY: 140 };
    }
  }

  // 상의 (CHEST) - 입은 사람 기준 (화면상 반대)
  if (part.includes('CHEST')) {
    if (part.includes('LEFT') || part.includes('L')) {
      // 입은 사람 기준 좌측 = 화면상 오른쪽
      return { key: 'CHEST_L', x: 190, y: 140, label: '상의 좌측', labelX: 190, labelY: 185 };
    }
    if (part.includes('RIGHT') || part.includes('R')) {
      // 입은 사람 기준 우측 = 화면상 왼쪽
      return { key: 'CHEST_R', x: 110, y: 140, label: '상의 우측', labelX: 110, labelY: 185 };
    }
    // 중앙
    return { key: 'CHEST_C', x: 150, y: 140, label: '상의 중앙', labelX: 150, labelY: 185 };
  }

  // 등판 (BACK)
  if (part.includes('BACK')) {
    return { key: 'BACK', x: 150, y: 170, label: '등판', labelX: 150, labelY: 215 };
  }

  // 벨트/허리 (BELT, WAIST)
  if (part.includes('BELT') || part.includes('WAIST')) {
    return { key: 'BELT', x: 150, y: 240, label: '벨트', labelX: 150, labelY: 275 };
  }

  // 기본값: 상의 좌측 (골프 셔츠의 일반적인 로고 위치 - 입은 사람 기준)
  return { key: 'CHEST_L', x: 190, y: 140, label: '상의 좌측', labelX: 190, labelY: 185 };
}

/**
 * 골프 폴로 셔츠 시각화 - 깔끔한 디자인
 */
function ShirtVisualization({
  bodyPart,
  brandLogo,
  brandName,
  className,
}: SlotVisualizationProps) {
  const pos = getPosition(bodyPart || '');

  return (
    <div className={cn('relative flex flex-col items-center', className)}>
      <div
        className="relative bg-slate-50 rounded-2xl p-4"
        style={{ maxWidth: '320px' }}
      >
        <svg
          viewBox="0 0 300 320"
          className="w-full h-auto"
        >
          {/* 그림자 효과 */}
          <defs>
            <filter id="shirtShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="2" dy="4" stdDeviation="4" floodOpacity="0.1" />
            </filter>
            <linearGradient id="shirtGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="100%" stopColor="#f1f5f9" />
            </linearGradient>
          </defs>

          {/* 셔츠 본체 */}
          <g filter="url(#shirtShadow)">
            {/* 몸통 */}
            <path
              d="M150 75
                 C125 75, 105 72, 85 65
                 L50 95
                 L70 115
                 L70 280
                 Q150 290, 230 280
                 L230 115
                 L250 95
                 L215 65
                 C195 72, 175 75, 150 75"
              fill="url(#shirtGradient)"
              stroke="#cbd5e1"
              strokeWidth="2"
            />

            {/* 왼쪽 소매 */}
            <path
              d="M85 65 L35 105 L58 130 L85 90 Z"
              fill="url(#shirtGradient)"
              stroke="#cbd5e1"
              strokeWidth="2"
            />

            {/* 오른쪽 소매 */}
            <path
              d="M215 65 L265 105 L242 130 L215 90 Z"
              fill="url(#shirtGradient)"
              stroke="#cbd5e1"
              strokeWidth="2"
            />

            {/* 소매 밴드 (왼쪽) */}
            <path
              d="M35 102 Q48 118, 58 127 L58 133 Q45 122, 32 108 Z"
              fill="#e2e8f0"
              stroke="#cbd5e1"
              strokeWidth="1"
            />

            {/* 소매 밴드 (오른쪽) */}
            <path
              d="M265 102 Q252 118, 242 127 L242 133 Q255 122, 268 108 Z"
              fill="#e2e8f0"
              stroke="#cbd5e1"
              strokeWidth="1"
            />

            {/* 칼라 - 폴로 칼라 (몸통과 연결) */}
            <path
              d="M110 78
                 Q110 65, 125 62
                 L138 73
                 L150 82
                 L162 73
                 L175 62
                 Q190 65, 190 78
                 Q150 88, 110 78"
              fill="#e2e8f0"
              stroke="#94a3b8"
              strokeWidth="1.5"
            />

            {/* 칼라 안쪽 라인 */}
            <path
              d="M128 70 Q150 78, 172 70"
              fill="none"
              stroke="#cbd5e1"
              strokeWidth="1"
            />

            {/* V넥 라인 */}
            <path
              d="M138 73 L150 100 L162 73"
              fill="#f8fafc"
              stroke="#cbd5e1"
              strokeWidth="1"
            />

            {/* 단추 플라켓 */}
            <line x1="150" y1="90" x2="150" y2="155" stroke="#e2e8f0" strokeWidth="2" />

            {/* 단추들 */}
            <circle cx="150" cy="100" r="3" fill="#cbd5e1" stroke="#94a3b8" strokeWidth="1" />
            <circle cx="150" cy="120" r="3" fill="#cbd5e1" stroke="#94a3b8" strokeWidth="1" />
            <circle cx="150" cy="140" r="3" fill="#cbd5e1" stroke="#94a3b8" strokeWidth="1" />

            {/* 하단 밑단 */}
            <path
              d="M70 275 Q150 285, 230 275"
              fill="none"
              stroke="#cbd5e1"
              strokeWidth="1.5"
            />
          </g>

          {/* 부착 위치 표시 영역 */}
          <rect
            x={pos.x - 30}
            y={pos.y - 20}
            width="60"
            height="40"
            fill="rgba(16, 185, 129, 0.15)"
            stroke="#10b981"
            strokeWidth="2"
            strokeDasharray="6,3"
            rx="6"
          />

          {/* 로고 또는 브랜드명 */}
          {brandLogo ? (
            <image
              href={brandLogo}
              x={pos.x - 25}
              y={pos.y - 15}
              width="50"
              height="30"
              preserveAspectRatio="xMidYMid meet"
            />
          ) : (
            <text
              x={pos.x}
              y={pos.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#10b981"
              fontSize="12"
              fontWeight="bold"
            >
              {brandName}
            </text>
          )}
        </svg>
      </div>

      {/* 위치 라벨 */}
      <div className="mt-4 px-6 py-2 bg-emerald-500 text-white text-sm font-medium rounded-full">
        {pos.label}
      </div>

      {/* 범례 */}
      <div className="mt-3 flex items-center justify-center gap-4 text-xs text-slate-500">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-3 border-2 border-emerald-500 border-dashed rounded bg-emerald-500/10" />
          <span>부착 위치</span>
        </div>
      </div>
    </div>
  );
}

/**
 * 모자 bodyPart에서 위치 판별
 */
function getCapPosition(bodyPart: string): 'front' | 'back' | 'left' | 'right' | 'brim_top' {
  const part = bodyPart.toUpperCase();

  // BRIM_TOP은 FRONT보다 먼저 체크해야 함 (CAP_BRIM_TOP 등)
  if (part.includes('BRIM') && part.includes('TOP')) return 'brim_top';
  if (part.includes('FRONT')) return 'front';
  if (part.includes('BACK')) return 'back';
  if (part.includes('LEFT') || part.includes('SIDE_L')) return 'left';
  if (part.includes('RIGHT') || part.includes('SIDE_R')) return 'right';

  // 기본값
  return 'front';
}

/**
 * 골프 모자 시각화
 */
function CapVisualization({
  bodyPart,
  brandLogo,
  className,
}: Omit<SlotVisualizationProps, 'brandName'>) {
  const position = getCapPosition(bodyPart || '');

  if (position === 'back') {
    return <CapBackView brandLogo={brandLogo} className={className} />;
  }

  if (position === 'front') {
    return <CapFrontView brandLogo={brandLogo} className={className} />;
  }

  if (position === 'brim_top') {
    return <CapBrimTopView brandLogo={brandLogo} className={className} />;
  }

  return (
    <CapSideView
      isLeft={position === 'left'}
      brandLogo={brandLogo}
      className={className}
    />
  );
}

/**
 * 모자 측면 뷰
 */
function CapSideView({
  isLeft,
  brandLogo,
  className,
}: {
  isLeft: boolean;
  brandLogo?: string;
  className?: string;
}) {
  return (
    <div className={cn('relative flex flex-col items-center', className)}>
      <div
        className="relative bg-slate-50 rounded-2xl p-6"
        style={{ maxWidth: '300px' }}
      >
        <svg viewBox="0 0 200 160" className="w-full h-auto">
          <defs>
            <linearGradient id="capGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#f8fafc" />
              <stop offset="100%" stopColor="#e2e8f0" />
            </linearGradient>
            <filter id="capShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="2" dy="3" stdDeviation="3" floodOpacity="0.15" />
            </filter>
          </defs>

          <g filter="url(#capShadow)" transform={isLeft ? '' : 'translate(200, 0) scale(-1, 1)'}>
            {/* 모자 크라운 */}
            <path
              d="M45 80 Q45 30 100 25 Q155 30 155 80 L155 95 L45 95 Z"
              fill="url(#capGradient)"
              stroke="#94a3b8"
              strokeWidth="2"
            />

            {/* 모자 챙 */}
            <path
              d="M45 90 Q20 95 10 105 Q15 115 45 110 L155 110 L155 90 Z"
              fill="#e2e8f0"
              stroke="#94a3b8"
              strokeWidth="2"
            />

            {/* 챙 하단 선 */}
            <path
              d="M15 108 Q30 118 155 112"
              fill="none"
              stroke="#cbd5e1"
              strokeWidth="1.5"
            />

            {/* 모자 꼭대기 버튼 */}
            <circle cx="100" cy="28" r="5" fill="#cbd5e1" stroke="#94a3b8" strokeWidth="1" />

            {/* 통풍구멍 */}
            <circle cx="80" cy="55" r="3" fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="1" />
            <circle cx="100" cy="50" r="3" fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="1" />
            <circle cx="120" cy="55" r="3" fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="1" />
          </g>

          {/* 부착 위치 */}
          <rect
            x={isLeft ? 70 : 95}
            y="55"
            width="55"
            height="35"
            fill="rgba(16, 185, 129, 0.15)"
            stroke="#10b981"
            strokeWidth="2"
            strokeDasharray="5,3"
            rx="4"
          />

          {/* 로고 */}
          {brandLogo && (
            <image
              href={brandLogo}
              x={isLeft ? 75 : 100}
              y="60"
              width="45"
              height="25"
              preserveAspectRatio="xMidYMid meet"
            />
          )}
        </svg>
      </div>

      <div className="mt-4 px-6 py-2 bg-emerald-500 text-white text-sm font-medium rounded-full">
        {isLeft ? '모자 측면(좌)' : '모자 측면(우)'}
      </div>

      <div className="mt-3 flex items-center justify-center gap-4 text-xs text-slate-500">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-3 border-2 border-emerald-500 border-dashed rounded bg-emerald-500/10" />
          <span>부착 위치</span>
        </div>
      </div>
    </div>
  );
}

/**
 * 모자 정면 뷰
 */
function CapFrontView({
  brandLogo,
  className,
}: Omit<SlotVisualizationProps, 'bodyPart' | 'brandName'>) {
  return (
    <div className={cn('relative flex flex-col items-center', className)}>
      <div
        className="relative bg-slate-50 rounded-2xl p-6"
        style={{ maxWidth: '300px' }}
      >
        <svg viewBox="0 0 200 160" className="w-full h-auto">
          <defs>
            <linearGradient id="capFrontGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#f8fafc" />
              <stop offset="100%" stopColor="#e2e8f0" />
            </linearGradient>
            <filter id="capFrontShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="3" stdDeviation="3" floodOpacity="0.15" />
            </filter>
          </defs>

          <g filter="url(#capFrontShadow)">
            {/* 모자 크라운 */}
            <path
              d="M30 85 Q30 25 100 20 Q170 25 170 85 L170 100 L30 100 Z"
              fill="url(#capFrontGradient)"
              stroke="#94a3b8"
              strokeWidth="2"
            />

            {/* 모자 챙 */}
            <ellipse
              cx="100"
              cy="105"
              rx="80"
              ry="20"
              fill="#e2e8f0"
              stroke="#94a3b8"
              strokeWidth="2"
            />

            {/* 챙 상단 곡선 */}
            <path
              d="M25 100 Q100 115 175 100"
              fill="none"
              stroke="#cbd5e1"
              strokeWidth="1.5"
            />

            {/* 모자 꼭대기 버튼 */}
            <circle cx="100" cy="23" r="6" fill="#cbd5e1" stroke="#94a3b8" strokeWidth="1" />

            {/* 패널 분리선 */}
            <path d="M100 30 L100 85" fill="none" stroke="#e2e8f0" strokeWidth="1" />
            <path d="M65 35 L55 90" fill="none" stroke="#e2e8f0" strokeWidth="1" />
            <path d="M135 35 L145 90" fill="none" stroke="#e2e8f0" strokeWidth="1" />

            {/* 통풍구멍 */}
            <circle cx="60" cy="55" r="3" fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="1" />
            <circle cx="140" cy="55" r="3" fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="1" />
          </g>

          {/* 부착 위치 */}
          <rect
            x="60"
            y="45"
            width="80"
            height="40"
            fill="rgba(16, 185, 129, 0.15)"
            stroke="#10b981"
            strokeWidth="2"
            strokeDasharray="5,3"
            rx="4"
          />

          {/* 로고 */}
          {brandLogo && (
            <image
              href={brandLogo}
              x="70"
              y="50"
              width="60"
              height="30"
              preserveAspectRatio="xMidYMid meet"
            />
          )}
        </svg>
      </div>

      <div className="mt-4 px-6 py-2 bg-emerald-500 text-white text-sm font-medium rounded-full">
        모자 정면
      </div>

      <div className="mt-3 flex items-center justify-center gap-4 text-xs text-slate-500">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-3 border-2 border-emerald-500 border-dashed rounded bg-emerald-500/10" />
          <span>부착 위치</span>
        </div>
      </div>
    </div>
  );
}

/**
 * 모자 후면 뷰
 */
function CapBackView({
  brandLogo,
  className,
}: Omit<SlotVisualizationProps, 'bodyPart' | 'brandName'>) {
  return (
    <div className={cn('relative flex flex-col items-center', className)}>
      <div
        className="relative bg-slate-50 rounded-2xl p-6"
        style={{ maxWidth: '300px' }}
      >
        <svg viewBox="0 0 200 160" className="w-full h-auto">
          <defs>
            <linearGradient id="capBackGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#f8fafc" />
              <stop offset="100%" stopColor="#e2e8f0" />
            </linearGradient>
            <filter id="capBackShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="3" stdDeviation="3" floodOpacity="0.15" />
            </filter>
          </defs>

          <g filter="url(#capBackShadow)">
            {/* 모자 크라운 */}
            <path
              d="M30 90 Q30 30 100 25 Q170 30 170 90 L170 105 L30 105 Z"
              fill="url(#capBackGradient)"
              stroke="#94a3b8"
              strokeWidth="2"
            />

            {/* 조절 밴드 */}
            <rect
              x="55"
              y="95"
              width="90"
              height="20"
              fill="#cbd5e1"
              stroke="#94a3b8"
              strokeWidth="1"
              rx="3"
            />

            {/* 조절 버클 */}
            <rect
              x="90"
              y="98"
              width="20"
              height="14"
              fill="#94a3b8"
              rx="2"
            />

            {/* 모자 꼭대기 버튼 */}
            <circle cx="100" cy="28" r="6" fill="#cbd5e1" stroke="#94a3b8" strokeWidth="1" />

            {/* 패널 분리선 */}
            <path d="M100 35 L100 90" fill="none" stroke="#e2e8f0" strokeWidth="1" />
            <path d="M60 40 L50 95" fill="none" stroke="#e2e8f0" strokeWidth="1" />
            <path d="M140 40 L150 95" fill="none" stroke="#e2e8f0" strokeWidth="1" />
          </g>

          {/* 부착 위치 */}
          <rect
            x="60"
            y="45"
            width="80"
            height="35"
            fill="rgba(16, 185, 129, 0.15)"
            stroke="#10b981"
            strokeWidth="2"
            strokeDasharray="5,3"
            rx="4"
          />

          {/* 로고 */}
          {brandLogo && (
            <image
              href={brandLogo}
              x="70"
              y="50"
              width="60"
              height="25"
              preserveAspectRatio="xMidYMid meet"
            />
          )}
        </svg>
      </div>

      <div className="mt-4 px-6 py-2 bg-emerald-500 text-white text-sm font-medium rounded-full">
        모자 후면
      </div>

      <div className="mt-3 flex items-center justify-center gap-4 text-xs text-slate-500">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-3 border-2 border-emerald-500 border-dashed rounded bg-emerald-500/10" />
          <span>부착 위치</span>
        </div>
      </div>
    </div>
  );
}

/**
 * 모자 챙 상단 뷰 (정면에서 살짝 위에서 본 시점 - 챙이 잘 보이게)
 */
function CapBrimTopView({
  brandLogo,
  className,
}: Omit<SlotVisualizationProps, 'bodyPart' | 'brandName'>) {
  return (
    <div className={cn('relative flex flex-col items-center', className)}>
      <div
        className="relative bg-slate-50 rounded-2xl p-6"
        style={{ maxWidth: '300px' }}
      >
        <svg viewBox="0 0 200 160" className="w-full h-auto">
          <defs>
            <linearGradient id="capBrimGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#f8fafc" />
              <stop offset="100%" stopColor="#e2e8f0" />
            </linearGradient>
            <filter id="capBrimShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="3" stdDeviation="3" floodOpacity="0.15" />
            </filter>
          </defs>

          <g filter="url(#capBrimShadow)">
            {/* 모자 크라운 */}
            <path
              d="M30 70 Q30 20 100 15 Q170 20 170 70 L170 85 L30 85 Z"
              fill="url(#capBrimGradient)"
              stroke="#94a3b8"
              strokeWidth="2"
            />

            {/* 모자 챙 - 정면에서 보이는 두꺼운 챙 (위에서 보이는 면 강조) */}
            <path
              d="M20 85 Q20 75 30 75 L170 75 Q180 75 180 85 L180 95 Q100 110 20 95 Z"
              fill="#e2e8f0"
              stroke="#94a3b8"
              strokeWidth="2"
            />

            {/* 챙 상단면 (로고 부착 영역) */}
            <path
              d="M25 80 L175 80 Q180 85 175 90 Q100 102 25 90 Q20 85 25 80 Z"
              fill="url(#capBrimGradient)"
              stroke="#94a3b8"
              strokeWidth="1"
            />

            {/* 챙 끝단 곡선 */}
            <path
              d="M20 95 Q100 115 180 95"
              fill="none"
              stroke="#cbd5e1"
              strokeWidth="1.5"
            />

            {/* 모자 꼭대기 버튼 */}
            <circle cx="100" cy="18" r="6" fill="#cbd5e1" stroke="#94a3b8" strokeWidth="1" />

            {/* 패널 분리선 */}
            <path d="M100 25 L100 70" fill="none" stroke="#e2e8f0" strokeWidth="1" />
            <path d="M65 30 L55 75" fill="none" stroke="#e2e8f0" strokeWidth="1" />
            <path d="M135 30 L145 75" fill="none" stroke="#e2e8f0" strokeWidth="1" />

            {/* 통풍구멍 */}
            <circle cx="60" cy="45" r="3" fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="1" />
            <circle cx="140" cy="45" r="3" fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="1" />
          </g>

          {/* 부착 위치 (챙 상단면) */}
          <rect
            x="50"
            y="78"
            width="100"
            height="18"
            fill="rgba(16, 185, 129, 0.15)"
            stroke="#10b981"
            strokeWidth="2"
            strokeDasharray="5,3"
            rx="3"
          />

          {/* 로고 */}
          {brandLogo && (
            <image
              href={brandLogo}
              x="60"
              y="80"
              width="80"
              height="14"
              preserveAspectRatio="xMidYMid meet"
            />
          )}
        </svg>
      </div>

      <div className="mt-4 px-6 py-2 bg-emerald-500 text-white text-sm font-medium rounded-full">
        모자 챙 상단
      </div>

      <div className="mt-3 flex items-center justify-center gap-4 text-xs text-slate-500">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-3 border-2 border-emerald-500 border-dashed rounded bg-emerald-500/10" />
          <span>부착 위치</span>
        </div>
      </div>
    </div>
  );
}

/**
 * 바지 bodyPart에서 위치 판별
 */
function getPantsPosition(bodyPart: string): {
  key: string;
  x: number;
  y: number;
  label: string;
} {
  const part = bodyPart.toUpperCase();

  if (part.includes('HIP')) {
    // 힙 사이드 포켓 위치 (오른쪽 엉덩이 옆면)
    return { key: 'PANTS_HIP', x: 150, y: 85, label: '바지 힙 (측면)' };
  }
  if (part.includes('THIGH')) {
    return { key: 'PANTS_THIGH', x: 155, y: 160, label: '바지 허벅지' };
  }

  // 기본값: 힙
  return { key: 'PANTS_HIP', x: 150, y: 85, label: '바지 힙 (측면)' };
}

/**
 * 골프 바지 시각화
 */
function PantsVisualization({
  bodyPart,
  brandLogo,
  className,
}: Omit<SlotVisualizationProps, 'brandName'>) {
  const pos = getPantsPosition(bodyPart || '');
  const isHip = pos.key === 'PANTS_HIP';

  return (
    <div className={cn('relative flex flex-col items-center', className)}>
      <div
        className="relative bg-slate-50 rounded-2xl p-4"
        style={{ maxWidth: '320px' }}
      >
        <svg
          viewBox="0 0 200 280"
          className="w-full h-auto"
        >
          {/* 그림자 효과 */}
          <defs>
            <filter id="pantsShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="2" dy="4" stdDeviation="4" floodOpacity="0.1" />
            </filter>
            <linearGradient id="pantsGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#f1f5f9" />
              <stop offset="100%" stopColor="#e2e8f0" />
            </linearGradient>
          </defs>

          <g filter="url(#pantsShadow)">
            {/* 허리 밴드 */}
            <path
              d="M40 25 L160 25 L160 45 L40 45 Z"
              fill="#cbd5e1"
              stroke="#94a3b8"
              strokeWidth="2"
            />

            {/* 벨트 루프들 */}
            <rect x="55" y="22" width="8" height="26" fill="#94a3b8" rx="1" />
            <rect x="95" y="22" width="8" height="26" fill="#94a3b8" rx="1" />
            <rect x="135" y="22" width="8" height="26" fill="#94a3b8" rx="1" />

            {/* 왼쪽 다리 */}
            <path
              d="M40 45 L45 260 L95 260 L100 120 L100 45 Z"
              fill="url(#pantsGradient)"
              stroke="#94a3b8"
              strokeWidth="2"
            />

            {/* 오른쪽 다리 */}
            <path
              d="M100 45 L100 120 L105 260 L155 260 L160 45 Z"
              fill="url(#pantsGradient)"
              stroke="#94a3b8"
              strokeWidth="2"
            />

            {/* 지퍼 라인 */}
            <line x1="100" y1="45" x2="100" y2="90" stroke="#cbd5e1" strokeWidth="2" />

            {/* 앞주머니 (왼쪽) */}
            <path
              d="M45 55 Q55 65 60 90 L50 90 Q45 70 45 55"
              fill="none"
              stroke="#cbd5e1"
              strokeWidth="1.5"
            />

            {/* 앞주머니 (오른쪽) */}
            <path
              d="M155 55 Q145 65 140 90 L150 90 Q155 70 155 55"
              fill="none"
              stroke="#cbd5e1"
              strokeWidth="1.5"
            />

            {/* 사이드 포켓 라인 (오른쪽) */}
            <path
              d="M155 55 L155 110"
              fill="none"
              stroke="#cbd5e1"
              strokeWidth="1.5"
            />

            {/* 무릎 부분 라인 */}
            <path
              d="M50 180 Q70 185 90 180"
              fill="none"
              stroke="#e2e8f0"
              strokeWidth="1"
            />
            <path
              d="M110 180 Q130 185 150 180"
              fill="none"
              stroke="#e2e8f0"
              strokeWidth="1"
            />

            {/* 하단 밑단 */}
            <path d="M45 255 Q70 260 95 255" fill="none" stroke="#cbd5e1" strokeWidth="1.5" />
            <path d="M105 255 Q130 260 155 255" fill="none" stroke="#cbd5e1" strokeWidth="1.5" />
          </g>

          {/* 부착 위치 표시 영역 */}
          {isHip ? (
            // 힙 측면 영역 (오른쪽 엉덩이 옆)
            <rect
              x={pos.x - 25}
              y={pos.y - 20}
              width="45"
              height="40"
              fill="rgba(16, 185, 129, 0.15)"
              stroke="#10b981"
              strokeWidth="2"
              strokeDasharray="6,3"
              rx="6"
            />
          ) : (
            // 허벅지 측면 영역
            <rect
              x={pos.x - 20}
              y={pos.y - 30}
              width="40"
              height="55"
              fill="rgba(16, 185, 129, 0.15)"
              stroke="#10b981"
              strokeWidth="2"
              strokeDasharray="6,3"
              rx="6"
            />
          )}

          {/* 로고 */}
          {brandLogo && (
            <image
              href={brandLogo}
              x={isHip ? pos.x - 20 : pos.x - 15}
              y={isHip ? pos.y - 15 : pos.y - 25}
              width={isHip ? 35 : 30}
              height={isHip ? 30 : 45}
              preserveAspectRatio="xMidYMid meet"
            />
          )}
        </svg>
      </div>

      {/* 위치 라벨 */}
      <div className="mt-4 px-6 py-2 bg-emerald-500 text-white text-sm font-medium rounded-full">
        {pos.label}
      </div>

      {/* 범례 */}
      <div className="mt-3 flex items-center justify-center gap-4 text-xs text-slate-500">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-3 border-2 border-emerald-500 border-dashed rounded bg-emerald-500/10" />
          <span>부착 위치</span>
        </div>
      </div>
    </div>
  );
}

export default SlotVisualization;
