import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { signIn, signOut, fetchAuthSession } from 'aws-amplify/auth';
import { setCredentials } from '../feature/auth/authSlice';
import { useSyncUserMutation } from '../services/api';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const Login = () => {
  const { t } = useTranslation();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const dispatch   = useDispatch();
  const navigate   = useNavigate();
  const [syncUser] = useSyncUserMutation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      // 1. Clear any stale Amplify session before signing in
      await signOut({ global: false }).catch(() => {});

      // 2. Sign in with Cognito
      const { isSignedIn, nextStep } = await signIn({ username: email, password });
      if (!isSignedIn) {
        throw new Error(`Additional sign-in step required: ${nextStep.signInStep}`);
      }

      // 3. Get the access token and ID token claims
      const session  = await fetchAuthSession();
      const idClaims = session.tokens?.idToken?.payload;

      const username = idClaims?.name || idClaims?.['cognito:username'] || email;
      const userEmail = idClaims?.email || email;

      // 4. Sync user with backend (creates/updates the MySQL row)
      let user;
      try {
        ({ user } = await syncUser({ username, email: userEmail }).unwrap());
      } catch (syncErr) {
        console.error('Backend sync failed:', syncErr);
        throw new Error(t('login.syncFailed'));
      }

      console.log('User synced with backend:', user);
      // 5. Store user in Redux
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
    <div className="flex justify-center items-center min-h-screen bg-gray-100">
      <Card className="w-full max-w-md p-6">
        <CardContent>
          <h2 className="text-2xl font-semibold text-center mb-4">{t('login.title')}</h2>
          {error && <p className="text-red-500 text-center mb-3">{error}</p>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">{t('login.email')}</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t('login.password')}</label>
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
              {isLoading ? t('login.submitting') : t('login.submit')}
            </Button>
            <p className="text-sm text-center mt-3">
              {t('login.needAccount')}{' '}
              <a href="/register" className="text-blue-600 hover:underline">{t('login.register')}</a>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
