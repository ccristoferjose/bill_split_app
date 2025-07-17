import React, { createContext, useContext, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { io } from 'socket.io-client';
import { toast } from 'sonner';

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
  const { user } = useSelector((state) => state.auth);

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
        
        // Show toast notification based on type
        switch (notification.type) {
          case 'bill_invitation':
            toast.info(notification.title, {
              description: notification.message,
              duration: 5000,
              action: {
                label: 'View',
                onClick: () => {
                  // You can add navigation logic here if needed
                  console.log('Navigate to bill:', notification.data.billId);
                }
              }
            });
            break;
          
          case 'bill_response':
            toast.success(notification.title, {
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
  }, [user]);

  const value = {
    socket,
    isConnected,
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};
