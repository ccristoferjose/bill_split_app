import React, { createContext, useContext, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { io } from 'socket.io-client';
import { toast } from 'sonner';

const SocketContext = createContext();

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const { user, isAuthenticated } = useSelector((state) => state.auth);

  useEffect(() => {
    if (isAuthenticated && user) {
      // Connect to Socket.IO server with reconnection options
      const newSocket = io('http://localhost:5001', {
        withCredentials: true,
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000
      });

      newSocket.on('connect', () => {
        console.log('Socket connected:', newSocket.id);
        // Join user's personal room
        newSocket.emit('join', user.id);
        console.log(`Joined room for user ${user.id}`);
      });

      newSocket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
        toast.error('Connection to notification server lost. Retrying...');
      });

      newSocket.on('disconnect', (reason) => {
        console.log('Socket disconnected:', reason);
        if (reason === 'io server disconnect') {
          // Server disconnected us, try to reconnect
          newSocket.connect();
        }
      });

      newSocket.on('reconnect', (attemptNumber) => {
        console.log('Socket reconnected after', attemptNumber, 'attempts');
        // Re-join room after reconnection
        newSocket.emit('join', user.id);
        toast.success('Reconnected to notification server');
      });

      newSocket.on('reconnect_error', (error) => {
        console.error('Socket reconnection error:', error);
        toast.error('Failed to reconnect to notification server');
      });

      newSocket.on('new_invitation', (data) => {
        console.log('New invitation received:', data);
        toast.info(
          `New bill invitation: ${data.bill_title} ($${data.bill_total})`,
          {
            description: `From user ${data.invited_by}. You owe $${data.proposed_amount}`,
            action: {
              label: 'View',
              onClick: () => {
                // Navigate to bills page or show notification
                window.location.href = '/bills';
              }
            }
          }
        );
      });

      newSocket.on('invitation_response', (data) => {
        console.log('Invitation response received:', data);
        const actionText = data.action === 'accept' ? 'accepted' : 'rejected';
        toast.info(
          `User ${data.user_id} ${actionText} your bill invitation`,
          {
            description: `They ${actionText} to pay $${data.proposed_amount}`,
            action: {
              label: 'View Bill',
              onClick: () => {
                window.location.href = `/bills/${data.billId}`;
              }
            }
          }
        );
      });

      newSocket.on('bill_finalized', (data) => {
        console.log('Bill finalized notification:', data);
        toast.success(
          `Bill "${data.bill_title}" has been finalized!`,
          {
            description: `Total: $${data.total_amount} with ${data.participants_count} participants`,
            action: {
              label: 'View Details',
              onClick: () => {
                window.location.href = `/bills/${data.billId}`;
              }
            }
          }
        );
      });

      setSocket(newSocket);

      return () => {
        if (newSocket.connected) {
          newSocket.disconnect();
        }
      };
    }
  }, [isAuthenticated, user]);

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
};
