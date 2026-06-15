import { useEffect, useState } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { Inbox, Users, FolderKanban, Settings as SettingsIcon, LogOut, Package, Menu, X, Layers, ChevronDown, ChevronRight, PanelLeftClose, PanelLeftOpen, CalendarClock, LayoutDashboard, ShieldCheck, History, UserCog, Search, Bell } from "lucide-react";
import { useAuth } from "../lib/auth-context";
import { db } from "../lib/firebase";

interface NavItem { name: string; path: string; icon: any; module: string }

const LEAD_ITEMS: NavItem[] = [
  { name: "Dashboard", path: "/", icon: LayoutDashboard, module: "dashboard" },
  { name: "Leads", path: "/leads", icon: Inbox, module: "leads" },
  { name: "Pipeline", path: "/pipeline", icon: Layers, module: "pipeline" },
  { name: "Follow-ups", path: "/followups", icon: CalendarClock, module: "followups" },
  { name: "CRM", path: "/crm", icon: Users, module: "crm" },
  { name: "Settings", path: "/settings", icon: SettingsIcon, module: "settings" },
];

const STANDALONE_ITEMS: NavItem[] = [
  { name: "Projects", path: "/projects", icon: FolderKanban, module: "projects" },
  { name: "Products", path: "/products", icon: Package, module: "products" },
];

const ADMIN_ITEMS = [
  { name: "Roles", path: "/roles", icon: ShieldCheck },
  { name: "Members", path: "/members", icon: UserCog },
  { name: "Activity Log", path: "/activity", icon: History },
];

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { can, isAdmin, member, signOutNow } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [leadsOpen, setLeadsOpen] = useState(true);
  const [adminOpen, setAdminOpen] = useState(true);
  const [search, setSearch] = useState("");
  const [newLeads, setNewLeads] = useState(0);
  const [assignedProjects, setAssignedProjects] = useState(0);

  const closeMenu = () => setIsMobileMenuOpen(false);

  // A member assigned to a project (but without the 'projects' role) still gets
  // a scoped link to it.
  const canReadProjects = can("projects", "read");
  useEffect(() => {
    if (canReadProjects || !member?.uid) { setAssignedProjects(0); return; }
    const q = query(collection(db, "projects"), where("members", "array-contains", member.uid));
    const unsub = onSnapshot(q, (snap) => setAssignedProjects(snap.size), () => setAssignedProjects(0));
    return () => unsub();
  }, [canReadProjects, member?.uid]);

  const leadItems = LEAD_ITEMS.filter((i) => can(i.module, "read"));
  const standalone = STANDALONE_ITEMS.filter((i) =>
    i.module === "projects" ? (canReadProjects || assignedProjects > 0) : can(i.module, "read")
  );
  const isLeadActive = leadItems.some((i) => i.path === location.pathname);
  const isAdminActive = ADMIN_ITEMS.some((i) => i.path === location.pathname);
  const canSeeLeads = can("leads", "read") || can("dashboard", "read") || can("pipeline", "read");

  // New-lead count for the notification bell.
  useEffect(() => {
    if (!canSeeLeads) return;
    const q = query(collection(db, "bookings"), where("status", "==", "new"));
    const unsub = onSnapshot(q, (snap) => setNewLeads(snap.size), () => setNewLeads(0));
    return () => unsub();
  }, [canSeeLeads]);

  const firstName = (member?.name || member?.email || "there").split(" ")[0].split("@")[0];
  const submitSearch = () => {
    const q = search.trim();
    navigate(q ? `/?q=${encodeURIComponent(q)}` : "/");
    closeMenu();
  };

  return (
    <div className="flex flex-col md:flex-row h-screen bg-[#FFFFFF] text-[#17222F] font-['Inter',sans-serif] overflow-hidden">

      {/* Mobile Top Navigation */}
      <div className="md:hidden bg-white border-b-2 border-[#17222F] flex items-center justify-between p-4 z-20 relative">
        <Link to="/" onClick={closeMenu}><img src="/tot2.svg" alt="Logo" className="w-[120px]" /></Link>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="text-[#17222F] p-1 bg-[#F2F2F2] rounded-none border border-[#17222F]">
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {isMobileMenuOpen && <div className="fixed inset-0 bg-[#17222F] bg-opacity-40 backdrop-blur-sm z-30 md:hidden" onClick={closeMenu} />}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-40 bg-white border-r-2 border-[#17222F] flex flex-col transform transition-all duration-300 ease-in-out md:relative md:translate-x-0 ${
        isMobileMenuOpen ? "translate-x-0 w-64" : "-translate-x-full"
      } ${isCollapsed ? "md:w-20" : "md:w-64"}`}>

        {/* Logo Header */}
        <div className={`hidden md:flex p-6 border-b-2 border-[#17222F] overflow-hidden whitespace-nowrap h-[80px] items-center ${isCollapsed ? 'justify-center px-0' : ''}`}>
          {isCollapsed ? (
            <div className="w-10 h-10 bg-[#17222F] rounded-none flex items-center justify-center text-white font-black text-xl">T</div>
          ) : (
            <Link to="/" className="flex items-center gap-2.5">
              <img src="/tot2.svg" alt="Logo" className="w-[130px]" />
            </Link>
          )}
        </div>

        {/* Navigation */}
        <nav className={`flex-1 p-3 space-y-1.5 ${isCollapsed ? "overflow-visible" : "overflow-y-auto overflow-x-hidden"}`}>
          {!isCollapsed && <div className="px-3 pt-2 pb-1 font-mono text-[10.5px] uppercase tracking-[0.16em] text-[#9AA0AD]">Workspace</div>}

          {leadItems.length > 0 && (
            <NavGroup label="Lead Management" icon={Inbox} items={leadItems} isCollapsed={isCollapsed}
              open={leadsOpen} setOpen={setLeadsOpen} active={isLeadActive} pathname={location.pathname}
              closeMenu={closeMenu} expand={() => setIsCollapsed(false)} />
          )}

          {standalone.map((item) => <NavLink key={item.name} item={item} active={location.pathname === item.path} isCollapsed={isCollapsed} onClick={closeMenu} />)}

          {isAdmin && (
            <>
              {!isCollapsed && <div className="px-3 pt-4 pb-1 font-mono text-[10.5px] uppercase tracking-[0.16em] text-[#9AA0AD]">Administration</div>}
              <NavGroup label="Administration" icon={ShieldCheck} items={ADMIN_ITEMS.map((i) => ({ ...i, module: "" }))} isCollapsed={isCollapsed}
                open={adminOpen} setOpen={setAdminOpen} active={isAdminActive} pathname={location.pathname}
                closeMenu={closeMenu} expand={() => setIsCollapsed(false)} />
            </>
          )}
        </nav>

        {/* Footer: profile + sign out */}
        <div className="p-3 border-t-2 border-[#17222F] space-y-1.5">
          <Link to="/profile" onClick={closeMenu} className={`flex items-center gap-3 rounded-none transition-colors group/item relative ${
            location.pathname === "/profile" ? "bg-white border border-[#17222F]" : "hover:bg-[#F2F2F2]"
          } ${isCollapsed ? "justify-center p-2" : "p-2"}`}>
            <Avatar member={member} />
            {!isCollapsed && (
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-[13.5px] text-[#17222F] truncate">{member?.name || member?.email}</div>
                <div className="font-mono text-[11px] text-[#9AA0AD] truncate">{member?.roleName || (isAdmin ? "Administrator" : "View profile")}</div>
              </div>
            )}
            {isCollapsed && <Tooltip label="Your profile" />}
          </Link>

          <button onClick={signOutNow} className="flex items-center gap-3 px-3 py-2.5 w-full rounded-none text-[#E5322B] hover:bg-[#FBE9E7] transition-colors group/item relative justify-center md:justify-start">
            <LogOut size={18} />
            {!isCollapsed && <span className="font-semibold text-[14px]">Sign Out</span>}
            {isCollapsed && <Tooltip label="Sign Out" />}
          </button>

          <button onClick={() => setIsCollapsed(!isCollapsed)} className="hidden md:flex items-center justify-center w-full pt-2.5 border-t border-[#E6E6E6] text-[#9AA0AD] hover:text-[#17222F] transition-colors">
            {isCollapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
          </button>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Global top bar */}
        <header className="hidden md:flex items-center justify-between gap-4 px-8 lg:px-10 h-[80px] shrink-0 bg-white border-b-2 border-[#17222F]">
          <div className="min-w-0">
            <h2 className="text-[19px] font-bold text-[#17222F] leading-tight truncate">Welcome back, {firstName} <span className="inline-block">👋</span></h2>
            <p className="text-[13.5px] text-[#9AA0AD] truncate">Here's what's happening across your workspace.</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {canSeeLeads && (
              <div className="relative hidden lg:block">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9AA0AD]" />
                <input
                  value={search} onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") submitSearch(); }}
                  placeholder="Search leads…"
                  className="w-64 xl:w-80 pl-10 pr-3 py-2.5 rounded-none border border-[#17222F] bg-white text-[14px] text-[#17222F] focus:border-[#E5322B] outline-none"
                />
              </div>
            )}
            {canSeeLeads && (
              <Link to="/leads" className="relative w-11 h-11 rounded-none bg-white border border-[#17222F] flex items-center justify-center text-[#5A6473] hover:text-[#17222F] hover:border-[#17222F] transition-colors" title={`${newLeads} new lead${newLeads === 1 ? "" : "s"}`}>
                <Bell size={18} />
                {newLeads > 0 && <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 bg-[#E5322B] text-white text-[10px] font-bold rounded-none flex items-center justify-center">{newLeads > 9 ? "9+" : newLeads}</span>}
              </Link>
            )}
            <Link to="/profile" className="shrink-0"><Avatar member={member} size={44} /></Link>
          </div>
        </header>

        {/* Routed page content */}
        <main className="flex-1 overflow-auto">
          <div className="p-5 md:p-8 lg:p-10 max-w-[1400px] mx-auto pb-24 md:pb-10">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

function Avatar({ member, size = 36 }: { member: any; size?: number }) {
  const [err, setErr] = useState(false);
  const initial = (member?.name || member?.email || "?").charAt(0).toUpperCase();
  if (member?.photoURL && !err) {
    return <img src={member.photoURL} onError={() => setErr(true)} alt="" className="rounded-none object-cover border border-[#17222F] shrink-0" style={{ width: size, height: size }} />;
  }
  return <div className="rounded-none bg-[#17222F] text-white flex items-center justify-center font-semibold shrink-0" style={{ width: size, height: size, fontSize: size * 0.4 }}>{initial}</div>;
}

function Tooltip({ label }: { label: string }) {
  return (
    <div className="absolute left-full ml-3 px-3 py-1.5 bg-[#17222F] text-white text-[13px] font-medium rounded-none opacity-0 invisible group-hover/item:opacity-100 group-hover/item:visible transition-all pointer-events-none z-50 whitespace-nowrap">
      {label}
    </div>
  );
}

// Elevated white active item with a coral left accent — the Knowvio look.
function NavLink({ item, active, isCollapsed, onClick }: { item: { name: string; path: string; icon: any }; active: boolean; isCollapsed: boolean; onClick: () => void }) {
  return (
    <Link to={item.path} onClick={onClick} className={`relative flex items-center gap-3 px-3 py-2.5 rounded-none transition-all group/item ${
      active ? "bg-white border border-[#17222F] text-[#17222F] font-semibold" : "text-[#5A6473] hover:bg-[#F2F2F2] hover:text-[#17222F] font-medium"
    }`}>
      {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-none bg-[#E5322B]" />}
      <item.icon size={18} strokeWidth={active ? 2.4 : 2} />
      {!isCollapsed && <span className="text-[13px] uppercase tracking-[0.06em]">{item.name}</span>}
      {isCollapsed && <Tooltip label={item.name} />}
    </Link>
  );
}

function NavGroup({ label, icon: Icon, items, isCollapsed, open, setOpen, active, pathname, closeMenu, expand }: {
  label: string; icon: any; items: { name: string; path: string; icon: any }[]; isCollapsed: boolean;
  open: boolean; setOpen: (v: boolean) => void; active: boolean; pathname: string; closeMenu: () => void; expand: () => void;
}) {
  return (
    <div className="relative group/grp">
      <button
        onClick={() => { if (isCollapsed) { expand(); setOpen(true); } else setOpen(!open); }}
        className={`flex items-center justify-between w-full px-3 py-2.5 rounded-none transition-colors ${active && !open ? "bg-[#F2F2F2] text-[#17222F]" : "text-[#5A6473] hover:bg-[#F2F2F2] hover:text-[#17222F]"}`}
      >
        <div className="flex items-center gap-3">
          <Icon size={18} strokeWidth={active ? 2.4 : 2} />
          {!isCollapsed && <span className="font-bold text-[13px] uppercase tracking-[0.06em] whitespace-nowrap">{label}</span>}
        </div>
        {!isCollapsed && (open ? <ChevronDown size={16} /> : <ChevronRight size={16} />)}
      </button>

      {!isCollapsed && open && (
        <div className="mt-1 space-y-1">
          {items.map((sub) => {
            const a = pathname === sub.path;
            return (
              <Link key={sub.name} to={sub.path} onClick={closeMenu} className={`relative flex items-center gap-3 pl-9 pr-3 py-2.5 rounded-none transition-all ${
                a ? "bg-white border border-[#17222F] text-[#17222F] font-semibold" : "text-[#5A6473] hover:text-[#17222F] hover:bg-[#F2F2F2] font-medium"
              }`}>
                {a && <span className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-none bg-[#E5322B]" />}
                <sub.icon size={16} />
                <span className="text-[12.5px] uppercase tracking-[0.05em]">{sub.name}</span>
              </Link>
            );
          })}
        </div>
      )}

      {/* Collapsed flyout */}
      {isCollapsed && (
        <div className="absolute left-full top-0 ml-3 w-52 bg-white border border-[#17222F] rounded-none p-2 opacity-0 invisible group-hover/grp:opacity-100 group-hover/grp:visible transition-all z-50">
          <div className="px-3 py-2 font-mono text-[11px] text-[#9AA0AD] uppercase tracking-[0.14em]">{label}</div>
          {items.map((sub) => (
            <Link key={sub.name} to={sub.path} onClick={closeMenu} className={`flex items-center gap-3 px-3 py-2.5 rounded-none transition-all ${
              pathname === sub.path ? "bg-[#17222F] text-white" : "text-[#5A6473] hover:bg-[#F2F2F2] hover:text-[#17222F]"
            }`}>
              <sub.icon size={16} />
              <span className="font-medium text-[14px]">{sub.name}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
