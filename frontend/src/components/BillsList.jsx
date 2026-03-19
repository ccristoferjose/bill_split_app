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
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { toast } from 'sonner';
import { useSocket } from '../contexts/SocketContext';
import { useDispatch } from 'react-redux';
import { fetchAuthSession } from 'aws-amplify/auth';
import { api } from '../services/api';
import InvitationResponseModal from './InvitationResponseModal';
import BillSplitModal from './BillSplitModal';
import { useTranslation } from 'react-i18next';

const parseServiceBillDate = (raw) => {
  if (!raw) return null;
  const [y, m, d] = raw.split('T')[0].split('-').map(Number);
  return new Date(y, m - 1, d);
};

const isServiceBillInMonth = (bill, monthDate) => {
  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthDate);

  if (bill.bill_type === 'monthly') {
    const start = parseServiceBillDate(bill.due_date || bill.bill_date);
    if (!start) return false;
    return startOfMonth(start) <= monthStart;
  }

  const billDate = parseServiceBillDate(bill.due_date || bill.bill_date);
  if (!billDate) return true;
  return billDate >= monthStart && billDate <= monthEnd;
};

const BillsList = ({ userId, type, viewMonth, onSelectBill }) => {
  const { t } = useTranslation();
  const [selectedInvitation, setSelectedInvitation] = useState(null);
  const [splitBill, setSplitBill] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);
  const { socket, isConnected } = useSocket();
  const dispatch = useDispatch();
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
          if (type === 'invited' || type === 'all') {
            dispatch(api.util.invalidateTags(['Bill']));
            if (type === 'invited') refetchInvited();
            if (type === 'all') { refetchCreated(); refetchParticipating(); }
          }
          break;

        case 'bill_response':
        case 'bill_status_update':
        case 'bill_finalized':
          if (data.billId) {
            dispatch(api.util.invalidateTags([
              { type: 'Bill', id: data.billId },
              'Bill'
            ]));

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

    socket.on('notification', handleBillNotification);

    return () => {
      socket.off('notification', handleBillNotification);
    };
  }, [socket, type, dispatch, refetchCreated, refetchInvited, refetchParticipating]);

  // Status check function with proper error handling
  const handleStatusCheck = async (billId) => {
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.accessToken?.toString();
      const response = await fetch(`http://localhost:5001/bills/${billId}/check-status`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();
        toast.success(t('bills.billStatusUpdated'));
        console.log('Status check result:', result);

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
        toast.error(errorData.message || t('bills.failedCheckStatus'));
      }
    } catch (error) {
      console.error('Error checking status:', error);
      toast.error(t('bills.failedCheckStatus'));
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

  const { bills: rawBills, isLoading, error } = getBillsData();
  const bills = viewMonth
    ? rawBills.filter(b => isServiceBillInMonth(b, viewMonth))
    : rawBills;

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
      draft: t('bills.statusDraft'),
      pending_responses: t('bills.statusPendingResponses'),
      finalized: t('bills.statusFinalized'),
      paid: t('bills.statusPaid'),
      cancelled: t('bills.statusCancelled'),
      accepted: t('bills.statusAccepted'),
      rejected: t('bills.statusRejected'),
    };
    return labels[status] || status.replace('_', ' ');
  };

  const getBillTypeIcon = (billType) => {
    return billType === 'monthly' ? <Clock className="h-4 w-4" /> : <Calendar className="h-4 w-4" />;
  };

  const handleInvitationResponse = async (action) => {
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

      dispatch(api.util.invalidateTags(['Bill']));
      setSelectedInvitation(null);
    } catch (error) {
      console.error('Error refreshing after invitation response:', error);
    }
  };

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
      toast.success(t('bills.billsRefreshed'));
    } catch (error) {
      toast.error(t('bills.failedRefresh'));
    }
  };

  const handleMarkAsPaid = async (billId) => {
    try {
      await markBillAsPaid({ billId, user_id: userId }).unwrap();
      toast.success(t('bills.paymentMarked'));
    } catch (err) {
      console.error('Error marking as paid:', err);
      toast.error(err?.data?.message || t('bills.failedMarkPaid'));
    }
  };

  const handleDeleteBill = (billId, e) => {
    e.stopPropagation();
    setConfirmModal({
      title: t('bills.deleteBill'),
      message: t('bills.deleteConfirm'),
      confirmLabel: t('common.delete'),
      confirmClass: 'bg-red-600 hover:bg-red-700',
      onConfirm: async () => {
        try {
          const result = await deleteBill({ billId, user_id: userId }).unwrap();
          toast.success(result.message);
        } catch (err) {
          toast.error(err?.data?.message || t('bills.failedDeleteBill'));
        }
        setConfirmModal(null);
      }
    });
  };

  const handlePayInFull = (bill, e) => {
    e.stopPropagation();
    setConfirmModal({
      title: t('bills.payBillFull'),
      message: t('bills.payFullConfirm', { amount: bill.total_amount, title: bill.title }),
      confirmLabel: `${t('common.pay')} $${bill.total_amount}`,
      confirmClass: 'bg-green-600 hover:bg-green-700',
      onConfirm: async () => {
        try {
          await payBillInFull({ billId: bill.id, user_id: userId }).unwrap();
          toast.success(t('bills.billPaidFull'));
        } catch (err) {
          toast.error(err?.data?.message || t('bills.failedPayBill'));
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
        <p className="text-red-600">{t('bills.errorLoading')}: {error.message}</p>
        <Button onClick={handleManualRefresh} className="mt-2" variant="outline">
          {t('common.tryAgain')}
        </Button>
      </div>
    );
  }

  if (bills.length === 0) {
    return (
      <div className="text-center py-8">
        <Receipt className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500">{t('bills.noBills')}</p>
        <Button onClick={handleManualRefresh} className="mt-2" variant="outline">
          {t('common.refresh')}
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
            {isConnected ? t('bills.liveUpdates') : t('bills.offline')}
          </span>
        </div>
        <Button onClick={handleManualRefresh} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-1" />
          {t('common.refresh')}
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
                      <Badge variant="outline">{t('bills.monthly')}</Badge>
                    )}
                    {bill.status === 'pending_responses' && (type === 'created' || (type === 'all' && bill._isCreator)) && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleStatusCheck(bill.id)}
                        className="ml-2"
                      >
                        <RefreshCw className="h-3 w-3 mr-1" />
                        {t('common.checkStatus')}
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
                          {bill.total_invitations || 0} {t('bills.invited')}
                        </div>
                        {bill.creator_amount_owed && bill.status === 'finalized' && (
                          <>
                            <div className="flex items-center">
                              <DollarSign className="h-4 w-4 mr-1" />
                              {t('bills.yourShare')}: ${bill.creator_amount_owed}
                            </div>
                            <Badge className={bill.creator_payment_status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}>
                              {bill.creator_payment_status === 'paid' ? t('bills.youPaid') : t('bills.paymentPending')}
                            </Badge>
                          </>
                        )}
                      </>
                    )}
                    {type === 'invited' && bill.creator_name && (
                      <div>
                        {t('bills.createdBy')} {bill.creator_name}
                      </div>
                    )}
                    {(type === 'participating' || (type === 'all' && !bill._isCreator)) && (
                      <>
                        <div className="flex items-center">
                          <DollarSign className="h-4 w-4 mr-1" />
                          {t('bills.youOwe')}: ${bill.amount_owed}
                        </div>
                        {bill.creator_name && (
                          <div>{t('bills.createdBy')} {bill.creator_name}</div>
                        )}
                        <Badge className={bill.payment_status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}>
                          {bill.payment_status === 'paid' ? t('bills.youPaid') : t('bills.paymentPending')}
                        </Badge>
                      </>
                    )}
                  </div>

                  {bill.due_date && (
                    <p className="text-sm text-gray-500">
                      {t('common.due')}: {format(new Date(bill.due_date), 'MMM dd, yyyy')}
                    </p>
                  )}

                  {/* Enhanced invitation status display */}
                  {type === 'invited' && (
                    <div className="mt-3 flex space-x-2">
                      {bill.invitation_status === 'pending' && (
                        <Badge className="bg-orange-100 text-orange-800">
                          {t('bills.awaitingResponse')} - ${bill.proposed_amount}
                        </Badge>
                      )}
                      {bill.invitation_status === 'accepted' && (
                        <Badge className="bg-green-100 text-green-800">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          {t('bills.accepted')} - ${bill.proposed_amount}
                        </Badge>
                      )}
                      {bill.invitation_status === 'rejected' && (
                        <Badge className="bg-red-100 text-red-800">
                          <XCircle className="h-3 w-3 mr-1" />
                          {t('bills.rejected')}
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
                      {t('common.respond')}
                    </Button>
                  )}

                  {/* Mark as paid */}
                  {(() => {
                    if (bill.status !== 'finalized') return null;
                    const isCreator = type === 'all' ? bill._isCreator : type === 'created';
                    if (isCreator && bill.creator_payment_status === 'pending') {
                      return (
                        <Button
                          size="sm"
                          onClick={() => handleMarkAsPaid(bill.id)}
                          disabled={isMarkingPaid}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          {isMarkingPaid ? t('common.processing') : t('common.pay')}
                        </Button>
                      );
                    }
                    if (!isCreator && bill.payment_status === 'pending') {
                      return (
                        <Button
                          size="sm"
                          onClick={() => handleMarkAsPaid(bill.id)}
                          disabled={isMarkingPaid}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          {isMarkingPaid ? t('common.processing') : t('common.pay')}
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
                            {isPayingFull ? t('common.processing') : t('common.pay')}
                          </Button>
                        )}
                        {showSplit && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => { e.stopPropagation(); setSplitBill(bill); }}
                          >
                            <Users className="h-4 w-4 mr-1" />
                            {t('common.split')}
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
                          {t('common.remove')}
                        </Button>
                      );
                    }

                    if (!isCreator) return null;

                    const canDelete =
                      ['draft', 'cancelled'].includes(bill.status) ||
                      bill.bill_type === 'monthly' ||
                      ['finalized', 'pending_responses'].includes(bill.status);

                    if (!canDelete) return null;

                    const label = bill.bill_type === 'monthly' && !['draft', 'cancelled'].includes(bill.status) ? t('common.cancel') : t('common.delete');

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
                    {t('common.viewDetails')}
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
                {t('common.cancel')}
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
