/**
 * BillCard – shared bill card used by both BillsList and BillCalendar.
 *
 * Props
 * ─────
 * bill          : bill object (must have _isCreator flag)
 * userId        : current user id
 * onSelectBill  : (billId, calendarDate?) => void  – open BillDetails modal
 * onRefresh     : () => void        – called after mutations that change data
 *
 * Calendar-only (optional)
 * ────────────────────────
 * calendarDate  : Date              – the day being viewed in the calendar
 * paidCycles    : Set<string>       – "billId-year-month" keys from monthly_cycle_payments
 */
import React, { useState } from 'react';
import { format } from 'date-fns';
import {
  useMarkBillAsPaidMutation,
  useDeleteBillMutation,
  usePayBillInFullMutation,
  usePayMonthlyCycleMutation,
} from '../services/api';
import { useSelector } from 'react-redux';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DollarSign, Users, Clock, Receipt, CheckCircle, RefreshCw,
  Trash2, Star, AlertTriangle, Calendar,
} from 'lucide-react';
import { toast } from 'sonner';
import BillSplitModal from './BillSplitModal';

// ─── helpers ────────────────────────────────────────────────────────────────

const STATUS_COLORS = {
  draft: 'bg-gray-100 text-gray-800',
  pending_responses: 'bg-yellow-100 text-yellow-800',
  finalized: 'bg-orange-100 text-orange-800',
  paid: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
  pending: 'bg-orange-100 text-orange-800',
};
const STATUS_LABELS = {
  draft: 'Draft',
  pending_responses: 'Pending Responses',
  finalized: 'Awaiting Payment',
  paid: 'Paid',
  cancelled: 'Cancelled',
  pending: 'Unpaid',
};

const getStatusColor = (s) => STATUS_COLORS[s] || 'bg-gray-100 text-gray-800';
const getStatusLabel = (s) => STATUS_LABELS[s] || s;

const cycleKey = (billId, date) =>
  `${billId}-${date.getFullYear()}-${date.getMonth() + 1}`;

/** For a monthly bill viewed on a calendar date, derive the per-month status. */
const getCalendarStatus = (bill, date, paidCycles) => {
  if (bill.bill_type !== 'monthly' || !date) return bill.status;
  if (paidCycles?.has(cycleKey(bill.id, date))) return 'paid';
  if (['finalized', 'paid'].includes(bill.status)) return 'pending';
  return bill.status;
};

// ─── component ──────────────────────────────────────────────────────────────

const BillCard = ({ bill, userId, onSelectBill, onRefresh, calendarDate, paidCycles }) => {
  const { token } = useSelector((state) => state.auth);
  const [confirmModal, setConfirmModal] = useState(null);
  const [splitBill, setSplitBill] = useState(false);

  const [markBillAsPaid, { isLoading: isMarkingPaid }] = useMarkBillAsPaidMutation();
  const [deleteBill, { isLoading: isDeleting }] = useDeleteBillMutation();
  const [payBillInFull, { isLoading: isPayingFull }] = usePayBillInFullMutation();
  const [payMonthlyCycle, { isLoading: isPayingCycle }] = usePayMonthlyCycleMutation();

  const isCreator = bill._isCreator;

  // In calendar mode monthly bills use per-cycle status; otherwise use global status
  const displayStatus = calendarDate
    ? getCalendarStatus(bill, calendarDate, paidCycles)
    : bill.status;

  // ── handlers ──────────────────────────────────────────────────────────────

  const handleMarkAsPaid = async () => {
    try {
      await markBillAsPaid({ billId: bill.id, user_id: userId }).unwrap();
      toast.success('Payment marked successfully!');
      onRefresh();
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to mark as paid');
    }
  };

  const handlePayCycle = async () => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth() + 1;
    try {
      await payMonthlyCycle({ billId: bill.id, user_id: userId, cycle_year: year, cycle_month: month }).unwrap();
      toast.success(`Marked as paid for ${format(calendarDate, 'MMMM yyyy')}`);
      onRefresh();
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to record payment');
    }
  };

  const handleDeleteBill = () => {
    const isMonthly = bill.bill_type === 'monthly';
    const isPaidOneTime = bill.bill_type === 'one_time' && bill.status === 'paid';
    const label = isPaidOneTime ? 'Remove' : isMonthly && !['draft', 'cancelled'].includes(bill.status) ? 'Cancel' : 'Delete';

    setConfirmModal({
      title: `${label} Bill`,
      message: isPaidOneTime
        ? 'Remove this bill from your list?'
        : label === 'Cancel'
          ? 'Cancel this monthly bill? This will stop future cycles.'
          : 'Delete this bill? This cannot be undone.',
      confirmLabel: label,
      confirmClass: 'bg-red-600 hover:bg-red-700',
      onConfirm: async () => {
        try {
          const result = await deleteBill({ billId: bill.id, user_id: userId }).unwrap();
          toast.success(result.message);
          onRefresh();
        } catch (err) {
          toast.error(err?.data?.message || 'Failed to delete bill');
        }
        setConfirmModal(null);
      },
    });
  };

  const handlePayInFull = () => {
    setConfirmModal({
      title: 'Pay Bill in Full',
      message: `Pay the full amount of $${bill.total_amount} for "${bill.title}"?`,
      confirmLabel: `Pay $${bill.total_amount}`,
      confirmClass: 'bg-green-600 hover:bg-green-700',
      onConfirm: async () => {
        try {
          await payBillInFull({ billId: bill.id, user_id: userId }).unwrap();
          toast.success('Bill paid in full!');
          onRefresh();
        } catch (err) {
          toast.error(err?.data?.message || 'Failed to pay bill');
        }
        setConfirmModal(null);
      },
    });
  };

  const handleStatusCheck = async () => {
    try {
      const res = await fetch(`http://localhost:5001/bills/${bill.id}/check-status`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        toast.success('Bill status updated');
        onRefresh();
      } else {
        const data = await res.json();
        toast.error(data.message || 'Failed to check status');
      }
    } catch {
      toast.error('Failed to check bill status');
    }
  };

  // ── button visibility logic ────────────────────────────────────────────────

  const renderPayButton = () => {
    // Monthly bills in calendar mode → per-cycle payment
    if (calendarDate && bill.bill_type === 'monthly' && displayStatus === 'pending') {
      return (
        <Button
          size="sm"
          className="bg-green-600 hover:bg-green-700 text-white"
          onClick={handlePayCycle}
          disabled={isPayingCycle}
        >
          <CheckCircle className="h-4 w-4 mr-1" />
          {isPayingCycle ? 'Saving...' : `Pay ${format(calendarDate, 'MMM')}`}
        </Button>
      );
    }

    // Monthly bills in calendar mode are fully handled by the cycle system above.
    // Never fall through to the old markBillAsPaid path for them.
    if (calendarDate && bill.bill_type === 'monthly') return null;

    // One-time finalized bills → old mark-as-paid
    if (bill.status === 'finalized') {
      if (isCreator && bill.creator_payment_status === 'pending') {
        return (
          <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={handleMarkAsPaid} disabled={isMarkingPaid}>
            <CheckCircle className="h-4 w-4 mr-1" />
            {isMarkingPaid ? 'Processing...' : 'Pay'}
          </Button>
        );
      }
      if (!isCreator && bill.payment_status === 'pending') {
        return (
          <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={handleMarkAsPaid} disabled={isMarkingPaid}>
            <CheckCircle className="h-4 w-4 mr-1" />
            {isMarkingPaid ? 'Processing...' : 'Pay'}
          </Button>
        );
      }
    }

    return null;
  };

  const renderCreatorButtons = () => {
    if (!isCreator || bill.status === 'paid') return null;

    const showPayInFull = ['draft', 'cancelled'].includes(bill.status);
    const showSplit = bill.status !== 'paid';

    return (
      <>
        {showPayInFull && (
          <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={handlePayInFull} disabled={isPayingFull}>
            <DollarSign className="h-4 w-4 mr-1" />
            {isPayingFull ? 'Processing...' : 'Pay in Full'}
          </Button>
        )}
        {showSplit && (
          <Button size="sm" variant="outline" onClick={() => setSplitBill(true)}>
            <Users className="h-4 w-4 mr-1" />
            Split
          </Button>
        )}
      </>
    );
  };

  const renderDeleteButton = () => {
    const isPaidOneTime = bill.bill_type === 'one_time' && bill.status === 'paid';

    if (isPaidOneTime) {
      return (
        <Button size="sm" variant="outline" onClick={handleDeleteBill} disabled={isDeleting}
          className="text-red-600 hover:bg-red-50 hover:text-red-700">
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

    const label = bill.bill_type === 'monthly' && !['draft', 'cancelled'].includes(bill.status)
      ? 'Cancel' : 'Delete';

    return (
      <Button size="sm" variant="outline" onClick={handleDeleteBill} disabled={isDeleting}
        className="text-red-600 hover:bg-red-50 hover:text-red-700">
        <Trash2 className="h-4 w-4 mr-1" />
        {label}
      </Button>
    );
  };

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">

            {/* Left: info */}
            <div className="flex-1 min-w-0">
              {/* Title row */}
              <div className="flex flex-wrap items-center gap-2 mb-2">
                {bill.bill_type === 'monthly'
                  ? <Clock className="h-4 w-4 text-blue-500 shrink-0" />
                  : <Receipt className="h-4 w-4 text-gray-400 shrink-0" />}
                <h3 className="font-semibold text-base truncate">{bill.title}</h3>
                {isCreator && <Star className="h-4 w-4 text-yellow-500 fill-yellow-500 shrink-0" />}
                <Badge className={getStatusColor(displayStatus)}>
                  {getStatusLabel(displayStatus)}
                </Badge>
                {bill.bill_type === 'monthly' && <Badge variant="outline">Monthly</Badge>}
                {bill.status === 'pending_responses' && isCreator && (
                  <Button size="sm" variant="outline" onClick={handleStatusCheck} className="ml-1">
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Check Status
                  </Button>
                )}
              </div>

              {/* Meta row */}
              <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
                <span className="flex items-center">
                  <DollarSign className="h-4 w-4 mr-0.5" />${bill.total_amount}
                </span>
                {!calendarDate && (
                  <span className="flex items-center">
                    <Calendar className="h-4 w-4 mr-1" />
                    {format(new Date(bill.bill_date), 'MMM dd, yyyy')}
                  </span>
                )}
                {isCreator ? (
                  <>
                    <span className="flex items-center">
                      <Users className="h-4 w-4 mr-1" />{bill.total_invitations || 0} invited
                    </span>
                    {bill.creator_amount_owed && (
                      // In calendar monthly mode show per-cycle status; otherwise show global status only when finalized
                      (calendarDate && bill.bill_type === 'monthly')
                        ? <>
                            <span className="flex items-center">
                              <DollarSign className="h-4 w-4 mr-0.5" />Your share: ${bill.creator_amount_owed}
                            </span>
                            <Badge className={displayStatus === 'paid' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}>
                              {displayStatus === 'paid' ? 'You Paid' : 'Payment Pending'}
                            </Badge>
                          </>
                        : bill.status === 'finalized' && <>
                            <span className="flex items-center">
                              <DollarSign className="h-4 w-4 mr-0.5" />Your share: ${bill.creator_amount_owed}
                            </span>
                            <Badge className={bill.creator_payment_status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}>
                              {bill.creator_payment_status === 'paid' ? 'You Paid' : 'Payment Pending'}
                            </Badge>
                          </>
                    )}
                  </>
                ) : (
                  <>
                    {bill.amount_owed && (
                      <span className="flex items-center">
                        <DollarSign className="h-4 w-4 mr-0.5" />You owe: ${bill.amount_owed}
                      </span>
                    )}
                    {bill.creator_name && <span>by {bill.creator_name}</span>}
                    {(calendarDate && bill.bill_type === 'monthly') ? (
                      // Per-cycle status for monthly bills in calendar mode
                      <Badge className={displayStatus === 'paid' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}>
                        {displayStatus === 'paid' ? 'You Paid' : 'Payment Pending'}
                      </Badge>
                    ) : bill.payment_status && (
                      <Badge className={bill.payment_status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}>
                        {bill.payment_status === 'paid' ? 'You Paid' : 'Payment Pending'}
                      </Badge>
                    )}
                  </>
                )}
              </div>

              {bill.due_date && !calendarDate && (
                <p className="text-sm text-gray-500 mt-1">
                  Due: {format(new Date(bill.due_date), 'MMM dd, yyyy')}
                </p>
              )}
            </div>

            {/* Right: actions */}
            <div className="flex flex-wrap gap-2 justify-end shrink-0">
              {renderPayButton()}
              {renderCreatorButtons()}
              {renderDeleteButton()}
              <Button variant="outline" size="sm" onClick={() => onSelectBill(bill.id, calendarDate)}>
                {calendarDate ? 'View' : 'View Details'}
              </Button>
            </div>

          </div>
        </CardContent>
      </Card>

      {splitBill && (
        <BillSplitModal
          billId={bill.id}
          billAmount={bill.total_amount}
          billTitle={bill.title}
          onClose={() => setSplitBill(false)}
        />
      )}

      {confirmModal && (
        <Dialog open onOpenChange={() => setConfirmModal(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
                {confirmModal.title}
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-gray-600">{confirmModal.message}</p>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setConfirmModal(null)}>Cancel</Button>
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

export default BillCard;
