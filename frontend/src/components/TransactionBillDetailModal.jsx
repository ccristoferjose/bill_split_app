import React from 'react';
import { format } from 'date-fns';
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

const PayStatusBadge = ({ status }) => {
  if (status === 'paid') return <Badge className="bg-green-100 text-green-700 text-xs">Paid</Badge>;
  return <Badge className="bg-orange-100 text-orange-700 text-xs">Unpaid</Badge>;
};

const TransactionBillDetailModal = ({ transaction, userId, onClose }) => {
  const [respondToSplit, { isLoading: isResponding }] = useRespondToTransactionSplitMutation();
  const [markParticipantPaid, { isLoading: isMarkingPaid }] = useMarkParticipantPaidMutation();
  const [resendInvitation, { isLoading: isResending }] = useResendTransactionInvitationMutation();
  const [markTransactionPaid, { isLoading: isMarkingBillPaid }] = useMarkTransactionPaidMutation();

  const isOwner = transaction._role === 'owner' || Number(transaction.user_id) === Number(userId);
  const myRecord = !isOwner
    ? transaction.participants?.find(p => Number(p.user_id) === Number(userId))
    : null;

  const isPaid = transaction.status === 'paid';
  const dueDate = parseLocalDate(transaction.due_date);

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
      await markParticipantPaid({
        transactionId: transaction.id,
        participantUserId: userId,
        user_id: userId,
      }).unwrap();
      toast.success('Marked as paid');
      onClose();
    } catch (err) {
      toast.error('Failed to mark as paid');
    }
  };

  const handleToggleBillPaid = async () => {
    try {
      const result = await markTransactionPaid({ transactionId: transaction.id, user_id: userId }).unwrap();
      toast.success(result.message);
    } catch (err) {
      toast.error('Failed to update status');
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
              <p className="text-xs text-gray-400 mb-0.5">Status</p>
              {isPaid
                ? <Badge className="bg-green-100 text-green-700"><CheckCircle className="h-3 w-3 mr-1" />Paid</Badge>
                : <Badge className="bg-orange-100 text-orange-700"><Clock className="h-3 w-3 mr-1" />Unpaid</Badge>}
            </div>
            {dueDate && (
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Due Date</p>
                <p className="text-sm">{format(dueDate, 'MMM dd, yyyy')}</p>
              </div>
            )}
            {transaction.recurrence && (
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Recurrence</p>
                <Badge variant="outline" className="text-xs">{RECURRENCE_LABELS[transaction.recurrence]}</Badge>
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
                  const isMe = Number(p.user_id) === Number(userId);
                  const canResend = isOwner && p.invitation_status === 'rejected';

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
                        {p.invitation_status === 'accepted' && <PayStatusBadge status={p.status} />}
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
                className={`flex-1 ${isPaid ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' : 'bg-green-600 hover:bg-green-700 text-white'}`}
                variant={isPaid ? 'outline' : 'default'}
                disabled={isMarkingBillPaid}
                onClick={handleToggleBillPaid}
              >
                {isPaid
                  ? <><RotateCcw className="h-4 w-4 mr-1.5" />Reopen</>
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
              {myRecord.invitation_status === 'accepted' && myRecord.status === 'pending' && (
                <Button
                  className="w-full bg-green-600 hover:bg-green-700"
                  disabled={isMarkingPaid}
                  onClick={handleMyPay}
                >
                  <CheckCircle className="h-4 w-4 mr-1.5" />
                  Pay My Share (${Number(myRecord.amount_owed).toFixed(2)})
                </Button>
              )}
              {myRecord.invitation_status === 'accepted' && myRecord.status === 'paid' && (
                <div className="flex items-center justify-center gap-2 py-2 text-green-600 bg-green-50 rounded-lg">
                  <CheckCircle className="h-4 w-4" />
                  <span className="text-sm font-medium">You've paid your share</span>
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
