import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layout } from '../../components/Layout';
import { api } from '../../services/api';
import {
  Heart,
  User,
  Building2,
  Search,
  Loader2,
  X,
  Plus,
  Trash2,
  Globe,
} from 'lucide-react';
import { cn } from '../../utils';

interface Athlete {
  id: string;
  name: string;
  tour: string;
  profileImageUrl?: string;
  bio?: string;
  favoritedAt?: string;
}

interface Brand {
  id: string;
  name: string;
  category: string;
  website?: string;
  description?: string;
  favoritedAt?: string;
}

type Tab = 'athletes' | 'brands';

export default function Favorites() {
  const [activeTab, setActiveTab] = useState<Tab>('athletes');
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const queryClient = useQueryClient();

  const { data: favorites, isLoading } = useQuery({
    queryKey: ['favorites'],
    queryFn: async () => {
      const res = await api.getFavorites();
      return res.data as { athletes: Athlete[]; brands: Brand[] };
    },
  });

  const { data: athletesList, isLoading: loadingAthletes } = useQuery({
    queryKey: ['athletesList', searchQuery],
    queryFn: async () => {
      const res = await api.getAthletesList({ q: searchQuery || undefined, limit: 20 });
      return (res.data || []) as Athlete[];
    },
    enabled: showAddModal && activeTab === 'athletes',
  });

  const { data: brandsList, isLoading: loadingBrands } = useQuery({
    queryKey: ['brandsList', searchQuery],
    queryFn: async () => {
      const res = await api.getBrandsList({ q: searchQuery || undefined, limit: 20 });
      return (res.data || []) as Brand[];
    },
    enabled: showAddModal && activeTab === 'brands',
  });

  const addAthleteMutation = useMutation({
    mutationFn: (athleteId: string) => api.addFavoriteAthlete(athleteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['favorites'] });
    },
  });

  const removeAthleteMutation = useMutation({
    mutationFn: (athleteId: string) => api.removeFavoriteAthlete(athleteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['favorites'] });
    },
  });

  const addBrandMutation = useMutation({
    mutationFn: (brandId: string) => api.addFavoriteBrand(brandId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['favorites'] });
    },
  });

  const removeBrandMutation = useMutation({
    mutationFn: (brandId: string) => api.removeFavoriteBrand(brandId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['favorites'] });
    },
  });

  const isAthleteFavorited = (athleteId: string) => {
    return favorites?.athletes.some((a) => a.id === athleteId) ?? false;
  };

  const isBrandFavorited = (brandId: string) => {
    return favorites?.brands.some((b) => b.id === brandId) ?? false;
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">즐겨찾기</h1>
          <p className="text-slate-500">좋아하는 선수와 브랜드를 관리하세요</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('athletes')}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors',
              activeTab === 'athletes'
                ? 'bg-emerald-500 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            )}
          >
            <User className="w-4 h-4" />
            선수 ({favorites?.athletes.length ?? 0})
          </button>
          <button
            onClick={() => setActiveTab('brands')}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors',
              activeTab === 'brands'
                ? 'bg-emerald-500 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            )}
          >
            <Building2 className="w-4 h-4" />
            브랜드 ({favorites?.brands.length ?? 0})
          </button>

          <button
            onClick={() => {
              setShowAddModal(true);
              setSearchQuery('');
            }}
            className="ml-auto flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg font-medium hover:bg-emerald-600 transition-colors"
          >
            <Plus className="w-4 h-4" />
            추가하기
          </button>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
          </div>
        ) : activeTab === 'athletes' ? (
          <div className="space-y-3">
            {favorites?.athletes.length === 0 ? (
              <div className="card p-12 text-center">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Heart className="w-8 h-8 text-slate-400" />
                </div>
                <p className="text-slate-500 mb-4">즐겨찾기한 선수가 없습니다</p>
                <button
                  onClick={() => {
                    setShowAddModal(true);
                    setSearchQuery('');
                  }}
                  className="btn btn-primary"
                >
                  선수 추가하기
                </button>
              </div>
            ) : (
              favorites?.athletes.map((athlete) => (
                <div
                  key={athlete.id}
                  className="card p-4 flex items-center gap-4 hover:border-emerald-200 transition-colors"
                >
                  <div className="w-14 h-14 rounded-full bg-slate-100 overflow-hidden flex-shrink-0">
                    {athlete.profileImageUrl ? (
                      <img
                        src={athlete.profileImageUrl}
                        alt={athlete.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <User className="w-7 h-7 text-slate-400" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-slate-900">{athlete.name}</h3>
                    <p className="text-sm text-slate-500">{athlete.tour}</p>
                    {athlete.bio && (
                      <p className="text-xs text-slate-400 mt-1 line-clamp-1">{athlete.bio}</p>
                    )}
                  </div>
                  <button
                    onClick={() => removeAthleteMutation.mutate(athlete.id)}
                    disabled={removeAthleteMutation.isPending}
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    {removeAthleteMutation.isPending ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Trash2 className="w-5 h-5" />
                    )}
                  </button>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {favorites?.brands.length === 0 ? (
              <div className="card p-12 text-center">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Heart className="w-8 h-8 text-slate-400" />
                </div>
                <p className="text-slate-500 mb-4">즐겨찾기한 브랜드가 없습니다</p>
                <button
                  onClick={() => {
                    setShowAddModal(true);
                    setSearchQuery('');
                  }}
                  className="btn btn-primary"
                >
                  브랜드 추가하기
                </button>
              </div>
            ) : (
              favorites?.brands.map((brand) => (
                <div
                  key={brand.id}
                  className="card p-4 flex items-center gap-4 hover:border-emerald-200 transition-colors"
                >
                  <div className="w-14 h-14 rounded-xl bg-sky-100 flex items-center justify-center flex-shrink-0">
                    <Building2 className="w-7 h-7 text-sky-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-slate-900">{brand.name}</h3>
                    <p className="text-sm text-slate-500">{brand.category}</p>
                    {brand.website && (
                      <a
                        href={brand.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-emerald-600 hover:underline flex items-center gap-1 mt-1"
                      >
                        <Globe className="w-3 h-3" />
                        {brand.website}
                      </a>
                    )}
                  </div>
                  <button
                    onClick={() => removeBrandMutation.mutate(brand.id)}
                    disabled={removeBrandMutation.isPending}
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    {removeBrandMutation.isPending ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Trash2 className="w-5 h-5" />
                    )}
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="font-semibold text-lg">
                {activeTab === 'athletes' ? '선수 추가' : '브랜드 추가'}
              </h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search */}
            <div className="p-4 border-b">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder={activeTab === 'athletes' ? '선수 이름 검색...' : '브랜드 이름 검색...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input pl-10"
                />
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4">
              {activeTab === 'athletes' ? (
                loadingAthletes ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
                  </div>
                ) : !athletesList || athletesList.length === 0 ? (
                  <p className="text-center text-slate-500 py-8">검색 결과가 없습니다</p>
                ) : (
                  <div className="space-y-2">
                    {athletesList.map((athlete) => {
                      const isFavorited = isAthleteFavorited(athlete.id);
                      return (
                        <div
                          key={athlete.id}
                          className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50"
                        >
                          <div className="w-10 h-10 rounded-full bg-slate-100 overflow-hidden flex-shrink-0">
                            {athlete.profileImageUrl ? (
                              <img
                                src={athlete.profileImageUrl}
                                alt={athlete.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <User className="w-5 h-5 text-slate-400" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-slate-900">{athlete.name}</p>
                            <p className="text-xs text-slate-500">{athlete.tour}</p>
                          </div>
                          <button
                            onClick={() => {
                              if (isFavorited) {
                                removeAthleteMutation.mutate(athlete.id);
                              } else {
                                addAthleteMutation.mutate(athlete.id);
                              }
                            }}
                            disabled={addAthleteMutation.isPending || removeAthleteMutation.isPending}
                            className={cn(
                              'p-2 rounded-lg transition-colors',
                              isFavorited
                                ? 'bg-red-100 text-red-600 hover:bg-red-200'
                                : 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200'
                            )}
                          >
                            {addAthleteMutation.isPending || removeAthleteMutation.isPending ? (
                              <Loader2 className="w-5 h-5 animate-spin" />
                            ) : isFavorited ? (
                              <Heart className="w-5 h-5 fill-current" />
                            ) : (
                              <Plus className="w-5 h-5" />
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )
              ) : (
                loadingBrands ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
                  </div>
                ) : !brandsList || brandsList.length === 0 ? (
                  <p className="text-center text-slate-500 py-8">검색 결과가 없습니다</p>
                ) : (
                  <div className="space-y-2">
                    {brandsList.map((brand) => {
                      const isFavorited = isBrandFavorited(brand.id);
                      return (
                        <div
                          key={brand.id}
                          className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50"
                        >
                          <div className="w-10 h-10 rounded-lg bg-sky-100 flex items-center justify-center flex-shrink-0">
                            <Building2 className="w-5 h-5 text-sky-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-slate-900">{brand.name}</p>
                            <p className="text-xs text-slate-500">{brand.category}</p>
                          </div>
                          <button
                            onClick={() => {
                              if (isFavorited) {
                                removeBrandMutation.mutate(brand.id);
                              } else {
                                addBrandMutation.mutate(brand.id);
                              }
                            }}
                            disabled={addBrandMutation.isPending || removeBrandMutation.isPending}
                            className={cn(
                              'p-2 rounded-lg transition-colors',
                              isFavorited
                                ? 'bg-red-100 text-red-600 hover:bg-red-200'
                                : 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200'
                            )}
                          >
                            {addBrandMutation.isPending || removeBrandMutation.isPending ? (
                              <Loader2 className="w-5 h-5 animate-spin" />
                            ) : isFavorited ? (
                              <Heart className="w-5 h-5 fill-current" />
                            ) : (
                              <Plus className="w-5 h-5" />
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
