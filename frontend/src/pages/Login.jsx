import { useState, useContext, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { toast } from 'react-hot-toast';
import api from '../api/axios';
import { EnvelopeIcon, KeyIcon, LockClosedIcon } from '@heroicons/react/24/outline';

const Login = () => {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, user } = useContext(AuthContext);
  const navigate = useNavigate();

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      if (user.role === 'admin') navigate('/admin');
      else if (user.role === 'manager') navigate('/manager');
      else navigate('/employee');
    }
  }, [user, navigate]);

  const handleCredentialsSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) return toast.error("Email and password required.");
    
    setLoading(true);
    try {
      // Step 1: Request OTP for login
      const response = await api.post('/auth/request-otp/', { email });
      toast.success(`Verification code: ${response.data.otp}`, { duration: 6000 });
      setStep(2);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to initiate login. Check credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleOTPSubmit = async (e) => {
    e.preventDefault();
    if (!otp || otp.length !== 6) return toast.error("Valid 6-digit OTP required.");
    
    setLoading(true);
    try {
      // Step 2: Final Login with OTP
      const role = await login(email, password, otp);
      if (role === 'admin') navigate('/admin');
      else if (role === 'manager') navigate('/manager');
      else navigate('/employee');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Invalid OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5"></div>
      
      <div className="max-w-md w-full relative z-10">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-indigo-500/20 text-indigo-400 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-indigo-500/30 shadow-[0_0_30px_-5px_rgba(99,102,241,0.4)]">
             <LockClosedIcon className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold text-slate-100 tracking-tight">Sign In to REMS</h1>
          <p className="text-slate-400 mt-2">Secure access to your enterprise workspace</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden p-8">
          {step === 1 ? (
            <form onSubmit={handleCredentialsSubmit} className="space-y-6">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-2">Email Address</label>
                <div className="relative">
                  <EnvelopeIcon className="w-5 h-5 text-slate-500 absolute left-3 top-3" />
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2.5 pl-10 pr-4 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                    placeholder="Enter your corporate email"
                    required
                    autoComplete="email"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-2">Password</label>
                <div className="relative">
                  <KeyIcon className="w-5 h-5 text-slate-500 absolute left-3 top-3" />
                  <input
                    type="password"
                    id="password"
                    name="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2.5 pl-10 pr-4 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 rounded-xl shadow-[0_0_20px_-3px_rgba(99,102,241,0.5)] hover:shadow-[0_0_25px_-3px_rgba(99,102,241,0.7)] transition-all flex items-center justify-center disabled:opacity-50"
              >
                {loading ? 'Verifying...' : 'Continue to 2FA'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleOTPSubmit} className="space-y-6">
              <div className="text-center mb-6">
                 <p className="text-sm text-slate-400">We sent a 6-digit verification code to</p>
                 <p className="font-semibold text-indigo-400 mt-1">{email}</p>
              </div>
              
              <div>
                <label htmlFor="otp" className="block text-sm font-medium text-slate-300 mb-2 text-center">Enter Verification Code</label>
                <input
                  type="text"
                  id="otp"
                  name="otp"
                  maxLength="6"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl py-4 text-center text-3xl tracking-[1em] font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  placeholder="------"
                  required
                  autoComplete="one-time-code"
                />
              </div>

              <button
                type="submit"
                disabled={loading || otp.length !== 6}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-3 rounded-xl shadow-[0_0_20px_-3px_rgba(16,185,129,0.5)] transition-all flex items-center justify-center disabled:opacity-50"
              >
                {loading ? 'Authenticating...' : 'Sign In Securely'}
              </button>
              
              <button
                type="button"
                onClick={() => setStep(1)}
                className="w-full text-slate-400 hover:text-slate-200 text-sm font-medium pt-4"
              >
                Back to credentials
              </button>
            </form>
          )}

          <p className="text-center text-slate-500 text-sm mt-8">
            Don't have an account? <Link to="/signup" className="text-indigo-400 hover:text-indigo-300 font-medium">Sign up</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
