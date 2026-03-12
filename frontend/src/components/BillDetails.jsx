import React from 'react';
import { format, endOfMonth } from 'date-fns';
import { useSelector } from 'react-redux';
import {
  useGetBillDetailsQuery,
  useGetBillCyclePaymentsQuery,
  useGetBillCycleHistoryQuery,
  useReopenBillMutation,
  useDeleteBillMutation,
} from '../services/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, DollarSign, User, X, RefreshCw, Trash2, Clock, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

// ─── helpers ─────────────────────────────────────────────────────────────────

const getDaySuffix = (d) => {
  if (d >= 11 && d <= 13) return 'th';
  switch (d % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
};

/** For monthly bills, the effective billing day in a given month respects end-of-month. */
const effectiveBillingDay = (anchorDay, date) =>
  Math.min(anchorDay, endOfMonth(date).getDate());

const MONTH_NAMES = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const STATUS_COLORS = {
  draft: 'bg-gray-100 text-gray-800',
  pending_responses: 'bg-yellow-100 text-yellow-800',
  finalized: 'bg-orange-100 text-orange-800',
  paid: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};
const STATUS_LABELS = {
  draft: 'Draft',
  pending_responses: 'Pending Responses',
  finalized: 'Awaiting Payment',
  paid: 'Paid',
  cancelled: 'Cancelled',
};
const getStatusColor = (s) => STATUS_COLORS[s] || 'bg-gray-100 text-gray-800';
const getStatusLabel = (s) => STATUS_LABELS[s] || s.replace(/_/g, ' ');

// ─── component ────────────────────────────────────────────────────────────────

const BillDetails = ({ billId, calendarDate, onClose }) => {
  const { user } = useSelector((state) => state.auth);

  const { data, isLoading, error } = useGetBillDetailsQuery(billId);

  // Per-cycle payment data — only for monthly bills opened from a calendar date
  const isCalendarMonthly = !!(calendarDate && data?.bill?.bill_type === 'monthly');
  const cycleYear  = calendarDate?.getFullYear();
  const cycleMonth = calendarDate ? calendarDate.getMonth() + 1 : undefined;

  const { data: cycleData } = useGetBillCyclePaymentsQuery(
    { billId, year: cycleYear, month: cycleMonth },
    { skip: !isCalendarMonthly }
  );

  const { data: historyData } = useGetBillCycleHistoryQuery(billId, {
    skip: !isCalendarMonthly,
  });

  const [reopenBill, { isLoading: isReopening }] = useReopenBillMutation();
  const [deleteBill, { isLoading: isDeleting }] = useDeleteBillMutation();

  // Use Number() to avoid int/string type mismatch from MySQL
  const cyclePayerIds = new Set(
    (cycleData?.payments || []).map((p) => Number(p.user_id))
  );

  // ── loading / error states ──────────────────────────────────────────────────

  if (isLoading) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader><DialogTitle>Loading Bill Details</DialogTitle></DialogHeader>
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            <span className="ml-2">Loading bill details...</span>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (error || !data?.bill) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{error ? 'Error Loading Bill' : 'Bill Not Found'}</DialogTitle>
          </DialogHeader>
          <div className="text-center p-8">
            <p className="text-red-600">{error ? `Error: ${error.message}` : 'Bill not found'}</p>
            <Button onClick={onClose} className="mt-4">Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const bill = data.bill;
  const isOwner = bill.created_by === user?.id;
  const hasRejections = data.invitations?.some(inv => inv.status === 'rejected');
  const allRejected = bill.status === 'cancelled' && data.invitations?.every(inv => inv.status === 'rejected');
  const showOwnerActions = isOwner && (allRejected || (hasRejections && ['pending_responses', 'finalized', 'cancelled'].includes(bill.status)));

  // For calendar monthly mode: derive a cycle-specific status for the badge
  const cyclePaidCount = cyclePayerIds.size;
  const totalParticipants = data.participants?.length || 0;
  const allCyclePaid = isCalendarMonthly && cyclePaidCount > 0 && cyclePaidCount >= totalParticipants;
  const cycleStatusLabel = isCalendarMonthly
    ? (allCyclePaid ? 'Paid' : `${cyclePaidCount}/${totalParticipants} Paid`)
    : null;
  const cycleStatusColor = isCalendarMonthly
    ? (allCyclePaid ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800')
    : null;

  // Effective billing date for the calendar month (handles end-of-month adjustment)
  const anchorDay = bill.bill_type === 'monthly' && bill.bill_date
    ? new Date(bill.bill_date).getDate()
    : null;
  const effectiveDay = isCalendarMonthly && anchorDay
    ? effectiveBillingDay(anchorDay, calendarDate)
    : null;

  const handleReopenBill = async () => {
    try {
      const result = await reopenBill({ billId, user_id: user.id }).unwrap();
      toast.success(result.message);
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to resend invitations');
    }
  };

  const handleDeleteBill = async () => {
    if (!window.confirm('Are you sure? This action cannot be undone.')) return;
    try {
      const result = await deleteBill({ billId, user_id: user.id }).unwrap();
      toast.success(result.message);
      onClose();
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to delete bill');
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <DialogTitle>{bill.title}</DialogTitle>
              {isCalendarMonthly && (
                <Badge className="bg-blue-100 text-blue-700 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {format(calendarDate, 'MMMM yyyy')}
                </Badge>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Bill Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Bill Information
                {/* In calendar monthly mode show cycle status; otherwise show global status */}
                {isCalendarMonthly ? (
                  <Badge className={cycleStatusColor}>
                    {cycleStatusLabel}
                  </Badge>
                ) : (
                  <Badge className={getStatusColor(bill.status)}>
                    {getStatusLabel(bill.status)}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center">
                <DollarSign className="h-4 w-4 mr-2" />
                <span className="font-semibold">Total: ${bill.total_amount}</span>
              </div>
              <div className="flex items-center">
                <Calendar className="h-4 w-4 mr-2" />
                <span>
                  {bill.bill_type === 'monthly' ? (
                    isCalendarMonthly ? (
                      // Show effective date for the viewed month
                      <>Billing date: {format(calendarDate, 'MMMM')} {effectiveDay}{getDaySuffix(effectiveDay)}, {format(calendarDate, 'yyyy')}
                        {effectiveDay !== anchorDay && (
                          <span className="text-gray-400 text-xs ml-1">(anchor: {anchorDay}{getDaySuffix(anchorDay)})</span>
                        )}
                      </>
                    ) : (
                      <>Billing day: {anchorDay}{getDaySuffix(anchorDay)} of each month</>
                    )
                  ) : (
                    new Date(bill.bill_date).toLocaleDateString()
                  )}
                </span>
              </div>
              {bill.due_date && (
                <div className="flex items-center">
                  <Calendar className="h-4 w-4 mr-2" />
                  <span>Due: {new Date(bill.due_date).toLocaleDateString()}</span>
                </div>
              )}
              <div className="flex items-center">
                <User className="h-4 w-4 mr-2" />
                <span>Created by: {bill.creator_name}</span>
              </div>
              {bill.notes && (
                <div>
                  <p className="font-medium">Notes:</p>
                  <p className="text-gray-600">{bill.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Items */}
          {data.items?.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Items</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {data.items.map((item, i) => (
                    <div key={i} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                      <div>
                        <span className="font-medium">{item.item_name}</span>
                        {item.item_description && (
                          <span className="text-gray-500 ml-2">- {item.item_description}</span>
                        )}
                      </div>
                      <span>${item.total_price}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Participants */}
          {data.participants?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Participants
                  {isCalendarMonthly && (
                    <span className="text-sm font-normal text-gray-500">
                      Payment status for {format(calendarDate, 'MMMM yyyy')}
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data.participants.map((participant, i) => {
                    const isPaidThisCycle = isCalendarMonthly
                      ? cyclePayerIds.has(Number(participant.user_id))
                      : participant.payment_status === 'paid';

                    return (
                      <div key={i} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {participant.username}
                            {participant.user_id === user?.id && ' (You)'}
                          </span>
                          {participant.is_creator === 1 && (
                            <Badge variant="outline" className="text-xs">Creator</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">${participant.amount_owed}</span>
                          <Badge className={isPaidThisCycle ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}>
                            {isPaidThisCycle ? 'Paid' : 'Pending'}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Payment History — only shown for monthly bills in calendar mode */}
          {isCalendarMonthly && historyData?.cycles?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Payment History
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {historyData.cycles.map((cycle, i) => {
                    const isCurrentCycle =
                      cycle.cycle_year === cycleYear && cycle.cycle_month === cycleMonth;
                    const allPaid = cycle.paid_count >= cycle.total_participants;
                    return (
                      <div
                        key={i}
                        className={`flex justify-between items-center p-2 rounded ${
                          isCurrentCycle ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {allPaid
                            ? <CheckCircle className="h-4 w-4 text-green-600" />
                            : <Clock className="h-4 w-4 text-orange-500" />
                          }
                          <span className="font-medium">
                            {MONTH_NAMES[cycle.cycle_month]} {cycle.cycle_year}
                            {isCurrentCycle && (
                              <span className="text-blue-600 text-xs ml-1">(current)</span>
                            )}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-600">
                            {cycle.paid_count}/{cycle.total_participants} paid
                          </span>
                          <Badge className={allPaid ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}>
                            {allPaid ? 'Complete' : 'Partial'}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Owner actions */}
          {showOwnerActions && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="p-4 space-y-3">
                <p className="font-semibold text-red-800">
                  {allRejected ? 'All invitations were rejected' : 'Some invitations were rejected'}
                </p>
                <p className="text-sm text-gray-600">
                  You can resend invitations or delete this bill from the bills list.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={handleReopenBill} disabled={isReopening} variant="outline">
                    <RefreshCw className="h-4 w-4 mr-1" />
                    {isReopening ? 'Resending...' : 'Resend Invitations'}
                  </Button>
                  <Button onClick={handleDeleteBill} disabled={isDeleting} variant="outline"
                    className="text-red-600 hover:bg-red-100 hover:text-red-700">
                    <Trash2 className="h-4 w-4 mr-1" />
                    {isDeleting ? 'Deleting...' : 'Delete Bill'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="flex justify-end">
          <Button onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BillDetails;
