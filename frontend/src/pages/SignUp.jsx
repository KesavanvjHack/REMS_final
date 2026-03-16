import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import api from '../api/axios';
import { EnvelopeIcon, UserIcon, KeyIcon, ClipboardDocumentCheckIcon } from '@heroicons/react/24/outline';

const SignUp = () => {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [verifiedToken, setVerifiedToken] = useState(null);
  
  // Profile Data
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    if (!email) return toast.error("Email is required.");
    
    setLoading(true);
    try {
      // Check user & send OTP
      const res = await api.post('/auth/request-otp/', { email });
      if (res.data.user_exists) {
        toast.error('User already exists. Please sign in.');
        navigate('/login');
      } else {
        toast.success('Verification code sent to your email.');
        setStep(2);
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to send OTP.');
    } finally {
      setLoading(false);
    }
  };

  const handleOTPSubmit = async (e) => {
    e.preventDefault();
    if (!otp || otp.length !== 6) return toast.error("Valid 6-digit OTP required.");
    
    setLoading(true);
    try {
      // Verify OTP before profile setup
      const res = await api.post('/auth/verify-otp/', { email, otp });
      setVerifiedToken(res.data.verified_token);
      toast.success('Email verified successfully.');
      setStep(3);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Invalid OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    if (!firstName || !lastName || !password) return toast.error("All fields are required.");
    
    setLoading(true);
    try {
      // Complete Registration
      await api.post('/auth/register/', { 
        email, 
        verified_token: verifiedToken,
        first_name: firstName,
        last_name: lastName,
        password
      });
      toast.success('Account created! Please sign in.');
      navigate('/login');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5"></div>
      
      <div className="max-w-md w-full relative z-10">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-cyan-500/20 text-cyan-400 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-cyan-500/30 shadow-[0_0_30px_-5px_rgba(34,211,238,0.4)]">
             <ClipboardDocumentCheckIcon className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold text-slate-100 tracking-tight">Create Account</h1>
          <p className="text-slate-400 mt-2">Join the REMS remote workspace</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden p-8">
          
          {/* STEP 1: EMAIL REQUEST */}
          {step === 1 && (
            <form onSubmit={handleEmailSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Corporate Email Address</label>
                <div className="relative">
                  <EnvelopeIcon className="w-5 h-5 text-slate-500 absolute left-3 top-3" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2.5 pl-10 pr-4 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                    placeholder="name@company.com"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-semibold py-3 rounded-xl shadow-[0_0_20px_-3px_rgba(34,211,238,0.5)] transition-all flex items-center justify-center disabled:opacity-50"
              >
                {loading ? 'Sending Code...' : 'Verify Email'}
              </button>
            </form>
          )}

          {/* STEP 2: OTP VERIFICATION */}
          {step === 2 && (
            <form onSubmit={handleOTPSubmit} className="space-y-6">
              <div className="text-center mb-6">
                 <p className="text-sm text-slate-400">We sent a verification code to</p>
                 <p className="font-semibold text-cyan-400 mt-1">{email}</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2 text-center">Enter Verification Code</label>
                <input
                  type="text"
                  maxLength="6"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl py-4 text-center text-3xl tracking-[1em] font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                  placeholder="------"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading || otp.length !== 6}
                className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-semibold py-3 rounded-xl shadow-[0_0_20px_-3px_rgba(34,211,238,0.5)] transition-all flex items-center justify-center disabled:opacity-50"
              >
                {loading ? 'Verifying...' : 'Confirm Email'}
              </button>
              
              <button
                type="button"
                onClick={() => setStep(1)}
                className="w-full text-slate-400 hover:text-slate-200 text-sm font-medium pt-4"
              >
                Change Email address
              </button>
            </form>
          )}
          
          {/* STEP 3: PROFILE SETUP */}
          {step === 3 && (
            <form onSubmit={handleProfileSubmit} className="space-y-6">
              <div className="text-center mb-4">
                 <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-semibold">
                   ✓ Email Verified
                 </span>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">First Name</label>
                    <div className="relative">
                      <UserIcon className="w-5 h-5 text-slate-500 absolute left-3 top-3" />
                      <input
                        type="text"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2.5 pl-10 pr-4 text-slate-200"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Last Name</label>
                    <div className="relative">
                      <UserIcon className="w-5 h-5 text-slate-500 absolute left-3 top-3" />
                      <input
                        type="text"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2.5 pl-10 pr-4 text-slate-200"
                        required
                      />
                    </div>
                  </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Create Password</label>
                <div className="relative">
                  <KeyIcon className="w-5 h-5 text-slate-500 absolute left-3 top-3" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2.5 pl-10 pr-4 text-slate-200"
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-semibold py-3 rounded-xl shadow-[0_0_20px_-3px_rgba(34,211,238,0.5)] transition-all flex items-center justify-center disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Complete Profile & Sign In'}
              </button>
            </form>
          )}

          <p className="text-center text-slate-500 text-sm mt-8">
            Already have an account? <Link to="/login" className="text-cyan-400 hover:text-cyan-300 font-medium">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default SignUp;
