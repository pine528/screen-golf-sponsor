import { useEffect } from 'react';
import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import { Hexagon } from 'lucide-react';
import { Analytics } from '@vercel/analytics/react';
import { useAuth } from './hooks/useAuth';
import { Home } from './pages/Home';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Dashboard } from './pages/Dashboard';
import { Auctions } from './pages/Auctions';
import { Features } from './pages/Features';
import { HowItWorks } from './pages/HowItWorks';
import { ForWho } from './pages/ForWho';
import { AdminEvents } from './pages/admin/AdminEvents';
import { AdminAuctions } from './pages/admin/AdminAuctions';
import { AdminFeaturedAuctions } from './pages/admin/AdminFeaturedAuctions';
import { AdminSlotTemplates } from './pages/admin/AdminSlotTemplates';
import { AdminKyc } from './pages/admin/AdminKyc';
import { AdminReviews } from './pages/admin/AdminReviews';
import { AdminSettings } from './pages/admin/AdminSettings';
import AdminPoints from './pages/admin/AdminPoints';
import AdminPayments from './pages/admin/AdminPayments';
import AdminReports from './pages/admin/AdminReports';
import AdminEntities from './pages/admin/AdminEntities';
import AdminEntityDetail from './pages/admin/AdminEntityDetail';
import {
  FinanceDashboard,
  FinanceEscrows,
  FinanceEscrowDetail,
  FinanceWallets,
  FinanceWalletDetail,
  FinancePayouts,
  FinancePayoutDetail,
  FinanceWithdrawals,
  FinanceWithdrawalDetail,
  FinanceWithdrawalBatches,
  FinanceWithdrawalBatchDetail,
  FinanceTopups,
  FinancePointTopups,
} from './pages/admin/finance';
import AthleteWithdrawals from './pages/athlete/Withdrawals';
import AthletePendingSignatures from './pages/athlete/PendingSignatures';
import AthleteDonations from './pages/athlete/Donations';
import AthletePointWithdrawals from './pages/athlete/PointWithdrawals';
import FinanceReports from './pages/admin/reports/ReportsDashboard';
import BrandCampaigns from './pages/brand/Campaigns';
import CampaignDetail from './pages/brand/CampaignDetail';
import BrandWallet from './pages/brand/BrandWallet';
import BrandCheckout from './pages/brand/BrandCheckout';
import BrandSponsoredVotes from './pages/brand/BrandSponsoredVotes';
import BrandROIDashboard from './pages/brand/BrandROIDashboard';
import BrandBilling from './pages/brand/BrandBilling';
import { BrandCreativeApprovals } from './pages/brand/BrandCreativeApprovals';
import { BrandLogoTemplates } from './pages/brand/BrandLogoTemplates';
import { FanHome, FanLogin, FanRegister, Points, Ranking, Favorites, BrandRegister, Shop, ShopDetail, Orders } from './pages/fan';
import { AgencyDashboard, AgencyAthleteRegister, AgencyAthletes, AgencyAthleteSearch, AgencySentRequests, AgencyAthleteDetail } from './pages/agency';
import { AthleteAgencyRequests } from './pages/athlete/AthleteAgencyRequests';
import PointTopup from './pages/PointTopup';
import MyDonations from './pages/fan/MyDonations';
import SeasonLeaderboard from './pages/fan/SeasonLeaderboard';
import MyBadges from './pages/fan/MyBadges';
import { AdminBrandRegistrations } from './pages/admin/AdminBrandRegistrations';
import AdminOps from './pages/admin/AdminOps';
import AdminFeePolicies from './pages/admin/AdminFeePolicies';
import AdminFaq from './pages/admin/AdminFaq';
import AdminPenalties from './pages/admin/AdminPenalties';
import AdminDisputes from './pages/admin/AdminDisputes';
import AdminDisputeDetail from './pages/admin/AdminDisputeDetail';
import AdminSeasons from './pages/admin/AdminSeasons';
import AdminExposure from './pages/admin/AdminExposure';
import AdminReconciliation from './pages/admin/AdminReconciliation';
import AdminUsers from './pages/admin/AdminUsers';
import AdminTaxInvoices from './pages/admin/AdminTaxInvoices';
import AdminPointWithdrawals from './pages/admin/AdminPointWithdrawals';
import { AdminCreativeApprovals } from './pages/admin/AdminCreativeApprovals';
import AdminVotes from './pages/admin/AdminVoteV2';
import { AdminVodIngest } from './pages/admin/AdminVodIngest';
import { AdminDetectionQA } from './pages/admin/AdminDetectionQA';
import { BrandEvidence } from './pages/brand/BrandEvidence';
import { BrandReports } from './pages/brand/BrandReports';
import { BrandSlotAnalytics } from './pages/brand/BrandSlotAnalytics';
import { BrandROISettings } from './pages/brand/BrandROISettings';
import { AdminEvidenceManager } from './pages/admin/AdminEvidenceManager';
import { AdminReportTemplates } from './pages/admin/AdminReportTemplates';
import { AdminCampaignBuilder } from './pages/admin/AdminCampaignBuilder';
// Full Funnel Data Reporting (스폰픽 풀 퍼널)
import AdminFunnelCampaigns from './pages/admin/AdminFunnelCampaigns';
import AdminFunnelCampaignDetail from './pages/admin/AdminFunnelCampaignDetail';
import AdminPromoCodesLinks from './pages/admin/AdminPromoCodesLinks';
import AdminMiniStoreSettings from './pages/admin/AdminMiniStoreSettings';
import AdminIntegratedROIReport from './pages/admin/AdminIntegratedROIReport';
import AdminPerformanceSettlement from './pages/admin/AdminPerformanceSettlement';
import BrandFunnelDashboard from './pages/brand/BrandFunnelDashboard';
import BrandPerformanceCompare from './pages/brand/BrandPerformanceCompare';
import BrandOrders from './pages/brand/BrandOrders';
import BrandPixelInstall from './pages/brand/BrandPixelInstall';
import BrandAttribution from './pages/brand/BrandAttribution';
import AthleteFunnelDashboard from './pages/athlete/AthleteFunnelDashboard';
import MiniStoreLanding from './pages/store/MiniStoreLanding';
import MiniStoreProduct from './pages/store/MiniStoreProduct';
import MiniStoreCheckout from './pages/store/MiniStoreCheckout';
import { ShortLinkRedirect } from './pages/ShortLinkRedirect';
import PublicAthletes from './pages/PublicAthletes';
import PublicAthleteDetail from './pages/PublicAthleteDetail';
import AdminAthleteEventResults from './pages/admin/AdminAthleteEventResults';
import AdminTournamentActivation from './pages/admin/AdminTournamentActivation';
import VotesList from './pages/fan/VoteV2List';
import VotesDetail from './pages/fan/VoteV2Detail';
import VoteCreate from './pages/fan/VoteCreate';
import MyCreatedVotes from './pages/fan/MyCreatedVotes';
import Faq from './pages/Faq';
import Guide from './pages/Guide';
import Contact from './pages/Contact';
import Terms from './pages/Terms';
import Privacy from './pages/Privacy';
import { Inventory } from './pages/Inventory';
import { Contracts } from './pages/Contracts';
import { Profile } from './pages/Profile';
import { MySlots } from './pages/MySlots';
import { Settlements } from './pages/Settlements';
import { AuctionDetail } from './pages/AuctionDetail';
import MockAuctionDetail from './pages/MockAuctionDetail';

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 transition-colors duration-300">
      <div className="text-center">
        <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pulse shadow-lg shadow-emerald-500/25">
          <Hexagon className="w-8 h-8 text-white" strokeWidth={2.5} />
        </div>
        <p className="text-slate-600">로딩 중...</p>
      </div>
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

function LegacyStoreRedirect({ kind }: { kind?: 'product' | 'checkout' }) {
  const params = useParams();
  const slug = params.slug;
  const productId = params.productId;
  if (!slug) return <Navigate to="/" replace />;
  let path = `/store/brand/${slug}`;
  if (kind === 'product' && productId) path += `/product/${productId}`;
  if (kind === 'checkout') path += '/checkout';
  return <Navigate to={path} replace />;
}

function HomeRoute() {
  const { isLoading } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  return <Home />;
}


function App() {
  const { checkAuth } = useAuth();

  useEffect(() => {
    checkAuth();
  }, []);

  return (
    <>
    <Routes>
      {/* Public Routes */}
      <Route
        path="/login"
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicRoute>
            <Register />
          </PublicRoute>
        }
      />
      <Route path="/features" element={<Features />} />
      <Route path="/how-it-works" element={<HowItWorks />} />
      <Route path="/for-who" element={<ForWho />} />
      <Route path="/faq" element={<Faq />} />
      <Route path="/guide" element={<Guide />} />
      <Route path="/contact" element={<Contact />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/privacy" element={<Privacy />} />

      {/* Fan Auth Routes (Public) */}
      <Route path="/fan/login" element={<FanLogin />} />
      <Route path="/fan/register" element={<FanRegister />} />

      {/* Protected Routes */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route path="/auctions" element={<Auctions />} />
      <Route path="/auctions/mock/:id" element={<MockAuctionDetail />} />
      <Route path="/auctions/:id" element={<AuctionDetail />} />
      <Route path="/inventory" element={<Inventory />} />
      <Route
        path="/contracts"
        element={
          <ProtectedRoute>
            <Contracts />
          </ProtectedRoute>
        }
      />
      <Route
        path="/contracts/:id"
        element={
          <ProtectedRoute>
            <Contracts />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        }
      />
      <Route
        path="/my-slots"
        element={
          <ProtectedRoute>
            <MySlots />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settlements"
        element={
          <ProtectedRoute>
            <Settlements />
          </ProtectedRoute>
        }
      />
      <Route
        path="/athlete/withdrawals"
        element={
          <ProtectedRoute>
            <AthleteWithdrawals />
          </ProtectedRoute>
        }
      />
      <Route
        path="/athlete/pending-signatures"
        element={
          <ProtectedRoute>
            <AthletePendingSignatures />
          </ProtectedRoute>
        }
      />
      <Route
        path="/athlete/donations"
        element={
          <ProtectedRoute>
            <AthleteDonations />
          </ProtectedRoute>
        }
      />
      <Route
        path="/athlete/point-withdrawals"
        element={
          <ProtectedRoute>
            <AthletePointWithdrawals />
          </ProtectedRoute>
        }
      />
      <Route
        path="/athlete/agency-requests"
        element={
          <ProtectedRoute>
            <AthleteAgencyRequests />
          </ProtectedRoute>
        }
      />

      {/* Agency Routes */}
      <Route
        path="/agency"
        element={
          <ProtectedRoute>
            <AgencyDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/agency/athletes"
        element={
          <ProtectedRoute>
            <AgencyAthletes />
          </ProtectedRoute>
        }
      />
      <Route
        path="/agency/athletes/register"
        element={
          <ProtectedRoute>
            <AgencyAthleteRegister />
          </ProtectedRoute>
        }
      />
      <Route
        path="/agency/athletes/search"
        element={
          <ProtectedRoute>
            <AgencyAthleteSearch />
          </ProtectedRoute>
        }
      />
      <Route
        path="/agency/requests"
        element={
          <ProtectedRoute>
            <AgencySentRequests />
          </ProtectedRoute>
        }
      />
      <Route
        path="/agency/athletes/:athleteId"
        element={
          <ProtectedRoute>
            <AgencyAthleteDetail />
          </ProtectedRoute>
        }
      />

      <Route
        path="/campaigns"
        element={
          <ProtectedRoute>
            <BrandCampaigns />
          </ProtectedRoute>
        }
      />
      <Route
        path="/brand/wallet/checkout"
        element={
          <ProtectedRoute>
            <BrandCheckout />
          </ProtectedRoute>
        }
      />
      <Route
        path="/brand/wallet"
        element={
          <ProtectedRoute>
            <BrandWallet />
          </ProtectedRoute>
        }
      />
      <Route
        path="/brand/sponsored-votes"
        element={
          <ProtectedRoute>
            <BrandSponsoredVotes />
          </ProtectedRoute>
        }
      />
      <Route
        path="/brand/campaigns/:id"
        element={
          <ProtectedRoute>
            <CampaignDetail />
          </ProtectedRoute>
        }
      />
      <Route
        path="/brand/reports/roi"
        element={
          <ProtectedRoute>
            <BrandROIDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/brand/logo-templates"
        element={
          <ProtectedRoute>
            <BrandLogoTemplates />
          </ProtectedRoute>
        }
      />
      <Route
        path="/brand/billing"
        element={
          <ProtectedRoute>
            <BrandBilling />
          </ProtectedRoute>
        }
      />
      {/* Legacy(구버전) Brand fan-votes 기능 제거: Vote V2(/votes)로 통일 */}
      <Route
        path="/brand/votes"
        element={
          <ProtectedRoute>
            <Navigate to="/votes" replace />
          </ProtectedRoute>
        }
      />
      <Route
        path="/brand/votes/create"
        element={
          <ProtectedRoute>
            <Navigate to="/votes/create" replace />
          </ProtectedRoute>
        }
      />
      <Route
        path="/brand/creative-approvals"
        element={
          <ProtectedRoute>
            <BrandCreativeApprovals />
          </ProtectedRoute>
        }
      />
      <Route
        path="/brand/campaigns/:campaignId/evidence"
        element={
          <ProtectedRoute>
            <BrandEvidence />
          </ProtectedRoute>
        }
      />
      <Route
        path="/brand/campaigns/:campaignId/reports"
        element={
          <ProtectedRoute>
            <BrandReports />
          </ProtectedRoute>
        }
      />
      <Route
        path="/brand/slot-analytics"
        element={
          <ProtectedRoute>
            <BrandSlotAnalytics />
          </ProtectedRoute>
        }
      />
      <Route
        path="/brand/roi-settings"
        element={
          <ProtectedRoute>
            <BrandROISettings />
          </ProtectedRoute>
        }
      />

      {/* Fan Routes */}
      {/* /fan, /votes, /votes/:id 비로그인도 접근 가능 (투표 행위는 컴포넌트에서 로그인 체크) */}
      <Route path="/fan" element={<FanHome />} />
      <Route
        path="/points"
        element={
          <ProtectedRoute>
            <Points />
          </ProtectedRoute>
        }
      />
      <Route
        path="/points/topup"
        element={
          <ProtectedRoute>
            <PointTopup />
          </ProtectedRoute>
        }
      />
      <Route
        path="/ranking"
        element={
          <ProtectedRoute>
            <Ranking />
          </ProtectedRoute>
        }
      />
      <Route
        path="/favorites"
        element={
          <ProtectedRoute>
            <Favorites />
          </ProtectedRoute>
        }
      />
      <Route
        path="/brand-register"
        element={
          <ProtectedRoute>
            <BrandRegister />
          </ProtectedRoute>
        }
      />

      {/* Shop Routes */}
      <Route
        path="/shop"
        element={
          <ProtectedRoute>
            <Shop />
          </ProtectedRoute>
        }
      />
      <Route
        path="/shop/:id"
        element={
          <ProtectedRoute>
            <ShopDetail />
          </ProtectedRoute>
        }
      />
      <Route
        path="/orders"
        element={
          <ProtectedRoute>
            <Orders />
          </ProtectedRoute>
        }
      />
      <Route
        path="/my-donations"
        element={
          <ProtectedRoute>
            <MyDonations />
          </ProtectedRoute>
        }
      />

      {/* 투표 (리워드풀 기반 무료 투표) - 비로그인도 목록/상세 접근 가능 */}
      <Route path="/votes" element={<VotesList />} />
      <Route path="/votes/create" element={<ProtectedRoute><VoteCreate /></ProtectedRoute>} />
      <Route path="/votes/my-created" element={<ProtectedRoute><MyCreatedVotes /></ProtectedRoute>} />
      <Route path="/votes/:id" element={<VotesDetail />} />
      <Route
        path="/seasons/:id/leaderboard"
        element={
          <ProtectedRoute>
            <SeasonLeaderboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/fan/badges"
        element={
          <ProtectedRoute>
            <MyBadges />
          </ProtectedRoute>
        }
      />

      {/* Admin Routes */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/events"
        element={
          <ProtectedRoute>
            <AdminEvents />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/auctions"
        element={
          <ProtectedRoute>
            <AdminAuctions />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/featured-auctions"
        element={
          <ProtectedRoute>
            <AdminFeaturedAuctions />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/slot-templates"
        element={
          <ProtectedRoute>
            <AdminSlotTemplates />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/kyc"
        element={
          <ProtectedRoute>
            <AdminKyc />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/reviews"
        element={
          <ProtectedRoute>
            <AdminReviews />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/settings"
        element={
          <ProtectedRoute>
            <AdminSettings />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/points"
        element={
          <ProtectedRoute>
            <AdminPoints />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/point-withdrawals"
        element={
          <ProtectedRoute>
            <AdminPointWithdrawals />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/creative-approvals"
        element={
          <ProtectedRoute>
            <AdminCreativeApprovals />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/payments"
        element={
          <ProtectedRoute>
            <AdminPayments />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/reports"
        element={
          <ProtectedRoute>
            <AdminReports />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/entities"
        element={
          <ProtectedRoute>
            <AdminEntities />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/entities/:type/:id"
        element={
          <ProtectedRoute>
            <AdminEntityDetail />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/brand-registrations"
        element={
          <ProtectedRoute>
            <AdminBrandRegistrations />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/votes"
        element={
          <ProtectedRoute>
            <AdminVotes />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/fee-policies"
        element={
          <ProtectedRoute>
            <AdminFeePolicies />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/ops"
        element={
          <ProtectedRoute>
            <AdminOps />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/faq"
        element={
          <ProtectedRoute>
            <AdminFaq />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/penalties"
        element={
          <ProtectedRoute>
            <AdminPenalties />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/disputes"
        element={
          <ProtectedRoute>
            <AdminDisputes />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/disputes/:id"
        element={
          <ProtectedRoute>
            <AdminDisputeDetail />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/seasons"
        element={
          <ProtectedRoute>
            <AdminSeasons />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/exposure"
        element={
          <ProtectedRoute>
            <AdminExposure />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/reconciliation"
        element={
          <ProtectedRoute>
            <AdminReconciliation />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/finance/tax-invoices"
        element={
          <ProtectedRoute>
            <AdminTaxInvoices />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/users"
        element={
          <ProtectedRoute>
            <AdminUsers />
          </ProtectedRoute>
        }
      />

      {/* Admin ROI Routes */}
      <Route
        path="/admin/roi/vod"
        element={
          <ProtectedRoute>
            <AdminVodIngest />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/roi/qa"
        element={
          <ProtectedRoute>
            <AdminDetectionQA />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/roi/evidence"
        element={
          <ProtectedRoute>
            <AdminEvidenceManager />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/roi/reports"
        element={
          <ProtectedRoute>
            <AdminReportTemplates />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/roi/campaign-builder"
        element={
          <ProtectedRoute>
            <AdminCampaignBuilder />
          </ProtectedRoute>
        }
      />

      {/* Admin Finance Routes */}
      <Route
        path="/admin/finance"
        element={
          <ProtectedRoute>
            <FinanceDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/finance/escrows"
        element={
          <ProtectedRoute>
            <FinanceEscrows />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/finance/escrows/:id"
        element={
          <ProtectedRoute>
            <FinanceEscrowDetail />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/finance/wallets"
        element={
          <ProtectedRoute>
            <FinanceWallets />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/finance/wallets/:id"
        element={
          <ProtectedRoute>
            <FinanceWalletDetail />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/finance/payouts"
        element={
          <ProtectedRoute>
            <FinancePayouts />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/finance/payouts/:id"
        element={
          <ProtectedRoute>
            <FinancePayoutDetail />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/finance/withdrawals"
        element={
          <ProtectedRoute>
            <FinanceWithdrawals />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/finance/withdrawals/:id"
        element={
          <ProtectedRoute>
            <FinanceWithdrawalDetail />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/finance/withdrawals/batches"
        element={
          <ProtectedRoute>
            <FinanceWithdrawalBatches />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/finance/withdrawals/batches/:id"
        element={
          <ProtectedRoute>
            <FinanceWithdrawalBatchDetail />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/finance/topups"
        element={
          <ProtectedRoute>
            <FinanceTopups />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/finance/point-topups"
        element={
          <ProtectedRoute>
            <FinancePointTopups />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/finance/reports"
        element={
          <ProtectedRoute>
            <FinanceReports />
          </ProtectedRoute>
        }
      />

      {/* ============================================
          Full Funnel Data Reporting (스폰픽 풀 퍼널)
          ============================================ */}
      {/* ADM-01~04 + REP-01 (Admin) */}
      <Route path="/admin/funnel/campaigns" element={<ProtectedRoute><AdminFunnelCampaigns /></ProtectedRoute>} />
      <Route path="/admin/funnel/campaigns/:id" element={<ProtectedRoute><AdminFunnelCampaignDetail /></ProtectedRoute>} />
      <Route path="/admin/funnel/codes-links" element={<ProtectedRoute><AdminPromoCodesLinks /></ProtectedRoute>} />
      <Route path="/admin/funnel/mini-store/:campaignId" element={<ProtectedRoute><AdminMiniStoreSettings /></ProtectedRoute>} />
      <Route path="/admin/funnel/integrated-report" element={<ProtectedRoute><AdminIntegratedROIReport /></ProtectedRoute>} />
      <Route path="/admin/funnel/settlements" element={<ProtectedRoute><AdminPerformanceSettlement /></ProtectedRoute>} />

      {/* BRD-01~03 + Phase 2/3 (Brand) */}
      <Route path="/brand/funnel/dashboard" element={<ProtectedRoute><BrandFunnelDashboard /></ProtectedRoute>} />
      <Route path="/brand/funnel/compare" element={<ProtectedRoute><BrandPerformanceCompare /></ProtectedRoute>} />
      <Route path="/brand/funnel/orders" element={<ProtectedRoute><BrandOrders /></ProtectedRoute>} />
      <Route path="/brand/funnel/pixel" element={<ProtectedRoute><BrandPixelInstall /></ProtectedRoute>} />
      <Route path="/brand/funnel/attribution" element={<ProtectedRoute><BrandAttribution /></ProtectedRoute>} />

      {/* ATH-01 (Athlete) */}
      <Route path="/athlete/funnel/dashboard" element={<ProtectedRoute><AthleteFunnelDashboard /></ProtectedRoute>} />

      {/* STO-01~03 (Public Mini Store) - api_spec TABLE 13: /store/brand/:slug */}
      <Route path="/store/brand/:slug" element={<MiniStoreLanding />} />
      <Route path="/store/brand/:slug/product/:productId" element={<MiniStoreProduct />} />
      <Route path="/store/brand/:slug/checkout" element={<MiniStoreCheckout />} />
      {/* 하위 호환: /store/:slug → /store/brand/:slug */}
      <Route path="/store/:slug" element={<LegacyStoreRedirect />} />
      <Route path="/store/:slug/product/:productId" element={<LegacyStoreRedirect kind="product" />} />
      <Route path="/store/:slug/checkout" element={<LegacyStoreRedirect kind="checkout" />} />

      {/* 단축링크 redirect: /s/:shortCode */}
      <Route path="/s/:shortCode" element={<ShortLinkRedirect />} />

      {/* 공개 선수 둘러보기 */}
      <Route path="/athletes" element={<PublicAthletes />} />
      <Route path="/athletes/:id" element={<PublicAthleteDetail />} />

      {/* 관리자: 선수 경기결과 관리 (docx 3-6) */}
      <Route path="/admin/athletes/event-results" element={<ProtectedRoute><AdminAthleteEventResults /></ProtectedRoute>} />
      {/* 관리자: 대회 활성화 / N값 / 카테고리 (SPONPIK 3-7) */}
      <Route path="/admin/tournament-activation" element={<ProtectedRoute><AdminTournamentActivation /></ProtectedRoute>} />

      {/* Home & Redirect */}
      <Route path="/" element={<HomeRoute />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    <Analytics />
    </>
  );
}

export default App;
