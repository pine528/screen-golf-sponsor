import { useState } from 'react';
import { Truck, ExternalLink, Loader2 } from 'lucide-react';

interface ShippingInfoFormProps {
  initialCarrier?: string;
  initialTrackingNumber?: string;
  onSubmit: (data: { carrier: string; trackingNumber: string }) => Promise<void>;
  isLoading?: boolean;
  readOnly?: boolean;
}

const CARRIERS = [
  { value: 'CJ대한통운', label: 'CJ대한통운', trackingUrl: 'https://www.cjlogistics.com/ko/tool/parcel/tracking?gnbInvcNo=' },
  { value: '한진택배', label: '한진택배', trackingUrl: 'https://www.hanjin.com/kor/CMS/DeliveryMgr/WaybillResult.do?mession_mode=&wblnumText=' },
  { value: '롯데택배', label: '롯데택배', trackingUrl: 'https://www.lotteglogis.com/home/reservation/tracking/linkView?InvNo=' },
  { value: '로젠택배', label: '로젠택배', trackingUrl: 'https://www.ilogen.com/web/personal/trace/' },
  { value: '우체국택배', label: '우체국택배', trackingUrl: 'https://service.epost.go.kr/trace.RetrieveDomRi498.postal?sid1=' },
  { value: 'GS편의점택배', label: 'GS편의점택배', trackingUrl: 'https://www.cvsnet.co.kr/invoice/tracking.do?invoice_no=' },
  { value: '기타', label: '기타(직접입력)', trackingUrl: '' },
];

export function ShippingInfoForm({
  initialCarrier = '',
  initialTrackingNumber = '',
  onSubmit,
  isLoading = false,
  readOnly = false,
}: ShippingInfoFormProps) {
  const [carrier, setCarrier] = useState(initialCarrier);
  const [customCarrier, setCustomCarrier] = useState('');
  const [trackingNumber, setTrackingNumber] = useState(initialTrackingNumber);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalCarrier = carrier === '기타' ? customCarrier : carrier;
    await onSubmit({ carrier: finalCarrier, trackingNumber });
  };

  const getTrackingUrl = () => {
    const carrierInfo = CARRIERS.find((c) => c.value === carrier);
    if (carrierInfo?.trackingUrl && trackingNumber) {
      return carrierInfo.trackingUrl + trackingNumber;
    }
    return null;
  };

  const trackingUrl = getTrackingUrl();

  if (readOnly) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-slate-600">
          <Truck className="w-5 h-5" />
          <span className="font-medium">배송 정보</span>
        </div>
        <div className="bg-slate-50 rounded-lg p-4 space-y-2">
          <div className="flex justify-between">
            <span className="text-slate-500">택배사</span>
            <span className="font-medium">{initialCarrier || '-'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">운송장번호</span>
            <span className="font-medium">{initialTrackingNumber || '-'}</span>
          </div>
          {trackingUrl && (
            <a
              href={trackingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 mt-2"
            >
              배송 조회 <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center gap-2 text-slate-600">
        <Truck className="w-5 h-5" />
        <span className="font-medium">배송 정보 등록</span>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          택배사
        </label>
        <select
          value={carrier}
          onChange={(e) => setCarrier(e.target.value)}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
          required
        >
          <option value="">선택하세요</option>
          {CARRIERS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      {carrier === '기타' && (
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            택배사명
          </label>
          <input
            type="text"
            value={customCarrier}
            onChange={(e) => setCustomCarrier(e.target.value)}
            placeholder="택배사명을 입력하세요"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            required
          />
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          운송장 번호
        </label>
        <input
          type="text"
          value={trackingNumber}
          onChange={(e) => setTrackingNumber(e.target.value)}
          placeholder="운송장 번호를 입력하세요"
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
          required
        />
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            등록 중...
          </>
        ) : (
          <>
            <Truck className="w-4 h-4" />
            배송 정보 등록
          </>
        )}
      </button>
    </form>
  );
}
