import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { confirmSignUp, signIn, signOut, fetchAuthSession } from 'aws-amplify/auth';
import { setCredentials } from '../feature/auth/authSlice';
import { useSyncUserMutation } from '../services/api';
import { Receipt, CheckCircle, XCircle, Loader2 } from 'lucide-react';

const VerifyEmail = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('verifying'); // verifying | logging-in | success | error
  const [errorMsg, setErrorMsg] = useState('');
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [syncUser] = useSyncUserMutation();
  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;

    const code = searchParams.get('code');
    const username = searchParams.get('u');

    if (!code || !username) {
      setStatus('error');
      setErrorMsg('Invalid verification link. Please check your email and try again.');
      return;
    }

    (async () => {
      // Step 1: Confirm signup
      try {
        await confirmSignUp({ username, confirmationCode: code });
      } catch (err) {
        if (err.name === 'NotAuthorizedException' || err.message?.includes('Current status is CONFIRMED')) {
          // Already verified — continue to auto-login
        } else if (err.name === 'ExpiredCodeException') {
          setStatus('error');
          setErrorMsg('This verification link has expired. Please register again or request a new code.');
          return;
        } else if (err.name === 'CodeMismatchException') {
          setStatus('error');
          setErrorMsg('Invalid verification code. Please check your email for the latest link.');
          return;
        } else {
          setStatus('error');
          setErrorMsg(err.message || 'Verification failed. Please try again.');
          return;
        }
      }

      // Step 2: Try auto-login using stored credentials from registration
      const stored = sessionStorage.getItem('_pendingVerification');
      if (stored) {
        try {
          setStatus('logging-in');
          const { email, password, displayName } = JSON.parse(stored);
          sessionStorage.removeItem('_pendingVerification');

          await signOut({ global: false }).catch(() => {});
          const { isSignedIn } = await signIn({ username: email, password });

          if (isSignedIn) {
            const session = await fetchAuthSession();
            const idClaims = session.tokens?.idToken?.payload;
            const syncName = idClaims?.name || idClaims?.['cognito:username'] || displayName;
            const syncEmail = idClaims?.email || email;

            const { user } = await syncUser({ username: syncName, email: syncEmail }).unwrap();
            dispatch(setCredentials({ user }));
            // Navigate to dashboard — ProtectedRoute will allow it since user is now set
            navigate('/dashboard', { replace: true });
            return;
          }
        } catch (loginErr) {
          console.warn('Auto-login failed, redirecting to login:', loginErr.message);
          // Fall through to manual login
        }
      }

      // Step 3: If auto-login not possible, redirect to login with success banner
      setStatus('success');
      setTimeout(() => navigate('/login?verified=true'), 2000);
    })();
  }, [searchParams, navigate, dispatch, syncUser]);

  return (
    <div
      className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{ background: '#0f172a' }}
    >
      {/* Background orbs */}
      <div
        className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full opacity-25"
        style={{ background: 'radial-gradient(circle, #7c3aed 0%, transparent 70%)', filter: 'blur(80px)' }}
      />
      <div
        className="absolute bottom-[-20%] right-[-10%] w-[400px] h-[400px] rounded-full opacity-20"
        style={{ background: 'radial-gradient(circle, #0d9488 0%, transparent 70%)', filter: 'blur(80px)' }}
      />

      {/* Card */}
      <div
        className="relative z-10 w-full max-w-md mx-4 rounded-2xl p-8 text-center"
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
          style={{ background: 'linear-gradient(90deg, transparent, #7c3aed, #0d9488, transparent)' }}
        />

        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="bg-gradient-to-br from-teal-400 to-teal-600 rounded-lg p-2">
            <Receipt className="h-6 w-6 text-white" />
          </div>
          <span className="text-xl font-bold text-white">SpendSync</span>
        </div>

        {(status === 'verifying' || status === 'logging-in') && (
          <>
            <Loader2 className="h-12 w-12 text-teal-400 mx-auto mb-4 animate-spin" />
            <h2 className="text-xl font-semibold text-white mb-2">
              {status === 'logging-in' ? 'Signing you in...' : 'Verifying your email...'}
            </h2>
            <p className="text-sm text-gray-400">Please wait a moment.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">Email verified!</h2>
            <p className="text-sm text-gray-400 mb-6">Your account is ready. Redirecting to login...</p>
            <button
              onClick={() => navigate('/login?verified=true')}
              className="w-full h-11 rounded-lg text-sm font-semibold text-white transition-all duration-300 relative overflow-hidden group"
              style={{ background: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)', boxShadow: '0 4px 15px rgba(13,148,136,0.3)' }}
            >
              <span className="relative z-10">Go to Login</span>
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ background: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)' }} />
            </button>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">Verification failed</h2>
            <p className="text-sm text-gray-400 mb-6">{errorMsg}</p>
            <button
              onClick={() => navigate('/register')}
              className="w-full h-11 rounded-lg text-sm font-semibold text-white transition-all duration-300 relative overflow-hidden group"
              style={{ background: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)', boxShadow: '0 4px 15px rgba(13,148,136,0.3)' }}
            >
              <span className="relative z-10">Back to Register</span>
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ background: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)' }} />
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default VerifyEmail;
