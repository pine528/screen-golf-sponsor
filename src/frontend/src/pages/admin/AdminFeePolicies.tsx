import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Layout } from '../../components/Layout';
import { api } from '../../services/api';
import {
  Settings,
  Loader2,
  Calculator,
  TrendingUp,
  Users,
} from 'lucide-react';
import { cn } from '../../utils';

type FeePolicyType = 'FAN_VOTE_OPEN' | 'FAN_VOTE_ENTRY' | 'FAN_VOTE_SETTLE';

interface SimulationInput {
  seedPoints: number;
  entryFee: number;
  participantCount: number;
}

const POLICY_TYPE_LABELS: Record<FeePolicyType, { label: string; description: string; icon: any; color: string }> = {
  FAN_VOTE_OPEN: {
    label: '개설 수수료',
    description: 'Seed의 2% (최소 1,000P ~ 최대 50,000P)',
    icon: Settings,
    color: 'blue',
  },
  FAN_VOTE_ENTRY: {
    label: '참여 수수료',
    description: '참여비의 10% (최소 10P ~ 최대 500P), 플랫폼 70% / 개설자 30%',
    icon: Users,
    color: 'emerald',
  },
  FAN_VOTE_SETTLE: {
    label: '정산 수수료',
    description: '총 상금풀의 2% (최대 100,000P)',
    icon: TrendingUp,
    color: 'purple',
  },
};

export default function AdminFeePolicies() {
  const [simulationInput, setSimulationInput] = useState<SimulationInput>({
    seedPoints: 200000,
    entryFee: 500,
    participantCount: 1000,
  });
  const [showSimulation, setShowSimulation] = useState(false);

  // 현재 활성 정책 조회
  const { data: feeInfo, isLoading: infoLoading } = useQuery({
    queryKey: ['feeInfo'],
    queryFn: async () => {
      const res = await api.get('/fan-votes/fee/info');
      return res.data;
    },
  });

  // 시뮬레이션
  const simulateMutation = useMutation({
    mutationFn: async (input: SimulationInput) => {
      const res = await api.post('/admin/fee-policies/simulate', input);
      return res.data;
    },
  });

  const handleSimulate = () => {
    simulateMutation.mutate(simulationInput);
  };

  const formatNumber = (num: number | string) => {
    return Number(num).toLocaleString();
  };

  if (infoLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
              <Settings className="w-5 h-5 text-slate-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">수수료 정책 관리</h1>
              <p className="text-sm text-slate-500">팬 투표 수수료 정책을 관리합니다</p>
            </div>
          </div>
          <button
            onClick={() => setShowSimulation(!showSimulation)}
            className={cn(
              'btn gap-2',
              showSimulation ? 'btn-primary' : 'btn-outline'
            )}
          >
            <Calculator className="w-4 h-4" />
            시뮬레이터
          </button>
        </div>

        {/* Current Policies Summary */}
        {feeInfo && (
          <div className="grid grid-cols-3 gap-4 mb-6">
            {/* Open Fee */}
            <div className="card p-4 bg-blue-50 border-blue-200">
              <div className="flex items-center gap-2 mb-2">
                <Settings className="w-4 h-4 text-blue-600" />
                <span className="font-medium text-blue-800">개설 수수료</span>
              </div>
              <p className="text-2xl font-bold text-blue-900">{feeInfo.openFee.ratePercent}%</p>
              <p className="text-xs text-blue-600 mt-1">
                {formatNumber(feeInfo.openFee.minAmount)}P ~ {formatNumber(feeInfo.openFee.maxAmount)}P
              </p>
            </div>

            {/* Entry Fee */}
            <div className="card p-4 bg-emerald-50 border-emerald-200">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-4 h-4 text-emerald-600" />
                <span className="font-medium text-emerald-800">참여 수수료</span>
              </div>
              <p className="text-2xl font-bold text-emerald-900">{feeInfo.entryFee.ratePercent}%</p>
              <p className="text-xs text-emerald-600 mt-1">
                플랫폼 {feeInfo.entryFee.platformSharePercent}% / 개설자 {feeInfo.entryFee.creatorSharePercent}%
              </p>
            </div>

            {/* Settlement Fee */}
            <div className="card p-4 bg-purple-50 border-purple-200">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-purple-600" />
                <span className="font-medium text-purple-800">정산 수수료</span>
              </div>
              <p className="text-2xl font-bold text-purple-900">{feeInfo.settlementFee.ratePercent}%</p>
              <p className="text-xs text-purple-600 mt-1">
                최대 {formatNumber(feeInfo.settlementFee.maxAmount)}P
              </p>
            </div>
          </div>
        )}

        {/* Simulator */}
        {showSimulation && (
          <div className="card p-6 mb-6 bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200">
            <h3 className="font-semibold text-amber-800 mb-4 flex items-center gap-2">
              <Calculator className="w-5 h-5" />
              수수료 시뮬레이터
            </h3>

            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Seed (상금포인트)
                </label>
                <input
                  type="number"
                  value={simulationInput.seedPoints}
                  onChange={(e) => setSimulationInput(prev => ({
                    ...prev,
                    seedPoints: parseInt(e.target.value) || 0
                  }))}
                  className="input w-full"
                  min={0}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  참여비 (1인당)
                </label>
                <input
                  type="number"
                  value={simulationInput.entryFee}
                  onChange={(e) => setSimulationInput(prev => ({
                    ...prev,
                    entryFee: parseInt(e.target.value) || 0
                  }))}
                  className="input w-full"
                  min={0}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  예상 참여자 수
                </label>
                <input
                  type="number"
                  value={simulationInput.participantCount}
                  onChange={(e) => setSimulationInput(prev => ({
                    ...prev,
                    participantCount: parseInt(e.target.value) || 1
                  }))}
                  className="input w-full"
                  min={1}
                />
              </div>
            </div>

            <button
              onClick={handleSimulate}
              disabled={simulateMutation.isPending}
              className="btn btn-primary w-full mb-4"
            >
              {simulateMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Calculator className="w-4 h-4 mr-2" />
              )}
              시뮬레이션 실행
            </button>

            {/* Simulation Results */}
            {simulateMutation.data && (
              <div className="bg-white rounded-lg p-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {/* 개설자 비용 */}
                  <div className="bg-blue-50 rounded-lg p-3">
                    <p className="text-sm font-medium text-blue-800 mb-2">개설자 필요 포인트</p>
                    <p className="text-xl font-bold text-blue-900">
                      {formatNumber(simulateMutation.data.summary.creatorRequired)}P
                    </p>
                    <div className="text-xs text-blue-600 mt-1 space-y-0.5">
                      <div className="flex justify-between">
                        <span>Seed</span>
                        <span>{formatNumber(simulateMutation.data.input.seedPoints)}P</span>
                      </div>
                      <div className="flex justify-between">
                        <span>개설 수수료</span>
                        <span>{formatNumber(simulateMutation.data.openFee.fee)}P</span>
                      </div>
                    </div>
                  </div>

                  {/* 당첨자 지급 */}
                  <div className="bg-emerald-50 rounded-lg p-3">
                    <p className="text-sm font-medium text-emerald-800 mb-2">당첨자 총 지급액</p>
                    <p className="text-xl font-bold text-emerald-900">
                      {formatNumber(simulateMutation.data.summary.winnerPayout)}P
                    </p>
                    <div className="text-xs text-emerald-600 mt-1 space-y-0.5">
                      <div className="flex justify-between">
                        <span>총 상금풀</span>
                        <span>{formatNumber(simulateMutation.data.pool.grossPool)}P</span>
                      </div>
                      <div className="flex justify-between">
                        <span>정산 수수료</span>
                        <span>-{formatNumber(simulateMutation.data.settlementFee.fee)}P</span>
                      </div>
                    </div>
                  </div>

                  {/* 플랫폼 수익 */}
                  <div className="bg-purple-50 rounded-lg p-3">
                    <p className="text-sm font-medium text-purple-800 mb-2">플랫폼 총 수익</p>
                    <p className="text-xl font-bold text-purple-900">
                      {formatNumber(simulateMutation.data.summary.totalPlatformRevenue)}P
                    </p>
                    <div className="text-xs text-purple-600 mt-1 space-y-0.5">
                      <div className="flex justify-between">
                        <span>개설 수수료</span>
                        <span>{formatNumber(simulateMutation.data.openFee.fee)}P</span>
                      </div>
                      <div className="flex justify-between">
                        <span>참여 수수료</span>
                        <span>{formatNumber(simulateMutation.data.entryDeduction.total.totalPlatformFees)}P</span>
                      </div>
                      <div className="flex justify-between">
                        <span>정산 수수료</span>
                        <span>{formatNumber(simulateMutation.data.settlementFee.fee)}P</span>
                      </div>
                    </div>
                  </div>

                  {/* 개설자 리워드 */}
                  <div className="bg-amber-50 rounded-lg p-3">
                    <p className="text-sm font-medium text-amber-800 mb-2">개설자 리워드</p>
                    <p className="text-xl font-bold text-amber-900">
                      {formatNumber(simulateMutation.data.summary.totalCreatorReward)}P
                    </p>
                    <div className="text-xs text-amber-600 mt-1 space-y-0.5">
                      <div className="flex justify-between">
                        <span>참여 수수료 중 30%</span>
                        <span>{formatNumber(simulateMutation.data.entryDeduction.total.totalCreatorRewards)}P</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 상세 breakdown */}
                <div className="border-t pt-4">
                  <p className="text-sm font-medium text-slate-700 mb-2">상세 계산</p>
                  <div className="text-xs text-slate-600 space-y-1">
                    <div className="flex justify-between">
                      <span>참여비 총액 ({simulateMutation.data.input.participantCount}명 x {formatNumber(simulateMutation.data.input.entryFee)}P)</span>
                      <span>{formatNumber(simulateMutation.data.entryDeduction.total.totalEntryFees)}P</span>
                    </div>
                    <div className="flex justify-between pl-3">
                      <span>└ 참여 수수료 공제 (10%)</span>
                      <span>{formatNumber(simulateMutation.data.entryDeduction.total.totalEntryDeductions)}P</span>
                    </div>
                    <div className="flex justify-between pl-3">
                      <span>└ 상금풀 적립 (90%)</span>
                      <span>{formatNumber(simulateMutation.data.entryDeduction.total.netPoolFromEntries)}P</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Policy Descriptions */}
        <div className="card p-6">
          <h3 className="font-semibold text-slate-900 mb-4">수수료 정책 설명</h3>
          <div className="space-y-4">
            {Object.entries(POLICY_TYPE_LABELS).map(([type, info]) => {
              const Icon = info.icon;
              return (
                <div
                  key={type}
                  className={cn(
                    'p-4 rounded-lg border',
                    `bg-${info.color}-50 border-${info.color}-200`
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'w-10 h-10 rounded-lg flex items-center justify-center',
                      `bg-${info.color}-100`
                    )}>
                      <Icon className={cn('w-5 h-5', `text-${info.color}-600`)} />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">{info.label}</p>
                      <p className="text-sm text-slate-600">{info.description}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Example Calculation */}
        <div className="card p-6 mt-6 bg-slate-50">
          <h3 className="font-semibold text-slate-900 mb-4">예시: Entry 500P, Seed 200,000P, 1,000명 참여</h3>
          <div className="grid grid-cols-2 gap-6 text-sm">
            <div>
              <p className="font-medium text-slate-700 mb-2">수입 내역</p>
              <ul className="space-y-1 text-slate-600">
                <li className="flex justify-between">
                  <span>참여비 총액</span>
                  <span>500,000P</span>
                </li>
                <li className="flex justify-between text-slate-500 pl-2">
                  <span>└ 참여 수수료 (10%)</span>
                  <span>50,000P</span>
                </li>
                <li className="flex justify-between text-slate-500 pl-4">
                  <span>└ 플랫폼 (70%)</span>
                  <span>35,000P</span>
                </li>
                <li className="flex justify-between text-slate-500 pl-4">
                  <span>└ 개설자 (30%)</span>
                  <span>15,000P</span>
                </li>
                <li className="flex justify-between text-slate-500 pl-2">
                  <span>└ 상금풀 (90%)</span>
                  <span>450,000P</span>
                </li>
                <li className="flex justify-between">
                  <span>Seed (개설자)</span>
                  <span>200,000P</span>
                </li>
                <li className="flex justify-between border-t pt-1 font-medium">
                  <span>총 상금풀</span>
                  <span>650,000P</span>
                </li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-slate-700 mb-2">지출 내역</p>
              <ul className="space-y-1 text-slate-600">
                <li className="flex justify-between">
                  <span>개설 수수료 (2%)</span>
                  <span>4,000P</span>
                </li>
                <li className="flex justify-between">
                  <span>정산 수수료 (2%)</span>
                  <span>13,000P</span>
                </li>
                <li className="flex justify-between border-t pt-1 font-medium text-emerald-700">
                  <span>1등 지급액</span>
                  <span>637,000P</span>
                </li>
                <li className="flex justify-between border-t pt-1 font-medium text-purple-700">
                  <span>플랫폼 총 수익</span>
                  <span>52,000P</span>
                </li>
                <li className="flex justify-between font-medium text-amber-700">
                  <span>개설자 리워드</span>
                  <span>15,000P</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
