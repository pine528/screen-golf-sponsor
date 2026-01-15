import axios, { AxiosInstance, AxiosError } from 'axios';
import { ApiResponse } from '../types';

const API_URL = import.meta.env.VITE_API_URL || '/api';

class ApiService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor for auth token
    this.client.interceptors.request.use((config) => {
      const token = localStorage.getItem('accessToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        if (error.response?.status === 401) {
          // Try refresh token
          const refreshToken = localStorage.getItem('refreshToken');
          if (refreshToken) {
            try {
              const response = await axios.post(`${API_URL}/auth/refresh`, {
                refreshToken,
              });
              const { accessToken, refreshToken: newRefreshToken } = response.data.data;
              localStorage.setItem('accessToken', accessToken);
              localStorage.setItem('refreshToken', newRefreshToken);
              // Retry original request
              const originalRequest = error.config!;
              originalRequest.headers.Authorization = `Bearer ${accessToken}`;
              return this.client(originalRequest);
            } catch {
              // Refresh failed, logout
              localStorage.removeItem('accessToken');
              localStorage.removeItem('refreshToken');
              window.location.href = '/login';
            }
          }
        }
        return Promise.reject(error);
      }
    );
  }

  // Auth
  async login(email: string, password: string) {
    const response = await this.client.post<ApiResponse<any>>('/auth/login', { email, password });
    return response.data;
  }

  async register(data: any) {
    const response = await this.client.post<ApiResponse<any>>('/auth/register', data);
    return response.data;
  }

  async getMe() {
    const response = await this.client.get<ApiResponse<any>>('/auth/me');
    return response.data;
  }

  // Events
  async getEvents(params?: any) {
    const response = await this.client.get<ApiResponse<any[]>>('/events', { params });
    return response.data;
  }

  async getEvent(id: string) {
    const response = await this.client.get<ApiResponse<any>>(`/events/${id}`);
    return response.data;
  }

  async getUpcomingEvents(limit?: number) {
    const response = await this.client.get<ApiResponse<any[]>>('/events/upcoming', {
      params: { limit },
    });
    return response.data;
  }

  // Slots
  async getSlotTemplates() {
    const response = await this.client.get<ApiResponse<any[]>>('/slots/templates');
    return response.data;
  }

  async getSlotInstances(params?: any) {
    const response = await this.client.get<ApiResponse<any[]>>('/slots/instances', { params });
    return response.data;
  }

  async getAvailableSlots(params?: any) {
    const response = await this.client.get<ApiResponse<any[]>>('/slots/instances/available', {
      params,
    });
    return response.data;
  }

  async getSlotInstance(id: string) {
    const response = await this.client.get<ApiResponse<any>>(`/slots/instances/${id}`);
    return response.data;
  }

  async updateSlotSaleMode(slotId: string, data: {
    enableAuction?: boolean;
    enableDirectBuy?: boolean;
    directBuyPrice?: number | null;
    auctionMinBid?: number | null;
    auctionEndAt?: string | null;
  }) {
    const response = await this.client.patch<ApiResponse<any>>(`/slots/instances/${slotId}/sale-mode`, data);
    return response.data;
  }

  async buySlotNow(slotId: string) {
    const response = await this.client.post<ApiResponse<any>>(`/slots/instances/${slotId}/buy-now`);
    return response.data;
  }

  // Auctions
  async getAuctions(params?: any) {
    const response = await this.client.get<ApiResponse<any[]>>('/auctions', { params });
    return response.data;
  }

  async getAuction(id: string) {
    const response = await this.client.get<ApiResponse<any>>(`/auctions/${id}`);
    return response.data;
  }

  async getLiveAuctions() {
    const response = await this.client.get<ApiResponse<any[]>>('/auctions/live');
    return response.data;
  }

  async getEndingSoonAuctions(minutes?: number) {
    const response = await this.client.get<ApiResponse<any[]>>('/auctions/ending-soon', {
      params: { minutes },
    });
    return response.data;
  }

  async placeBid(auctionId: string, maxBid: number, autoBid: boolean = true) {
    const response = await this.client.post<ApiResponse<any>>(`/auctions/${auctionId}/bids`, {
      maxBid,
      autoBid,
    });
    return response.data;
  }

  async createAuction(data: {
    slotInstanceId: string;
    startAt: string;
    endAt: string;
    softCloseSec?: number;
    maxExtensionSec?: number;
    minBidIncrement?: number;
  }) {
    const response = await this.client.post<ApiResponse<any>>('/auctions', data);
    return response.data;
  }

  async getMyBids() {
    const response = await this.client.get<ApiResponse<any[]>>('/auctions/my-bids');
    return response.data;
  }

  async getMyWinningBids() {
    const response = await this.client.get<ApiResponse<any[]>>('/auctions/my-winning-bids');
    return response.data;
  }

  // Contracts
  async getContracts(params?: any) {
    const response = await this.client.get<ApiResponse<any[]>>('/contracts', { params });
    return response.data;
  }

  async getContract(id: string) {
    const response = await this.client.get<ApiResponse<any>>(`/contracts/${id}`);
    return response.data;
  }

  async getMyContracts() {
    const response = await this.client.get<ApiResponse<any[]>>('/contracts/my');
    return response.data;
  }

  async signContract(id: string) {
    const response = await this.client.post<ApiResponse<any>>(`/contracts/${id}/sign`);
    return response.data;
  }

  async uploadAsset(contractId: string, data: any) {
    const response = await this.client.post<ApiResponse<any>>(`/contracts/${contractId}/assets`, data);
    return response.data;
  }

  async submitVerification(contractId: string, data: any) {
    const response = await this.client.post<ApiResponse<any>>(`/contracts/${contractId}/verification`, data);
    return response.data;
  }

  async getContractReport(id: string) {
    const response = await this.client.get<ApiResponse<any>>(`/contracts/${id}/report`);
    return response.data;
  }

  // Settlements
  async getMySettlements() {
    const response = await this.client.get<ApiResponse<any[]>>('/contracts/settlements/my');
    return response.data;
  }

  async getMySettlementStats() {
    const response = await this.client.get<ApiResponse<any>>('/contracts/settlements/my/stats');
    return response.data;
  }

  // Brand
  async getMyBrand() {
    const response = await this.client.get<ApiResponse<any>>('/brands/me');
    return response.data;
  }

  async updateMyBrand(data: any) {
    const response = await this.client.patch<ApiResponse<any>>('/brands/me', data);
    return response.data;
  }

  async getMyBrandStats() {
    const response = await this.client.get<ApiResponse<any>>('/brands/me/stats');
    return response.data;
  }

  // Athlete
  async getMyAthlete() {
    const response = await this.client.get<ApiResponse<any>>('/athletes/me');
    return response.data;
  }

  async updateMyAthlete(data: any) {
    const response = await this.client.patch<ApiResponse<any>>('/athletes/me', data);
    return response.data;
  }

  async getMyAthleteStats() {
    const response = await this.client.get<ApiResponse<any>>('/athletes/me/stats');
    return response.data;
  }

  async getMyAthleteSlots(eventId?: string) {
    const response = await this.client.get<ApiResponse<any[]>>('/athletes/me/slots', {
      params: { eventId },
    });
    return response.data;
  }

  // Admin
  async getAdminDashboard() {
    const response = await this.client.get<ApiResponse<any>>('/admin/dashboard');
    return response.data;
  }

  async getPendingKyc() {
    const response = await this.client.get<ApiResponse<any>>('/admin/kyc/pending');
    return response.data;
  }

  async reviewBrandKyc(brandId: string, status: string, notes?: string) {
    const response = await this.client.post<ApiResponse<any>>(`/admin/kyc/brands/${brandId}/review`, {
      status,
      notes,
    });
    return response.data;
  }

  async reviewAthleteKyc(athleteId: string, status: string, notes?: string) {
    const response = await this.client.post<ApiResponse<any>>(`/admin/kyc/athletes/${athleteId}/review`, {
      status,
      notes,
    });
    return response.data;
  }

  async getAuctionMonitoring() {
    const response = await this.client.get<ApiResponse<any>>('/admin/monitoring/auctions');
    return response.data;
  }

  async getPendingReviews() {
    const response = await this.client.get<ApiResponse<any>>('/admin/monitoring/pending-reviews');
    return response.data;
  }

  // Upload
  async uploadFile(file: File, type: 'asset' | 'kyc' | 'verification' | 'profile') {
    const formData = new FormData();
    formData.append('file', file);

    const endpoint = type === 'asset' ? '/upload/asset'
      : type === 'kyc' ? '/upload/kyc'
      : type === 'verification' ? '/upload/verification'
      : '/upload/profile';

    const response = await this.client.post<ApiResponse<any>>(endpoint, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  async uploadFiles(files: File[], type: 'assets' | 'kyc' | 'verification') {
    const formData = new FormData();
    files.forEach(file => formData.append('files', file));

    const endpoint = type === 'assets' ? '/upload/assets'
      : type === 'kyc' ? '/upload/kyc/documents'
      : '/upload/verification';

    const response = await this.client.post<ApiResponse<any>>(endpoint, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  // KYC
  async submitKyc(data: { documents: { type: string; url: string }[]; businessNumber?: string }) {
    const response = await this.client.post<ApiResponse<any>>('/brands/me/kyc', data);
    return response.data;
  }

  async submitAthleteKyc(data: { documents: { type: string; url: string }[] }) {
    const response = await this.client.post<ApiResponse<any>>('/athletes/me/kyc', data);
    return response.data;
  }

  // Password change
  async changePassword(currentPassword: string, newPassword: string) {
    const response = await this.client.post<ApiResponse<any>>('/auth/change-password', {
      currentPassword,
      newPassword,
    });
    return response.data;
  }

  // Settlement
  async updateBankAccount(data: { bankName: string; accountNumber: string; accountHolder: string }) {
    const response = await this.client.patch<ApiResponse<any>>('/athletes/me/bank-account', data);
    return response.data;
  }

  async getMonthlySettlements() {
    const response = await this.client.get<ApiResponse<any[]>>('/contracts/settlements/my/monthly');
    return response.data;
  }

  async downloadSettlementReport(year: number, month: number) {
    const response = await this.client.get(`/contracts/settlements/my/report`, {
      params: { year, month },
      responseType: 'blob',
    });
    return response.data;
  }

  // Admin Settings
  async getAdminSettings() {
    const response = await this.client.get<ApiResponse<Record<string, { value: string; description: string | null }>>>('/admin/settings');
    return response.data;
  }

  async updateAdminSetting(key: string, value: string) {
    const response = await this.client.patch<ApiResponse<{ key: string; value: string }>>(`/admin/settings/${key}`, { value });
    return response.data;
  }

  // ============================================
  // Campaign API
  // ============================================

  async getCampaigns(params?: any) {
    const response = await this.client.get<ApiResponse<any[]>>('/campaigns', { params });
    return response.data;
  }

  async getMyCampaigns() {
    const response = await this.client.get<ApiResponse<any[]>>('/campaigns/my');
    return response.data;
  }

  async getCampaign(id: string) {
    const response = await this.client.get<ApiResponse<any>>(`/campaigns/${id}`);
    return response.data;
  }

  async createCampaign(data: {
    name: string;
    description?: string;
    budget: number;
    targetCategories?: string[];
    dateStart?: string;
    dateEnd?: string;
  }) {
    const response = await this.client.post<ApiResponse<any>>('/campaigns', data);
    return response.data;
  }

  async updateCampaign(id: string, data: any) {
    const response = await this.client.patch<ApiResponse<any>>(`/campaigns/${id}`, data);
    return response.data;
  }

  async deleteCampaign(id: string) {
    const response = await this.client.delete<ApiResponse<any>>(`/campaigns/${id}`);
    return response.data;
  }

  async activateCampaign(id: string) {
    const response = await this.client.post<ApiResponse<any>>(`/campaigns/${id}/activate`);
    return response.data;
  }

  async pauseCampaign(id: string) {
    const response = await this.client.post<ApiResponse<any>>(`/campaigns/${id}/pause`);
    return response.data;
  }

  async getCampaignStats() {
    const response = await this.client.get<ApiResponse<any>>('/campaigns/stats');
    return response.data;
  }

  // ============================================
  // Vote/Point API
  // ============================================

  async getActiveVoteEvents(params?: any) {
    const response = await this.client.get<ApiResponse<any[]>>('/votes/active', { params });
    return response.data;
  }

  async getVoteEvents(params?: any) {
    const response = await this.client.get<ApiResponse<any[]>>('/votes/events', { params });
    return response.data;
  }

  async getVoteEvent(id: string) {
    const response = await this.client.get<ApiResponse<any>>(`/votes/events/${id}`);
    return response.data;
  }

  async createVoteEvent(data: {
    eventId?: string;
    title: string;
    description?: string;
    questionType: 'PREDICTION' | 'QUIZ' | 'POLL';
    question: string;
    options: { id: string; label: string; athleteId?: string }[];
    pointsPerCorrect?: number;
    sponsorBrandId?: string;
    startAt: string;
    endAt: string;
  }) {
    const response = await this.client.post<ApiResponse<any>>('/votes/events', data);
    return response.data;
  }

  async updateVoteEvent(id: string, data: any) {
    const response = await this.client.patch<ApiResponse<any>>(`/votes/events/${id}`, data);
    return response.data;
  }

  async activateVoteEvent(id: string) {
    const response = await this.client.post<ApiResponse<any>>(`/votes/events/${id}/activate`);
    return response.data;
  }

  async closeVoteEvent(id: string) {
    const response = await this.client.post<ApiResponse<any>>(`/votes/events/${id}/close`);
    return response.data;
  }

  async settleVoteEvent(id: string, correctOptionId: string) {
    const response = await this.client.post<ApiResponse<any>>(`/votes/events/${id}/settle`, {
      correctOptionId,
    });
    return response.data;
  }

  async deleteVoteEvent(id: string) {
    const response = await this.client.delete<ApiResponse<any>>(`/votes/events/${id}`);
    return response.data;
  }

  async getVoteEventStats(id: string) {
    const response = await this.client.get<ApiResponse<any>>(`/votes/events/${id}/stats`);
    return response.data;
  }

  async submitVote(voteEventId: string, selectedOptionId: string) {
    const response = await this.client.post<ApiResponse<any>>(`/votes/events/${voteEventId}/vote`, {
      selectedOptionId,
    });
    return response.data;
  }

  async getMyVotes(params?: any) {
    const response = await this.client.get<ApiResponse<any[]>>('/votes/my/votes', { params });
    return response.data;
  }

  async getMyPoints() {
    const response = await this.client.get<ApiResponse<any>>('/votes/my/points');
    return response.data;
  }

  async getMyPointHistory(params?: any) {
    const response = await this.client.get<ApiResponse<any[]>>('/votes/my/points/history', { params });
    return response.data;
  }

  async redeemPoints(amount: number, description?: string) {
    const response = await this.client.post<ApiResponse<any>>('/votes/my/points/redeem', {
      amount,
      description,
    });
    return response.data;
  }

  async getAthleteRanking(params?: { eventId?: string; limit?: number }) {
    const response = await this.client.get<ApiResponse<any[]>>('/votes/ranking/athletes', { params });
    return response.data;
  }

  // ============================================
  // Payment API
  // ============================================

  async getPayments(params?: any) {
    const response = await this.client.get<ApiResponse<any[]>>('/payments', { params });
    return response.data;
  }

  async getMyPayments(params?: any) {
    const response = await this.client.get<ApiResponse<any[]>>('/payments/my', { params });
    return response.data;
  }

  async getPayment(id: string) {
    const response = await this.client.get<ApiResponse<any>>(`/payments/${id}`);
    return response.data;
  }

  async createPayment(data: {
    contractId?: string;
    amount: number;
    method: 'CARD' | 'BANK_TRANSFER' | 'VIRTUAL_ACCOUNT';
  }) {
    const response = await this.client.post<ApiResponse<any>>('/payments', data);
    return response.data;
  }

  async initiatePayment(id: string, pgProvider?: string) {
    const response = await this.client.post<ApiResponse<any>>(`/payments/${id}/initiate`, {
      pgProvider,
    });
    return response.data;
  }

  async cancelPayment(id: string) {
    const response = await this.client.post<ApiResponse<any>>(`/payments/${id}/cancel`);
    return response.data;
  }

  async refundPayment(id: string, refundAmount?: number) {
    const response = await this.client.post<ApiResponse<any>>(`/payments/${id}/refund`, {
      refundAmount,
    });
    return response.data;
  }

  async getPaymentStats(params?: { brandId?: string; startDate?: string; endDate?: string }) {
    const response = await this.client.get<ApiResponse<any>>('/payments/stats/summary', { params });
    return response.data;
  }

  async getDailyPaymentStats(days?: number) {
    const response = await this.client.get<ApiResponse<any[]>>('/payments/stats/daily', {
      params: { days },
    });
    return response.data;
  }

  // ============================================
  // Review API (Admin - Asset/Verification Review)
  // ============================================

  async approveAsset(assetId: string, notes?: string) {
    const response = await this.client.post<ApiResponse<any>>(`/contracts/assets/${assetId}/review`, {
      status: 'APPROVED',
      notes,
    });
    return response.data;
  }

  async rejectAsset(assetId: string, notes?: string) {
    const response = await this.client.post<ApiResponse<any>>(`/contracts/assets/${assetId}/review`, {
      status: 'REJECTED',
      notes,
    });
    return response.data;
  }

  async approveVerification(verificationId: string, notes?: string) {
    const response = await this.client.post<ApiResponse<any>>(`/contracts/verifications/${verificationId}/review`, {
      status: 'VERIFIED',
      notes,
    });
    return response.data;
  }

  async rejectVerification(verificationId: string, rejectionReason?: string) {
    const response = await this.client.post<ApiResponse<any>>(`/contracts/verifications/${verificationId}/review`, {
      status: 'REJECTED',
      rejectionReason,
    });
    return response.data;
  }

  // ============================================
  // Notification API
  // ============================================

  async getNotifications(params?: { unreadOnly?: boolean; limit?: number; offset?: number }) {
    const response = await this.client.get<ApiResponse<{
      notifications: any[];
      total: number;
      unreadCount: number;
    }>>('/notifications', { params });
    return response.data;
  }

  async getUnreadNotificationCount() {
    const response = await this.client.get<ApiResponse<{ count: number }>>('/notifications/unread-count');
    return response.data;
  }

  async markNotificationAsRead(notificationId: string) {
    const response = await this.client.patch<ApiResponse<any>>(`/notifications/${notificationId}/read`);
    return response.data;
  }

  async markAllNotificationsAsRead() {
    const response = await this.client.patch<ApiResponse<{ count: number }>>('/notifications/read-all');
    return response.data;
  }

  async deleteNotification(notificationId: string) {
    const response = await this.client.delete<ApiResponse<any>>(`/notifications/${notificationId}`);
    return response.data;
  }

  // ============================================
  // Admin Finance API
  // ============================================

  async getFinanceEscrows(params?: {
    status?: string;
    q?: string;
    from?: string;
    to?: string;
    page?: number;
    pageSize?: number;
    sort?: string;
    order?: string;
  }) {
    const response = await this.client.get<ApiResponse<any[]>>('/admin/finance/escrows', { params });
    return response.data;
  }

  async getFinanceEscrow(id: string) {
    const response = await this.client.get<ApiResponse<any>>(`/admin/finance/escrows/${id}`);
    return response.data;
  }

  async downloadEscrowsCsv(params?: { status?: string; q?: string; from?: string; to?: string }) {
    const response = await this.client.get('/admin/finance/escrows.csv', {
      params,
      responseType: 'blob',
    });
    return response.data;
  }

  async getFinanceWallets(params?: {
    ownerType?: string;
    q?: string;
    page?: number;
    pageSize?: number;
  }) {
    const response = await this.client.get<ApiResponse<any[]>>('/admin/finance/wallets', { params });
    return response.data;
  }

  async getFinanceWalletLedger(walletId: string, params?: {
    type?: string;
    refType?: string;
    refId?: string;
    page?: number;
    pageSize?: number;
  }) {
    const response = await this.client.get<ApiResponse<any>>(`/admin/finance/wallets/${walletId}/ledger`, { params });
    return response.data;
  }

  async downloadWalletLedgerCsv(walletId: string, params?: { type?: string; refType?: string }) {
    const response = await this.client.get(`/admin/finance/wallets/${walletId}/ledger.csv`, {
      params,
      responseType: 'blob',
    });
    return response.data;
  }

  async getFinancePayoutBatches(params?: {
    status?: string;
    page?: number;
    pageSize?: number;
  }) {
    const response = await this.client.get<ApiResponse<any[]>>('/admin/finance/payout-batches', { params });
    return response.data;
  }

  async getFinancePayoutBatch(id: string) {
    const response = await this.client.get<ApiResponse<any>>(`/admin/finance/payout-batches/${id}`);
    return response.data;
  }

  async getFinanceSummary() {
    const response = await this.client.get<ApiResponse<any>>('/admin/finance/summary');
    return response.data;
  }

  // Admin Finance WRITE Actions
  async adminReleaseEscrow(id: string, data: { reason: string; confirmText: string; idempotencyKey?: string }) {
    const response = await this.client.post<ApiResponse<any>>(`/admin/finance/escrows/${id}/release`, data);
    return response.data;
  }

  async adminRefundEscrow(id: string, data: { reason: string; confirmText: string; idempotencyKey?: string }) {
    const response = await this.client.post<ApiResponse<any>>(`/admin/finance/escrows/${id}/refund`, data);
    return response.data;
  }

  async adminCancelContract(id: string, data: { reason: string; confirmText: string; idempotencyKey?: string }) {
    const response = await this.client.post<ApiResponse<any>>(`/admin/finance/contracts/${id}/cancel`, data);
    return response.data;
  }

  async getFinanceActionLogs(params?: { action?: string; targetType?: string; page?: number; pageSize?: number }) {
    const response = await this.client.get<ApiResponse<any[]>>('/admin/finance/action-logs', { params });
    return response.data;
  }

  // ============================================
  // Admin Reports API
  // ============================================

  async getReportsOverview(params?: { range?: string }) {
    const response = await this.client.get<ApiResponse<any>>('/admin/reports/overview', { params });
    return response.data;
  }

  async getReportsTimeseries(params?: { range?: string; metric?: string }) {
    const response = await this.client.get<ApiResponse<any>>('/admin/reports/timeseries', { params });
    return response.data;
  }

  async getReportsFunnel(params?: { range?: string }) {
    const response = await this.client.get<ApiResponse<any>>('/admin/reports/funnel', { params });
    return response.data;
  }

  async getReportsAnomalies(params?: { range?: string }) {
    const response = await this.client.get<ApiResponse<any>>('/admin/reports/anomalies', { params });
    return response.data;
  }

  async downloadReportsCsv(params?: { range?: string }) {
    const response = await this.client.get('/admin/reports/export.csv', {
      params,
      responseType: 'blob',
    });
    return response.data;
  }

  // ============================================
  // Admin Entities API
  // ============================================

  async getAdminAthletes(params?: {
    page?: number;
    pageSize?: number;
    q?: string;
    kycStatus?: string;
    isActive?: string;
    from?: string;
    to?: string;
  }) {
    const response = await this.client.get<ApiResponse<any>>('/admin/entities/athletes', { params });
    return response.data;
  }

  async getAdminBrands(params?: {
    page?: number;
    pageSize?: number;
    q?: string;
    kycStatus?: string;
    isActive?: string;
    from?: string;
    to?: string;
  }) {
    const response = await this.client.get<ApiResponse<any>>('/admin/entities/brands', { params });
    return response.data;
  }

  async toggleAthleteActive(athleteId: string) {
    const response = await this.client.patch<ApiResponse<any>>(`/admin/entities/athletes/${athleteId}/toggle-active`);
    return response.data;
  }

  async toggleBrandActive(brandId: string) {
    const response = await this.client.patch<ApiResponse<any>>(`/admin/entities/brands/${brandId}/toggle-active`);
    return response.data;
  }
}

export const api = new ApiService();
