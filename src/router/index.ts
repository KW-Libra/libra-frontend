import { createRouter, createWebHistory, type RouteRecordRaw } from "vue-router";

import { useAuth } from "../composables/useAuth";
import AuthCallbackPage from "../pages/AuthCallbackPage.vue";
import DashboardPage from "../pages/DashboardPage.vue";
import DecisionTracePage from "../pages/DecisionTracePage.vue";
import AgentsPage from "../pages/AgentsPage.vue";
import HistoryPage from "../pages/HistoryPage.vue";
import IndexingPage from "../pages/IndexingPage.vue";
import LandingPage from "../pages/LandingPage.vue";
import LoginPage from "../pages/LoginPage.vue";
import NewsPage from "../pages/NewsPage.vue";
import OnboardingPage from "../pages/OnboardingPage.vue";
import PlaceholderPage from "../pages/PlaceholderPage.vue";
import ProfilePage from "../pages/ProfilePage.vue";
import SignupPage from "../pages/SignupPage.vue";
import SymbolDetailPage from "../pages/SymbolDetailPage.vue";

export type NavItem = {
  path: string;
  glyph: string;
  label: string;
  meta: { title: string; eyebrow: string };
};

export const navItems: NavItem[] = [
  { path: "/dashboard", glyph: "◈", label: "대시보드", meta: { title: "포트폴리오", eyebrow: "Portfolio" } },
  { path: "/onboarding", glyph: "◇", label: "초기 설정", meta: { title: "초기 설정", eyebrow: "Setup" } },
  { path: "/decision", glyph: "◬", label: "판단 과정", meta: { title: "판단 과정", eyebrow: "Decision Trace" } },
  { path: "/agents", glyph: "◉", label: "통합 현황", meta: { title: "통합 현황", eyebrow: "Team Modules" } },
  { path: "/indexing", glyph: "◫", label: "목표 비중", meta: { title: "목표 비중", eyebrow: "Target Portfolio" } },
  { path: "/news", glyph: "◭", label: "시장 신호", meta: { title: "시장 신호", eyebrow: "Market Signals" } },
  { path: "/history", glyph: "◷", label: "결정 이력", meta: { title: "결정 이력", eyebrow: "Decision Memory" } },
  { path: "/profile", glyph: "◯", label: "KIS 설정", meta: { title: "KIS 설정", eyebrow: "Brokerage" } },
];

const routes: RouteRecordRaw[] = [
  { path: "/", component: LandingPage, meta: { layout: "public", title: "LIBRA", eyebrow: "" } },
  { path: "/login", component: LoginPage, meta: { layout: "auth", title: "로그인", eyebrow: "Login" } },
  { path: "/signup", component: SignupPage, meta: { layout: "auth", title: "회원가입", eyebrow: "Signup" } },
  { path: "/auth/callback", component: AuthCallbackPage, meta: { layout: "auth", title: "Authenticating", eyebrow: "Auth" } },
  { path: "/dashboard", component: DashboardPage, meta: { ...navItems[0].meta, requiresAuth: true } },
  { path: "/onboarding", component: OnboardingPage, meta: { ...navItems[1].meta, requiresAuth: true } },
  { path: "/decision", component: DecisionTracePage, meta: { ...navItems[2].meta, requiresAuth: true } },
  { path: "/agents", component: AgentsPage, meta: { ...navItems[3].meta, requiresAuth: true } },
  { path: "/indexing", component: IndexingPage, meta: { ...navItems[4].meta, requiresAuth: true } },
  { path: "/news", component: NewsPage, meta: { ...navItems[5].meta, requiresAuth: true } },
  { path: "/history", component: HistoryPage, meta: { ...navItems[6].meta, requiresAuth: true } },
  { path: "/profile", component: ProfilePage, meta: { ...navItems[7].meta, requiresAuth: true } },
  { path: "/symbol/:ticker", component: SymbolDetailPage, meta: { title: "종목 상세", eyebrow: "KIS Symbol", requiresAuth: true } },
  { path: "/:pathMatch(.*)*", redirect: "/" },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach(async (to) => {
  const { ready, bootstrap, isAuthenticated } = useAuth();
  if (!ready.value) {
    await bootstrap();
  }

  const requiresAuth = Boolean(to.meta.requiresAuth);
  if (requiresAuth && !isAuthenticated.value) {
    return { path: "/login", query: { redirect: to.fullPath } };
  }
  if ((to.path === "/login" || to.path === "/signup") && isAuthenticated.value) {
    return { path: "/dashboard" };
  }
  return true;
});
