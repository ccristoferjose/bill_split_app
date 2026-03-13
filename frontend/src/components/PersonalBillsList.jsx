import React, { useState } from 'react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import {
  useGetUserTransactionsQuery,
  useDeleteTransactionMutation,
  useMarkTransactionPaidMutation,
  useMarkParticipantPaidMutation,
  useMarkTransactionCyclePaidMutation,
} from '../services/api';
import { useSelector } from 'react-redux';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  CalendarDays, DollarSign, Users, Trash2, AlertTriangle,
  CheckCircle, Clock, RotateCcw, XCircle, RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import TransactionSplitModal from './TransactionSplitModal';
import TransactionBillDetailModal from './TransactionBillDetailModal';
import { useResendTransactionInvitationMutation } from '../services/api';

const RECURRENCE_LABELS = {
  monthly: 'Monthly',
  weekly: 'Weekly',
  yearly: 'Yearly',
  custom: 'Custom',
};

const parseLocalDate = (raw) => {
  if (!raw) return null;
  const [y, m, d] = raw.split('T')[0].split('-').map(Number);
  return new Date(y, m - 1, d);
};

const isBillInMonth = (bill, monthDate) => {
  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthDate);

  if (bill.recurrence === 'monthly') {
    const start = parseLocalDate(bill.due_date);
    if (!start) return false;
    return startOfMonth(start) <= monthStart;
  }

  if (bill.recurrence === 'yearly') {
    const start = parseLocalDate(bill.due_date);
    if (!start) return false;
    return start.getMonth() === monthDate.getMonth();
  }

  if (bill.recurrence === 'weekly') {
    const start = parseLocalDate(bill.due_date);
    if (!start) return false;
    return start <= monthEnd;
  }

  const txDate = parseLocalDate(bill.due_date || bill.date);
  if (!txDate) return true;
  return txDate >= monthStart && txDate <= monthEnd;
};

const PersonalBillsList = ({ userId, viewMonth }) => {
  const { user } = useSelector((state) => state.auth);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [splitBill, setSplitBill] = useState(null);
  const [detailBill, setDetailBill] = useState(null);

  const { data, isLoading, error, refetch } = useGetUserTransactionsQuery(userId);
  const [deleteTransaction, { isLoading: isDeleting }] = useDeleteTransactionMutation();
  const [markTransactionPaid] = useMarkTransactionPaidMutation();
  const [markParticipantPaid] = useMarkParticipantPaidMutation();
  const [markCyclePaid] = useMarkTransactionCyclePaidMutation();
  const [resendInvitation] = useResendTransactionInvitationMutation();

  // Cycle context derived from viewMonth
  const cycleYear = (viewMonth || new Date()).getFullYear();
  const cycleMonth = (viewMonth || new Date()).getMonth() + 1; // 1-12

  const bills = (data?.transactions || [])
    .filter(t => t.type === 'bill')
    .filter(t => !viewMonth || isBillInMonth(t, viewMonth));

  // Returns true if a given user has paid for the current viewed cycle
  const hasCyclePaid = (bill, uid) =>
    (bill.cycle_payments || []).some(
      cp =>
        Number(cp.user_id) === Number(uid) &&
        Number(cp.cycle_year) === cycleYear &&
        Number(cp.cycle_month) === cycleMonth
    );

  // Effective due date adjusted to viewMonth for recurring bills
  const getEffectiveDueDate = (bill) => {
    if (!viewMonth) return parseLocalDate(bill.due_date);

    if (bill.recurrence === 'monthly') {
      const start = parseLocalDate(bill.due_date);
      if (!start) return null;
      const clamped = Math.min(start.getDate(), endOfMonth(viewMonth).getDate());
      return new Date(viewMonth.getFullYear(), viewMonth.getMonth(), clamped);
    }

    if (bill.recurrence === 'weekly') {
      const start = parseLocalDate(bill.due_date);
      if (!start) return null;
      const monthStart = startOfMonth(viewMonth);
      const monthEnd   = endOfMonth(viewMonth);
      let d = new Date(start.getTime());
      // Advance to first occurrence on or after the start of viewMonth
      while (d < monthStart) d = new Date(d.getTime() + 7 * 86400000);
      return d <= monthEnd ? d : null;
    }

    return parseLocalDate(bill.due_date);
  };

  // --- Handlers ---

  const isCycleBased = (bill) =>
    bill.recurrence === 'monthly' || bill.recurrence === 'weekly';

  const handleTogglePaid = async (bill) => {
    try {
      if (isCycleBased(bill)) {
        const result = await markCyclePaid({ transactionId: bill.id, year: cycleYear, month: cycleMonth, user_id: userId }).unwrap();
        toast.success(result.message);
      } else {
        const result = await markTransactionPaid({ transactionId: bill.id, user_id: userId }).unwrap();
        toast.success(result.message);
      }
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to update payment status');
    }
  };

  const handleToggleParticipantPaid = async (bill, participant) => {
    try {
      if (isCycleBased(bill)) {
        const result = await markCyclePaid({ transactionId: bill.id, year: cycleYear, month: cycleMonth, user_id: userId }).unwrap();
        toast.success(result.message);
      } else {
        const result = await markParticipantPaid({
          transactionId: bill.id,
          participantUserId: participant.user_id,
          user_id: userId,
        }).unwrap();
        toast.success(result.message);
      }
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to update participant status');
    }
  };

  const handleDelete = (bill) => {
    setConfirmDelete({
      bill,
      onConfirm: async () => {
        try {
          await deleteTransaction({ transactionId: bill.id, user_id: userId }).unwrap();
          toast.success('Bill deleted');
        } catch (err) {
          toast.error(err?.data?.message || 'Failed to delete bill');
        }
        setConfirmDelete(null);
      },
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(2)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
              <div className="h-3 bg-gray-200 rounded w-1/2" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-6">
        <p className="text-red-600 text-sm">Error loading bills</p>
        <Button onClick={refetch} className="mt-2" variant="outline" size="sm">Try Again</Button>
      </div>
    );
  }

  if (bills.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        <CalendarDays className="h-10 w-10 mx-auto mb-2 opacity-40" />
        <p className="text-sm">
          {viewMonth
            ? `No bills for ${format(viewMonth, 'MMMM yyyy')}`
            : 'No personal bills yet'}
        </p>
        {!viewMonth && <p className="text-xs mt-1">Create a bill using the "New Transaction" button</p>}
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {bills.map((bill) => {
          const isOwner = bill._role === 'owner';
          const isMonthly = bill.recurrence === 'monthly';

          // Effective paid status for this bill/cycle
          const myIsPaid = isMonthly
            ? hasCyclePaid(bill, userId)
            : bill.status === 'paid';

          const effectiveDueDate = getEffectiveDueDate(bill);

          // For participant view: find current user's participant record
          const myParticipantRecord = !isOwner
            ? bill.participants?.find(p => String(p.user_id) === String(userId))
            : null;

          // Participant's effective paid status (for the "I Paid" area)
          const myParticipantIsPaid = isMonthly
            ? hasCyclePaid(bill, userId)
            : myParticipantRecord?.status === 'paid';

          return (
            <Card
              key={`${bill.id}-${bill._role}-${cycleYear}-${cycleMonth}`}
              className={`transition-shadow ${myIsPaid ? 'opacity-75' : 'hover:shadow-md'}`}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">

                  {/* Left: info — click to open detail modal */}
                  <div
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => setDetailBill(bill)}
                  >

                    {/* Title row */}
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <CalendarDays className="h-4 w-4 text-blue-500 shrink-0" />
                      <h3 className="font-semibold text-sm truncate">{bill.title}</h3>

                      {/* Paid status for this cycle/month */}
                      {myIsPaid ? (
                        <Badge className="bg-green-100 text-green-800 text-xs flex items-center gap-1">
                          <CheckCircle className="h-3 w-3" />Paid
                        </Badge>
                      ) : (
                        <Badge className="bg-orange-100 text-orange-800 text-xs flex items-center gap-1">
                          <Clock className="h-3 w-3" />Unpaid
                        </Badge>
                      )}

                      {bill.recurrence && (
                        <Badge variant="outline" className="text-xs">
                          {RECURRENCE_LABELS[bill.recurrence] || bill.recurrence}
                        </Badge>
                      )}
                      {!isOwner && (
                        <Badge className="bg-purple-100 text-purple-800 text-xs">Shared with me</Badge>
                      )}
                    </div>

                    {/* Meta row */}
                    <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600 mb-2">
                      <span className="flex items-center">
                        <DollarSign className="h-3.5 w-3.5 mr-0.5" />
                        {Number(bill.amount).toFixed(2)}
                      </span>
                      {effectiveDueDate && (
                        <span className="flex items-center gap-1">
                          <CalendarDays className="h-3.5 w-3.5" />
                          Due {format(effectiveDueDate, 'MMM dd, yyyy')}
                        </span>
                      )}
                    </div>

                    {/* Participants — shown for owner AND participants */}
                    {bill.participants?.length > 0 && (
                      <div className="mt-2 space-y-1">
                        <p className="text-xs font-medium text-gray-500 flex items-center gap-1">
                          <Users className="h-3.5 w-3.5" />Split with:
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {bill.participants.map((p) => {
                            const invStatus = p.invitation_status || 'accepted';
                            // For monthly bills: check cycle payment; for others: use participant status
                            const pPaid = isMonthly ? hasCyclePaid(bill, p.user_id) : p.status === 'paid';
                            const isAccepted = invStatus === 'accepted';
                            const isRejected = invStatus === 'rejected';
                            const isPendingInv = invStatus === 'pending';
                            const canTogglePay = isAccepted && String(p.user_id) === String(userId);
                            const canResend = isOwner && isRejected;

                            return (
                              <div key={p.user_id} className="flex items-center gap-1">
                                <button
                                  type="button"
                                  disabled={!canTogglePay}
                                  onClick={canTogglePay ? () => handleToggleParticipantPaid(bill, p) : undefined}
                                  title={canTogglePay ? (pPaid ? 'Mark as unpaid' : 'Mark as paid') : undefined}
                                  className={[
                                    'flex items-center gap-1.5 text-xs rounded-full px-2.5 py-1 border transition-colors',
                                    isRejected
                                      ? 'bg-red-50 border-red-200 text-red-600'
                                      : isPendingInv
                                        ? 'bg-yellow-50 border-yellow-200 text-yellow-700'
                                        : pPaid
                                          ? 'bg-green-50 border-green-200 text-green-700'
                                          : 'bg-orange-50 border-orange-200 text-orange-700',
                                    canTogglePay ? 'cursor-pointer hover:opacity-80' : 'cursor-default',
                                  ].join(' ')}
                                >
                                  {isRejected
                                    ? <XCircle className="h-3 w-3" />
                                    : isPendingInv
                                      ? <Clock className="h-3 w-3" />
                                      : pPaid
                                        ? <CheckCircle className="h-3 w-3" />
                                        : <Clock className="h-3 w-3" />}
                                  {p.username}
                                  <span className="text-gray-500">${Number(p.amount_owed).toFixed(2)}</span>
                                </button>
                                {canResend && (
                                  <button
                                    type="button"
                                    title="Resend invitation"
                                    onClick={() => resendInvitation({ transactionId: bill.id, participantUserId: p.user_id, user_id: userId }).unwrap().then(() => toast.success('Invitation resent')).catch(() => toast.error('Failed'))}
                                    className="text-xs text-blue-500 hover:text-blue-700 transition-colors"
                                  >
                                    <RefreshCw className="h-3 w-3" />
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Participant view: my own share status */}
                    {!isOwner && myParticipantRecord && (
                      <div className="mt-2 text-xs text-gray-500">
                        Your share: <span className="font-medium">${Number(myParticipantRecord.amount_owed).toFixed(2)}</span>
                        {' · '}
                        {myParticipantIsPaid
                          ? <span className="text-green-600 font-medium">You paid</span>
                          : <span className="text-orange-600 font-medium">You haven't paid</span>}
                      </div>
                    )}

                    {bill.notes && (
                      <p className="text-xs text-gray-400 mt-1.5 truncate">{bill.notes}</p>
                    )}
                  </div>

                  {/* Right: actions */}
                  <div className="flex flex-col gap-2 shrink-0 items-end">
                    {/* Owner: toggle paid (cycle-aware) */}
                    {isOwner && (
                      <Button
                        size="sm"
                        variant={myIsPaid ? 'outline' : 'default'}
                        className={myIsPaid
                          ? 'text-gray-600 border-gray-300'
                          : 'bg-green-600 hover:bg-green-700 text-white'}
                        onClick={() => handleTogglePaid(bill)}
                      >
                        {myIsPaid
                          ? <><RotateCcw className="h-3.5 w-3.5 mr-1" />Undo</>
                          : <><CheckCircle className="h-3.5 w-3.5 mr-1" />Pay</>}
                      </Button>
                    )}

                    {/* Owner: split */}
                    {isOwner && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSplitBill(bill)}
                      >
                        <Users className="h-3.5 w-3.5 mr-1" />Split
                      </Button>
                    )}

                    {/* Participant: toggle own payment (cycle-aware) */}
                    {!isOwner && myParticipantRecord && (
                      <Button
                        size="sm"
                        variant={myParticipantIsPaid ? 'outline' : 'default'}
                        className={myParticipantIsPaid
                          ? 'text-gray-600 border-gray-300'
                          : 'bg-green-600 hover:bg-green-700 text-white'}
                        onClick={() => handleToggleParticipantPaid(bill, myParticipantRecord)}
                      >
                        {myParticipantIsPaid
                          ? <><RotateCcw className="h-3.5 w-3.5 mr-1" />Undo</>
                          : <><CheckCircle className="h-3.5 w-3.5 mr-1" />Pay</>}
                      </Button>
                    )}

                    {/* Owner: delete */}
                    {isOwner && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDelete(bill)}
                        disabled={isDeleting}
                        className="text-red-600 hover:bg-red-50 hover:text-red-700"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>

                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {detailBill && (
        <TransactionBillDetailModal
          transaction={detailBill}
          userId={userId}
          viewMonth={viewMonth}
          onClose={() => setDetailBill(null)}
        />
      )}

      {splitBill && (
        <TransactionSplitModal
          bill={splitBill}
          userId={userId}
          onClose={() => setSplitBill(null)}
        />
      )}

      {confirmDelete && (
        <Dialog open onOpenChange={() => setConfirmDelete(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
                Delete Bill
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-gray-600">
              Delete "{confirmDelete.bill.title}"? This cannot be undone.
            </p>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setConfirmDelete(null)}>Cancel</Button>
              <Button className="bg-red-600 hover:bg-red-700" onClick={confirmDelete.onConfirm}>
                Delete
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};

export default PersonalBillsList;
