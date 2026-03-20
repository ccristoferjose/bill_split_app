import React, { useState } from 'react';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Receipt, ArrowDownCircle, CalendarDays, DollarSign, Tag, FileText, Users, Trash2 } from 'lucide-react';
import { useDeleteTransactionMutation } from '../services/api';
import { toast } from 'sonner';

const TYPE_CONFIG = {
  expense: {
    icon:      Receipt,
    label:     'Expense',
    badgeCls:  'bg-red-100 text-red-700',
    iconColor: 'text-red-500',
    amountCls: 'text-red-600',
    prefix:    '-',
  },
  income: {
    icon:      ArrowDownCircle,
    label:     'Income',
    badgeCls:  'bg-green-100 text-green-700',
    iconColor: 'text-green-600',
    amountCls: 'text-green-600',
    prefix:    '+',
  },
  bill: {
    icon:      CalendarDays,
    label:     'Recurring Bill',
    badgeCls:  'bg-orange-100 text-orange-700',
    iconColor: 'text-orange-500',
    amountCls: 'text-blue-600',
    prefix:    '-',
  },
};

const parseLocalDate = (raw) => {
  if (!raw) return null;
  const [y, m, d] = raw.split('T')[0].split('-').map(Number);
  return new Date(y, m - 1, d);
};

const TransactionDetailModal = ({ transaction, userId, onClose }) => {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteTransaction, { isLoading: isDeleting }] = useDeleteTransactionMutation();

  const cfg = TYPE_CONFIG[transaction.type] || TYPE_CONFIG.expense;
  const Icon = cfg.icon;

  const dateRaw  = transaction.type === 'bill' ? transaction.due_date : transaction.date;
  const txDate   = parseLocalDate(dateRaw);
  const amount   = parseFloat(transaction.amount || 0);

  // For shared transactions, find my participant record
  const myRecord = (transaction.participants || []).find(
    p => String(p.user_id) === String(userId)
  );
  const isShared = transaction.is_shared && (transaction.participants || []).length > 0;

  // Owner's own share = total minus all participants' amounts
  const participantsTotal = (transaction.participants || [])
    .reduce((sum, p) => sum + parseFloat(p.amount_owed || 0), 0);
  const ownerShare = Math.max(0, amount - participantsTotal);

  // Am I the owner?
  const isOwner = String(transaction.user_id) === String(userId);

  const handleDelete = async () => {
    try {
      await deleteTransaction({ transactionId: transaction.id, user_id: userId }).unwrap();
      toast.success('Transaction deleted');
      onClose();
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to delete transaction');
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 pr-6">
            <Icon className={`h-5 w-5 shrink-0 ${cfg.iconColor}`} />
            <span className="truncate">{transaction.title}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">

          {/* Type + amount */}
          <div className="grid grid-cols-2 gap-3 bg-gray-50 rounded-xl p-3">
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Type</p>
              <Badge className={cfg.badgeCls}>{cfg.label}</Badge>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Amount</p>
              <p className={`font-semibold flex items-center gap-0.5 ${cfg.amountCls}`}>
                <DollarSign className="h-3.5 w-3.5" />
                {cfg.prefix}{amount.toFixed(2)}
              </p>
            </div>

            {txDate && (
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Date</p>
                <p className="text-sm flex items-center gap-1">
                  <CalendarDays className="h-3.5 w-3.5 text-gray-400" />
                  {format(txDate, 'MMM dd, yyyy')}
                </p>
              </div>
            )}

            {transaction.category && (
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Category</p>
                <p className="text-sm flex items-center gap-1 capitalize">
                  <Tag className="h-3.5 w-3.5 text-gray-400" />
                  {transaction.category}
                </p>
              </div>
            )}

            {transaction.recurrence && (
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Recurrence</p>
                <Badge variant="outline" className="text-xs capitalize">{transaction.recurrence}</Badge>
              </div>
            )}
          </div>

          {/* Shared participants */}
          {isShared && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                <Users className="h-3.5 w-3.5" /> Split participants
              </p>
              <div className="space-y-2">
                {/* Owner's own share — always first */}
                {isOwner && (
                  <div className="flex items-center justify-between px-3 py-2 rounded-lg border bg-blue-50 border-blue-200">
                    <span className="text-sm font-medium">
                      You <span className="text-blue-500 font-normal">(your share)</span>
                    </span>
                    <span className="text-sm font-medium">${ownerShare.toFixed(2)}</span>
                  </div>
                )}
                {/* Split-ees */}
                {transaction.participants.map(p => {
                  const isMe = String(p.user_id) === String(userId);
                  return (
                    <div
                      key={p.user_id}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg border ${
                        isMe ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-100'
                      }`}
                    >
                      <span className="text-sm font-medium">
                        {p.username}{isMe && <span className="text-blue-500 font-normal"> (you)</span>}
                      </span>
                      <span className="text-sm font-medium">${parseFloat(p.amount_owed).toFixed(2)}</span>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-gray-400 mt-2 text-right">
                Total: <span className="font-semibold text-gray-600">${amount.toFixed(2)}</span>
              </p>
            </div>
          )}

          {/* Notes */}
          {transaction.notes && (
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-400 mb-1 flex items-center gap-1">
                <FileText className="h-3.5 w-3.5" /> Notes
              </p>
              <p className="text-sm text-gray-700">{transaction.notes}</p>
            </div>
          )}

          {/* Delete — owner only */}
          {isOwner && (
            <div className="pt-2 border-t border-gray-100">
              {confirmDelete ? (
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm text-gray-600">Delete this transaction?</p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setConfirmDelete(false)}>Cancel</Button>
                    <Button size="sm" variant="destructive" onClick={handleDelete} disabled={isDeleting}>
                      {isDeleting ? 'Deleting…' : 'Delete'}
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-red-500 hover:text-red-600 hover:bg-red-50 w-full"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 className="h-4 w-4 mr-1" /> Delete transaction
                </Button>
              )}
            </div>
          )}

        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TransactionDetailModal;
