import React from 'react';
import { format, endOfMonth } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  CalendarDays, DollarSign, Users, CheckCircle,
  XCircle, RotateCcw, Clock, RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  useRespondToTransactionSplitMutation,
  useMarkParticipantPaidMutation,
  useResendTransactionInvitationMutation,
  useMarkTransactionPaidMutation,
  useMarkTransactionCyclePaidMutation,
} from '../services/api';

const RECURRENCE_LABELS = {
  monthly: 'Monthly', weekly: 'Weekly', yearly: 'Yearly', custom: 'Custom',
};

const parseLocalDate = (raw) => {
  if (!raw) return null;
  const [y, m, d] = raw.split('T')[0].split('-').map(Number);
  return new Date(y, m - 1, d);
};

const InvStatusBadge = ({ status }) => {
  if (status === 'accepted') return <Badge className="bg-green-100 text-green-700 text-xs">Accepted</Badge>;
  if (status === 'rejected') return <Badge className="bg-red-100 text-red-700 text-xs">Declined</Badge>;
  return <Badge className="bg-yellow-100 text-yellow-700 text-xs">Pending</Badge>;
};

const PayStatusBadge = ({ paid }) => {
  if (paid) return <Badge className="bg-green-100 text-green-700 text-xs">Paid</Badge>;
  return <Badge className="bg-orange-100 text-orange-700 text-xs">Unpaid</Badge>;
};

// viewMonth: the currently viewed month (Date object), used for cycle-aware status
const TransactionBillDetailModal = ({ transaction, userId, viewMonth, onClose }) => {
  const [respondToSplit, { isLoading: isResponding }] = useRespondToTransactionSplitMutation();
  const [markParticipantPaid, { isLoading: isMarkingPaid }] = useMarkParticipantPaidMutation();
  const [resendInvitation, { isLoading: isResending }] = useResendTransactionInvitationMutation();
  const [markTransactionPaid, { isLoading: isMarkingBillPaid }] = useMarkTransactionPaidMutation();
  const [markCyclePaid, { isLoading: isMarkingCycle }] = useMarkTransactionCyclePaidMutation();

  const isMonthly = transaction.recurrence === 'monthly' || transaction.recurrence === 'weekly';
  const cycleYear = (viewMonth || new Date()).getFullYear();
  const cycleMonth = (viewMonth || new Date()).getMonth() + 1; // 1-12

  // Returns true if a given user has a cycle payment record for the viewed month
  const hasCyclePaid = (uid) =>
    (transaction.cycle_payments || []).some(
      cp =>
        String(cp.user_id) === String(uid) &&
        Number(cp.cycle_year) === cycleYear &&
        Number(cp.cycle_month) === cycleMonth
    );

  const isOwner = transaction._role === 'owner' || String(transaction.user_id) === String(userId);
  const myRecord = !isOwner
    ? transaction.participants?.find(p => String(p.user_id) === String(userId))
    : null;

  // Effective paid status — cycle-aware for monthly bills
  const myIsPaid = isMonthly ? hasCyclePaid(userId) : transaction.status === 'paid';
  const myParticipantPaid = isMonthly ? hasCyclePaid(userId) : myRecord?.status === 'paid';

  // Effective due date adjusted to the viewed month for recurring bills
  const getEffectiveDueDate = () => {
    if (!isMonthly || !viewMonth) return parseLocalDate(transaction.due_date);
    const start = parseLocalDate(transaction.due_date);
    if (!start) return null;
    const clamped = Math.min(start.getDate(), endOfMonth(viewMonth).getDate());
    return new Date(viewMonth.getFullYear(), viewMonth.getMonth(), clamped);
  };
  const effectiveDueDate = getEffectiveDueDate();

  const isActioning = isMarkingPaid || isMarkingBillPaid || isMarkingCycle;

  // --- Handlers ---

  const handleRespond = async (action) => {
    try {
      await respondToSplit({ transactionId: transaction.id, user_id: userId, action }).unwrap();
      toast.success(`Invitation ${action}ed`);
      onClose();
    } catch (err) {
      toast.error(err?.data?.message || 'Failed');
    }
  };

  const handleMyPay = async () => {
    try {
      if (isMonthly) {
        const result = await markCyclePaid({
          transactionId: transaction.id,
          year: cycleYear,
          month: cycleMonth,
          user_id: userId,
        }).unwrap();
        toast.success(result.message);
      } else {
        await markParticipantPaid({
          transactionId: transaction.id,
          participantUserId: userId,
          user_id: userId,
        }).unwrap();
        toast.success('Marked as paid');
      }
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to mark as paid');
    }
  };

  const handleToggleBillPaid = async () => {
    try {
      if (isMonthly) {
        const result = await markCyclePaid({
          transactionId: transaction.id,
          year: cycleYear,
          month: cycleMonth,
          user_id: userId,
        }).unwrap();
        toast.success(result.message);
      } else {
        const result = await markTransactionPaid({ transactionId: transaction.id, user_id: userId }).unwrap();
        toast.success(result.message);
      }
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to update status');
    }
  };

  const handleResend = async (participantUserId) => {
    try {
      await resendInvitation({
        transactionId: transaction.id,
        participantUserId,
        user_id: userId,
      }).unwrap();
      toast.success('Invitation resent');
    } catch (err) {
      toast.error('Failed to resend');
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 pr-6">
            <CalendarDays className="h-5 w-5 text-blue-500 shrink-0" />
            <span className="truncate">{transaction.title}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">

          {/* Bill info grid */}
          <div className="grid grid-cols-2 gap-3 bg-gray-50 rounded-xl p-3">
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Total Amount</p>
              <p className="font-semibold text-gray-800 flex items-center gap-0.5">
                <DollarSign className="h-3.5 w-3.5" />{Number(transaction.amount).toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-0.5">
                {isMonthly ? `Status (${format(viewMonth || new Date(), 'MMM yyyy')})` : 'Status'}
              </p>
              {myIsPaid
                ? <Badge className="bg-green-100 text-green-700"><CheckCircle className="h-3 w-3 mr-1" />Paid</Badge>
                : <Badge className="bg-orange-100 text-orange-700"><Clock className="h-3 w-3 mr-1" />Unpaid</Badge>}
            </div>
            {effectiveDueDate && (
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Due Date</p>
                <p className="text-sm">{format(effectiveDueDate, 'MMM dd, yyyy')}</p>
              </div>
            )}
            {transaction.recurrence && (
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Recurrence</p>
                <Badge variant="outline" className="text-xs">{RECURRENCE_LABELS[transaction.recurrence]}</Badge>
              </div>
            )}
            {transaction.category && (
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Category</p>
                <p className="text-sm">{transaction.category}</p>
              </div>
            )}
            {!isOwner && transaction.owner_username && (
              <div className="col-span-2">
                <p className="text-xs text-gray-400 mb-0.5">Bill Owner</p>
                <p className="text-sm font-medium">{transaction.owner_username}</p>
              </div>
            )}
          </div>

          {/* Participants list */}
          {transaction.participants?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                <Users className="h-3.5 w-3.5" /> Split participants
              </p>
              <div className="space-y-2">
                {transaction.participants.map(p => {
                  const isMe = String(p.user_id) === String(userId);
                  const canResend = isOwner && p.invitation_status === 'rejected';
                  const participantPaid = isMonthly ? hasCyclePaid(p.user_id) : p.status === 'paid';

                  return (
                    <div
                      key={p.user_id}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg border ${
                        isMe ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-100'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-medium truncate">
                          {p.username}{isMe && <span className="text-blue-500 font-normal"> (you)</span>}
                        </span>
                        <InvStatusBadge status={p.invitation_status} />
                        {p.invitation_status === 'accepted' && <PayStatusBadge paid={participantPaid} />}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-sm font-medium">${Number(p.amount_owed).toFixed(2)}</span>
                        {canResend && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            disabled={isResending}
                            onClick={() => handleResend(p.user_id)}
                          >
                            <RefreshCw className="h-3 w-3 mr-1" />Resend
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Notes */}
          {transaction.notes && (
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-400 mb-1">Notes</p>
              <p className="text-sm text-gray-700">{transaction.notes}</p>
            </div>
          )}

          {/* Owner actions */}
          {isOwner && (
            <div className="flex gap-2 pt-1 border-t">
              <Button
                className={`flex-1 ${myIsPaid ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' : 'bg-green-600 hover:bg-green-700 text-white'}`}
                variant={myIsPaid ? 'outline' : 'default'}
                disabled={isActioning}
                onClick={handleToggleBillPaid}
              >
                {myIsPaid
                  ? <><RotateCcw className="h-4 w-4 mr-1.5" />Undo</>
                  : <><CheckCircle className="h-4 w-4 mr-1.5" />Mark as Paid</>}
              </Button>
            </div>
          )}

          {/* Participant actions */}
          {!isOwner && myRecord && (
            <div className="pt-1 border-t space-y-2">
              {myRecord.invitation_status === 'pending' && (
                <div className="flex gap-2">
                  <Button
                    className="flex-1 bg-green-600 hover:bg-green-700"
                    disabled={isResponding}
                    onClick={() => handleRespond('accept')}
                  >
                    <CheckCircle className="h-4 w-4 mr-1.5" />Accept
                  </Button>
                  <Button
                    className="flex-1"
                    variant="destructive"
                    disabled={isResponding}
                    onClick={() => handleRespond('reject')}
                  >
                    <XCircle className="h-4 w-4 mr-1.5" />Decline
                  </Button>
                </div>
              )}
              {myRecord.invitation_status === 'accepted' && !myParticipantPaid && (
                <Button
                  className="w-full bg-green-600 hover:bg-green-700"
                  disabled={isActioning}
                  onClick={handleMyPay}
                >
                  <CheckCircle className="h-4 w-4 mr-1.5" />
                  Pay My Share (${Number(myRecord.amount_owed).toFixed(2)})
                </Button>
              )}
              {myRecord.invitation_status === 'accepted' && myParticipantPaid && (
                <div className="space-y-2">
                  <div className="flex items-center justify-center gap-2 py-2 text-green-600 bg-green-50 rounded-lg">
                    <CheckCircle className="h-4 w-4" />
                    <span className="text-sm font-medium">You've paid your share</span>
                  </div>
                  <Button
                    className="w-full"
                    variant="outline"
                    disabled={isActioning}
                    onClick={handleMyPay}
                  >
                    <RotateCcw className="h-4 w-4 mr-1.5" />Undo Payment
                  </Button>
                </div>
              )}
              {myRecord.invitation_status === 'rejected' && (
                <div className="flex items-center justify-center gap-2 py-2 text-red-600 bg-red-50 rounded-lg">
                  <XCircle className="h-4 w-4" />
                  <span className="text-sm">You declined this invitation</span>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TransactionBillDetailModal;
