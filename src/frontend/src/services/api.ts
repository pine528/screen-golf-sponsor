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

  // Fan Auth
  async fanRegister(data: { email: string; password: string; nickname?: string }) {
    const response = await this.client.post<ApiResponse<any>>('/auth/fan/register', data);
    return response.data;
  }

  async fanLogin(email: string, password: string) {
    const response = await this.client.post<ApiResponse<any>>('/auth/fan/login', { email, password });
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

  // Fulfillment (이행 추적)
  async getContractFulfillment(contractId: string) {
    const response = await this.client.get<ApiResponse<any>>(`/contracts/${contractId}/fulfillment`);
    return response.data;
  }

  async updateFulfillmentStatus(contractId: string, data: { status: string; notes?: string }) {
    const response = await this.client.patch<ApiResponse<any>>(`/contracts/${contractId}/fulfillment/status`, data);
    return response.data;
  }

  async updateFulfillmentShipping(contractId: string, data: { carrier: string; trackingNumber: string }) {
    const response = await this.client.patch<ApiResponse<any>>(`/contracts/${contractId}/fulfillment/shipping`, data);
    return response.data;
  }

  async markFulfillmentDelivered(contractId: string) {
    const response = await this.client.post<ApiResponse<any>>(`/contracts/${contractId}/fulfillment/delivered`);
    return response.data;
  }

  async addFulfillmentAttachment(contractId: string, data: { photoUrls: string[]; notes?: string }) {
    const response = await this.client.post<ApiResponse<any>>(`/contracts/${contractId}/fulfillment/attachment`, data);
    return response.data;
  }

  async updateFulfillmentNotes(contractId: string, notes: string) {
    const response = await this.client.patch<ApiResponse<any>>(`/contracts/${contractId}/fulfillment/notes`, { notes });
    return response.data;
  }

  async getFulfillmentHistory(contractId: string) {
    const response = await this.client.get<ApiResponse<any[]>>(`/contracts/${contractId}/fulfillment/history`);
    return response.data;
  }

  // Admin Fulfillment
  async getAdminFulfillmentsList(params?: { status?: string; brandId?: string; athleteId?: string }) {
    const response = await this.client.get<ApiResponse<any[]>>('/contracts/fulfillments/list', { params });
    return response.data;
  }

  async getAdminFulfillmentStats() {
    const response = await this.client.get<ApiResponse<any>>('/contracts/fulfillments/stats');
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

  async getMyBrandWallet() {
    const response = await this.client.get<ApiResponse<any>>('/brands/me/wallet');
    return response.data;
  }

  // Brand Topup (지갑 충전)
  async createTopup(data: { amount: number; provider: 'TOSS' | 'STRIPE' }) {
    const response = await this.client.post<ApiResponse<any>>('/brand/topups', data);
    return response.data;
  }

  async confirmTopup(topupId: string, paymentKey: string) {
    const response = await this.client.post<ApiResponse<any>>(`/brand/topups/${topupId}/confirm`, { paymentKey });
    return response.data;
  }

  async getMyTopups(params?: { status?: string; limit?: number; offset?: number }) {
    const response = await this.client.get<ApiResponse<any>>('/brand/topups/my', { params });
    return response.data;
  }

  async getMyTopup(topupId: string) {
    const response = await this.client.get<ApiResponse<any>>(`/brand/topups/my/${topupId}`);
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

  // Legacy vote points (deprecated - use new point system)
  async getMyVotePoints() {
    const response = await this.client.get<ApiResponse<any>>('/votes/my/points');
    return response.data;
  }

  async getMyVotePointHistory(params?: any) {
    const response = await this.client.get<ApiResponse<any[]>>('/votes/my/points/history', { params });
    return response.data;
  }

  async redeemVotePoints(amount: number, description?: string) {
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

  async getAdminAthlete(id: string) {
    const response = await this.client.get<ApiResponse<any>>(`/admin/entities/athletes/${id}`);
    return response.data;
  }

  async getAdminBrand(id: string) {
    const response = await this.client.get<ApiResponse<any>>(`/admin/entities/brands/${id}`);
    return response.data;
  }

  // ============================================
  // Fan Favorites API
  // ============================================

  async getFavorites() {
    const response = await this.client.get<ApiResponse<{
      athletes: any[];
      brands: any[];
    }>>('/fan/favorites');
    return response.data;
  }

  async addFavoriteAthlete(athleteId: string) {
    const response = await this.client.post<ApiResponse<any>>(`/fan/favorites/athletes/${athleteId}`);
    return response.data;
  }

  async removeFavoriteAthlete(athleteId: string) {
    const response = await this.client.delete<ApiResponse<any>>(`/fan/favorites/athletes/${athleteId}`);
    return response.data;
  }

  async addFavoriteBrand(brandId: string) {
    const response = await this.client.post<ApiResponse<any>>(`/fan/favorites/brands/${brandId}`);
    return response.data;
  }

  async removeFavoriteBrand(brandId: string) {
    const response = await this.client.delete<ApiResponse<any>>(`/fan/favorites/brands/${brandId}`);
    return response.data;
  }

  // ============================================
  // Fan Brand Registration API
  // ============================================

  async submitBrandRegistration(data: {
    brandName: string;
    contactEmail: string;
    contactPhone?: string;
    website?: string;
    note?: string;
  }) {
    const response = await this.client.post<ApiResponse<any>>('/fan/brand-registration', data);
    return response.data;
  }

  async getMyBrandRegistrations() {
    const response = await this.client.get<ApiResponse<any[]>>('/fan/brand-registration');
    return response.data;
  }

  // ============================================
  // Admin Brand Registration API
  // ============================================

  async getAdminBrandRegistrations(params?: {
    status?: string;
    q?: string;
    page?: number;
    limit?: number;
  }) {
    const response = await this.client.get<ApiResponse<any>>('/admin/brand-registrations', { params });
    return response.data;
  }

  async approveBrandRegistration(id: string, adminNote?: string) {
    const response = await this.client.post<ApiResponse<any>>(`/admin/brand-registrations/${id}/approve`, {
      adminNote,
    });
    return response.data;
  }

  async rejectBrandRegistration(id: string, adminNote?: string) {
    const response = await this.client.post<ApiResponse<any>>(`/admin/brand-registrations/${id}/reject`, {
      adminNote,
    });
    return response.data;
  }

  // ============================================
  // Athletes/Brands Public List API (for favorites)
  // ============================================

  async getAthletesList(params?: { q?: string; tour?: string; limit?: number }) {
    const response = await this.client.get<ApiResponse<any[]>>('/athletes', { params });
    return response.data;
  }

  async getBrandsList(params?: { q?: string; category?: string; limit?: number }) {
    const response = await this.client.get<ApiResponse<any[]>>('/brands', { params });
    return response.data;
  }

  // ============================================
  // Points API
  // ============================================

  // Public: 포인트 랭킹 조회
  async getPointRanking(limit?: number) {
    const response = await this.client.get<ApiResponse<any>>('/points/ranking', {
      params: { limit },
    });
    return response.data;
  }

  // Fan: 내 포인트 잔액 조회
  async getMyPointBalance() {
    const response = await this.client.get<ApiResponse<any>>('/points/me');
    return response.data;
  }

  // Fan: 내 포인트 내역 조회
  async getMyPointHistory(params?: { page?: number; pageSize?: number; reason?: string }) {
    const response = await this.client.get<ApiResponse<any>>('/points/me/history', { params });
    return response.data;
  }

  // Admin: 포인트 지급
  async adminGrantPoints(data: { userId: string; amount: number; reasonText?: string }) {
    const response = await this.client.post<ApiResponse<any>>('/points/admin/grant', data);
    return response.data;
  }

  // Admin: 사용자 포인트 잔액 조회
  async adminGetUserPointBalance(userId: string) {
    const response = await this.client.get<ApiResponse<any>>(`/points/admin/user/${userId}/balance`);
    return response.data;
  }

  // Admin: 사용자 포인트 내역 조회
  async adminGetUserPointHistory(userId: string, params?: { page?: number; pageSize?: number; reason?: string }) {
    const response = await this.client.get<ApiResponse<any>>(`/points/admin/user/${userId}/history`, { params });
    return response.data;
  }

  // ============================================
  // Fan Votes API
  // ============================================

  // Public: 활성화된 팬 투표 목록
  async getActiveFanVotes() {
    const response = await this.client.get<ApiResponse<any[]>>('/fan-votes/active');
    return response.data;
  }

  // Public: 종료된 팬 투표 목록
  async getEndedFanVotes(limit?: number) {
    const response = await this.client.get<ApiResponse<any[]>>('/fan-votes/ended', {
      params: { limit },
    });
    return response.data;
  }

  // Public: 팬 투표 상세
  async getFanVoteEvent(id: string) {
    const response = await this.client.get<ApiResponse<any>>(`/fan-votes/${id}`);
    return response.data;
  }

  // Fan: 팬 투표 참여
  async enterFanVote(id: string, optionIndex: number, idempotencyKey?: string) {
    const response = await this.client.post<ApiResponse<any>>(
      `/fan-votes/${id}/enter`,
      { optionIndex },
      {
        headers: idempotencyKey ? { 'X-Idempotency-Key': idempotencyKey } : {},
      }
    );
    return response.data;
  }

  // Fan: 내 참여 내역
  async getMyFanVoteEntries(params?: { page?: number; pageSize?: number }) {
    const response = await this.client.get<ApiResponse<any>>('/fan-votes/my/entries', { params });
    return response.data;
  }

  // ============================================
  // Phase F4: Fan-created Votes
  // ============================================

  // Fan: 투표 생성
  async createFanVote(data: {
    title: string;
    question: string;
    options: string[];
    entryFeePoints: number;
    winnersCount: number;
    startsAt: string;
    endsAt: string;
  }) {
    const response = await this.client.post<ApiResponse<any>>('/fan-votes/create', data);
    return response.data;
  }

  // Fan: 내가 만든 투표 목록
  async getMyCreatedFanVotes(params?: { page?: number; pageSize?: number }) {
    const response = await this.client.get<ApiResponse<any>>('/fan-votes/my/events', { params });
    return response.data;
  }

  // Fan: 투표 제출 (DRAFT -> SUBMITTED)
  async submitFanVote(id: string) {
    const response = await this.client.post<ApiResponse<any>>(`/fan-votes/${id}/submit`);
    return response.data;
  }

  // Public: 투표 결과 조회
  async getFanVoteResult(id: string) {
    const response = await this.client.get<ApiResponse<any>>(`/fan-votes/${id}/result`);
    return response.data;
  }

  // ============================================
  // Admin: Fan Vote Management
  // ============================================

  // Admin: 승인 대기 투표 목록
  async getPendingFanVotes(params?: { page?: number; pageSize?: number }) {
    const response = await this.client.get<ApiResponse<any>>('/fan-votes/admin/pending', { params });
    return response.data;
  }

  // Admin: 승인 및 활성화
  async approveFanVote(id: string) {
    const response = await this.client.post<ApiResponse<any>>(`/fan-votes/admin/${id}/approve-and-activate`);
    return response.data;
  }

  // Admin: 투표 종료
  async closeFanVote(id: string) {
    const response = await this.client.post<ApiResponse<any>>(`/fan-votes/admin/${id}/close`);
    return response.data;
  }

  // Admin: 정산 실행
  async settleFanVote(id: string, resultOptionIndex: number) {
    const response = await this.client.post<ApiResponse<any>>(`/fan-votes/admin/${id}/settle`, {
      resultOptionIndex,
    });
    return response.data;
  }

  // ============================================
  // Vote Sponsorship (투표 스폰서십) - Phase G
  // ============================================

  // 투표 후원 (BRAND)
  async sponsorVote(
    id: string,
    data: {
      contributionAmount: number;
      bannerUrl?: string;
      logoUrl?: string;
      message?: string;
      linkUrl?: string;
    }
  ) {
    const response = await this.client.post<ApiResponse<any>>(`/fan-votes/${id}/sponsor`, data);
    return response.data;
  }

  // 후원한 투표 목록 (BRAND)
  async getSponsoredVotes(params?: { page?: number; pageSize?: number }) {
    const response = await this.client.get<ApiResponse<any>>('/brands/me/sponsored-votes', { params });
    return response.data;
  }

  // 스폰서 통계 (BRAND)
  async getSponsorStats() {
    const response = await this.client.get<ApiResponse<any>>('/brands/me/sponsor-stats');
    return response.data;
  }

  // 노출/클릭 추적 (Public)
  async trackSponsorEngagement(eventId: string, type: 'banner_impression' | 'banner_click' | 'link_click') {
    const response = await this.client.post<ApiResponse<any>>(`/fan-votes/${eventId}/track-engagement`, { type });
    return response.data;
  }

  // ============================================
  // Point Shop (포인트 샵)
  // ============================================

  // 상품 목록 조회
  async getShopItems(params?: { page?: number; pageSize?: number }) {
    const response = await this.client.get<ApiResponse<any>>('/shop/items', { params });
    return response.data;
  }

  // 상품 상세 조회
  async getShopItem(id: string) {
    const response = await this.client.get<ApiResponse<any>>(`/shop/items/${id}`);
    return response.data;
  }

  // 교환 주문 생성
  async createRedemptionOrder(
    data: {
      itemId: string;
      quantity?: number;
      shipping?: {
        name: string;
        phone: string;
        address1: string;
        address2?: string;
      };
      memo?: string;
    },
    idempotencyKey?: string
  ) {
    const response = await this.client.post<ApiResponse<any>>('/shop/orders', data, {
      headers: idempotencyKey ? { 'X-Idempotency-Key': idempotencyKey } : {},
    });
    return response.data;
  }

  // 내 주문 목록 조회
  async getMyRedemptionOrders(params?: { page?: number; pageSize?: number; status?: string }) {
    const response = await this.client.get<ApiResponse<any>>('/shop/orders/my', { params });
    return response.data;
  }

  // 주문 취소
  async cancelRedemptionOrder(id: string) {
    const response = await this.client.post<ApiResponse<any>>(`/shop/orders/${id}/cancel`);
    return response.data;
  }

  // Admin: 상품 생성
  async createShopItem(data: {
    title: string;
    description?: string;
    imageUrl?: string;
    pricePoints: number;
    stock: number;
    requiresShipping?: boolean;
  }) {
    const response = await this.client.post<ApiResponse<any>>('/shop/admin/items', data);
    return response.data;
  }

  // Admin: 상품 목록 (모든 상태)
  async getAdminShopItems(params?: { page?: number; pageSize?: number }) {
    const response = await this.client.get<ApiResponse<any>>('/shop/admin/items', { params });
    return response.data;
  }

  // Admin: 상품 수정
  async updateShopItem(
    id: string,
    data: {
      title?: string;
      description?: string;
      imageUrl?: string;
      pricePoints?: number;
      stock?: number;
      status?: string;
      requiresShipping?: boolean;
    }
  ) {
    const response = await this.client.patch<ApiResponse<any>>(`/shop/admin/items/${id}`, data);
    return response.data;
  }

  // Admin: 주문 목록
  async getAdminRedemptionOrders(params?: { page?: number; pageSize?: number; status?: string; q?: string }) {
    const response = await this.client.get<ApiResponse<any>>('/shop/admin/orders', { params });
    return response.data;
  }

  // Admin: 주문 처리 완료
  async fulfillRedemptionOrder(id: string, memo?: string) {
    const response = await this.client.post<ApiResponse<any>>(`/shop/admin/orders/${id}/fulfill`, { memo });
    return response.data;
  }

  // ============================================
  // Withdrawal (선수 출금)
  // ============================================

  // Athlete: 출금 가능 잔액 조회
  async getWithdrawalAvailableBalance() {
    const response = await this.client.get<ApiResponse<{
      balance: number;
      frozenAmount: number;
      available: number;
    }>>('/withdrawals/available-balance');
    return response.data;
  }

  // Athlete: 출금 요청 생성
  async createWithdrawalRequest(
    data: {
      amount: number;
      bankName: string;
      bankAccountNumber: string;
      accountHolder: string;
      reason?: string;
    },
    idempotencyKey?: string
  ) {
    const response = await this.client.post<ApiResponse<any>>('/withdrawals', data, {
      headers: idempotencyKey ? { 'X-Idempotency-Key': idempotencyKey } : {},
    });
    return response.data;
  }

  // Athlete: 내 출금 요청 목록
  async getMyWithdrawals(params?: { page?: number; pageSize?: number; status?: string }) {
    const response = await this.client.get<ApiResponse<any>>('/withdrawals/my', { params });
    return response.data;
  }

  // Athlete: 내 출금 요청 상세
  async getMyWithdrawal(id: string) {
    const response = await this.client.get<ApiResponse<any>>(`/withdrawals/my/${id}`);
    return response.data;
  }

  // Admin: 출금 요청 목록
  async getAdminWithdrawals(params?: {
    page?: number;
    pageSize?: number;
    status?: string;
    q?: string;
    from?: string;
    to?: string;
  }) {
    const response = await this.client.get<ApiResponse<any>>('/admin/finance/withdrawals', { params });
    return response.data;
  }

  // Admin: 출금 요청 상세
  async getAdminWithdrawal(id: string) {
    const response = await this.client.get<ApiResponse<any>>(`/admin/finance/withdrawals/${id}`);
    return response.data;
  }

  // Admin: 출금 통계 요약
  async getAdminWithdrawalSummary() {
    const response = await this.client.get<ApiResponse<any>>('/admin/finance/withdrawals/summary');
    return response.data;
  }

  // Admin: 출금 CSV 다운로드
  async downloadWithdrawalsCsv(params?: { status?: string; from?: string; to?: string }) {
    const response = await this.client.get('/admin/finance/withdrawals.csv', {
      params,
      responseType: 'blob',
    });
    return response.data;
  }

  // Admin: 출금 승인
  async approveWithdrawal(id: string, data: { confirmText: string; reason?: string }) {
    const response = await this.client.post<ApiResponse<any>>(`/admin/finance/withdrawals/${id}/approve`, data);
    return response.data;
  }

  // Admin: 출금 거부
  async rejectWithdrawal(id: string, data: { confirmText: string; reason: string }) {
    const response = await this.client.post<ApiResponse<any>>(`/admin/finance/withdrawals/${id}/reject`, data);
    return response.data;
  }

  // Admin: 출금 지급 완료
  async markWithdrawalPaid(id: string, data: { confirmText: string; payoutReference: string; reason?: string }) {
    const response = await this.client.post<ApiResponse<any>>(`/admin/finance/withdrawals/${id}/paid`, data);
    return response.data;
  }

  // ========================================
  // 출금 배치 관리
  // ========================================

  // Admin: 출금 배치 목록
  async getWithdrawalBatches(params?: { status?: string; page?: number; pageSize?: number }) {
    const response = await this.client.get<ApiResponse<any>>('/admin/finance/withdrawals/batches', { params });
    return response.data;
  }

  // Admin: 출금 배치 생성
  async createWithdrawalBatch(data: { withdrawalIds: string[]; note?: string }) {
    const response = await this.client.post<ApiResponse<any>>('/admin/finance/withdrawals/batches', data);
    return response.data;
  }

  // Admin: 출금 배치 상세
  async getWithdrawalBatch(id: string) {
    const response = await this.client.get<ApiResponse<any>>(`/admin/finance/withdrawals/batches/${id}`);
    return response.data;
  }

  // Admin: 출금 배치 CSV 내보내기
  async downloadWithdrawalBatchCsv(batchId: string) {
    const response = await this.client.get(`/admin/finance/withdrawals/batches/${batchId}/export.csv`, {
      responseType: 'blob',
    });
    return response.data;
  }

  // Admin: 출금 배치 일괄 지급 완료
  async completeWithdrawalBatch(id: string, data: { confirmText: string; reason: string; proofUrl?: string }) {
    const response = await this.client.post<ApiResponse<any>>(`/admin/finance/withdrawals/batches/${id}/complete`, data);
    return response.data;
  }

  // Admin: 출금 배치 취소
  async cancelWithdrawalBatch(id: string, data: { confirmText: string; reason: string }) {
    const response = await this.client.post<ApiResponse<any>>(`/admin/finance/withdrawals/batches/${id}/cancel`, data);
    return response.data;
  }

  // Admin: 출금 메트릭
  async getWithdrawalMetrics() {
    const response = await this.client.get<ApiResponse<any>>('/admin/finance/withdrawals/metrics');
    return response.data;
  }

  // ============================================
  // FAQ API
  // ============================================

  // Public: FAQ 목록 조회
  async getFaqs(category?: string) {
    const response = await this.client.get<ApiResponse<any[]>>('/faq', {
      params: category ? { category } : {},
    });
    return response.data;
  }

  // Public: FAQ 카테고리별 개수
  async getFaqCategories() {
    const response = await this.client.get<ApiResponse<any[]>>('/faq/categories');
    return response.data;
  }

  // Public: FAQ 검색
  async searchFaqs(q: string) {
    const response = await this.client.get<ApiResponse<any[]>>('/faq/search', {
      params: { q },
    });
    return response.data;
  }

  // Public: FAQ 상세 조회
  async getFaq(id: string) {
    const response = await this.client.get<ApiResponse<any>>(`/faq/${id}`);
    return response.data;
  }

  // Admin: 전체 FAQ 목록 조회 (비발행 포함)
  async getAdminFaqs(params?: { category?: string; isPublished?: boolean; q?: string }) {
    const response = await this.client.get<ApiResponse<any[]>>('/faq/admin/all', { params });
    return response.data;
  }

  // Admin: FAQ 상세 조회
  async getAdminFaq(id: string) {
    const response = await this.client.get<ApiResponse<any>>(`/faq/admin/${id}`);
    return response.data;
  }

  // Admin: FAQ 생성
  async createFaq(data: {
    category: string;
    question: string;
    answer: string;
    orderIndex?: number;
    isPublished?: boolean;
  }) {
    const response = await this.client.post<ApiResponse<any>>('/faq/admin', data);
    return response.data;
  }

  // Admin: FAQ 수정
  async updateFaq(id: string, data: {
    category?: string;
    question?: string;
    answer?: string;
    orderIndex?: number;
    isPublished?: boolean;
  }) {
    const response = await this.client.patch<ApiResponse<any>>(`/faq/admin/${id}`, data);
    return response.data;
  }

  // Admin: FAQ 삭제
  async deleteFaq(id: string) {
    const response = await this.client.delete<ApiResponse<any>>(`/faq/admin/${id}`);
    return response.data;
  }

  // Admin: FAQ 발행 상태 토글
  async toggleFaqPublish(id: string) {
    const response = await this.client.post<ApiResponse<any>>(`/faq/admin/${id}/toggle-publish`);
    return response.data;
  }

  // Admin: FAQ 순서 재정렬
  async reorderFaqs(category: string, orderedIds: string[]) {
    const response = await this.client.post<ApiResponse<any>>('/faq/admin/reorder', {
      category,
      orderedIds,
    });
    return response.data;
  }

  // ============================================
  // Penalty API
  // ============================================

  // Admin: 페널티 목록 조회
  async getPenalties(params?: {
    athleteId?: string;
    brandId?: string;
    userId?: string;
    status?: string;
    type?: string;
    q?: string;
  }) {
    const response = await this.client.get<ApiResponse<any[]>>('/admin/penalties', { params });
    return response.data;
  }

  // Admin: 페널티 통계 조회
  async getPenaltyStats() {
    const response = await this.client.get<ApiResponse<any>>('/admin/penalties/stats');
    return response.data;
  }

  // Admin: 페널티 상세 조회
  async getPenalty(id: string) {
    const response = await this.client.get<ApiResponse<any>>(`/admin/penalties/${id}`);
    return response.data;
  }

  // Admin: 페널티 부여
  async createPenalty(data: {
    athleteId?: string;
    brandId?: string;
    userId: string;
    type: string;
    points?: number;
    reason: string;
    refType?: string;
    refId?: string;
    expiresAt?: string;
  }) {
    const response = await this.client.post<ApiResponse<any>>('/admin/penalties', data);
    return response.data;
  }

  // Admin: 페널티 제거
  async removePenalty(id: string, removeReason: string) {
    const response = await this.client.post<ApiResponse<any>>(`/admin/penalties/${id}/remove`, {
      removeReason,
    });
    return response.data;
  }

  // Admin: 만료된 페널티 일괄 처리
  async expirePenalties() {
    const response = await this.client.post<ApiResponse<any>>('/admin/penalties/expire');
    return response.data;
  }

  // Admin: 특정 엔티티의 페널티 목록 조회
  async getEntityPenalties(type: 'brand' | 'athlete' | 'user', entityId: string, status?: string) {
    const response = await this.client.get<ApiResponse<any[]>>(`/admin/penalties/entity/${type}/${entityId}`, {
      params: status ? { status } : {},
    });
    return response.data;
  }

  // Admin: 참여 자격 검사
  async checkPenaltyEligibility(type: 'brand' | 'athlete', entityId: string) {
    const response = await this.client.get<ApiResponse<any>>(`/admin/penalties/check/${type}/${entityId}`);
    return response.data;
  }

  // ============================================
  // Report/Dispute API (신고/분쟁)
  // ============================================

  // User: 신고 접수
  async createReport(data: {
    type: string;
    targetType: string;
    targetId: string;
    title: string;
    description: string;
    evidenceUrls?: string[];
    priority?: string;
  }) {
    const response = await this.client.post<ApiResponse<any>>('/reports', data);
    return response.data;
  }

  // User: 내 신고 목록
  async getMyReportsList() {
    const response = await this.client.get<ApiResponse<any[]>>('/reports/my');
    return response.data;
  }

  // User: 내 신고 상세
  async getMyReportDetail(id: string) {
    const response = await this.client.get<ApiResponse<any>>(`/reports/my/${id}`);
    return response.data;
  }

  // User: 내 신고에 댓글 추가
  async addMyReportComment(id: string, content: string) {
    const response = await this.client.post<ApiResponse<any>>(`/reports/my/${id}/comments`, { content });
    return response.data;
  }

  // Admin: 전체 신고 목록
  async getAdminReportsList(params?: {
    status?: string;
    priority?: string;
    type?: string;
    assignedTo?: string;
    targetType?: string;
    q?: string;
  }) {
    const response = await this.client.get<ApiResponse<any[]>>('/reports/admin', { params });
    return response.data;
  }

  // Admin: 신고 통계
  async getReportStats() {
    const response = await this.client.get<ApiResponse<any>>('/reports/admin/stats');
    return response.data;
  }

  // Admin: 신고 상세
  async getAdminReportDetail(id: string) {
    const response = await this.client.get<ApiResponse<any>>(`/reports/admin/${id}`);
    return response.data;
  }

  // Admin: 상태 변경
  async updateReportStatus(id: string, status: string) {
    const response = await this.client.patch<ApiResponse<any>>(`/reports/admin/${id}/status`, { status });
    return response.data;
  }

  // Admin: 우선순위 변경
  async updateReportPriority(id: string, priority: string) {
    const response = await this.client.patch<ApiResponse<any>>(`/reports/admin/${id}/priority`, { priority });
    return response.data;
  }

  // Admin: 담당자 지정
  async assignReport(id: string, assignedTo: string) {
    const response = await this.client.patch<ApiResponse<any>>(`/reports/admin/${id}/assign`, { assignedTo });
    return response.data;
  }

  // Admin: 해결
  async resolveReport(id: string, resolution: string, status?: string) {
    const response = await this.client.post<ApiResponse<any>>(`/reports/admin/${id}/resolve`, {
      resolution,
      status: status || 'RESOLVED',
    });
    return response.data;
  }

  // Admin: 댓글 추가
  async addAdminReportComment(id: string, content: string, isInternal: boolean = false) {
    const response = await this.client.post<ApiResponse<any>>(`/reports/admin/${id}/comments`, {
      content,
      isInternal,
    });
    return response.data;
  }

  // ============================================
  // Phase 9-3: Brand Dashboard API
  // ============================================

  // Brand: 내 예약 목록 (Direct Buy + Auction 낙찰)
  async getMyReservations() {
    const response = await this.client.get<ApiResponse<any[]>>('/brands/me/reservations');
    return response.data;
  }

  // Brand: 내 입찰 목록
  async getMyAuctionBids() {
    const response = await this.client.get<ApiResponse<any[]>>('/brands/me/bids');
    return response.data;
  }

  // Brand: 내 낙찰 목록
  async getMyWins() {
    const response = await this.client.get<ApiResponse<any[]>>('/brands/me/wins');
    return response.data;
  }

  // ============================================
  // Phase 9-3: Athlete Dashboard API
  // ============================================

  // Athlete: 서명 대기 계약 목록
  async getPendingSignatures() {
    const response = await this.client.get<ApiResponse<any[]>>('/athletes/me/pending-signatures');
    return response.data;
  }

  // ============================================
  // Phase 9-3: Auction Summary API (Polling)
  // ============================================

  // Auction: 요약 정보 (폴링용)
  async getAuctionSummary(auctionId: string) {
    const response = await this.client.get<ApiResponse<{
      id: string;
      currentPrice: number;
      bidCount: number;
      remainingSeconds: number;
      status: string;
      endAt: string;
      myIsHighest?: boolean;
    }>>(`/auctions/${auctionId}/summary`);
    return response.data;
  }

  // ============================================
  // Phase 9-3: Admin Operations API
  // ============================================

  // Admin Ops: 계약 조회
  async getOpsContract(contractId: string) {
    const response = await this.client.get<ApiResponse<any>>(`/admin/ops/contracts/${contractId}`);
    return response.data;
  }

  // Admin Ops: 예약 강제 해제
  async releaseReservation(contractId: string, data: { reason: string; confirmText: string; idempotencyKey?: string }) {
    const response = await this.client.post<ApiResponse<any>>(`/admin/ops/contracts/${contractId}/release-reservation`, data);
    return response.data;
  }

  // Admin Ops: 경매 조회
  async getOpsAuction(auctionId: string) {
    const response = await this.client.get<ApiResponse<any>>(`/admin/ops/auctions/${auctionId}`);
    return response.data;
  }

  // Admin Ops: 경매 강제 종료
  async forceCloseAuction(auctionId: string, data: { reason: string; confirmText: string; idempotencyKey?: string }) {
    const response = await this.client.post<ApiResponse<any>>(`/admin/ops/auctions/${auctionId}/force-close`, data);
    return response.data;
  }

  // ============================================
  // Season (시즌 리워드) - Phase H
  // ============================================

  // 현재 시즌 조회
  async getCurrentSeason() {
    const response = await this.client.get<ApiResponse<any>>('/seasons/current');
    return response.data;
  }

  // 시즌 목록
  async getSeasons(params?: { page?: number; pageSize?: number; status?: string }) {
    const response = await this.client.get<ApiResponse<any>>('/seasons', { params });
    return response.data;
  }

  // 시즌 상세
  async getSeason(id: string) {
    const response = await this.client.get<ApiResponse<any>>(`/seasons/${id}`);
    return response.data;
  }

  // 시즌 리더보드
  async getSeasonLeaderboard(seasonId: string, params?: { page?: number; pageSize?: number }) {
    const response = await this.client.get<ApiResponse<any>>(`/seasons/${seasonId}/leaderboard`, { params });
    return response.data;
  }

  // 내 시즌 참여 현황
  async getMySeasonParticipation(seasonId?: string) {
    const response = await this.client.get<ApiResponse<any>>('/seasons/my/participation', {
      params: seasonId ? { seasonId } : {},
    });
    return response.data;
  }

  // 내 뱃지 목록
  async getMyBadges() {
    const response = await this.client.get<ApiResponse<any>>('/seasons/my/badges');
    return response.data;
  }

  // Admin: 시즌 생성
  async createSeason(data: {
    name: string;
    description?: string;
    startsAt: string;
    endsAt: string;
    rewardTiers?: Array<{ rankFrom: number; rankTo: number; rewardPoints: number }>;
    participationBonus?: number;
  }) {
    const response = await this.client.post<ApiResponse<any>>('/seasons/admin', data);
    return response.data;
  }

  // Admin: 시즌 수정
  async updateSeason(id: string, data: {
    name?: string;
    description?: string;
    startsAt?: string;
    endsAt?: string;
    rewardTiers?: Array<{ rankFrom: number; rankTo: number; rewardPoints: number }>;
    participationBonus?: number;
    status?: string;
  }) {
    const response = await this.client.patch<ApiResponse<any>>(`/seasons/admin/${id}`, data);
    return response.data;
  }

  // Admin: 시즌 활성화
  async activateSeason(id: string) {
    const response = await this.client.post<ApiResponse<any>>(`/seasons/admin/${id}/activate`);
    return response.data;
  }

  // Admin: 시즌 종료
  async endSeason(id: string) {
    const response = await this.client.post<ApiResponse<any>>(`/seasons/admin/${id}/end`);
    return response.data;
  }

  // Admin: 보상 배포
  async distributeSeasonRewards(id: string) {
    const response = await this.client.post<ApiResponse<any>>(`/seasons/admin/${id}/distribute-rewards`);
    return response.data;
  }

  // Admin: 랭킹 업데이트
  async updateSeasonRankings(id: string) {
    const response = await this.client.post<ApiResponse<any>>(`/seasons/admin/${id}/update-rankings`);
    return response.data;
  }

  // ============================================
  // Phase E: Campaign Performance
  // ============================================

  // 캠페인 성과 조회
  async getCampaignPerformance(campaignId: string) {
    const response = await this.client.get<ApiResponse<any>>(`/campaigns/${campaignId}/performance`);
    return response.data;
  }

  // 추천 선수 조회
  async getRecommendedAthletes(params?: {
    tours?: string[];
    minRating?: number;
    limit?: number;
  }) {
    const response = await this.client.get<ApiResponse<any>>('/campaigns/recommended-athletes', { params });
    return response.data;
  }

  // 캠페인에 계약 연결
  async linkContractToCampaign(campaignId: string, contractId: string, allocatedBudget: number) {
    const response = await this.client.post<ApiResponse<any>>(`/campaigns/${campaignId}/contracts`, {
      contractId,
      allocatedBudget,
    });
    return response.data;
  }

  // ============================================
  // Phase F: Exposure / Media Value
  // ============================================

  // Brand: 노출 리포트 조회
  async getBrandExposureReport(params?: { startDate?: string; endDate?: string }) {
    const response = await this.client.get<ApiResponse<any>>('/exposure/brand/report', { params });
    return response.data;
  }

  // 계약별 노출 기록 조회
  async getContractExposures(contractId: string) {
    const response = await this.client.get<ApiResponse<any>>(`/exposure/contract/${contractId}`);
    return response.data;
  }

  // Admin: 노출 기록 목록
  async getExposureRecords(filters?: {
    contractId?: string;
    brandId?: string;
    athleteId?: string;
    exposureType?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const response = await this.client.get<ApiResponse<any>>('/exposure/admin/records', { params: filters });
    return response.data;
  }

  // Admin: 노출 기록 생성
  async createExposureRecord(data: {
    contractId: string;
    exposureType: string;
    impressions: number;
    viewDurationSec?: number;
    reachCount?: number;
    sourceUrl?: string;
    description?: string;
    recordedAt: string;
  }) {
    const response = await this.client.post<ApiResponse<any>>('/exposure/admin/records', data);
    return response.data;
  }

  // Admin: 노출 기록 삭제
  async deleteExposureRecord(id: string) {
    const response = await this.client.delete<ApiResponse<any>>(`/exposure/admin/records/${id}`);
    return response.data;
  }

  // Admin: 미디어밸류 리포트
  async getMediaValueReport(options?: {
    startDate?: string;
    endDate?: string;
    groupBy?: 'day' | 'week' | 'month';
  }) {
    const response = await this.client.get<ApiResponse<any>>('/exposure/admin/report', { params: options });
    return response.data;
  }

  // Admin: 미디어밸류 요율 목록
  async getMediaValueRates() {
    const response = await this.client.get<ApiResponse<any>>('/exposure/admin/rates');
    return response.data;
  }

  // Admin: 미디어밸류 요율 생성
  async createMediaValueRate(data: {
    exposureType: string;
    bodyPart?: string;
    ratePerImpression: number;
    effectiveFrom: string;
    effectiveTo?: string;
    description?: string;
  }) {
    const response = await this.client.post<ApiResponse<any>>('/exposure/admin/rates', data);
    return response.data;
  }
}

export const api = new ApiService();
