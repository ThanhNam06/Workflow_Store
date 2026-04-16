import { useState } from "react";
import { Command, ArrowRight } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../store/AuthContext";
import { motion } from "@motionone/react";
import useT from "../i18n";

export function Login() {
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const t = useT();
  
  const from = (location.state as any)?.from || '/';

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      // Placeholder: OAuth would redirect; here we use demo login
      await login('user@gmail.com', 'password');
      navigate(from);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailLogin = async () => {
    if (!email) return;
    setIsLoading(true);
    try {
      // For now we call backend auth; using email as password placeholder if not provided
      await login(email, 'password')
      navigate(from);
    } catch (err) {
      console.error(err)
      // Show user-friendly error here (toast)
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Animated background gradients */}
      <div className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none">
        <motion.div 
          className="w-[80vw] h-[80vw] sm:w-[500px] sm:h-[500px] bg-cyan-500/10 rounded-full blur-[100px]"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        <motion.div 
          className="absolute w-[60vw] h-[60vw] sm:w-[400px] sm:h-[400px] bg-blue-600/10 rounded-full blur-[100px]"
          animate={{
            scale: [1.2, 1, 1.2],
            opacity: [0.2, 0.4, 0.2],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="sm:mx-auto sm:w-full sm:max-w-md relative z-10"
      >
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 via-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/30">
            <Command className="w-8 h-8 text-white" />
          </div>
        </div>
        <h2 className="mt-2 text-center text-4xl font-bold text-white tracking-tight">
          Welcome to <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">WorkflowStore</span>
        </h2>
        <p className="mt-3 text-center text-base text-zinc-400">
          {t('login.signin')}
        </p>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="mt-10 sm:mx-auto sm:w-full sm:max-w-md relative z-10"
      >
        <div className="bg-zinc-900/60 backdrop-blur-xl py-10 px-4 shadow-[0_0_50px_rgba(6,182,212,0.15)] sm:rounded-3xl sm:px-10 border border-zinc-800/50">
          <div className="space-y-6">
            <div>
              <button
                onClick={handleGoogleLogin}
                disabled={isLoading}
                className="w-full flex justify-center items-center py-3.5 px-4 border border-zinc-700 rounded-xl shadow-sm bg-white text-sm font-semibold text-zinc-900 hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-zinc-900 focus:ring-cyan-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed gap-3 hover:scale-[1.02] active:scale-[0.98]"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-zinc-900 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        fill="#4285F4"
                      />
                      <path
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        fill="#34A853"
                      />
                      <path
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        fill="#FBBC05"
                      />
                      <path
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        fill="#EA4335"
                      />
                    </svg>
                    Continue with Google
                  </>
                )}
              </button>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-zinc-800" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-3 bg-zinc-900/60 text-zinc-500">
                  Or continue with email
                </span>
              </div>
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-zinc-300 mb-2">
                Email address
              </label>
              <div className="mt-1">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleEmailLogin()}
                  className="appearance-none block w-full px-4 py-3.5 border border-zinc-700 rounded-xl bg-zinc-950/50 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent sm:text-sm transition-all"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <div>
              <button
                type="button"
                onClick={handleEmailLogin}
                disabled={!email || isLoading}
                className="w-full flex justify-center py-3.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-semibold text-white bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-zinc-900 focus:ring-cyan-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98]"
              >
                Continue with Email
              </button>
            </div>
          </div>
          
          <div className="mt-6 text-center text-sm text-zinc-500">
            By continuing, you agree to our{' '}
            <a href="#" className="text-cyan-400 hover:text-cyan-300 transition-colors">
              Terms of Service
            </a>{' '}
            and{' '}
            <a href="#" className="text-cyan-400 hover:text-cyan-300 transition-colors">
              Privacy Policy
            </a>
            .
          </div>
        </div>
      </motion.div>
    </div>
  );
}