import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, API } from "@/App";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Lock, Mail, User, ArrowRight } from "lucide-react";

export default function LoginPage() {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const endpoint = isRegister ? "/auth/register" : "/auth/login";
      const payload = isRegister
        ? { username, email, password }
        : { email, password };
      const res = await axios.post(`${API}${endpoint}`, payload);
      login(res.data.token, res.data.user);
      toast.success(isRegister ? "Account created" : "Access granted");
      navigate("/");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] flex" data-testid="login-page">
      {/* Left panel - branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden items-center justify-center">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-20"
          style={{ backgroundImage: `url(https://images.unsplash.com/photo-1762278804941-27ff5cba5a2e?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMjV8MHwxfHNlYXJjaHwxfHxhYnN0cmFjdCUyMGRpZ2l0YWwlMjBuZXR3b3JrJTIwZGFyayUyMGJhY2tncm91bmR8ZW58MHx8fHwxNzcxNzI0Mzk1fDA&ixlib=rb-4.1.0&q=85)` }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#050505] via-transparent to-[#050505]" />
        <div className="relative z-10 p-16 max-w-lg">
          <h1 className="font-['Barlow_Condensed'] font-bold text-5xl lg:text-6xl text-blue-500 tracking-widest mb-6">
            OBSIDIAN
          </h1>
          <p className="text-gray-500 text-sm leading-relaxed font-light">
            MULTIMODAL RETRIEVAL-AUGMENTED GENERATION SYSTEM
          </p>
          <div className="mt-8 flex gap-3">
            {["PDF", "DOCX", "IMAGE", "AUDIO"].map((t) => (
              <span
                key={t}
                className="px-2 py-1 border border-white/10 text-[10px] font-mono text-gray-500 tracking-wider rounded-sm"
              >
                {t}
              </span>
            ))}
          </div>
          <p className="mt-8 text-gray-600 text-xs font-mono">
            SECURE // OFFLINE-READY // CITATION-GROUNDED
          </p>
        </div>
      </div>

      {/* Right panel - form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div className="lg:hidden mb-10">
            <h1 className="font-['Barlow_Condensed'] font-bold text-4xl text-blue-500 tracking-widest">
              OBSIDIAN
            </h1>
            <p className="text-gray-600 text-xs font-mono mt-2">MULTIMODAL RAG SYSTEM</p>
          </div>

          <h2 className="font-['Barlow_Condensed'] font-semibold text-xl tracking-wider text-gray-200 mb-1">
            {isRegister ? "CREATE ACCOUNT" : "AUTHENTICATE"}
          </h2>
          <p className="text-gray-600 text-xs mb-8">
            {isRegister ? "Register for secure access" : "Enter credentials to proceed"}
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {isRegister && (
              <div className="space-y-2">
                <Label className="text-gray-500 text-xs tracking-wider font-['Barlow_Condensed']">
                  CALLSIGN
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-600" />
                  <Input
                    data-testid="register-username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter username"
                    className="pl-10 bg-black/50 border-white/10 focus:border-blue-500/50 rounded-sm h-10 text-sm"
                    required
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-gray-500 text-xs tracking-wider font-['Barlow_Condensed']">
                EMAIL
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-600" />
                <Input
                  data-testid="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="operator@obsidian.sec"
                  className="pl-10 bg-black/50 border-white/10 focus:border-blue-500/50 rounded-sm h-10 text-sm"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-gray-500 text-xs tracking-wider font-['Barlow_Condensed']">
                PASSPHRASE
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-600" />
                <Input
                  data-testid="login-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter passphrase"
                  className="pl-10 bg-black/50 border-white/10 focus:border-blue-500/50 rounded-sm h-10 text-sm"
                  required
                />
              </div>
            </div>

            <Button
              data-testid="login-submit-btn"
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white rounded-sm h-10 font-['Barlow_Condensed'] tracking-wider text-sm shadow-[0_0_15px_rgba(37,99,235,0.3)] hover:shadow-[0_0_25px_rgba(37,99,235,0.4)] transition-all duration-150"
            >
              {loading ? (
                <span className="font-mono text-xs">PROCESSING...</span>
              ) : (
                <>
                  {isRegister ? "REGISTER" : "ACCESS SYSTEM"}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button
              data-testid="toggle-auth-mode"
              onClick={() => setIsRegister(!isRegister)}
              className="text-gray-600 hover:text-blue-500 text-xs transition-colors duration-150 font-mono"
            >
              {isRegister ? "Already have access? Authenticate" : "Request new access credentials"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
