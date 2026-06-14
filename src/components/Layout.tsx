import { useState } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { Inbox, Users, FolderKanban, Settings as SettingsIcon, LogOut, Package, Menu, X, Layers, ChevronDown, ChevronRight, PanelLeftClose, PanelLeftOpen, CalendarClock, LayoutDashboard, ShieldCheck, History, UserCog } from "lucide-react";
import { useAuth } from "../lib/auth-context";

interface NavItem { name: string; path: string; icon: any; module: string }

// "Lead Management" module — each item is gated by its read permission.
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

// Admin-only module (shown when the member's role is an Administrator).
const ADMIN_ITEMS = [
  { name: "Roles", path: "/roles", icon: ShieldCheck },
  { name: "Members", path: "/members", icon: UserCog },
  { name: "Activity Log", path: "/activity", icon: History },
];

export default function Layout() {
  const location = useLocation();
  const { can, isAdmin, member, signOutNow } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [leadsOpen, setLeadsOpen] = useState(true);
  const [adminOpen, setAdminOpen] = useState(true);

  const closeMenu = () => setIsMobileMenuOpen(false);

  const leadItems = LEAD_ITEMS.filter((i) => can(i.module, "read"));
  const standalone = STANDALONE_ITEMS.filter((i) => can(i.module, "read"));
  const isLeadActive = leadItems.some((i) => i.path === location.pathname);
  const isAdminActive = ADMIN_ITEMS.some((i) => i.path === location.pathname);

  return (
    <div className="flex flex-col md:flex-row h-screen bg-[#FCFBF8] text-[#13182B] font-['Poppins',sans-serif] overflow-hidden">

      {/* Mobile Top Navigation */}
      <div className="md:hidden bg-[#FFFFFF] border-b border-[#E5E2D9] flex items-center justify-between p-4 z-20 relative">
        <Link to="/" onClick={closeMenu}><img src="/logo.png" alt="Logo" className="w-[120px]" /></Link>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="text-[#13182B] p-1 bg-[#F4F2EC] rounded-lg border border-[#E5E2D9]">
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {isMobileMenuOpen && <div className="fixed inset-0 bg-[#13182B] bg-opacity-40 backdrop-blur-sm z-30 md:hidden" onClick={closeMenu} />}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-40 bg-[#FFFFFF] border-r border-[#E5E2D9] flex flex-col transform transition-all duration-300 ease-in-out md:relative md:translate-x-0 ${
        isMobileMenuOpen ? "translate-x-0 w-64" : "-translate-x-full"
      } ${isCollapsed ? "md:w-20" : "md:w-64"}`}>

        {/* Logo Header */}
        <div className={`hidden md:flex p-6 border-b border-[#E5E2D9] overflow-hidden whitespace-nowrap h-[88px] items-center ${isCollapsed ? 'justify-center px-0' : ''}`}>
          {isCollapsed ? (
            <div className="w-10 h-10 bg-[#13182B] rounded-xl flex items-center justify-center text-white font-bold text-xl">O</div>
          ) : (
            <div>
              <Link to="/"><img src="/logo.png" alt="Logo" className="w-[140px]" /></Link>
              <div className="mt-2 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#FF5C49] animate-pulse" />
                <p className="text-[11px] text-[#9AA0AD] font-mono tracking-[0.16em] uppercase font-medium">Operations</p>
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className={`flex-1 p-4 space-y-2 ${isCollapsed ? "overflow-visible" : "overflow-y-auto overflow-x-hidden"}`}>

          {/* Lead Management group */}
          {leadItems.length > 0 && (
            <NavGroup
              label="Lead Management" icon={Inbox} items={leadItems} isCollapsed={isCollapsed}
              open={leadsOpen} setOpen={setLeadsOpen} active={isLeadActive} pathname={location.pathname}
              closeMenu={closeMenu} expand={() => setIsCollapsed(false)}
            />
          )}

          {/* Standalone links */}
          {standalone.map((item) => (
            <Link key={item.name} to={item.path} onClick={closeMenu} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all relative group/item ${
              location.pathname === item.path ? "bg-[#13182B] text-white shadow-md" : "text-[#6B7283] hover:bg-[#F4F2EC] hover:text-[#13182B]"
            }`}>
              <item.icon size={18} strokeWidth={location.pathname === item.path ? 2.5 : 2} />
              {!isCollapsed && <span className="font-semibold text-[14.5px]">{item.name}</span>}
              {isCollapsed && <Tooltip label={item.name} />}
            </Link>
          ))}

          {/* Administration group (admins only) */}
          {isAdmin && (
            <NavGroup
              label="Administration" icon={ShieldCheck} items={ADMIN_ITEMS.map((i) => ({ ...i, module: "" }))} isCollapsed={isCollapsed}
              open={adminOpen} setOpen={setAdminOpen} active={isAdminActive} pathname={location.pathname}
              closeMenu={closeMenu} expand={() => setIsCollapsed(false)}
            />
          )}
        </nav>

        {/* Footer: current member + sign out */}
        <div className="p-4 border-t border-[#E5E2D9] space-y-2">
          {member && !isCollapsed && (
            <div className="flex items-center gap-3 px-2 py-1.5">
              <div className="w-9 h-9 rounded-full bg-[#13182B] text-white flex items-center justify-center font-semibold text-[14px] shrink-0">{(member.name || member.email || "?").charAt(0).toUpperCase()}</div>
              <div className="min-w-0">
                <div className="font-semibold text-[13.5px] text-[#13182B] truncate">{member.name || member.email}</div>
                <div className="font-mono text-[11px] text-[#9AA0AD] truncate">{member.roleName || (isAdmin ? "Administrator" : "No role")}</div>
              </div>
            </div>
          )}

          <button onClick={signOutNow} className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-[#FF5C49] hover:bg-[#FFEDE9] transition-colors group/item relative justify-center md:justify-start">
            <LogOut size={18} />
            {!isCollapsed && <span className="font-semibold text-[14.5px]">Sign Out</span>}
            {isCollapsed && <Tooltip label="Sign Out" />}
          </button>

          <button onClick={() => setIsCollapsed(!isCollapsed)} className="hidden md:flex items-center justify-center w-full mt-1 pt-3 border-t border-[#E5E2D9] text-[#9AA0AD] hover:text-[#13182B] transition-colors">
            {isCollapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-auto w-full relative">
        <div className="p-5 md:p-10 max-w-7xl mx-auto pb-24 md:pb-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function Tooltip({ label }: { label: string }) {
  return (
    <div className="absolute left-full ml-3 px-3 py-1.5 bg-[#13182B] text-white text-[13px] font-medium rounded-lg opacity-0 invisible group-hover/item:opacity-100 group-hover/item:visible transition-all pointer-events-none z-50 whitespace-nowrap shadow-lg">
      {label}
    </div>
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
        className={`flex items-center justify-between w-full px-4 py-3 rounded-xl transition-colors ${active ? "bg-[#F4F2EC] text-[#13182B]" : "text-[#6B7283] hover:bg-[#F4F2EC] hover:text-[#13182B]"}`}
      >
        <div className="flex items-center gap-3">
          <Icon size={18} strokeWidth={active ? 2.5 : 2} />
          {!isCollapsed && <span className="font-semibold text-[14.5px] whitespace-nowrap">{label}</span>}
        </div>
        {!isCollapsed && (open ? <ChevronDown size={16} /> : <ChevronRight size={16} />)}
      </button>

      {!isCollapsed && open && (
        <div className="pl-4 space-y-1 mt-1 border-l-2 border-[#F4F2EC] ml-6">
          {items.map((sub) => (
            <Link key={sub.name} to={sub.path} onClick={closeMenu} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all ${
              pathname === sub.path ? "bg-[#13182B] text-white shadow-md" : "text-[#6B7283] hover:text-[#13182B] hover:bg-[#F4F2EC]"
            }`}>
              <sub.icon size={16} />
              <span className="font-medium text-[14px]">{sub.name}</span>
            </Link>
          ))}
        </div>
      )}

      {/* Collapsed flyout */}
      {isCollapsed && (
        <div className="absolute left-full top-0 ml-3 w-52 bg-white border border-[#E5E2D9] rounded-xl shadow-xl p-2 opacity-0 invisible group-hover/grp:opacity-100 group-hover/grp:visible transition-all z-50">
          <div className="px-3 py-2 font-mono text-[11px] text-[#9AA0AD] uppercase tracking-[0.14em]">{label}</div>
          {items.map((sub) => (
            <Link key={sub.name} to={sub.path} onClick={closeMenu} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
              pathname === sub.path ? "bg-[#13182B] text-white" : "text-[#6B7283] hover:bg-[#F4F2EC] hover:text-[#13182B]"
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
