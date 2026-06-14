import { createContext, useContext, useEffect, useRef, useState } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { doc, onSnapshot, getDocs, collection, setDoc, addDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "./firebase";
import { setAuditActor, logAction } from "./audit";
import { fullPermissions, type Member, type Role, type Action } from "./permissions";

type Access = "loading" | "noauth" | "noaccess" | "disabled" | "ok";

interface AuthCtx {
  user: User | null;
  member: Member | null;
  role: Role | null;
  isAdmin: boolean;
  access: Access;
  can: (moduleKey: string, action: Action) => boolean;
  signOutNow: () => void;
}

const Ctx = createContext<AuthCtx>(null as any);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [member, setMember] = useState<Member | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [roleId, setRoleId] = useState<string | null>(null);
  const [access, setAccess] = useState<Access>("loading");
  const bootstrapping = useRef(false);

  // Track Firebase auth session.
  useEffect(() => onAuthStateChanged(auth, (u) => {
    setUser(u);
    if (!u) {
      setMember(null); setRole(null); setRoleId(null); setIsAdmin(false);
      setAccess("noauth"); setAuditActor(null);
    } else {
      setAccess("loading");
    }
  }), []);

  // First user to ever sign in is provisioned as the Administrator.
  async function bootstrapAdmin(u: User) {
    if (bootstrapping.current) return;
    bootstrapping.current = true;
    try {
      const roleRef = await addDoc(collection(db, "roles"), {
        name: "Administrator",
        isAdmin: true,
        permissions: fullPermissions(),
        createdAt: serverTimestamp(),
      });
      await setDoc(doc(db, "members", u.uid), {
        uid: u.uid,
        email: u.email || "",
        name: u.email || "Administrator",
        roleId: roleRef.id,
        roleName: "Administrator",
        disabled: false,
        createdAt: serverTimestamp(),
        createdBy: u.uid,
      });
      setAuditActor({ uid: u.uid, email: u.email || "", name: u.email || "Administrator" });
      await logAction("Workspace created", "First administrator account provisioned");
    } catch (e) {
      console.error("bootstrap failed", e);
    }
  }

  // Subscribe to this user's member document.
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, "members", user.uid), async (snap) => {
      if (snap.exists()) {
        const m = { uid: user.uid, ...snap.data() } as Member;
        setMember(m);
        setAuditActor({ uid: user.uid, email: user.email || "", name: m.name || user.email || "" });
        if (m.disabled) { setAccess("disabled"); setIsAdmin(false); setRoleId(null); return; }
        setRoleId(m.roleId || null);
        if (!m.roleId) { setRole(null); setIsAdmin(false); }
        setAccess("ok");
      } else {
        // No member doc — either bootstrap the very first user, or deny access.
        // Under strict rules a non-member can't list members; treat that as no access.
        try {
          const all = await getDocs(collection(db, "members"));
          if (all.empty) {
            await bootstrapAdmin(user);
            return;
          }
        } catch (e) {
          console.warn("members lookup denied", e);
        }
        setMember(null); setRole(null); setRoleId(null); setIsAdmin(false);
        setAuditActor({ uid: user.uid, email: user.email || "", name: user.email || "" });
        setAccess("noaccess");
      }
    });
    return () => unsub();
  }, [user]);

  // Subscribe to the assigned role so permission changes apply live.
  useEffect(() => {
    if (!roleId) { setRole(null); return; }
    const unsub = onSnapshot(doc(db, "roles", roleId), (snap) => {
      if (snap.exists()) {
        const r = { id: snap.id, ...snap.data() } as Role;
        setRole(r);
        setIsAdmin(!!r.isAdmin);
      } else {
        setRole(null); setIsAdmin(false);
      }
    });
    return () => unsub();
  }, [roleId]);

  const can = (moduleKey: string, action: Action) => {
    if (isAdmin) return true;
    return !!role?.permissions?.[moduleKey]?.[action];
  };

  return (
    <Ctx.Provider value={{ user, member, role, isAdmin, access, can, signOutNow: () => signOut(auth) }}>
      {children}
    </Ctx.Provider>
  );
}
