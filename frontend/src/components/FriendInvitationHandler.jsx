import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useRespondToFriendRequestMutation } from '../services/api';
import { Receipt, CheckCircle, XCircle, Loader2, UserCheck, UserX, LogIn } from 'lucide-react';

const FriendInvitationHandler = () => {
  const { friendshipId } = useParams();
  const [searchParams] = useSearchParams();
  const action = searchParams.get('action'); // 'accept' or 'decline'
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);
  const [respondToRequest] = useRespondToFriendRequestMutation();
  const [status, setStatus] = useState('idle'); // idle | processing | success | error
  const [message, setMessage] = useState('');
  const attempted = useRef(false);

  // Map email action to backend action
  const backendAction = action === 'accept' ? 'accepted' : 'blocked';
  const isAccept = action === 'accept';

  useEffect(() => {
    if (!user || attempted.current) return;
    if (!friendshipId || !action || !['accept', 'decline'].includes(action)) {
      setStatus('error');
      setMessage('Invalid invitation link.');
      return;
    }

    attempted.current = true;
    setStatus('processing');

    (async () => {
      try {
        await respondToRequest({
          friendship_id: parseInt(friendshipId),
          user_id: user.id,
          action: backendAction,
        }).unwrap();
        setStatus('success');
        setMessage(isAccept ? 'Friend request accepted!' : 'Friend request declined.');
        setTimeout(() => navigate('/dashboard', { replace: true }), 2000);
      } catch (err) {
        setStatus('error');
        setMessage(err?.data?.message || 'Failed to respond to friend request.');
      }
    })();
  }, [user, friendshipId, action, backendAction, isAccept, respondToRequest, navigate]);

  const renderContent = () => {
    // Not logged in — prompt to log in first
    if (!user) {
      return (
        <>
          <LogIn className="h-12 w-12 text-teal-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Log in to continue</h2>
          <p className="text-sm text-gray-400 mb-6">
            You need to log in to {isAccept ? 'accept' : 'decline'} this friend request.
          </p>
          <button
            onClick={() => navigate(`/login?redirect=/friends/invitations/${friendshipId}?action=${action}`)}
            className="w-full h-11 rounded-lg text-sm font-semibold text-white transition-all duration-300 relative overflow-hidden group"
            style={{ background: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)', boxShadow: '0 4px 15px rgba(13,148,136,0.3)' }}
          >
            <span className="relative z-10">Go to Login</span>
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ background: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)' }} />
          </button>
        </>
      );
    }

    if (status === 'idle' || status === 'processing') {
      return (
        <>
          <Loader2 className="h-12 w-12 text-teal-400 mx-auto mb-4 animate-spin" />
          <h2 className="text-xl font-semibold text-white mb-2">
            {isAccept ? 'Accepting friend request...' : 'Declining friend request...'}
          </h2>
          <p className="text-sm text-gray-400">Please wait a moment.</p>
        </>
      );
    }

    if (status === 'success') {
      const Icon = isAccept ? UserCheck : UserX;
      return (
        <>
          <Icon className={`h-12 w-12 mx-auto mb-4 ${isAccept ? 'text-green-400' : 'text-orange-400'}`} />
          <h2 className="text-xl font-semibold text-white mb-2">{message}</h2>
          <p className="text-sm text-gray-400 mb-6">Redirecting to dashboard...</p>
          <button
            onClick={() => navigate('/dashboard', { replace: true })}
            className="w-full h-11 rounded-lg text-sm font-semibold text-white transition-all duration-300 relative overflow-hidden group"
            style={{ background: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)', boxShadow: '0 4px 15px rgba(13,148,136,0.3)' }}
          >
            <span className="relative z-10">Go to Dashboard</span>
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ background: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)' }} />
          </button>
        </>
      );
    }

    // Error
    return (
      <>
        <XCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-white mb-2">Something went wrong</h2>
        <p className="text-sm text-gray-400 mb-6">{message}</p>
        <button
          onClick={() => navigate('/dashboard', { replace: true })}
          className="w-full h-11 rounded-lg text-sm font-semibold text-white transition-all duration-300 relative overflow-hidden group"
          style={{ background: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)', boxShadow: '0 4px 15px rgba(13,148,136,0.3)' }}
        >
          <span className="relative z-10">Go to Dashboard</span>
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ background: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)' }} />
        </button>
      </>
    );
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{ background: '#0f172a' }}
    >
      <div
        className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full opacity-25"
        style={{ background: 'radial-gradient(circle, #7c3aed 0%, transparent 70%)', filter: 'blur(80px)' }}
      />
      <div
        className="absolute bottom-[-20%] right-[-10%] w-[400px] h-[400px] rounded-full opacity-20"
        style={{ background: 'radial-gradient(circle, #0d9488 0%, transparent 70%)', filter: 'blur(80px)' }}
      />

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

        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="bg-gradient-to-br from-teal-400 to-teal-600 rounded-lg p-2">
            <Receipt className="h-6 w-6 text-white" />
          </div>
          <span className="text-xl font-bold text-white">SpendSync</span>
        </div>

        {renderContent()}
      </div>
    </div>
  );
};

export default FriendInvitationHandler;
