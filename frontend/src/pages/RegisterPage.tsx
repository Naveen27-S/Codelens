import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Code2, User, Mail, Lock, Eye, EyeOff, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

interface FormState {
  full_name: string;
  email: string;
  password: string;
  confirm_password: string;
}

interface FormErrors {
  full_name?: string;
  email?: string;
  password?: string;
  confirm_password?: string;
  general?: string;
}

function validate(form: FormState): FormErrors {
  const errs: FormErrors = {};
  if (!form.full_name.trim()) errs.full_name = 'Please enter your full name.';
  if (!form.email.trim()) {
    errs.email = 'Email is required.';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
    errs.email = 'Please enter a valid email address.';
  }
  if (!form.password) {
    errs.password = 'Password is required.';
  } else if (form.password.length < 8) {
    errs.password = 'Password must be at least 8 characters.';
  }
  if (!form.confirm_password) {
    errs.confirm_password = 'Please confirm your password.';
  } else if (form.password !== form.confirm_password) {
    errs.confirm_password = 'Passwords do not match.';
  }
  return errs;
}

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState<FormState>({
    full_name: '', email: '', password: '', confirm_password: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const set = (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, [field]: e.target.value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: undefined }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const errs = validate(form);
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setLoading(true);
    setErrors({});
    try {
      await register({
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        password: form.password,
      });
      setSuccess(true);
      setTimeout(() => navigate('/editor'), 1500);
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const detail = err.response?.data?.detail as string | undefined;
        if (detail?.toLowerCase().includes('email')) {
          setErrors({ email: 'This email is already registered. Please sign in instead.' });
        } else if (!err.response) {
          setErrors({ general: 'Unable to connect to the server. Please try again.' });
        } else {
          setErrors({ general: detail || 'Registration failed. Please try again.' });
        }
      } else {
        setErrors({ general: 'An unexpected error occurred.' });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-4 relative overflow-hidden">
      {/* Background gradients */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-600/20 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-violet-600/20 blur-[120px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative z-10 w-full max-w-md"
      >
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="p-2 bg-indigo-500/20 rounded-xl border border-indigo-500/30 group-hover:bg-indigo-500/30 transition-colors">
              <Code2 className="w-6 h-6 text-indigo-400" />
            </div>
            <span className="text-xl font-bold tracking-tight">CodeLens AI</span>
          </Link>
        </div>

        {/* Card */}
        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/60 rounded-2xl p-8 shadow-2xl shadow-black/40">
          <div className="mb-7">
            <h1 className="text-2xl font-extrabold tracking-tight mb-2">Create your CodeLens AI account</h1>
            <p className="text-slate-400 text-sm">Start visualizing and understanding code with AI.</p>
          </div>

          {/* Success state */}
          <AnimatePresence>
            {success && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center gap-3 py-8 text-center"
              >
                <div className="w-14 h-14 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
                  <CheckCircle2 className="w-7 h-7 text-emerald-400" />
                </div>
                <p className="text-lg font-semibold text-white">Account created successfully!</p>
                <p className="text-slate-400 text-sm">Welcome to CodeLens AI. Redirecting to editor…</p>
              </motion.div>
            )}
          </AnimatePresence>

          {!success && (
            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              {/* General error */}
              <AnimatePresence>
                {errors.general && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="flex items-start gap-2.5 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-sm text-red-300"
                  >
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{errors.general}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Full Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    id="register-full-name"
                    type="text"
                    value={form.full_name}
                    onChange={set('full_name')}
                    placeholder="Enter your full name"
                    autoComplete="name"
                    className={`w-full pl-10 pr-4 py-3 bg-slate-800/60 border rounded-xl text-sm text-white placeholder-slate-500 outline-none transition-all focus:ring-2 focus:ring-indigo-500/50 ${errors.full_name ? 'border-red-500/60' : 'border-slate-700/60 focus:border-indigo-500/60'}`}
                  />
                </div>
                {errors.full_name && <p className="mt-1.5 text-xs text-red-400 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.full_name}</p>}
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    id="register-email"
                    type="email"
                    value={form.email}
                    onChange={set('email')}
                    placeholder="Enter your email"
                    autoComplete="email"
                    className={`w-full pl-10 pr-4 py-3 bg-slate-800/60 border rounded-xl text-sm text-white placeholder-slate-500 outline-none transition-all focus:ring-2 focus:ring-indigo-500/50 ${errors.email ? 'border-red-500/60' : 'border-slate-700/60 focus:border-indigo-500/60'}`}
                  />
                </div>
                {errors.email && <p className="mt-1.5 text-xs text-red-400 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.email}</p>}
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    id="register-password"
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={set('password')}
                    placeholder="Create a password (8+ characters)"
                    autoComplete="new-password"
                    className={`w-full pl-10 pr-12 py-3 bg-slate-800/60 border rounded-xl text-sm text-white placeholder-slate-500 outline-none transition-all focus:ring-2 focus:ring-indigo-500/50 ${errors.password ? 'border-red-500/60' : 'border-slate-700/60 focus:border-indigo-500/60'}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && <p className="mt-1.5 text-xs text-red-400 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.password}</p>}
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Confirm Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    id="register-confirm-password"
                    type={showConfirm ? 'text' : 'password'}
                    value={form.confirm_password}
                    onChange={set('confirm_password')}
                    placeholder="Confirm your password"
                    autoComplete="new-password"
                    className={`w-full pl-10 pr-12 py-3 bg-slate-800/60 border rounded-xl text-sm text-white placeholder-slate-500 outline-none transition-all focus:ring-2 focus:ring-indigo-500/50 ${errors.confirm_password ? 'border-red-500/60' : 'border-slate-700/60 focus:border-indigo-500/60'}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(v => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                    aria-label={showConfirm ? 'Hide password' : 'Show password'}
                  >
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.confirm_password && <p className="mt-1.5 text-xs text-red-400 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.confirm_password}</p>}
              </div>

              {/* Submit */}
              <button
                id="register-submit"
                type="submit"
                disabled={loading}
                className="w-full py-3.5 mt-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all hover:shadow-[0_0_25px_rgba(99,102,241,0.4)] active:scale-[0.98] flex items-center justify-center gap-2"
              >
                {loading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Creating Account…</>
                ) : (
                  'Create Account'
                )}
              </button>
            </form>
          )}

          {/* Sign in link */}
          {!success && (
            <p className="mt-6 text-center text-sm text-slate-400">
              Already have an account?{' '}
              <Link to="/signin" className="text-indigo-400 hover:text-indigo-300 font-semibold transition-colors">
                Sign In
              </Link>
            </p>
          )}
        </div>
      </motion.div>
    </div>
  );
}
