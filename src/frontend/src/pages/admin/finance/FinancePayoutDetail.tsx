import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../../services/api';

function formatNumber(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0';
  return num.toLocaleString('ko-KR');
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString('ko-KR');
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  PROCESSING: 'bg-blue-100 text-blue-800 border-blue-300',
  COMPLETED: 'bg-green-100 text-green-800 border-green-300',
  FAILED: 'bg-red-100 text-red-800 border-red-300',
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: '대기중',
  PROCESSING: '처리중',
  COMPLETED: '완료',
  FAILED: '실패',
};

export default function FinancePayoutDetail() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      loadBatch();
    }
  }, [id]);

  const loadBatch = async () => {
    try {
      const res = await api.getFinancePayoutBatch(id!);
      if (res.success) {
        setData(res.data);
      }
    } catch (error) {
      console.error('Failed to load payout batch:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!data?.batch) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">정산 배치를 찾을 수 없습니다.</p>
        <Link to="/admin/finance/payouts" className="text-blue-600 hover:underline mt-2 inline-block">
          ← 목록으로
        </Link>
      </div>
    );
  }

  const { batch, totalAmount } = data;

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex justify-between items-center">
        <div>
          <Link to="/admin/finance/payouts" className="text-blue-600 hover:underline text-sm">
            ← 정산 배치 목록
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-2">정산 배치 상세</h1>
        </div>
        <span className={`px-4 py-2 text-sm font-medium rounded-lg border ${STATUS_COLORS[batch.status]}`}>
          {STATUS_LABELS[batch.status] || batch.status}
        </span>
      </div>

      {/* 배치 정보 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">배치 정보</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="text-sm text-gray-500">ID</div>
            <div className="font-mono text-sm">{batch.id}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500">생성일</div>
            <div className="text-sm">{formatDate(batch.createdAt)}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500">처리일</div>
            <div className="text-sm">{formatDate(batch.processedAt)}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500">항목 수</div>
            <div className="text-sm font-medium">{batch.items?.length || 0}건</div>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t">
          <div className="bg-green-50 p-4 rounded-lg inline-block">
            <div className="text-sm text-gray-500">총 정산 금액</div>
            <div className="text-2xl font-bold text-green-600">₩{formatNumber(totalAmount)}</div>
          </div>
        </div>
      </div>

      {/* 정산 항목 */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">정산 항목</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">선수</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">에스크로 ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">계약 ID</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">금액</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">상태</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {batch.items?.map((item: any) => (
                <tr key={item.id}>
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-gray-900">
                      {item.athlete?.name || '-'}
                    </div>
                    <div className="text-xs text-gray-500 font-mono">
                      {item.athleteId?.slice(0, 8)}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      to={`/admin/finance/escrows/${item.escrowId}`}
                      className="text-sm font-mono text-blue-600 hover:underline"
                    >
                      {item.escrowId?.slice(0, 8)}...
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm font-mono text-gray-600">
                    {item.escrow?.contractId?.slice(0, 8)}...
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-medium">
                    ₩{formatNumber(item.amount)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 text-xs font-medium rounded ${
                      item.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                      item.status === 'FAILED' ? 'bg-red-100 text-red-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {item.status}
                    </span>
                  </td>
                </tr>
              ))}
              {(!batch.items || batch.items.length === 0) && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    정산 항목이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
