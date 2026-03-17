import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signUp, confirmSignUp, resendSignUpCode } from 'aws-amplify/auth';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const Register = () => {
  const { t } = useTranslation();
  const [step, setStep]               = useState('register'); // 'register' | 'confirm'
  const [username, setUsername]       = useState('');
  const [email, setEmail]             = useState('');
  const [password, setPassword]       = useState('');
  const [code, setCode]               = useState('');
  const [cognitoUsername, setCognitoUsername] = useState(''); // internal UUID — user never sees this
  const [error, setError]             = useState(null);
  const [isLoading, setIsLoading]     = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      // Generate a UUID as the internal Cognito username so it is never email-format.
      // Users always sign in with their email (configured as an alias in Cognito).
      const internalUsername = crypto.randomUUID();

      await signUp({
        username: internalUsername,
        password,
        options: {
          userAttributes: {
            email,
            name: username, // maps to Cognito's required 'name' attribute
          },
        },
      });

      setCognitoUsername(internalUsername); // needed for confirm + resend
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
      navigate('/');
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

  if (step === 'confirm') {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-100">
        <Card className="w-full max-w-md p-6">
          <CardContent>
            <h2 className="text-2xl font-semibold text-center mb-2">{t('register.checkEmail')}</h2>
            <p className="text-sm text-gray-500 text-center mb-4">
              {t('register.confirmationSent')} <strong>{email}</strong>
            </p>
            {error && <p className="text-red-500 text-center mb-3">{error}</p>}
            <form onSubmit={handleConfirm} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">{t('register.confirmationCode')}</label>
                <Input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder={t('register.confirmPlaceholder')}
                  required
                />
              </div>
              <Button type="submit" disabled={isLoading} className="w-full">
                {isLoading ? t('register.confirming') : t('register.confirm')}
              </Button>
              <p className="text-sm text-center mt-3">
                {t('register.didntReceive')}{' '}
                <button
                  type="button"
                  onClick={handleResendCode}
                  className="text-blue-600 hover:underline"
                >
                  {t('register.resendCode')}
                </button>
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-100">
      <Card className="w-full max-w-md p-6">
        <CardContent>
          <h2 className="text-2xl font-semibold text-center mb-4">{t('register.title')}</h2>
          {error && <p className="text-red-500 text-center mb-3">{error}</p>}
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">{t('register.username')}</label>
              <Input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t('register.email')}</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t('register.password')}</label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading ? t('register.submitting') : t('register.submit')}
            </Button>
            <p className="text-sm text-center mt-3">
              {t('register.haveAccount')}{' '}
              <a href="/" className="text-blue-600 hover:underline">{t('register.login')}</a>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Register;
