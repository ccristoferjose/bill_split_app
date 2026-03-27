import React, { createContext, useContext, useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { io } from 'socket.io-client';
import { toast } from 'sonner';
import { api } from '../services/api'; // Import your API service

const SocketContext = createContext();

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastNotification, setLastNotification] = useState(null);
  const { user } = useSelector((state) => state.auth);
  const dispatch = useDispatch();

  useEffect(() => {
    if (user) {
      // Initialize socket connection
      const newSocket = io(import.meta.env.VITE_API_URL || 'http://localhost:5001', {
        withCredentials: true,
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 2000,
        reconnectionDelayMax: 30000,
      });

      newSocket.on('connect', () => {
        console.log('Connected to server');
        setIsConnected(true);
        
        // Authenticate user with socket
        newSocket.emit('authenticate', { userId: user.id });
      });

      newSocket.on('disconnect', () => {
        console.log('Disconnected from server');
        setIsConnected(false);
      });

      // Handle incoming notifications
      newSocket.on('notification', (notification) => {
        console.log('Received notification:', notification);
        setLastNotification(notification);
        
        // Invalidate RTK Query cache based on notification type
        if (notification.data?.billId) {
          // Invalidate bill-related queries
          dispatch(
            api.util.invalidateTags([
              'Bill',
              { type: 'BillStatus', id: notification.data.billId }
            ])
          );
        }

        // Show toast notification based on type
        switch (notification.type) {
          case 'bill_invitation':
            toast.info(notification.title, {
              description: notification.message,
              duration: 5000,
              action: {
                label: 'View',
                onClick: () => {
                  window.location.href = `/dashboard?tab=invitations`;
                }
              }
            });
            break;
          
          case 'bill_response':
            // Only show toast if the notification is for someone else's action
            // (not the current user's own response)
            if (notification.data?.responderId !== user.id) {
              toast.success(notification.title, {
                description: notification.message,
                duration: 4000,
                action: {
                  label: 'View Details',
                  onClick: () => {
                    window.location.href = `/dashboard?tab=invitations`;
                  }
                }
              });
            }
            break;

          case 'bill_status_update':
            dispatch(api.util.invalidateTags(['Bill']));
            toast.info('Bill Status Updated', {
              description: notification.message,
              duration: 4000,
            });
            break;
          
          case 'payment_reminder':
            toast.warning(notification.title, {
              description: notification.message,
              duration: 6000,
            });
            break;
          case 'transaction_split_invitation':
            dispatch(api.util.invalidateTags(['Transaction']));
            toast.info(notification.title, {
              description: notification.message,
              duration: 5000,
              action: {
                label: 'View',
                onClick: () => { window.location.href = '/dashboard?tab=invitations'; },
              },
            });
            break;

          case 'transaction_split_response':
            dispatch(api.util.invalidateTags(['Transaction']));
            toast.info(notification.title, {
              description: notification.message,
              duration: 4000,
            });
            break;

          case 'transaction_all_responded':
            // Clears invitation cards for all participants when everyone has responded
            dispatch(api.util.invalidateTags(['Transaction']));
            if (notification.data?.status === 'all_accepted') {
              toast.success(notification.title, {
                description: notification.message,
                duration: 5000,
              });
            }
            break;

          case 'transaction_payment':
            dispatch(api.util.invalidateTags(['Transaction']));
            if (notification.data?.allPaid) {
              toast.success(notification.title, {
                description: notification.message,
                duration: 5000,
              });
            } else {
              toast.info(notification.title, {
                description: notification.message,
                duration: 4000,
              });
            }
            break;

          case 'friend_request':
            dispatch(api.util.invalidateTags(['Friend']));
            toast.info(notification.title, {
              description: notification.message,
              duration: 5000,
              action: {
                label: 'View',
                onClick: () => {
                  window.location.href = `/dashboard?tab=friends`;
                }
              }
            });
            break;

          case 'friend_accepted':
            dispatch(api.util.invalidateTags(['Friend']));
            toast.success(notification.title, {
              description: notification.message,
              duration: 4000,
            });
            break;

          case 'bill_finalized':
            toast.success(notification.title, {
              description: notification.message,
              duration: 5000,
            });
            // Invalidate all bill-related cache
            if (notification.data.billId) {
              dispatch(api.util.invalidateTags([
                'Bill',
                { type: 'BillStatus', id: notification.data.billId },
                { type: 'Bill', id: notification.data.billId }
              ]));
            }
            break;
          
          default:
            toast(notification.title, {
              description: notification.message,
              duration: 4000,
            });
        }
      });

      newSocket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
        // Silent retry — don't show toast on transient connection failures
        // (e.g., mobile browser backgrounded, network switch, token refresh)
      });

      setSocket(newSocket);

      return () => {
        newSocket.close();
      };
    } else {
      // Clean up socket when user logs out
      if (socket) {
        socket.close();
        setSocket(null);
        setIsConnected(false);
      }
    }
  }, [user, dispatch]);

  const value = {
    socket,
    isConnected,
    lastNotification, // Export last notification for components to use
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};