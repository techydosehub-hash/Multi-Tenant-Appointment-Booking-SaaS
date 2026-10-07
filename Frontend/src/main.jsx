import React, { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Outlet,
  NavLink,
  Link,
} from "react-router-dom";
import {
  LayoutDashboard,
  CalendarDays,
  BookOpen,
  Users,
  Scissors,
  Settings,
  CreditCard,
  LogOut,
  ArrowUpRight,
  Bell,
  UserRound,
} from "lucide-react";
import { AppProvider, useApp } from "./context";
import { supabase } from "./lib";
import { Brand, Loading, ErrorBox } from "./ui";
import "./styles.css";
import DemoExperience from "./DemoExperience";
const page = (loader, name) =>
  lazy(() => loader().then((module) => ({ default: module[name] })));
const Landing = page(() => import("./pages/Public"), "Landing");
const Auth = page(() => import("./pages/Public"), "Auth");
const Onboarding = page(() => import("./pages/Public"), "Onboarding");
const ResetPassword = page(() => import("./pages/Public"), "ResetPassword");
const AuthCallback = page(() => import("./pages/Public"), "AuthCallback");
const Booking = lazy(() => import("./pages/Booking"));
const Overview = page(() => import("./pages/Bookings"), "Overview");
const Bookings = page(() => import("./pages/Bookings"), "Bookings");
const Calendar = page(() => import("./pages/Bookings"), "Calendar");
const BookingDetail = page(() => import("./pages/Bookings"), "BookingDetail");
const Clients = page(() => import("./pages/Clients"), "Clients");
const ClientDetail = page(() => import("./pages/Clients"), "ClientDetail");
const Services = page(() => import("./pages/Settings"), "Services");
const Providers = page(() => import("./pages/Settings"), "Providers");
const SettingsPage = page(() => import("./pages/Settings"), "SettingsPage");
const Schedule = page(() => import("./pages/Settings"), "Schedule");
const Notifications = page(() => import("./pages/Settings"), "Notifications");
const Billing = lazy(() => import("./pages/Billing"));
const Profile = lazy(() => import("./pages/Profile"));
const links = [
  ["", "Overview", LayoutDashboard],
  ["calendar", "Calendar", CalendarDays],
  ["bookings", "Bookings", BookOpen],
  ["clients", "Clients", Users],
  ["services", "Services", Scissors],
  ["providers", "Providers", Users],
  ["schedule", "Availability", CalendarDays],
  ["notifications", "Notifications", Bell],
  ["settings", "Settings", Settings],
  ["billing", "Billing", CreditCard],
  ["profile", "My profile", UserRound],
];
function Portal() {
  const {
    session,
    loading,
    business,
    businessId,
    setBusinessId,
    memberships,
    error,
    refresh,
    profile,
    role,
  } = useApp();
  if (loading) return <Loading />;
  if (!session) return <Navigate to="/login" replace />;
  if (error)
    return (
      <div className="narrow">
        <ErrorBox error={error} />
        <button className="btn" onClick={refresh}>
          Retry connection
        </button>
        <button className="btn subtle" onClick={() => supabase.auth.signOut()}>
          Sign out
        </button>
      </div>
    );
  if (!business) return <Onboarding />;
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Brand />
        <div className="workspace-label">WORKSPACE</div>
        <select
          className="business-switch"
          aria-label="Select business"
          value={businessId}
          onChange={(e) => setBusinessId(e.target.value)}
        >
          {memberships.map((m) => (
            <option key={m.business_id} value={m.business_id}>
              {m.businesses.name}
            </option>
          ))}
        </select>
        <nav>
          {links.map(([path, label, Icon]) => (
            <NavLink
              data-tour={path || "overview"}
              key={path}
              end={!path}
              to={`/dashboard${path ? "/" + path : ""}`}
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <Link to="/onboarding" className="quiet-link">
            + Add another business
          </Link>
          <a
            href={`/booking/${business.slug}`}
            target="_blank"
            rel="noreferrer"
            className="public-link"
          >
            Your booking page <ArrowUpRight size={16} />
          </a>
          <button className="signout" onClick={() => supabase.auth.signOut()}>
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <span>
            <span className="live-dot" />
            {business.name}
          </span>
          <span>
            {business.timezone}{" "}
            <Link
              to="/dashboard/profile"
              className="account-link"
              aria-label="Open your profile"
            >
              <span className="account-name">
                {profile?.full_name || session.user.email?.split("@")[0]}
                <small>{role === "owner" ? "Owner" : "Admin"}</small>
              </span>
              <span className="avatar">
                {(profile?.full_name || session.user.email)?.[0]?.toUpperCase()}
              </span>
            </Link>
          </span>
        </header>
        <main key={businessId}>
          <Outlet />
        </main>
        <footer className="app-footer">
          A little more order. A lot more possibility.
          <span>Steadly © {new Date().getFullYear()}</span>
        </footer>
      </div>
    </div>
  );
}
class ErrorBoundary extends React.Component {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <div className="narrow">
        <h1>Something went wrong</h1>
        <p>Please reload the page to continue.</p>
        <button className="btn" onClick={() => location.reload()}>
          Reload
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}
createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AppProvider>
          <DemoExperience />
          <Suspense fallback={<Loading />}>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Auth />} />
              <Route path="/signup" element={<Auth signup />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route path="/onboarding" element={<Onboarding />} />
              <Route path="/booking/:slug" element={<Booking />} />
              <Route path="/dashboard" element={<Portal />}>
                <Route index element={<Overview />} />
                <Route path="calendar" element={<Calendar />} />
                <Route path="bookings" element={<Bookings />} />
                <Route path="bookings/:id" element={<BookingDetail />} />
                <Route path="clients" element={<Clients />} />
                <Route path="clients/:id" element={<ClientDetail />} />
                <Route path="services" element={<Services />} />
                <Route path="providers" element={<Providers />} />
                <Route path="schedule" element={<Schedule />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="notifications" element={<Notifications />} />
                <Route path="billing" element={<Billing />} />
                <Route path="profile" element={<Profile />} />
              </Route>
              <Route
                path="*"
                element={
                  <div className="narrow">
                    <h1>Page not found</h1>
                    <Link className="btn" to="/">
                      Back to home
                    </Link>
                  </div>
                }
              />
            </Routes>
          </Suspense>
        </AppProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>,
);
