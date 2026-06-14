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
    <div className="min-h-screen bg-[#FCFBF8] font-['Poppins',sans-serif] flex flex-col justify-center items-center p-4">
      {/* Background Grid Pattern (Matching Frontend) */}
      <div aria-hidden className="absolute inset-0 pointer-events-none opacity-50" style={{ backgroundImage: `linear-gradient(#E5E2D9 1px,transparent 1px),linear-gradient(90deg,#E5E2D9 1px,transparent 1px)`, backgroundSize: "56px 56px", maskImage: "radial-gradient(ellipse 60% 60% at 50% 50%,#000,transparent 72%)", WebkitMaskImage: "radial-gradient(ellipse 60% 60% at 50% 50%,#000,transparent 72%)" }} />
      
      <div className="max-w-md w-full bg-[#FFFFFF] border border-[#D7D3C7] rounded-[22px] shadow-[0_30px_60px_-42px_rgba(19,24,43,0.25)] p-10 relative z-10 transition-colors duration-300 hover:border-[#FF5C49]">
        
        <div className="mb-10 text-center flex flex-col items-center">
          <img src="/logo.png" alt="Logo" className="w-[160px] mb-4" />
          <p className="text-[11px] font-mono text-[#FF5C49] tracking-[0.1em] uppercase font-semibold bg-[#FFEDE9] px-3 py-1 rounded-full">
            Operations Hub
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block font-mono text-[12px] text-[#6B7283] mb-[7px]">Admin Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="w-full px-[14px] py-[13px] rounded-xl border border-[#D7D3C7] bg-[#FCFBF8] text-[#13182B] text-[15px] focus:outline-none focus:border-[#FF5C49] focus:shadow-[0_0_0_4px_#FFEDE9] transition-all"
              required
            />
          </div>

          <div>
            <label className="block font-mono text-[12px] text-[#6B7283] mb-[7px]">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-[14px] py-[13px] rounded-xl border border-[#D7D3C7] bg-[#FCFBF8] text-[#13182B] text-[15px] focus:outline-none focus:border-[#FF5C49] focus:shadow-[0_0_0_4px_#FFEDE9] transition-all"
              required
            />
          </div>

          {error && <div className="text-[#FF5C49] text-[14.5px] font-medium">{error}</div>}

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 bg-[#13182B] text-white font-semibold text-[15px] py-[15px] rounded-xl hover:-translate-y-[2px] active:translate-y-0 transition-transform shadow-[0_14px_30px_-14px_rgba(19,24,43,0.55)] disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
          >
            {loading ? "Authenticating..." : "Secure Login"}
            {!loading && <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
          </button>
        </form>
      </div>
    </div>
  );
}