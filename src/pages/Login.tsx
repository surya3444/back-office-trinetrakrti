import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../lib/firebase";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate("/"); 
    } catch (err: any) {
      setError("Invalid email or password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FFFFFF] font-['Inter',sans-serif] flex flex-col justify-center items-center p-4">
      {/* Background Grid Pattern (Matching Frontend) */}
      <div aria-hidden className="absolute inset-0 pointer-events-none opacity-50" style={{ backgroundImage: `linear-gradient(#17222F 1px,transparent 1px),linear-gradient(90deg,#17222F 1px,transparent 1px)`, backgroundSize: "56px 56px", maskImage: "radial-gradient(ellipse 60% 60% at 50% 50%,#000,transparent 72%)", WebkitMaskImage: "radial-gradient(ellipse 60% 60% at 50% 50%,#000,transparent 72%)" }} />
      
      <div className="max-w-md w-full bg-[#FFFFFF] border border-[#17222F] rounded-none p-10 relative z-10 transition-colors duration-300 hover:border-[#E5322B]">
        
        <div className="mb-10 text-center flex flex-col items-center">
          <img src="/tot2.svg" alt="Logo" className="w-[160px] mb-4" />
          <p className="text-[11px] font-mono text-[#E5322B] tracking-[0.1em] uppercase font-semibold bg-[#FBE9E7] px-3 py-1 rounded-none">
            Operations Hub
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block font-mono text-[12px] text-[#5A6473] mb-[7px]">Admin Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="w-full px-[14px] py-[13px] rounded-none border border-[#17222F] bg-[#FFFFFF] text-[#17222F] text-[15px] focus:outline-none focus:border-[#E5322B] focus: transition-all"
              required
            />
          </div>

          <div>
            <label className="block font-mono text-[12px] text-[#5A6473] mb-[7px]">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-[14px] py-[13px] rounded-none border border-[#17222F] bg-[#FFFFFF] text-[#17222F] text-[15px] focus:outline-none focus:border-[#E5322B] focus: transition-all"
              required
            />
          </div>

          {error && <div className="text-[#E5322B] text-[14.5px] font-medium">{error}</div>}

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 bg-[#17222F] text-white font-semibold text-[15px] py-[15px] rounded-none hover:-translate-y-[2px] active:translate-y-0 transition-transform disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
          >
            {loading ? "Authenticating..." : "Secure Login"}
            {!loading && <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
          </button>
        </form>
      </div>
    </div>
  );
}