import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Layout } from '../../components/Layout';
import { api } from '../../services/api';
import {
  Gift,
  Package,
  Loader2,
  Truck,
} from 'lucide-react';
import { cn } from '../../utils';

interface ShopItem {
  id: string;
  title: string;
  description?: string;
  imageUrl?: string;
  pricePoints: string;
  stock: number;
  status: string;
  requiresShipping: boolean;
}

export default function Shop() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['shopItems', page],
    queryFn: () => api.getShopItems({ page, pageSize: 12 }),
  });

  const items: ShopItem[] = data?.data?.items || [];
  const pagination = data?.data?.pagination;

  const formatNumber = (num: string | number) => {
    return Number(num).toLocaleString();
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">포인트 샵</h1>
            <p className="text-slate-500">포인트로 다양한 상품을 교환하세요</p>
          </div>
          <Link
            to="/orders"
            className="btn btn-secondary flex items-center gap-2"
          >
            <Package className="w-4 h-4" />
            내 교환 내역
          </Link>
        </div>

        {/* Items Grid */}
        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
          </div>
        ) : items.length === 0 ? (
          <div className="card p-12 text-center">
            <Gift className="w-16 h-16 mx-auto mb-4 text-slate-300" />
            <p className="text-slate-500">등록된 상품이 없습니다</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {items.map((item) => (
                <Link
                  key={item.id}
                  to={`/shop/${item.id}`}
                  className="card overflow-hidden hover:shadow-lg transition-shadow group"
                >
                  {/* Image */}
                  <div className="aspect-square bg-slate-100 relative">
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={item.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Gift className="w-16 h-16 text-slate-300" />
                      </div>
                    )}
                    {item.stock === 0 && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <span className="text-white font-bold text-lg">품절</span>
                      </div>
                    )}
                    {item.requiresShipping && (
                      <div className="absolute top-2 right-2 bg-blue-500 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                        <Truck className="w-3 h-3" />
                        배송
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-4">
                    <h3 className="font-semibold text-slate-900 mb-1 group-hover:text-emerald-600 transition-colors">
                      {item.title}
                    </h3>
                    {item.description && (
                      <p className="text-sm text-slate-500 line-clamp-2 mb-3">
                        {item.description}
                      </p>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-bold text-emerald-600">
                        {formatNumber(item.pricePoints)}P
                      </span>
                      <span
                        className={cn(
                          'text-sm',
                          item.stock > 10
                            ? 'text-slate-500'
                            : item.stock > 0
                            ? 'text-amber-600'
                            : 'text-red-500'
                        )}
                      >
                        재고 {item.stock}개
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
              <div className="flex items-center justify-center gap-2">
                <button
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                  className="btn btn-secondary px-4 py-2 disabled:opacity-50"
                >
                  이전
                </button>
                <span className="text-slate-600">
                  {page} / {pagination.totalPages}
                </span>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={page === pagination.totalPages}
                  className="btn btn-secondary px-4 py-2 disabled:opacity-50"
                >
                  다음
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
