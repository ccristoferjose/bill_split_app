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
      const newSocket = io('http://localhost:5001', {
        withCredentials: true,
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
                  // Navigation logic here
                  window.location.href = `/bills/${notification.data.billId}`;
                }
              }
            });
            break;
          
          case 'bill_response':
            // Check if it's specifically an invitation acceptance
            if (notification.data?.action === 'accept') {
              toast.success('Invitation accepted successfully', {
                description: notification.message || `You've been added to ${notification.data?.billTitle || 'the bill'}`,
                duration: 4000,
                action: {
                  label: 'View Details',
                  onClick: () => {
                    window.location.href = `/bills/${notification.data.billId}`;
                  }
                }
              });
            } else if (notification.data?.action === 'reject') {
              toast.info('Invitation rejected', {
                description: notification.message,
                duration: 4000,
              });
            } else {
              // Default bill response handling
              toast.success(notification.title, {
                description: notification.message,
                duration: 4000,
                action: {
                  label: 'View Details',
                  onClick: () => {
                    window.location.href = `/bills/${notification.data.billId}`;
                  }
                }
              });
            }
            break;

          case 'bill_status_update':
            // New case for status updates
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
          // In your SocketContext.jsx, add to the notification handler:

          // In your SocketContext.jsx, add to the notification handler:
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
        toast.error('Connection Error', {
          description: 'Failed to connect to real-time notifications',
        });
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