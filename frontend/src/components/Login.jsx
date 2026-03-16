import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { signIn, fetchAuthSession } from 'aws-amplify/auth';
import { setCredentials } from '../feature/auth/authSlice';
import { useSyncUserMutation } from '../services/api';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const Login = () => {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const dispatch   = useDispatch();
  const navigate   = useNavigate();
  const [syncUser] = useSyncUserMutation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      // 1. Sign in with Cognito
      await signIn({ username: email, password });

      // 2. Get the access token and ID token claims
      const session  = await fetchAuthSession();
      const idClaims = session.tokens?.idToken?.payload;

      const username = idClaims?.name || idClaims?.['cognito:username'] || email;
      const userEmail = idClaims?.email || email;

      // 3. Sync user with backend (creates/updates the MySQL row)
      const { user } = await syncUser({ username, email: userEmail }).unwrap();

      // 4. Store user in Redux
      dispatch(setCredentials({ user }));
      navigate('/dashboard');
    } catch (err) {
      console.error('Login failed:', err);
      setError(err.message || 'Invalid email or password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-100">
      <Card className="w-full max-w-md p-6">
        <CardContent>
          <h2 className="text-2xl font-semibold text-center mb-4">Login</h2>
          {error && <p className="text-red-500 text-center mb-3">{error}</p>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Password</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading ? 'Logging in...' : 'Login'}
            </Button>
            <p className="text-sm text-center mt-3">
              Need an account?{' '}
              <a href="/register" className="text-blue-600 hover:underline">Register</a>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
