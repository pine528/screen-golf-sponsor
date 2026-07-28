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

  // Generic HTTP methods
  async get<T = any>(url: string, params?: any): Promise<ApiResponse<T>> {
    const response = await this.client.get<ApiResponse<T>>(url, { params });
    return response.data;
  }

  async post<T = any>(url: string, data?: any, config?: any): Promise<ApiResponse<T>> {
    const response = await this.client.post<ApiResponse<T>>(url, data, config);
    return response.data;
  }

  async patch<T = any>(url: string, data?: any): Promise<ApiResponse<T>> {
    const response = await this.client.patch<ApiResponse<T>>(url, data);
    return response.data;
  }

  async put<T = any>(url: string, data?: any): Promise<ApiResponse<T>> {
    const response = await this.client.put<ApiResponse<T>>(url, data);
    return response.data;
  }

  async delete<T = any>(url: string): Promise<ApiResponse<T>> {
    const response = await this.client.delete<ApiResponse<T>>(url);
    return response.data;
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

  // Agency Auth
  async agencyRegister(data: {
    email: string;
    password: string;
    name: string;
    bizNo?: string;
    contactName?: string;
    contactPhone?: string;
  }) {
    const response = await this.client.post<ApiResponse<any>>('/auth/agency/register', data);
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

  async createEvent(data: {
    name: string;
    tour: string;
    venue?: string;
    dateStart: string;
    dateEnd: string;
    description?: string;
    broadcastEpisode?: string;
    multiplier?: number;
  }) {
    const response = await this.client.post<ApiResponse<any>>('/events', data);
    return response.data;
  }

  async updateEvent(id: string, data: {
    name?: string;
    tour?: string;
    venue?: string;
    dateStart?: string;
    dateEnd?: string;
    description?: string;
    broadcastEpisode?: string;
    multiplier?: number;
    status?: string;
  }) {
    const response = await this.client.patch<ApiResponse<any>>(`/events/${id}`, data);
    return response.data;
  }

  async deleteEvent(id: string) {
    const response = await this.client.delete<ApiResponse<any>>(`/events/${id}`);
    return response.data;
  }

  // Tournament Rules (v2)
  async getTournamentRules(eventId: string) {
    const response = await this.client.get<ApiResponse<any>>(`/events/${eventId}/tournament-rules`);
    return response.data;
  }

  async updateTournamentRules(eventId: string, rules: any) {
    const response = await this.client.put<ApiResponse<any>>(`/admin/events/${eventId}/tournament-rules`, rules);
    return response.data;
  }

  async getSlotAvailability(eventId: string, athleteId: string) {
    const response = await this.client.get<ApiResponse<any>>(`/events/${eventId}/athletes/${athleteId}/slot-availability`);
    return response.data;
  }

  async approvePhase2Slots(eventId: string, athleteId: string) {
    const response = await this.client.post<ApiResponse<any>>(`/admin/events/${eventId}/athletes/${athleteId}/approve-phase2`);
    return response.data;
  }

  async getEventSlotSummary(eventId: string) {
    const response = await this.client.get<ApiResponse<any>>(`/admin/events/${eventId}/slot-summary`);
    return response.data;
  }

  // Slots
  async getSlotTemplates() {
    const response = await this.client.get<ApiResponse<any[]>>('/slots/templates');
    return response.data;
  }

  async getSlotTemplate(id: string) {
    const response = await this.client.get<ApiResponse<any>>(`/slots/templates/${id}`);
    return response.data;
  }

  async createSlotTemplate(data: {
    code: string;
    name: string;
    bodyPart: string;
    sizeMaxWMm: number;
    sizeMaxHMm: number;
    perimeterMaxMm: number;
    phase?: number;
    category?: string;
    grade?: string;
    defaultReservePrice?: number;
    nameKr?: string;
    nameEn?: string;
    uiHeadline?: string;
    uiCopy?: string;
  }) {
    const response = await this.client.post<ApiResponse<any>>('/slots/templates', data);
    return response.data;
  }

  async updateSlotTemplate(id: string, data: Partial<{
    name: string;
    sizeMaxWMm: number;
    sizeMaxHMm: number;
    perimeterMaxMm: number;
    phase: number;
    category: string;
    grade: string;
    defaultReservePrice: number;
    nameKr: string;
    nameEn: string;
    uiHeadline: string;
    uiCopy: string;
    isActive: boolean;
  }>) {
    const response = await this.client.patch<ApiResponse<any>>(`/slots/templates/${id}`, data);
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

  async createSlotInstance(data: {
    eventId: string;
    athleteId: string;
    slotTemplateId: string;
    reservePrice?: number;
  }) {
    const response = await this.client.post<ApiResponse<any>>('/slots/instances', data);
    return response.data;
  }

  async bulkCreateSlotInstances(eventId: string, athleteId: string, templateIds: string[]) {
    const response = await this.client.post<ApiResponse<any>>('/slots/instances/bulk', {
      eventId,
      athleteId,
      templateIds,
    });
    return response.data;
  }

  async updateSlotSaleMode(slotId: string, data: {
    /** 판매 방식 (택1) — 지정 시 enableAuction/enableDirectBuy는 서버에서 파생됨 */
    saleMode?: 'AUCTION' | 'DIRECT' | 'INQUIRY';
    enableAuction?: boolean;
    enableDirectBuy?: boolean;
    directBuyPrice?: number | null;
    auctionMinBid?: number | null;
    auctionEndAt?: string | null;
    isPublic?: boolean;
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

  async getFeaturedAuctions() {
    const response = await this.client.get<ApiResponse<any[]>>('/auctions/featured');
    return response.data;
  }

  async startAuction(id: string) {
    const response = await this.client.post<ApiResponse<any>>(`/auctions/${id}/start`);
    return response.data;
  }

  async cancelAuction(id: string, reason?: string) {
    const response = await this.client.post<ApiResponse<any>>(`/auctions/${id}/cancel`, { reason });
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
  async createTopup(data: { amount: number; provider: 'TOSS' }) {
    const response = await this.client.post<ApiResponse<any>>('/brand/topups', data);
    return response.data;
  }

  // 테스트용 모의 충전
  async mockTopup(amount: number) {
    const response = await this.client.post<ApiResponse<any>>('/brand/topups/mock', { amount });
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

  async updateAthleteAdmin(athleteId: string, data: any) {
    const response = await this.client.patch<ApiResponse<any>>(`/athletes/admin/${athleteId}`, data);
    return response.data;
  }

  // ============================================
  // SPONPIK Phase 2 SNS — YouTube Data API 연동
  // ============================================
  async getYoutubeAthleteAggregate(athleteId: string) {
    const r = await this.client.get<ApiResponse<any>>(`/youtube/athletes/${athleteId}`);
    return r.data;
  }
  async connectMyYoutube(channelInput: string) {
    const r = await this.client.post<ApiResponse<any>>(`/youtube/me/connect`, { channelInput });
    return r.data;
  }
  async disconnectMyYoutube() {
    const r = await this.client.delete<ApiResponse<any>>(`/youtube/me`);
    return r.data;
  }
  async syncMyYoutube() {
    const r = await this.client.post<ApiResponse<any>>(`/youtube/me/sync`);
    return r.data;
  }
  async connectAthleteYoutubeAdmin(athleteId: string, channelInput: string) {
    const r = await this.client.post<ApiResponse<any>>(`/youtube/admin/athletes/${athleteId}/connect`, { channelInput });
    return r.data;
  }
  async getAdminYoutubeChannels() {
    const r = await this.client.get<ApiResponse<any>>(`/youtube/admin/channels`);
    return r.data;
  }
  async getAdminYoutubeStatus() {
    const r = await this.client.get<ApiResponse<any>>(`/youtube/admin/status`);
    return r.data;
  }

  // 선수 출연 영상 (Mention) — Phase 2 옵션 B
  async getAthleteMentionsAggregate(athleteId: string) {
    const r = await this.client.get<ApiResponse<any>>(`/youtube/mentions/athletes/${athleteId}`);
    return r.data;
  }
  async listMyMentions(status?: 'PENDING' | 'APPROVED' | 'REJECTED') {
    const r = await this.client.get<ApiResponse<any>>(`/youtube/mentions/me`, { params: status ? { status } : {} });
    return r.data;
  }
  async searchMyMentions(query?: string) {
    const r = await this.client.post<ApiResponse<any>>(`/youtube/mentions/me/search`, query ? { query } : {});
    return r.data;
  }
  async addMyMention(videoUrl: string) {
    const r = await this.client.post<ApiResponse<any>>(`/youtube/mentions/me`, { videoUrl });
    return r.data;
  }
  async approveMyMention(mentionId: string) {
    const r = await this.client.post<ApiResponse<any>>(`/youtube/mentions/me/${mentionId}/approve`);
    return r.data;
  }
  async rejectMyMention(mentionId: string, reason?: string) {
    const r = await this.client.post<ApiResponse<any>>(`/youtube/mentions/me/${mentionId}/reject`, reason ? { reason } : {});
    return r.data;
  }
  async deleteMyMention(mentionId: string) {
    const r = await this.client.delete<ApiResponse<any>>(`/youtube/mentions/me/${mentionId}`);
    return r.data;
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

  // Admin Featured Auctions
  async createFeaturedAuction(data: {
    athleteId: string;
    eventId: string;
    slotTemplateId: string;
    startAt: string;
    endAt: string;
    reservePrice?: number;
  }) {
    // Backend expects auctionEndAt instead of endAt
    const payload = {
      athleteId: data.athleteId,
      eventId: data.eventId,
      slotTemplateId: data.slotTemplateId,
      reservePrice: data.reservePrice,
      auctionEndAt: data.endAt, // Map endAt to auctionEndAt
    };
    const response = await this.client.post<ApiResponse<any>>('/admin/featured-auctions', payload);
    return response.data;
  }

  async bulkCreateFeaturedAuctions(items: Array<{
    athleteId: string;
    eventId: string;
    slotTemplateId: string;
    startAt: string;
    endAt: string;
    reservePrice?: number;
  }>) {
    const response = await this.client.post<ApiResponse<any>>('/admin/featured-auctions/bulk', { items });
    return response.data;
  }

  async getAdminFeaturedAuctions() {
    const response = await this.client.get<ApiResponse<any[]>>('/admin/featured-auctions');
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

  async submitAgencyKyc(data: { documents: { type: string; url: string }[] }) {
    const response = await this.client.post<ApiResponse<any>>('/agencies/me/kyc', data);
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
  // Admin Topup (브랜드 충전 관리)
  // ============================================

  async getAdminTopups(params?: { status?: string; provider?: string; brandId?: string; limit?: number; offset?: number }) {
    const response = await this.client.get<ApiResponse<any>>('/admin/finance/topups', { params });
    return response.data;
  }

  async getAdminTopupStats() {
    const response = await this.client.get<ApiResponse<any>>('/admin/finance/topups/stats');
    return response.data;
  }

  async getAdminTopupDetail(id: string) {
    const response = await this.client.get<ApiResponse<any>>(`/admin/finance/topups/${id}`);
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

  async getAdminFans(params?: { email?: string; page?: number; pageSize?: number }) {
    const response = await this.client.get<ApiResponse<any>>('/admin/entities/fans', { params });
    return response.data;
  }

  async deleteAdminBrand(brandId: string) {
    const response = await this.client.delete<ApiResponse<any>>(`/admin/entities/brands/${brandId}`);
    return response.data;
  }

  async deleteAdminAthlete(athleteId: string) {
    const response = await this.client.delete<ApiResponse<any>>(`/admin/entities/athletes/${athleteId}`);
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
  // Brand Vote Creation
  // ============================================

  // Brand: 투표 생성
  async createBrandVote(data: {
    title: string;
    question: string;
    options: string[];
    entryFeePoints: number;
    winnersCount: number;
    startsAt: string;
    endsAt: string;
    sponsorContribution?: number;
    sponsorBannerUrl?: string;
    sponsorLogoUrl?: string;
    sponsorMessage?: string;
    sponsorLinkUrl?: string;
  }) {
    const response = await this.client.post<ApiResponse<any>>('/fan-votes/brand/create', data);
    return response.data;
  }

  // Brand: 내가 만든 투표 목록
  async getBrandCreatedVotes(params?: { page?: number; pageSize?: number }) {
    const response = await this.client.get<ApiResponse<any>>('/fan-votes/brand/my/events', { params });
    return response.data;
  }

  // Brand: 투표 제출 (DRAFT -> SUBMITTED)
  async submitBrandVote(id: string) {
    const response = await this.client.post<ApiResponse<any>>(`/fan-votes/brand/${id}/submit`);
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

  // ============================================
  // Phase 10-3: Reconciliation API (결제/환불 대사)
  // ============================================

  // Admin: 대사 실행 목록 조회
  async getReconciliationRuns(params?: {
    status?: string;
    limit?: number;
    offset?: number;
  }) {
    const response = await this.client.get<ApiResponse<any>>('/admin/reconciliation/runs', { params });
    return response.data;
  }

  // Admin: 수동 대사 실행
  async createReconciliationRun(data?: {
    scope?: string;
    fromDate?: string;
    toDate?: string;
  }) {
    const response = await this.client.post<ApiResponse<any>>('/admin/reconciliation/runs', data || {});
    return response.data;
  }

  // Admin: 대사 이슈 목록 조회
  async getReconciliationIssues(params?: {
    runId?: string;
    severity?: string;
    issueType?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }) {
    const response = await this.client.get<ApiResponse<any>>('/admin/reconciliation/issues', { params });
    return response.data;
  }

  // Admin: 대사 이슈 요약 통계
  async getReconciliationIssuesSummary() {
    const response = await this.client.get<ApiResponse<any>>('/admin/reconciliation/issues/summary');
    return response.data;
  }

  // Admin: 대사 이슈 상태 변경
  async updateReconciliationIssueStatus(id: string, data: { status: string; note?: string }) {
    const response = await this.client.patch<ApiResponse<any>>(`/admin/reconciliation/issues/${id}/status`, data);
    return response.data;
  }

  // Admin: 대사 이슈 CSV 내보내기
  async exportReconciliationIssuesCsv(params?: {
    severity?: string;
    issueType?: string;
    status?: string;
  }) {
    const response = await this.client.get('/admin/reconciliation/issues.csv', {
      params,
      responseType: 'blob',
    });
    return response.data;
  }

  // ============================================
  // Phase 11-1: Admin Management API (RBAC)
  // ============================================

  // Admin: 관리자 목록 조회
  async getAdmins(params?: {
    page?: number;
    limit?: number;
  }) {
    const response = await this.client.get<ApiResponse<any>>('/admin/admins', { params });
    return response.data;
  }

  // Admin: 관리자 역할 변경 (Danger Zone)
  async changeAdminRole(adminId: string, data: {
    role: string;
    confirmText: string;
    reason: string;
  }) {
    const response = await this.client.patch<ApiResponse<any>>(`/admin/admins/${adminId}/role`, data);
    return response.data;
  }

  // Admin: 관리자 권한 변경
  async updateAdminPermissions(adminId: string, data: {
    permissions: string[];
    reason: string;
  }) {
    const response = await this.client.patch<ApiResponse<any>>(`/admin/admins/${adminId}/permissions`, data);
    return response.data;
  }

  // ============================================
  // Phase 11-2A: Brand Billing API (청구/명세서)
  // ============================================

  // Brand: 청구 프로필 조회
  async getBillingProfile() {
    const response = await this.client.get<ApiResponse<any>>('/brand/billing/profile');
    return response.data;
  }

  // Brand: 청구 프로필 생성
  async createBillingProfile(data: {
    businessName: string;
    businessNumber: string;
    representativeName: string;
    businessType?: string;
    businessCategory?: string;
    billingEmail: string;
    billingPhone?: string;
    address: string;
    addressDetail?: string;
  }) {
    const response = await this.client.post<ApiResponse<any>>('/brand/billing/profile', data);
    return response.data;
  }

  // Brand: 청구 프로필 수정
  async updateBillingProfile(data: {
    businessName?: string;
    businessNumber?: string;
    representativeName?: string;
    businessType?: string;
    businessCategory?: string;
    billingEmail?: string;
    billingPhone?: string;
    address?: string;
    addressDetail?: string;
  }) {
    const response = await this.client.patch<ApiResponse<any>>('/brand/billing/profile', data);
    return response.data;
  }

  // Brand: 기간별 요약 조회
  async getStatementSummary(from: string, to: string) {
    const response = await this.client.get<ApiResponse<any>>('/brand/billing/statements/summary', {
      params: { from, to },
    });
    return response.data;
  }

  // Brand: 거래 내역 조회
  async getStatementItems(from: string, to: string, page?: number, pageSize?: number) {
    const response = await this.client.get<ApiResponse<any>>('/brand/billing/statements/items', {
      params: { from, to, page, pageSize },
    });
    return response.data;
  }

  // Brand: CSV 내보내기
  async exportStatementCsv(from: string, to: string) {
    const response = await this.client.get('/brand/billing/statements/export.csv', {
      params: { from, to },
      responseType: 'blob',
    });
    return response.data;
  }

  // Brand: PDF 내보내기
  async exportStatementPdf(from: string, to: string) {
    const response = await this.client.get('/brand/billing/statements/export.pdf', {
      params: { from, to },
      responseType: 'blob',
    });
    return response.data;
  }

  // ============================================
  // Tax Invoice (Brand)
  // ============================================

  async requestTaxInvoice(data: {
    billingProfileId: string;
    from: string;
    to: string;
    idempotencyKey: string;
  }) {
    const response = await this.client.post('/brand/billing/tax-invoices/request', data);
    return response.data;
  }

  async getMyTaxInvoices(params: { status?: string; page?: number; pageSize?: number } = {}) {
    const response = await this.client.get('/brand/billing/tax-invoices/my', { params });
    return response.data;
  }

  // ============================================
  // Tax Invoice (Admin)
  // ============================================

  async getAdminTaxInvoices(params: { status?: string; page?: number; pageSize?: number } = {}) {
    const response = await this.client.get('/admin/finance/tax-invoices', { params });
    return response.data;
  }

  async getAdminTaxInvoiceStats() {
    const response = await this.client.get('/admin/finance/tax-invoices/stats');
    return response.data;
  }

  async getAdminTaxInvoiceById(id: string) {
    const response = await this.client.get(`/admin/finance/tax-invoices/${id}`);
    return response.data;
  }

  async approveTaxInvoice(id: string) {
    const response = await this.client.post(`/admin/finance/tax-invoices/${id}/approve`);
    return response.data;
  }

  async rejectTaxInvoice(id: string, reason: string) {
    const response = await this.client.post(`/admin/finance/tax-invoices/${id}/reject`, { reason });
    return response.data;
  }

  async issueTaxInvoice(id: string, invoiceNumber: string, confirmText: string) {
    const response = await this.client.post(`/admin/finance/tax-invoices/${id}/issue`, {
      invoiceNumber,
      confirmText,
    });
    return response.data;
  }

  // ============================================
  // Point Topup (포인트 충전)
  // ============================================

  // 충전 생성 (Checkout 세션)
  async createPointTopup(data: { amount: number; provider?: 'TOSS' | 'STRIPE' }) {
    const response = await this.client.post('/point-topups/create', data);
    return response.data;
  }

  // 결제 확인
  async confirmPointTopup(topupId: string, paymentKey: string) {
    const response = await this.client.post(`/point-topups/${topupId}/confirm`, { paymentKey });
    return response.data;
  }

  // 내 충전 내역
  async getMyPointTopups(params: { status?: string; limit?: number; offset?: number } = {}) {
    const response = await this.client.get('/point-topups/my', { params });
    return response.data;
  }

  // 단일 충전 조회
  async getPointTopupById(id: string) {
    const response = await this.client.get(`/point-topups/${id}`);
    return response.data;
  }

  // orderId로 조회
  async getPointTopupByOrderId(orderId: string) {
    const response = await this.client.get(`/point-topups/order/${orderId}`);
    return response.data;
  }

  // ============================================
  // Admin Point Topups (관리자 포인트 충전 관리)
  // ============================================

  // 전체 충전 내역 조회 (Admin)
  async getAdminPointTopups(params?: {
    status?: string;
    userId?: string;
    startDate?: string;
    endDate?: string;
    skip?: number;
    take?: number;
    limit?: number;
    offset?: number;
  }) {
    const response = await this.client.get('/point-topups/admin/all', { params });
    return response.data;
  }

  // 충전 통계 조회 (Admin)
  async getAdminPointTopupStats() {
    const response = await this.client.get('/point-topups/admin/stats');
    return response.data;
  }

  // 충전 환불 처리 (Admin)
  async adminRefundPointTopup(id: string, reason?: string) {
    const response = await this.client.post(`/point-topups/admin/${id}/refund`, { reason });
    return response.data;
  }

  // ============================================
  // Donations (팬→선수 후원)
  // ============================================

  // 후원 가능한 선수 목록 조회
  async getDonationAthletes(params?: { page?: number; limit?: number; search?: string }) {
    const response = await this.client.get('/donations/athletes', { params });
    return response.data;
  }

  // 후원 생성
  async createDonation(data: {
    athleteId: string;
    amount: number;
    message?: string;
    isAnonymous?: boolean;
  }) {
    const response = await this.client.post('/donations', data);
    return response.data;
  }

  // 내 후원 내역 조회 (팬용)
  async getMyDonations(params?: { page?: number; limit?: number }) {
    const response = await this.client.get('/donations/my', { params });
    return response.data;
  }

  // 내가 받은 후원 목록 조회 (선수용)
  async getReceivedDonations(params?: { page?: number; limit?: number }) {
    const response = await this.client.get('/donations/received', { params });
    return response.data;
  }

  // ============================================
  // Point Withdrawals (포인트 출금 - 선수용)
  // ============================================

  // 출금 가능 잔액 조회
  async getPointWithdrawalBalance() {
    const response = await this.client.get('/point-withdrawals/balance');
    return response.data;
  }

  // 포인트 출금 요청 생성
  async createPointWithdrawal(data: {
    amount: number;
    bankName: string;
    bankAccountNumber: string;
    accountHolder: string;
    reason?: string;
  }) {
    const response = await this.client.post('/point-withdrawals', data);
    return response.data;
  }

  // 내 출금 요청 목록 조회
  async getMyPointWithdrawals(params?: { status?: string; page?: number; limit?: number }) {
    const response = await this.client.get('/point-withdrawals/my', { params });
    return response.data;
  }

  // ============================================
  // Admin Point Withdrawals (관리자 포인트 출금 관리)
  // ============================================

  // 모든 포인트 출금 요청 목록
  async getAdminPointWithdrawals(params?: { status?: string; page?: number; limit?: number }) {
    const response = await this.client.get('/admin/point-withdrawals', { params });
    return response.data;
  }

  // 포인트 출금 승인
  async approvePointWithdrawal(id: string) {
    const response = await this.client.post(`/admin/point-withdrawals/${id}/approve`);
    return response.data;
  }

  // 포인트 출금 거부
  async rejectPointWithdrawal(id: string, reason?: string) {
    const response = await this.client.post(`/admin/point-withdrawals/${id}/reject`, { reason });
    return response.data;
  }

  // 포인트 출금 지급 완료
  async completePointWithdrawal(id: string, payoutReference?: string) {
    const response = await this.client.post(`/admin/point-withdrawals/${id}/complete`, { payoutReference });
    return response.data;
  }

  // ============================================
  // Agency-Athlete Connection Requests (에이전시-선수 연결 요청)
  // ============================================

  // 에이전시: 연결 가능한 선수 검색
  async searchAvailableAthletes(params?: { q?: string; tour?: string; page?: number; limit?: number }) {
    const response = await this.client.get('/agencies/athletes/search', { params });
    return response.data;
  }

  // 에이전시: 연결 요청 발송
  async sendConnectionRequest(athleteId: string, message?: string) {
    const response = await this.client.post('/agencies/athletes/request', { athleteId, message });
    return response.data;
  }

  // 에이전시: 보낸 요청 목록
  async getSentConnectionRequests(params?: { status?: string; page?: number; limit?: number }) {
    const response = await this.client.get('/agencies/requests/sent', { params });
    return response.data;
  }

  // 에이전시: 요청 취소
  async cancelConnectionRequest(requestId: string) {
    const response = await this.client.delete(`/agencies/requests/${requestId}`);
    return response.data;
  }

  // 선수: 받은 연결 요청 목록
  async getAgencyRequests(params?: { status?: string; page?: number; limit?: number }) {
    const response = await this.client.get('/athletes/agency-requests', { params });
    return response.data;
  }

  // 선수: 연결 요청 승인
  async approveAgencyRequest(requestId: string) {
    const response = await this.client.post(`/athletes/agency-requests/${requestId}/approve`);
    return response.data;
  }

  // 선수: 연결 요청 거부
  async rejectAgencyRequest(requestId: string, reason?: string) {
    const response = await this.client.post(`/athletes/agency-requests/${requestId}/reject`, { reason });
    return response.data;
  }

  // ============================================
  // 에이전시 - 선수 대리 관리 API
  // ============================================

  // 에이전시: 선수 상세 정보 조회
  async getAgencyAthleteDetail(athleteId: string) {
    const response = await this.client.get(`/agencies/athletes/${athleteId}/detail`);
    return response.data;
  }

  // 에이전시: 선수 프로필 수정
  async updateAgencyAthleteProfile(athleteId: string, data: {
    name?: string;
    realName?: string;
    bio?: string;
    profileImageUrl?: string;
    socialLinks?: any;
    blockedCategories?: string[];
  }) {
    const response = await this.client.patch(`/agencies/athletes/${athleteId}/profile`, data);
    return response.data;
  }

  // 에이전시: 선수 KYC 대신 제출
  async submitAgencyAthleteKyc(athleteId: string, documents: { type: string; url: string }[]) {
    const response = await this.client.post(`/agencies/athletes/${athleteId}/kyc`, { documents });
    return response.data;
  }

  // 에이전시: 선수 은행 계좌 업데이트
  async updateAgencyAthleteBankAccount(athleteId: string, data: {
    bankName: string;
    accountNumber: string;
    accountHolder: string;
  }) {
    const response = await this.client.patch(`/agencies/athletes/${athleteId}/bank-account`, data);
    return response.data;
  }

  // 에이전시: 선수 슬롯 조회
  async getAgencyAthleteSlots(athleteId: string) {
    const response = await this.client.get(`/agencies/athletes/${athleteId}/slots`);
    return response.data;
  }

  // 에이전시: 선수 슬롯 생성
  async createAgencyAthleteSlot(athleteId: string, data: {
    eventId: string;
    templateId: string;
    reservePrice?: number;
  }) {
    const response = await this.client.post(`/agencies/athletes/${athleteId}/slots`, data);
    return response.data;
  }

  // 에이전시: 선수 슬롯 일괄 생성
  async bulkCreateAgencyAthleteSlots(athleteId: string, data: {
    eventId: string;
    templateIds: string[];
  }) {
    const response = await this.client.post(`/agencies/athletes/${athleteId}/slots/bulk`, data);
    return response.data;
  }

  // 에이전시: 선수 슬롯 판매모드 설정
  async updateAgencyAthleteSlotSaleMode(athleteId: string, slotId: string, data: {
    enableAuction?: boolean;
    enableDirectBuy?: boolean;
    directBuyPrice?: number;
    auctionMinBid?: number;
    auctionEndAt?: string;
    isPublic?: boolean;
  }) {
    const response = await this.client.patch(`/agencies/athletes/${athleteId}/slots/${slotId}/sale-mode`, data);
    return response.data;
  }

  // 에이전시: 선수 계약 목록 조회
  async getAgencyAthleteContracts(athleteId: string, params?: { status?: string; page?: number; limit?: number }) {
    const response = await this.client.get(`/agencies/athletes/${athleteId}/contracts`, { params });
    return response.data;
  }

  // 에이전시: 선수 대신 계약 서명
  async signAgencyAthleteContract(athleteId: string, contractId: string) {
    const response = await this.client.post(`/agencies/athletes/${athleteId}/contracts/${contractId}/sign`);
    return response.data;
  }

  // 에이전시: 선수 정산 내역 조회
  async getAgencyAthleteSettlements(athleteId: string, params?: { page?: number; limit?: number }) {
    const response = await this.client.get(`/agencies/athletes/${athleteId}/settlements`, { params });
    return response.data;
  }

  // 에이전시: 선수 출금 내역 조회
  async getAgencyAthleteWithdrawals(athleteId: string, params?: { page?: number; limit?: number }) {
    const response = await this.client.get(`/agencies/athletes/${athleteId}/withdrawals`, { params });
    return response.data;
  }

  // 에이전시: 선수 성과 통계 조회
  async getAgencyAthletePerformance(athleteId: string) {
    const response = await this.client.get(`/agencies/athletes/${athleteId}/performance`);
    return response.data;
  }

  // 에이전시: 모든 관리 선수 성과 조회
  async getAgencyAllAthletesPerformance() {
    const response = await this.client.get('/agencies/athletes/performance');
    return response.data;
  }

  // 에이전시: 서명 대기 계약 목록
  async getAgencyPendingSignatures() {
    const response = await this.client.get('/agencies/pending-signatures');
    return response.data;
  }

  // ============================================
  // Creative Approval (크리에이티브 사전 승인)
  // ============================================

  // Brand: 크리에이티브 승인 요청 제출
  async submitCreativeApproval(data: {
    eventId: string;
    fileUrl: string;
    fileName?: string;
    fileType?: string;
    fileSizeBytes?: number;
  }) {
    const response = await this.client.post('/brand/creative-approvals', data);
    return response.data;
  }

  // Brand: 내 크리에이티브 승인 요청 목록
  async getMyCreativeApprovals() {
    const response = await this.client.get('/brand/creative-approvals');
    return response.data;
  }

  // Brand: 특정 대회의 내 크리에이티브 승인 상태 조회
  async getMyCreativeApprovalForEvent(eventId: string) {
    const response = await this.client.get(`/brand/creative-approvals/events/${eventId}`);
    return response.data;
  }

  // Admin: 전체 크리에이티브 승인 요청 목록
  async getAdminCreativeApprovals(params?: {
    status?: string;
    eventId?: string;
    brandId?: string;
    skip?: number;
    take?: number;
  }) {
    const response = await this.client.get('/admin/creative-approvals', { params });
    return response.data;
  }

  // Admin: 크리에이티브 승인 통계
  async getAdminCreativeApprovalStats(eventId?: string) {
    const response = await this.client.get('/admin/creative-approvals/stats', {
      params: eventId ? { eventId } : {},
    });
    return response.data;
  }

  // Admin: 검토 시작
  async startCreativeApprovalReview(id: string) {
    const response = await this.client.post(`/admin/creative-approvals/${id}/start-review`);
    return response.data;
  }

  // Admin: 크리에이티브 승인
  async approveCreativeApproval(id: string, reviewNotes?: string) {
    const response = await this.client.post(`/admin/creative-approvals/${id}/approve`, { reviewNotes });
    return response.data;
  }

  // Admin: 크리에이티브 거부
  async rejectCreativeApproval(id: string, reviewNotes: string) {
    const response = await this.client.post(`/admin/creative-approvals/${id}/reject`, { reviewNotes });
    return response.data;
  }

  // ============================================
  // 투표 시스템 (리워드풀 기반 무료 투표)
  // ============================================

  // 리워드풀 상태 조회
  async getRewardPoolStatus() {
    const response = await this.client.get<ApiResponse<{
      id: string;
      balanceEp: string;
      reservedEp: string;
      availableTodayEp: string;
      multiplierM: number;
      availableEp: string;
      effectiveMicroReward: number;
      updatedAt: string;
    }>>('/votes/reward-pool/status');
    return response.data;
  }

  // 리워드풀 충전 (Admin)
  async depositToRewardPool(amount: number, reason?: string) {
    const response = await this.client.post<ApiResponse<any>>('/votes/reward-pool/deposit', {
      amount,
      reason,
    });
    return response.data;
  }

  // 일일 가용액 리셋 (Admin)
  async resetRewardPoolDaily(percentage?: number) {
    const response = await this.client.post<ApiResponse<any>>('/votes/reward-pool/reset-daily', {
      percentage,
    });
    return response.data;
  }

  // 배수 재계산 (Admin)
  async recalculateRewardPoolMultiplier() {
    const response = await this.client.post<ApiResponse<any>>('/votes/reward-pool/recalculate-multiplier');
    return response.data;
  }

  // 투표 템플릿 목록
  async getVoteTemplates() {
    const response = await this.client.get<ApiResponse<Array<{
      code: string;
      name: string;
      baseBudget: number;
      difficulty: number;
    }>>>('/votes/templates');
    return response.data;
  }

  // 투표 목록 조회
  async getVotes(params?: { status?: string; page?: number; pageSize?: number }) {
    const response = await this.client.get<ApiResponse<any[]>>('/votes', { params });
    return response.data;
  }

  // 투표 상세 조회
  async getVote(id: string) {
    const response = await this.client.get<ApiResponse<any>>(`/votes/${id}`);
    return response.data;
  }

  // 투표 생성 (Admin)
  async createVote(data: {
    templateCode: string;
    title: string;
    description?: string;
    options: any[];
    closeAt: string;
    target?: { tournamentId?: string; matchId?: string; playerId?: string };
    outcomeSource?: string;
    maxPerWinnerEp?: number;
  }) {
    const response = await this.client.post<ApiResponse<any>>('/votes', data);
    return response.data;
  }

  // 투표 참여 (무료)
  async participateVote(id: string, answer: any) {
    const response = await this.client.post<ApiResponse<{
      participation: {
        voteId: string;
        userId: string;
        answer: any;
        microRewardPaidEp: string;
        finalRewardPaidEp: string;
        createdAt: string;
      };
      microRewardPaid: number;
    }>>(`/votes/${id}/participate`, { answer });
    return response.data;
  }

  // 투표 정산 (Admin)
  async settleVote(id: string, correctAnswer: any) {
    const response = await this.client.post<ApiResponse<{
      winnersCount: number;
      perWinnerEp: string;
      totalPaidEp: string;
      remainderEp: string;
      alreadySettled: boolean;
    }>>(`/votes/${id}/settle`, { correctAnswer });
    return response.data;
  }

  // 투표 취소 (Admin)
  async cancelVote(id: string) {
    const response = await this.client.post<ApiResponse<any>>(`/votes/${id}/cancel`);
    return response.data;
  }

  // 만료된 투표 마감 (Admin/Cron)
  async closeExpiredVotes() {
    const response = await this.client.post<ApiResponse<{ closedCount: number }>>('/votes/cron/close-expired');
    return response.data;
  }

  // 내 참여 목록
  async getMyVoteParticipations(params?: { page?: number; pageSize?: number }) {
    const response = await this.client.get<ApiResponse<any[]>>('/votes/my-participations', { params });
    return response.data;
  }

  // 투표 통계 (Admin)
  async getVoteStats() {
    const response = await this.client.get<ApiResponse<{
      votes: {
        open: number;
        closed: number;
        settled: number;
        canceled: number;
        total: number;
      };
      totalParticipations: number;
    }>>('/votes/stats');
    return response.data;
  }

  // ============================================
  // 사용자 투표 생성 (본인 포인트 사용)
  // ============================================

  // 사용자 투표 생성 제한 정보 조회
  async getUserVoteLimits() {
    const response = await this.client.get<ApiResponse<{
      minSeedEp: number;
      maxSeedEp: number;
      maxDailyCreates: number;
    }>>('/votes/user/limits');
    return response.data;
  }

  // 내가 생성한 투표 목록 조회
  async getMyCreatedVotes(params?: { status?: string; page?: number; pageSize?: number }) {
    const response = await this.client.get<ApiResponse<any[]>>('/votes/user/my-votes', { params });
    return response.data;
  }

  // 사용자 투표 생성 (본인 포인트 사용)
  async createUserVote(data: {
    templateCode: string;
    title: string;
    description?: string;
    options: { id: string; label: string }[];
    closeAt: string;
    seedAmountEp: number;
    target?: { tournamentId?: string; matchId?: string; playerId?: string };
  }) {
    const response = await this.client.post<ApiResponse<any>>('/votes/user/create', data);
    return response.data;
  }

  // 사용자 투표 취소 (생성자만, 참여자 없을 때)
  async cancelUserVote(id: string) {
    const response = await this.client.post<ApiResponse<any>>(`/votes/user/${id}/cancel`);
    return response.data;
  }

  // 사용자 투표 정산 (생성자)
  async settleUserVote(id: string, correctAnswer: any) {
    const response = await this.client.post<ApiResponse<{
      winnersCount: number;
      perWinnerEp: string;
      totalPaidEp: string;
      remainderEp: string;
      alreadySettled: boolean;
    }>>(`/votes/user/${id}/settle`, { correctAnswer });
    return response.data;
  }

  // ============================================
  // Full Funnel Data Reporting (스폰픽 풀 퍼널)
  // ============================================

  // 캠페인 자산
  async generateCampaignAssets(campaignId: string, body: any = {}) {
    const r = await this.client.post<ApiResponse<any>>(`/admin/campaigns/${campaignId}/tracking-assets/generate`, body);
    return r.data;
  }
  async getCampaignAssets(campaignId: string) {
    const r = await this.client.get<ApiResponse<any>>(`/admin/campaigns/${campaignId}/tracking-assets`);
    return r.data;
  }
  async listFunnelCampaigns() {
    const r = await this.client.get<ApiResponse<any[]>>(`/admin/funnel/campaigns`);
    return r.data;
  }
  async getFunnelCampaign(id: string) {
    const r = await this.client.get<ApiResponse<any>>(`/admin/funnel/campaigns/${id}`);
    return r.data;
  }

  // 프로모션 코드
  async listPromoCodes(campaignId: string) {
    const r = await this.client.get<ApiResponse<any[]>>(`/admin/promo-codes`, { params: { campaignId } });
    return r.data;
  }
  async createPromoCode(body: any) {
    const r = await this.client.post<ApiResponse<any>>(`/admin/promo-codes`, body);
    return r.data;
  }
  async disablePromoCode(id: string) {
    const r = await this.client.patch<ApiResponse<any>>(`/admin/promo-codes/${id}`, { status: 'DISABLED' });
    return r.data;
  }

  // 트래킹 링크
  async listTrackingLinks(campaignId: string) {
    const r = await this.client.get<ApiResponse<any[]>>(`/admin/tracking-links`, { params: { campaignId } });
    return r.data;
  }
  async createTrackingLink(body: any) {
    const r = await this.client.post<ApiResponse<any>>(`/admin/tracking-links`, body);
    return r.data;
  }

  // 미니스토어
  async getMiniStore(campaignId: string) {
    const r = await this.client.get<ApiResponse<any>>(`/admin/mini-stores/${campaignId}`);
    return r.data;
  }
  async updateMiniStore(campaignId: string, body: any) {
    const r = await this.client.put<ApiResponse<any>>(`/admin/mini-stores/${campaignId}`, body);
    return r.data;
  }
  async publishMiniStore(campaignId: string, status: 'PUBLISHED' | 'HIDDEN' | 'DRAFT' = 'PUBLISHED') {
    const r = await this.client.put<ApiResponse<any>>(`/admin/mini-stores/${campaignId}/publish`, { status });
    return r.data;
  }
  async addStoreProduct(campaignId: string, body: any) {
    const r = await this.client.post<ApiResponse<any>>(`/admin/mini-stores/${campaignId}/products`, body);
    return r.data;
  }
  async updateStoreProduct(productId: string, body: any) {
    const r = await this.client.patch<ApiResponse<any>>(`/admin/mini-stores/products/${productId}`, body);
    return r.data;
  }
  async deleteStoreProduct(productId: string) {
    const r = await this.client.delete<ApiResponse<any>>(`/admin/mini-stores/products/${productId}`);
    return r.data;
  }

  // 공개 미니스토어 (비회원 접근)
  async getPublicMiniStore(slug: string) {
    const r = await this.client.get<ApiResponse<any>>(`/store/brand/${slug}`);
    return r.data;
  }
  async resolveShortCode(shortCode: string, sessionId?: string) {
    const r = await this.client.get<ApiResponse<any>>(`/store/short/${shortCode}`, {
      params: { session_id: sessionId },
    });
    return r.data;
  }

  // 이벤트 트래킹 (공개)
  async trackFunnelEvent(eventName: string, body: any) {
    const r = await this.client.post<ApiResponse<any>>(`/events/${eventName}`, body);
    return r.data;
  }
  async applyPromoCode(body: { promo_code: string; order_preview_amount: number; session_id?: string }) {
    const r = await this.client.post<ApiResponse<any>>(`/events/promo-apply`, body);
    return r.data;
  }
  async createFunnelPurchase(body: any) {
    const r = await this.client.post<ApiResponse<any>>(`/events/purchase`, body);
    return r.data;
  }

  // 리포트
  async getCampaignFunnelReport(campaignId: string, params?: { from?: string; to?: string; group_by?: string }) {
    const r = await this.client.get<ApiResponse<any>>(`/reports/campaign/${campaignId}`, { params });
    return r.data;
  }
  async getBrandFunnelReport(brandId: string, params?: any) {
    const r = await this.client.get<ApiResponse<any>>(`/reports/brand/${brandId}`, { params });
    return r.data;
  }
  async getAthleteFunnelReport(athleteId: string, params?: any) {
    const r = await this.client.get<ApiResponse<any>>(`/reports/athlete/${athleteId}`, { params });
    return r.data;
  }
  async getCampaignPredict(campaignId: string, method: 'sma' | 'ema' = 'ema') {
    const r = await this.client.get<ApiResponse<any>>(`/reports/campaign/${campaignId}/predict`, { params: { method } });
    return r.data;
  }
  async getBrandSegments(brandId: string, params?: any) {
    const r = await this.client.get<ApiResponse<any>>(`/reports/brand/${brandId}/segments`, { params });
    return r.data;
  }
  async getBrandAttribution(brandId: string, model: string = 'LAST_TOUCH', params?: any) {
    const r = await this.client.get<ApiResponse<any>>(`/reports/brand/${brandId}/attribution`, { params: { model, ...params } });
    return r.data;
  }

  // 브랜드 주문 (BRD-03)
  async listBrandFunnelOrders(brandId: string, params?: any) {
    const r = await this.client.get<ApiResponse<any[]>>(`/reports/brand/${brandId}/orders`, { params });
    return r.data;
  }

  // 공개 선수 (비회원)
  async listPublicAthletes(params?: { q?: string; tour?: string; sport?: string; sportType?: string; page?: number; limit?: number }) {
    const r = await this.client.get<ApiResponse<{ items: any[]; total: number; page: number; limit: number }>>(`/athletes/public`, { params });
    return r.data;
  }
  async getPublicAthlete(id: string) {
    const r = await this.client.get<ApiResponse<{ athlete: any; slotInstances: any[]; exposureCount: number }>>(`/athletes/public/${id}`);
    return r.data;
  }
  async getPublicAthleteRoiDashboard(id: string) {
    const r = await this.client.get<ApiResponse<any>>(`/athletes/public/${id}/roi-dashboard`);
    return r.data;
  }

  // 개편 Phase 5 — 장기 파트너십 제안
  async listProposals(status?: string) {
    const r = await this.client.get<ApiResponse<any[]>>('/proposals', { params: status ? { status } : undefined });
    return r.data;
  }

  async getProposal(id: string) {
    const r = await this.client.get<ApiResponse<any>>(`/proposals/${id}`);
    return r.data;
  }

  async createProposal(data: any) {
    const r = await this.client.post<ApiResponse<any>>('/proposals', data);
    return r.data;
  }

  async updateProposal(id: string, data: any) {
    const r = await this.client.patch<ApiResponse<any>>(`/proposals/${id}`, data);
    return r.data;
  }

  async submitProposal(id: string) {
    const r = await this.client.post<ApiResponse<any>>(`/proposals/${id}/submit`);
    return r.data;
  }

  async transitionProposal(id: string, to: string, note?: string) {
    const r = await this.client.post<ApiResponse<any>>(`/proposals/${id}/transition`, { to, note });
    return r.data;
  }

  // 개편 Phase 3 — 슬롯 임시예약(HELD 15분) + 주문확인 견적
  async holdSlot(slotInstanceId: string) {
    const r = await this.client.post<ApiResponse<{ inventoryId: string; reservedUntil: string; expiresInSec: number }>>(
      `/slots/instances/${slotInstanceId}/hold`
    );
    return r.data;
  }

  async getSlotHold(slotInstanceId: string) {
    const r = await this.client.get<ApiResponse<any>>(`/slots/instances/${slotInstanceId}/hold`);
    return r.data;
  }

  async releaseSlotHold(slotInstanceId: string) {
    const r = await this.client.delete<ApiResponse<any>>(`/slots/instances/${slotInstanceId}/hold`);
    return r.data;
  }

  async getSlotQuote(slotInstanceId: string) {
    const r = await this.client.get<ApiResponse<any>>(`/slots/instances/${slotInstanceId}/quote`);
    return r.data;
  }

  // 개편 Phase 1/2 — 선수 기간별 슬롯 인벤토리 (통합 구매화면 데이터 소스)
  async getAthleteInventory(id: string, params?: { start?: string; end?: string }) {
    const r = await this.client.get<ApiResponse<{ slots: any[] }>>(`/athletes/public/${id}/inventory`, { params });
    return r.data;
  }

  // 선수 경기결과 관리 (관리자/본인)
  async getAthleteEventResults(athleteId: string) {
    const r = await this.client.get<ApiResponse<any[]>>(`/athletes/${athleteId}/event-results`);
    return r.data;
  }
  async createAthleteEventResult(athleteId: string, body: any) {
    const r = await this.client.post<ApiResponse<any>>(`/athletes/${athleteId}/event-results`, body);
    return r.data;
  }
  async updateAthleteEventResult(resultId: string, body: any) {
    const r = await this.client.patch<ApiResponse<any>>(`/athletes/event-results/${resultId}`, body);
    return r.data;
  }
  async deleteAthleteEventResult(resultId: string) {
    const r = await this.client.delete<ApiResponse<any>>(`/athletes/event-results/${resultId}`);
    return r.data;
  }
  // 선수 본인 경기결과 자가등록 (status PENDING → 관리자 승인)
  async getMyEventResults() {
    const r = await this.client.get<ApiResponse<any[]>>(`/athletes/me/event-results`);
    return r.data;
  }
  async createMyEventResult(body: any) {
    const r = await this.client.post<ApiResponse<any>>(`/athletes/me/event-results`, body);
    return r.data;
  }
  async updateMyEventResult(resultId: string, body: any) {
    const r = await this.client.patch<ApiResponse<any>>(`/athletes/me/event-results/${resultId}`, body);
    return r.data;
  }
  async deleteMyEventResult(resultId: string) {
    const r = await this.client.delete<ApiResponse<any>>(`/athletes/me/event-results/${resultId}`);
    return r.data;
  }
  // 관리자: 선수 자가등록 결과 승인/반려
  async approveAthleteEventResult(resultId: string, status: 'APPROVED' | 'REJECTED' = 'APPROVED') {
    const r = await this.client.patch<ApiResponse<any>>(`/athletes/event-results/${resultId}/approve`, { status });
    return r.data;
  }

  // ============================================
  // 미디어 노출 수동 입력 (docx §6 C-1, 관리자/본인)
  // ============================================
  async getAthleteMediaExposures(athleteId: string) {
    const r = await this.client.get<ApiResponse<any[]>>(`/athletes/${athleteId}/media-exposures`);
    return r.data;
  }
  async createAthleteMediaExposure(athleteId: string, body: any) {
    const r = await this.client.post<ApiResponse<any>>(`/athletes/${athleteId}/media-exposures`, body);
    return r.data;
  }
  async updateAthleteMediaExposure(exposureId: string, body: any) {
    const r = await this.client.patch<ApiResponse<any>>(`/athletes/media-exposures/${exposureId}`, body);
    return r.data;
  }
  async deleteAthleteMediaExposure(exposureId: string) {
    const r = await this.client.delete<ApiResponse<any>>(`/athletes/media-exposures/${exposureId}`);
    return r.data;
  }

  // ============================================
  // 자동 수집 트리거 (docx §6 C-1, C-3 관리자)
  // ============================================
  async syncAthleteNews(athleteId: string, extraKeyword = '골프') {
    const r = await this.client.post<ApiResponse<any>>(`/athletes/${athleteId}/sync-news`, { extraKeyword });
    return r.data;
  }
  async syncAllFollowers() {
    const r = await this.client.post<ApiResponse<any>>(`/athletes/sync-followers-all`, {});
    return r.data;
  }
  async syncAllNews() {
    const r = await this.client.post<ApiResponse<any>>(`/athletes/sync-news-all`, {});
    return r.data;
  }

  // Pixel (Phase 2)
  async createPixel(brandId?: string, domains: string[] = []) {
    const r = await this.client.post<ApiResponse<any>>(`/external/pixels`, { brand_id: brandId, domains });
    return r.data;
  }
  async getPixel(brandId: string) {
    const r = await this.client.get<ApiResponse<any>>(`/external/pixels/${brandId}`);
    return r.data;
  }
  async updatePixel(brandId: string, body: { domains?: string[]; status?: string }) {
    const r = await this.client.patch<ApiResponse<any>>(`/external/pixels/${brandId}`, body);
    return r.data;
  }
}

export const api = new ApiService();
