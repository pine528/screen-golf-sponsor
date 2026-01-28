import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Hexagon } from 'lucide-react';
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
import { AdminKyc } from './pages/admin/AdminKyc';
import { AdminReviews } from './pages/admin/AdminReviews';
import { AdminSettings } from './pages/admin/AdminSettings';
import AdminVoteEvents from './pages/admin/AdminVoteEvents';
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
import BrandVotes from './pages/brand/BrandVotes';
import BrandVoteCreate from './pages/brand/BrandVoteCreate';
import { FanHome, FanLogin, FanRegister, Votes, VoteDetail, FanVoteDetail, Points, Ranking, Favorites, BrandRegister, Shop, ShopDetail, Orders } from './pages/fan';
import { AgencyDashboard, AgencyAthleteRegister, AgencyAthletes, AgencyAthleteSearch, AgencySentRequests } from './pages/agency';
import { AthleteAgencyRequests } from './pages/athlete/AthleteAgencyRequests';
import FanVoteCreate from './pages/fan/FanVoteCreate';
import MyFanVotes from './pages/fan/MyFanVotes';
import PointTopup from './pages/PointTopup';
import FanVoteResult from './pages/fan/FanVoteResult';
import MyDonations from './pages/fan/MyDonations';
import SeasonLeaderboard from './pages/fan/SeasonLeaderboard';
import MyBadges from './pages/fan/MyBadges';
import { AdminBrandRegistrations } from './pages/admin/AdminBrandRegistrations';
import AdminOps from './pages/admin/AdminOps';
import AdminFanVotes from './pages/admin/AdminFanVotes';
import AdminFanVoteSettle from './pages/admin/AdminFanVoteSettle';
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
        path="/brand/billing"
        element={
          <ProtectedRoute>
            <BrandBilling />
          </ProtectedRoute>
        }
      />
      <Route
        path="/brand/votes"
        element={
          <ProtectedRoute>
            <BrandVotes />
          </ProtectedRoute>
        }
      />
      <Route
        path="/brand/votes/create"
        element={
          <ProtectedRoute>
            <BrandVoteCreate />
          </ProtectedRoute>
        }
      />

      {/* Fan Routes */}
      {/* /fan, /votes, /votes/:id 비로그인도 접근 가능 (투표 행위는 컴포넌트에서 로그인 체크) */}
      <Route path="/fan" element={<FanHome />} />
      <Route path="/votes" element={<Votes />} />
      <Route path="/votes/:id" element={<VoteDetail />} />
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

      {/* Fan Votes Routes */}
      <Route
        path="/fan-votes/create"
        element={
          <ProtectedRoute>
            <FanVoteCreate />
          </ProtectedRoute>
        }
      />
      <Route
        path="/fan-votes/my"
        element={
          <ProtectedRoute>
            <MyFanVotes />
          </ProtectedRoute>
        }
      />
      {/* /fan-votes/:id, /fan-votes/:id/result 비로그인도 접근 가능 (투표 행위는 컴포넌트에서 로그인 체크) */}
      <Route path="/fan-votes/:id" element={<FanVoteDetail />} />
      <Route path="/fan-votes/:id/result" element={<FanVoteResult />} />
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
        path="/admin/votes"
        element={
          <ProtectedRoute>
            <AdminVoteEvents />
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
        path="/admin/fan-votes"
        element={
          <ProtectedRoute>
            <AdminFanVotes />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/fan-votes/:id"
        element={
          <ProtectedRoute>
            <AdminFanVoteSettle />
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
        path="/admin/finance/reports"
        element={
          <ProtectedRoute>
            <FinanceReports />
          </ProtectedRoute>
        }
      />

      {/* Home & Redirect */}
      <Route path="/" element={<HomeRoute />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
