import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { resetPassword, confirmResetPassword } from 'aws-amplify/auth';
import { Eye, EyeOff, Receipt, ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const ForgotPassword = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [step, setStep] = useState('request'); // 'request' | 'confirm'
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleRequest = async (e) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      await resetPassword({ username: email });
      setStep('confirm');
    } catch (err) {
      setError(err.message || t('forgotPassword.requestFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirm = async (e) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      await confirmResetPassword({ username: email, confirmationCode: code, newPassword });
      navigate('/login');
    } catch (err) {
      setError(err.message || t('forgotPassword.confirmFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="auth-page min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{ background: '#0f172a' }}
    >
      <div
        className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full opacity-25"
        style={{ background: 'radial-gradient(circle, #0d9488 0%, transparent 70%)', filter: 'blur(80px)' }}
      />
      <div
        className="absolute bottom-[-20%] left-[-10%] w-[400px] h-[400px] rounded-full opacity-20"
        style={{ background: 'radial-gradient(circle, #7c3aed 0%, transparent 70%)', filter: 'blur(80px)' }}
      />

      <button
        onClick={() => navigate('/login')}
        className="absolute top-6 left-6 z-10 flex items-center gap-1.5 text-gray-400 hover:text-white text-sm transition-colors duration-300"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('forgotPassword.backToLogin')}
      </button>

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
        <div
          className="absolute top-0 left-0 right-0 h-[2px] rounded-t-2xl"
          style={{ background: 'linear-gradient(90deg, transparent, #0d9488, #7c3aed, transparent)' }}
        />

        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="bg-gradient-to-br from-teal-400 to-teal-600 rounded-lg p-2">
            <Receipt className="h-6 w-6 text-white" />
          </div>
          <span className="text-xl font-bold text-white">SpendSync</span>
        </div>

        {step === 'request' ? (
          <>
            <h2 className="text-xl font-semibold text-white text-center mb-1">
              {t('forgotPassword.title')}
            </h2>
            <p className="text-gray-400 text-center mb-6 text-sm">
              {t('forgotPassword.subtitle')}
            </p>

            {error && (
              <div className="rounded-lg px-4 py-3 mb-4" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <p className="text-red-400 text-sm text-center">{error}</p>
              </div>
            )}

            <form onSubmit={handleRequest} className="space-y-4">
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
                  {isLoading ? t('forgotPassword.sending') : t('forgotPassword.sendCode')}
                </span>
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style={{ background: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)' }}
                />
              </button>
            </form>
          </>
        ) : (
          <>
            <h2 className="text-xl font-semibold text-white text-center mb-1">
              {t('forgotPassword.checkEmail')}
            </h2>
            <p className="text-gray-400 text-center mb-6 text-sm">
              {t('forgotPassword.codeSentTo')} <span className="text-teal-400">{email}</span>
            </p>

            {error && (
              <div className="rounded-lg px-4 py-3 mb-4" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <p className="text-red-400 text-sm text-center">{error}</p>
              </div>
            )}

            <form onSubmit={handleConfirm} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">{t('forgotPassword.code')}</label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="123456"
                  required
                  className="w-full h-11 px-4 rounded-lg text-sm text-white placeholder-gray-500 outline-none transition-all duration-300 focus:ring-2 focus:ring-teal-500/50"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                  onFocus={(e) => (e.target.style.borderColor = 'rgba(13,148,136,0.5)')}
                  onBlur={(e) => (e.target.style.borderColor = 'rgba(255,255,255,0.1)')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">{t('forgotPassword.newPassword')}</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
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
                  {isLoading ? t('forgotPassword.resetting') : t('forgotPassword.resetPassword')}
                </span>
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style={{ background: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)' }}
                />
              </button>

              <button
                type="button"
                onClick={() => { setStep('request'); setError(null); }}
                className="w-full text-sm text-gray-500 hover:text-gray-300 transition-colors text-center"
              >
                {t('forgotPassword.wrongEmail')}
              </button>
            </form>
          </>
        )}
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

export default ForgotPassword;
