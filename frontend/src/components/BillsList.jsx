import React, { useState, useEffect } from 'react';
import {
  useGetUserCreatedBillsQuery,
  useGetUserInvitedBillsQuery,
  useGetUserParticipatingBillsQuery,
  useMarkBillAsPaidMutation,
  useDeleteBillMutation,
  usePayBillInFullMutation
} from '../services/api';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Calendar, DollarSign, Users, Clock, Receipt, CheckCircle, XCircle, RefreshCw, Trash2, Star, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useSocket } from '../contexts/SocketContext';
import { useDispatch, useSelector } from 'react-redux'; // Added useSelector
import { api } from '../services/api';
import InvitationResponseModal from './InvitationResponseModal';
import BillSplitModal from './BillSplitModal';

const BillsList = ({ userId, type, onSelectBill }) => {
  const [selectedInvitation, setSelectedInvitation] = useState(null);
  const [splitBill, setSplitBill] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);
  const { socket, isConnected } = useSocket();
  const dispatch = useDispatch();
  const { token } = useSelector((state) => state.auth);
  const [markBillAsPaid, { isLoading: isMarkingPaid }] = useMarkBillAsPaidMutation();
  const [deleteBill, { isLoading: isDeleting }] = useDeleteBillMutation();
  const [payBillInFull, { isLoading: isPayingFull }] = usePayBillInFullMutation();
  
  // Queries with shorter polling intervals for invited bills
  const {
    data: createdBills,
    isLoading: isLoadingCreated,
    error: createdError,
    refetch: refetchCreated
  } = useGetUserCreatedBillsQuery(userId, {
    skip: type !== 'created' && type !== 'all',
    pollingInterval: (type === 'created' || type === 'all') ? 30000 : 0
  });

  const {
    data: invitedBills,
    isLoading: isLoadingInvited,
    error: invitedError,
    refetch: refetchInvited
  } = useGetUserInvitedBillsQuery(userId, {
    skip: type !== 'invited',
    pollingInterval: type === 'invited' ? 15000 : 0
  });

  const {
    data: participatingBills,
    isLoading: isLoadingParticipating,
    error: participatingError,
    refetch: refetchParticipating
  } = useGetUserParticipatingBillsQuery(userId, {
    skip: type !== 'participating' && type !== 'all',
    pollingInterval: (type === 'participating' || type === 'all') ? 30000 : 0
  });

  // Socket event handlers for real-time updates
  useEffect(() => {
    if (!socket) return;

    const handleBillNotification = (notification) => {
      console.log('BillsList received notification:', notification);
      
      const { type: notificationType, data } = notification;
      
      // Handle different notification types
      switch (notificationType) {
        case 'bill_invitation':
          // New invitation received
          if (type === 'invited' || type === 'all') {
            dispatch(api.util.invalidateTags(['Bill']));
            if (type === 'invited') refetchInvited();
            if (type === 'all') { refetchCreated(); refetchParticipating(); }
          }
          break;
          
        case 'bill_response':
        case 'bill_status_update':
        case 'bill_finalized': // Added this case
          // Bill response, status update, or finalization
          if (data.billId) {
            // Invalidate cache for the specific bill
            dispatch(api.util.invalidateTags([
              { type: 'Bill', id: data.billId },
              'Bill' // Invalidate all bill queries to be safe
            ]));
            
            // Refetch the appropriate query based on current view
            switch (type) {
              case 'created':
                refetchCreated();
                break;
              case 'invited':
                refetchInvited();
                break;
              case 'participating':
                refetchParticipating();
                break;
              case 'all':
                refetchCreated();
                refetchParticipating();
                break;
            }
          }
          break;
          
        default:
          break;
      }
    };

    // Listen for notifications
    socket.on('notification', handleBillNotification);

    return () => {
      socket.off('notification', handleBillNotification);
    };
  }, [socket, type, dispatch, refetchCreated, refetchInvited, refetchParticipating]);

  // Status check function with proper error handling
  const handleStatusCheck = async (billId) => {
    try {
      const response = await fetch(`http://localhost:5001/bills/${billId}/check-status`, { // Added full URL
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const result = await response.json();
        toast.success('Bill status updated');
        console.log('Status check result:', result);
        
        // Refresh the current view
        switch (type) {
          case 'created':
            await refetchCreated();
            break;
          case 'invited':
            await refetchInvited();
            break;
          case 'participating':
            await refetchParticipating();
            break;
          case 'all':
            await refetchCreated();
            await refetchParticipating();
            break;
        }
      } else {
        const errorData = await response.json();
        toast.error(errorData.message || 'Failed to check bill status');
      }
    } catch (error) {
      console.error('Error checking status:', error);
      toast.error('Failed to check bill status');
    }
  };

  const getBillsData = () => {
    switch (type) {
      case 'created':
        return { bills: createdBills?.bills || [], isLoading: isLoadingCreated, error: createdError };
      case 'invited':
        return { bills: invitedBills?.bills || [], isLoading: isLoadingInvited, error: invitedError };
      case 'participating':
        return { bills: participatingBills?.bills || [], isLoading: isLoadingParticipating, error: participatingError };
      case 'all': {
        const created = (createdBills?.bills || []).map(b => ({ ...b, _isCreator: true }));
        const participating = (participatingBills?.bills || []).filter(b => !created.some(c => c.id === b.id)).map(b => ({ ...b, _isCreator: false }));
        const merged = [...created, ...participating].sort((a, b) => new Date(b.bill_date) - new Date(a.bill_date));
        return { bills: merged, isLoading: isLoadingCreated || isLoadingParticipating, error: createdError || participatingError };
      }
      default:
        return { bills: [], isLoading: false, error: null };
    }
  };

  const { bills, isLoading, error } = getBillsData();

  const getStatusColor = (status) => {
    const colors = {
      draft: 'bg-gray-100 text-gray-800',
      pending_responses: 'bg-yellow-100 text-yellow-800',
      finalized: 'bg-orange-100 text-orange-800',
      paid: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
      accepted: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getStatusLabel = (status) => {
    const labels = {
      draft: 'Draft',
      pending_responses: 'Pending Responses',
      finalized: 'Awaiting Payment',
      paid: 'Paid',
      cancelled: 'Cancelled',
      accepted: 'Accepted',
      rejected: 'Rejected',
    };
    return labels[status] || status.replace('_', ' ');
  };

  const getBillTypeIcon = (billType) => {
    return billType === 'monthly' ? <Clock className="h-4 w-4" /> : <Calendar className="h-4 w-4" />;
  };

  // Enhanced invitation response handler
  const handleInvitationResponse = async (action) => {
    try {
      // Force refresh the current view
      switch (type) {
        case 'created':
          await refetchCreated();
          break;
        case 'invited':
          await refetchInvited();
          break;
        case 'participating':
          await refetchParticipating();
          break;
        case 'all':
          await refetchCreated();
          await refetchParticipating();
          break;
      }
      
      // Also invalidate all bill-related cache
      dispatch(api.util.invalidateTags(['Bill']));
      
      //toast.success(`Invitation ${action}ed successfully!`);
      
      // Close the modal
      setSelectedInvitation(null);
    } catch (error) {
      console.error('Error refreshing after invitation response:', error);
    }
  };

  // Manual refresh function
  const handleManualRefresh = async () => {
    try {
      switch (type) {
        case 'created':
          await refetchCreated();
          break;
        case 'invited':
          await refetchInvited();
          break;
        case 'participating':
          await refetchParticipating();
          break;
        case 'all':
          await refetchCreated();
          await refetchParticipating();
          break;
      }
      toast.success('Bills refreshed!');
    } catch (error) {
      toast.error('Failed to refresh bills');
    }
  };

  const handleMarkAsPaid = async (billId) => {
    try {
      await markBillAsPaid({ billId, user_id: userId }).unwrap();
      toast.success('Payment marked successfully!');
    } catch (err) {
      console.error('Error marking as paid:', err);
      toast.error(err?.data?.message || 'Failed to mark as paid');
    }
  };

  const handleDeleteBill = (billId, e) => {
    e.stopPropagation();
    setConfirmModal({
      title: 'Delete Bill',
      message: 'Are you sure? This action cannot be undone.',
      confirmLabel: 'Delete',
      confirmClass: 'bg-red-600 hover:bg-red-700',
      onConfirm: async () => {
        try {
          const result = await deleteBill({ billId, user_id: userId }).unwrap();
          toast.success(result.message);
        } catch (err) {
          toast.error(err?.data?.message || 'Failed to delete bill');
        }
        setConfirmModal(null);
      }
    });
  };

  const handlePayInFull = (bill, e) => {
    e.stopPropagation();
    setConfirmModal({
      title: 'Pay Bill in Full',
      message: `You are about to pay the full amount of $${bill.total_amount} for "${bill.title}".`,
      confirmLabel: `Pay $${bill.total_amount}`,
      confirmClass: 'bg-green-600 hover:bg-green-700',
      onConfirm: async () => {
        try {
          await payBillInFull({ billId: bill.id, user_id: userId }).unwrap();
          toast.success('Bill paid in full!');
        } catch (err) {
          toast.error(err?.data?.message || 'Failed to pay bill');
        }
        setConfirmModal(null);
      }
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600">Error loading bills: {error.message}</p>
        <Button onClick={handleManualRefresh} className="mt-2" variant="outline">
          Try Again
        </Button>
      </div>
    );
  }

  if (bills.length === 0) {
    return (
      <div className="text-center py-8">
        <Receipt className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500">No bills found</p>
        <Button onClick={handleManualRefresh} className="mt-2" variant="outline">
          Refresh
        </Button>
      </div>
    );
  }

  return (
    <>
      {/* Connection status indicator */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center space-x-2">
          <div 
            className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}
          />
          <span className="text-xs text-gray-500">
            {isConnected ? 'Live updates active' : 'Offline - using cached data'}
          </span>
        </div>
        <Button onClick={handleManualRefresh} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-1" />
          Refresh
        </Button>
      </div>

      <div className="space-y-4">
        {bills.map((bill) => (
          <Card key={bill.id} className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    {getBillTypeIcon(bill.bill_type)}
                    <h3 className="font-semibold text-lg">{bill.title}</h3>
                    {(type === 'all' ? bill._isCreator : type === 'created') && (
                      <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                    )}
                    <Badge className={getStatusColor(bill.status)}>
                      {getStatusLabel(bill.status)}
                    </Badge>
                    {bill.bill_type === 'monthly' && (
                      <Badge variant="outline">Monthly</Badge>
                    )}
                    {bill.status === 'pending_responses' && (type === 'created' || (type === 'all' && bill._isCreator)) && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleStatusCheck(bill.id)}
                        className="ml-2"
                      >
                        <RefreshCw className="h-3 w-3 mr-1" />
                        Check Status
                      </Button>
                    )}
                  </div>
                  
                  <div className="flex items-center space-x-4 text-sm text-gray-600 mb-3">
                    <div className="flex items-center">
                      <DollarSign className="h-4 w-4 mr-1" />
                      ${bill.total_amount}
                    </div>
                    <div className="flex items-center">
                      <Calendar className="h-4 w-4 mr-1" />
                      {format(new Date(bill.bill_date), 'MMM dd, yyyy')}
                    </div>
                    {(type === 'created' || (type === 'all' && bill._isCreator)) && (
                      <>
                        <div className="flex items-center">
                          <Users className="h-4 w-4 mr-1" />
                          {bill.total_invitations || 0} invited
                        </div>
                        {bill.creator_amount_owed && bill.status === 'finalized' && (
                          <>
                            <div className="flex items-center">
                              <DollarSign className="h-4 w-4 mr-1" />
                              Your share: ${bill.creator_amount_owed}
                            </div>
                            <Badge className={bill.creator_payment_status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}>
                              {bill.creator_payment_status === 'paid' ? 'You Paid' : 'Payment Pending'}
                            </Badge>
                          </>
                        )}
                      </>
                    )}
                    {type === 'invited' && bill.creator_name && (
                      <div>
                        Created by {bill.creator_name}
                      </div>
                    )}
                    {(type === 'participating' || (type === 'all' && !bill._isCreator)) && (
                      <>
                        <div className="flex items-center">
                          <DollarSign className="h-4 w-4 mr-1" />
                          You owe: ${bill.amount_owed}
                        </div>
                        {bill.creator_name && (
                          <div>Created by {bill.creator_name}</div>
                        )}
                        <Badge className={bill.payment_status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}>
                          {bill.payment_status === 'paid' ? 'You Paid' : 'Payment Pending'}
                        </Badge>
                      </>
                    )}
                  </div>

                  {bill.due_date && (
                    <p className="text-sm text-gray-500">
                      Due: {format(new Date(bill.due_date), 'MMM dd, yyyy')}
                    </p>
                  )}

                  {/* Enhanced invitation status display */}
                  {type === 'invited' && (
                    <div className="mt-3 flex space-x-2">
                      {bill.invitation_status === 'pending' && (
                        <Badge className="bg-orange-100 text-orange-800">
                          Awaiting your response - ${bill.proposed_amount}
                        </Badge>
                      )}
                      {bill.invitation_status === 'accepted' && (
                        <Badge className="bg-green-100 text-green-800">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Accepted - ${bill.proposed_amount}
                        </Badge>
                      )}
                      {bill.invitation_status === 'rejected' && (
                        <Badge className="bg-red-100 text-red-800">
                          <XCircle className="h-3 w-3 mr-1" />
                          Rejected
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
                
                <div className="flex flex-wrap gap-2">
                  {type === 'invited' && bill.invitation_status === 'pending' && (
                    <Button
                      size="sm"
                      onClick={() => setSelectedInvitation(bill)}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Respond
                    </Button>
                  )}

                  {/* Mark as paid — for any participant (including creator) */}
                  {(() => {
                    if (bill.status !== 'finalized') return null;
                    const isCreator = type === 'all' ? bill._isCreator : type === 'created';
                    // Creator: use creator_payment_status from getCreatedBills
                    if (isCreator && bill.creator_payment_status === 'pending') {
                      return (
                        <Button
                          size="sm"
                          onClick={() => handleMarkAsPaid(bill.id)}
                          disabled={isMarkingPaid}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          {isMarkingPaid ? 'Processing...' : 'Pay'}
                        </Button>
                      );
                    }
                    // Participant: use payment_status from getParticipatingBills
                    if (!isCreator && bill.payment_status === 'pending') {
                      return (
                        <Button
                          size="sm"
                          onClick={() => handleMarkAsPaid(bill.id)}
                          disabled={isMarkingPaid}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          {isMarkingPaid ? 'Processing...' : 'Pay'}
                        </Button>
                      );
                    }
                    return null;
                  })()}

                  {/* Owner: Pay in full & Split buttons */}
                  {(() => {
                    const isCreator = type === 'all' ? bill._isCreator : type === 'created';
                    if (!isCreator || bill.status === 'paid') return null;

                    const showPay = ['draft', 'cancelled'].includes(bill.status);
                    const showSplit = bill.status !== 'paid';

                    return (
                      <>
                        {showPay && (
                          <Button
                            size="sm"
                            onClick={(e) => handlePayInFull(bill, e)}
                            disabled={isPayingFull}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <DollarSign className="h-4 w-4 mr-1" />
                            {isPayingFull ? 'Processing...' : 'Pay'}
                          </Button>
                        )}
                        {showSplit && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => { e.stopPropagation(); setSplitBill(bill); }}
                          >
                            <Users className="h-4 w-4 mr-1" />
                            Split
                          </Button>
                        )}
                      </>
                    );
                  })()}

                  {/* Delete / Remove / Cancel */}
                  {(() => {
                    const isCreator = type === 'all' ? bill._isCreator : type === 'created';
                    const isPaidOneTime = bill.bill_type === 'one_time' && bill.status === 'paid';

                    if (isPaidOneTime) {
                      return (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => handleDeleteBill(bill.id, e)}
                          disabled={isDeleting}
                          className="text-red-600 hover:bg-red-50 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Remove
                        </Button>
                      );
                    }

                    if (!isCreator) return null;

                    const canDelete =
                      ['draft', 'cancelled'].includes(bill.status) ||
                      bill.bill_type === 'monthly' ||
                      ['finalized', 'pending_responses'].includes(bill.status);

                    if (!canDelete) return null;

                    const label = bill.bill_type === 'monthly' && !['draft', 'cancelled'].includes(bill.status) ? 'Cancel' : 'Delete';

                    return (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => handleDeleteBill(bill.id, e)}
                        disabled={isDeleting}
                        className="text-red-600 hover:bg-red-50 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        {label}
                      </Button>
                    );
                  })()}

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onSelectBill(bill.id)}
                  >
                    View Details
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Enhanced Invitation Response Modal */}
      {selectedInvitation && (
        <InvitationResponseModal
          bill={selectedInvitation}
          invitation={{
            status: selectedInvitation.invitation_status,
            proposed_amount: selectedInvitation.proposed_amount
          }}
          onClose={() => setSelectedInvitation(null)}
          onResponse={handleInvitationResponse}
        />
      )}

      {/* Split Bill Modal */}
      {splitBill && (
        <BillSplitModal
          billId={splitBill.id}
          billAmount={splitBill.total_amount}
          billTitle={splitBill.title}
          onClose={() => setSplitBill(null)}
        />
      )}

      {/* Confirmation Modal */}
      {confirmModal && (
        <Dialog open={true} onOpenChange={() => setConfirmModal(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
                {confirmModal.title}
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-gray-600">{confirmModal.message}</p>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setConfirmModal(null)}>
                Cancel
              </Button>
              <Button className={confirmModal.confirmClass} onClick={confirmModal.onConfirm}>
                {confirmModal.confirmLabel}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};

export default BillsList;