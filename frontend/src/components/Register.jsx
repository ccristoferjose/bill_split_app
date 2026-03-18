import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signUp, confirmSignUp, resendSignUpCode } from 'aws-amplify/auth';
import { Eye, EyeOff, Receipt, ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const Register = () => {
  const { t } = useTranslation();
  const [step, setStep] = useState('register');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [cognitoUsername, setCognitoUsername] = useState('');
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const internalUsername = crypto.randomUUID();
      await signUp({
        username: internalUsername,
        password,
        options: {
          userAttributes: { email, name: username },
        },
      });
      setCognitoUsername(internalUsername);
      setStep('confirm');
    } catch (err) {
      console.error('Registration failed:', err);
      setError(err.message || t('register.failed'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirm = async (e) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await confirmSignUp({ username: cognitoUsername, confirmationCode: code });
      navigate('/login');
    } catch (err) {
      console.error('Confirmation failed:', err);
      setError(err.message || 'Invalid confirmation code.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    try {
      await resendSignUpCode({ username: cognitoUsername });
      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to resend code.');
    }
  };

  const inputStyle = {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
  };

  const inputClass =
    'w-full h-11 px-4 rounded-lg text-sm text-white placeholder-gray-500 outline-none transition-all duration-300 focus:ring-2 focus:ring-teal-500/50';

  const handleFocus = (e) => (e.target.style.borderColor = 'rgba(13,148,136,0.5)');
  const handleBlur = (e) => (e.target.style.borderColor = 'rgba(255,255,255,0.1)');

  const renderCard = (children) => (
    <div className="auth-page min-h-screen flex items-center justify-center relative overflow-hidden" style={{ background: '#0f172a' }}>
      {/* Background orbs */}
      <div
        className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full opacity-25"
        style={{ background: 'radial-gradient(circle, #7c3aed 0%, transparent 70%)', filter: 'blur(80px)' }}
      />
      <div
        className="absolute bottom-[-20%] right-[-10%] w-[400px] h-[400px] rounded-full opacity-20"
        style={{ background: 'radial-gradient(circle, #0d9488 0%, transparent 70%)', filter: 'blur(80px)' }}
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
          style={{ background: 'linear-gradient(90deg, transparent, #7c3aed, #0d9488, transparent)' }}
        />

        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="bg-gradient-to-br from-teal-400 to-teal-600 rounded-lg p-2">
            <Receipt className="h-6 w-6 text-white" />
          </div>
          <span className="text-xl font-bold text-white">SpendSync</span>
        </div>

        {children}
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

  if (step === 'confirm') {
    return renderCard(
      <>
        <h2 className="text-xl font-semibold text-white text-center mb-2">{t('register.checkEmail')}</h2>
        <p className="text-sm text-gray-400 text-center mb-6">
          {t('register.confirmationSent')} <strong className="text-white">{email}</strong>
        </p>
        {error && (
          <div className="rounded-lg px-4 py-3 mb-4" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <p className="text-red-400 text-sm text-center">{error}</p>
          </div>
        )}
        <form onSubmit={handleConfirm} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">{t('register.confirmationCode')}</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={t('register.confirmPlaceholder')}
              required
              className={inputClass}
              style={inputStyle}
              onFocus={handleFocus}
              onBlur={handleBlur}
            />
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full h-11 rounded-lg text-sm font-semibold text-white transition-all duration-300 disabled:opacity-50 relative overflow-hidden group"
            style={{ background: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)', boxShadow: '0 4px 15px rgba(13,148,136,0.3)' }}
          >
            <span className="relative z-10">{isLoading ? t('register.confirming') : t('register.confirm')}</span>
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ background: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)' }} />
          </button>
          <p className="text-sm text-center text-gray-500 mt-3">
            {t('register.didntReceive')}{' '}
            <button type="button" onClick={handleResendCode} className="text-teal-400 hover:text-teal-300 transition-colors">
              {t('register.resendCode')}
            </button>
          </p>
        </form>
      </>
    );
  }

  return renderCard(
    <>
      <h2 className="text-xl font-semibold text-white text-center mb-1">{t('register.title')}</h2>
      <p className="text-gray-400 text-center mb-6 text-sm">{t('landing.createAccountDesc')}</p>
      {error && (
        <div className="rounded-lg px-4 py-3 mb-4" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <p className="text-red-400 text-sm text-center">{error}</p>
        </div>
      )}
      <form onSubmit={handleRegister} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">{t('register.username')}</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            className={inputClass}
            style={inputStyle}
            onFocus={handleFocus}
            onBlur={handleBlur}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">{t('register.email')}</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className={inputClass}
            style={inputStyle}
            onFocus={handleFocus}
            onBlur={handleBlur}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">{t('register.password')}</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className={`${inputClass} pr-10`}
              style={inputStyle}
              onFocus={handleFocus}
              onBlur={handleBlur}
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
          className="w-full h-11 rounded-lg text-sm font-semibold text-white transition-all duration-300 disabled:opacity-50 relative overflow-hidden group"
          style={{ background: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)', boxShadow: '0 4px 15px rgba(13,148,136,0.3)' }}
        >
          <span className="relative z-10">{isLoading ? t('register.submitting') : t('register.submit')}</span>
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ background: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)' }} />
        </button>
      </form>
      <div className="mt-6 text-center">
        <p className="text-sm text-gray-500">
          {t('register.haveAccount')}{' '}
          <a href="/login" className="text-teal-400 font-medium hover:text-teal-300 transition-colors duration-300">
            {t('register.login')}
          </a>
        </p>
      </div>
    </>
  );
};

export default Register;
