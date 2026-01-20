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
import { AdminKyc } from './pages/admin/AdminKyc';
import { AdminReviews } from './pages/admin/AdminReviews';
import { AdminSettings } from './pages/admin/AdminSettings';
import AdminVoteEvents from './pages/admin/AdminVoteEvents';
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
} from './pages/admin/finance';
import AthleteWithdrawals from './pages/athlete/Withdrawals';
import AthletePendingSignatures from './pages/athlete/PendingSignatures';
import FinanceReports from './pages/admin/reports/ReportsDashboard';
import BrandCampaigns from './pages/brand/Campaigns';
import CampaignDetail from './pages/brand/CampaignDetail';
import BrandWallet from './pages/brand/BrandWallet';
import BrandSponsoredVotes from './pages/brand/BrandSponsoredVotes';
import BrandROIDashboard from './pages/brand/BrandROIDashboard';
import { FanHome, FanLogin, FanRegister, Votes, VoteDetail, Points, Ranking, Favorites, BrandRegister, Shop, ShopDetail, Orders } from './pages/fan';
import FanVoteCreate from './pages/fan/FanVoteCreate';
import MyFanVotes from './pages/fan/MyFanVotes';
import FanVoteResult from './pages/fan/FanVoteResult';
import SeasonLeaderboard from './pages/fan/SeasonLeaderboard';
import MyBadges from './pages/fan/MyBadges';
import { AdminBrandRegistrations } from './pages/admin/AdminBrandRegistrations';
import AdminOps from './pages/admin/AdminOps';
import AdminFanVotes from './pages/admin/AdminFanVotes';
import AdminFanVoteSettle from './pages/admin/AdminFanVoteSettle';
import AdminFaq from './pages/admin/AdminFaq';
import AdminPenalties from './pages/admin/AdminPenalties';
import AdminDisputes from './pages/admin/AdminDisputes';
import AdminDisputeDetail from './pages/admin/AdminDisputeDetail';
import AdminSeasons from './pages/admin/AdminSeasons';
import AdminExposure from './pages/admin/AdminExposure';
import Faq from './pages/Faq';
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
      <Route
        path="/auctions"
        element={
          <ProtectedRoute>
            <Auctions />
          </ProtectedRoute>
        }
      />
      <Route
        path="/auctions/:id"
        element={
          <ProtectedRoute>
            <AuctionDetail />
          </ProtectedRoute>
        }
      />
      <Route
        path="/inventory"
        element={
          <ProtectedRoute>
            <Inventory />
          </ProtectedRoute>
        }
      />
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
        path="/campaigns"
        element={
          <ProtectedRoute>
            <BrandCampaigns />
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

      {/* Fan Routes */}
      <Route
        path="/fan"
        element={
          <ProtectedRoute>
            <FanHome />
          </ProtectedRoute>
        }
      />
      <Route
        path="/votes"
        element={
          <ProtectedRoute>
            <Votes />
          </ProtectedRoute>
        }
      />
      <Route
        path="/votes/:id"
        element={
          <ProtectedRoute>
            <VoteDetail />
          </ProtectedRoute>
        }
      />
      <Route
        path="/points"
        element={
          <ProtectedRoute>
            <Points />
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
      <Route
        path="/fan-votes/:id/result"
        element={
          <ProtectedRoute>
            <FanVoteResult />
          </ProtectedRoute>
        }
      />
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
