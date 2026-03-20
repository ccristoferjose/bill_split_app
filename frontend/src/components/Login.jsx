import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { signIn, signOut, fetchAuthSession } from 'aws-amplify/auth';
import { setCredentials } from '../feature/auth/authSlice';
import { useSyncUserMutation } from '../services/api';
import { Eye, EyeOff, Receipt, ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const Login = () => {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [syncUser] = useSyncUserMutation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await signOut({ global: false }).catch(() => {});
      const { isSignedIn, nextStep } = await signIn({ username: email, password });
      if (!isSignedIn) {
        throw new Error(`Additional sign-in step required: ${nextStep.signInStep}`);
      }

      const session = await fetchAuthSession();
      const idClaims = session.tokens?.idToken?.payload;
      const username = idClaims?.name || idClaims?.['cognito:username'] || email;
      const userEmail = idClaims?.email || email;

      let user;
      try {
        ({ user } = await syncUser({ username, email: userEmail }).unwrap());
      } catch (syncErr) {
        console.error('Backend sync failed:', syncErr);
        throw new Error(t('login.syncFailed'));
      }

      dispatch(setCredentials({ user }));
      navigate('/dashboard');
    } catch (err) {
      console.error('Login failed:', err);
      setError(err.message || t('login.failed'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-page min-h-screen flex items-center justify-center relative overflow-hidden" style={{ background: '#0f172a' }}>
      {/* Background orbs */}
      <div
        className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full opacity-25"
        style={{ background: 'radial-gradient(circle, #0d9488 0%, transparent 70%)', filter: 'blur(80px)' }}
      />
      <div
        className="absolute bottom-[-20%] left-[-10%] w-[400px] h-[400px] rounded-full opacity-20"
        style={{ background: 'radial-gradient(circle, #7c3aed 0%, transparent 70%)', filter: 'blur(80px)' }}
      />

      {/* Back to home */}
      <button
        onClick={() => navigate('/')}
        className="absolute top-6 left-6 z-10 flex items-center gap-1.5 text-gray-400 hover:text-white text-sm transition-colors duration-300"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('landing.backHome')}
      </button>

      {/* Card */}
      <div
        className="relative z-10 w-full max-w-md mx-4 rounded-2xl p-8"
        style={{
          background: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        }}
      >
        {/* Top accent line */}
        <div
          className="absolute top-0 left-0 right-0 h-[2px] rounded-t-2xl"
          style={{ background: 'linear-gradient(90deg, transparent, #0d9488, #7c3aed, transparent)' }}
        />

        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="bg-gradient-to-br from-teal-400 to-teal-600 rounded-lg p-2">
            <Receipt className="h-6 w-6 text-white" />
          </div>
          <span className="text-xl font-bold text-white">SpendSync</span>
        </div>

        <h2 className="text-xl font-semibold text-white text-center mb-1">
          {t('landing.welcomeBack')}
        </h2>
        <p className="text-gray-400 text-center mb-6 text-sm">
          {t('landing.signInContinue')}
        </p>

        {error && (
          <div className="rounded-lg px-4 py-3 mb-4" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <p className="text-red-400 text-sm text-center">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">{t('login.email')}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="w-full h-11 px-4 rounded-lg text-sm text-white placeholder-gray-500 outline-none transition-all duration-300 focus:ring-2 focus:ring-teal-500/50"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
              onFocus={(e) => (e.target.style.borderColor = 'rgba(13,148,136,0.5)')}
              onBlur={(e) => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">{t('login.password')}</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full h-11 px-4 pr-10 rounded-lg text-sm text-white placeholder-gray-500 outline-none transition-all duration-300 focus:ring-2 focus:ring-teal-500/50"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                onFocus={(e) => (e.target.style.borderColor = 'rgba(13,148,136,0.5)')}
                onBlur={(e) => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full h-11 rounded-lg text-sm font-semibold text-white transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden group"
            style={{
              background: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)',
              boxShadow: '0 4px 15px rgba(13, 148, 136, 0.3)',
            }}
          >
            <span className="relative z-10">
              {isLoading ? t('login.submitting') : t('login.submit')}
            </span>
            <div
              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
              style={{ background: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)' }}
            />
          </button>
        </form>

        <div className="mt-6 text-center space-y-2">
          <p className="text-sm">
            <a href="/forgot-password" className="text-gray-500 hover:text-gray-300 transition-colors duration-300">
              {t('login.forgotPassword')}
            </a>
          </p>
          <p className="text-sm text-gray-500">
            {t('login.needAccount')}{' '}
            <a href="/register" className="text-teal-400 font-medium hover:text-teal-300 transition-colors duration-300">
              {t('login.register')}
            </a>
          </p>
        </div>
      </div>

      <style>{`
        .auth-page *,
        .auth-page *::before,
        .auth-page *::after {
          border-color: transparent;
        }
      `}</style>
    </div>
  );
};

export default Login;
