import { BetaBanner } from "@/components/layout/BetaBanner";
import { ViewBeacon } from "@/components/analytics/ViewBeacon";
import { TopNav } from "@/components/layout/TopNav";
import { Footer } from "@/components/layout/Footer";
import { currentUser } from "@/lib/session";
import { getSitePolicy } from "@/lib/site-settings";
import { showAuthEntry, showCommunityNav } from "@/lib/site-policy";

/** 세션과 사이트 정책을 여기서 한 번만 읽어 내려보낸다. */
export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const [user, policy] = await Promise.all([currentUser(), getSitePolicy()]);

  return (
    <div className="min-h-screen flex flex-col">
      <BetaBanner />
      <TopNav
        user={user && { name: user.name, email: user.email, role: user.role }}
        showCommunity={showCommunityNav(policy)}
        showAuth={showAuthEntry(policy)}
      />
      <main className="flex-1">{children}</main>
      <Footer showCommunity={showCommunityNav(policy)} />
      {/* 조회 집계 — 쿠키·IP 없이 (경로, 날짜, 합계)만 센다 */}
      <ViewBeacon />
    </div>
  );
}
