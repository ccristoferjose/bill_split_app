import React from 'react';
import { useSelector } from 'react-redux';
import { useGetBillDetailsQuery, useReopenBillMutation, useDeleteBillMutation, usePayBillInFullMutation } from '../services/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, DollarSign, User, X, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const BillDetails = ({ billId, onClose }) => {
  const { user } = useSelector((state) => state.auth);
  const { data, isLoading, error } = useGetBillDetailsQuery(billId);
  const [reopenBill, { isLoading: isReopening }] = useReopenBillMutation();
  const [deleteBill, { isLoading: isDeleting }] = useDeleteBillMutation();

  if (isLoading) {
    return (
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Loading Bill Details</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-2">Loading bill details...</span>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (error) {
    return (
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Error Loading Bill</DialogTitle>
          </DialogHeader>
          <div className="text-center p-8">
            <p className="text-red-600">Error loading bill details: {error.message}</p>
            <Button onClick={onClose} className="mt-4">Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const bill = data?.bill;

  if (!bill) {
    return (
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bill Not Found</DialogTitle>
          </DialogHeader>
          <div className="text-center p-8">
            <p className="text-gray-600">Bill not found</p>
            <Button onClick={onClose} className="mt-4">Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const getStatusColor = (status) => {
    const colors = {
      draft: 'bg-gray-100 text-gray-800',
      pending_responses: 'bg-yellow-100 text-yellow-800',
      finalized: 'bg-orange-100 text-orange-800',
      paid: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
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
    };
    return labels[status] || status.replace('_', ' ');
  };

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

  // Owner actions: show when bill has rejected invitations or is cancelled
  const isOwner = bill.created_by === user?.id;
  const hasRejections = data?.invitations?.some(inv => inv.status === 'rejected');
  const allRejected = bill.status === 'cancelled' && data?.invitations?.every(inv => inv.status === 'rejected');
  const showOwnerActions = isOwner && (allRejected || (hasRejections && ['pending_responses', 'finalized', 'cancelled'].includes(bill.status)));

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>{bill.title}</DialogTitle>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Bill Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Bill Information
                <Badge className={getStatusColor(bill.status)}>
                  {getStatusLabel(bill.status)}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center">
                <DollarSign className="h-4 w-4 mr-2" />
                <span className="font-semibold">Total: ${bill.total_amount}</span>
              </div>
              <div className="flex items-center">
                <Calendar className="h-4 w-4 mr-2" />
                <span>Date: {new Date(bill.bill_date).toLocaleDateString()}</span>
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
          {data?.items && data.items.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Items</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {data.items.map((item, index) => (
                    <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded">
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
          {data?.participants && data.participants.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Participants</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data.participants.map((participant, index) => (
                    <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium">
                          {participant.username}
                          {participant.user_id === user?.id && ' (You)'}
                        </span>
                        {participant.is_creator === 1 && (
                          <Badge variant="outline" className="text-xs">Creator</Badge>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold">${participant.amount_owed}</span>
                        <Badge className={participant.payment_status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}>
                          {participant.payment_status === 'paid' ? 'Paid' : 'Pending'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Owner actions when invitations are rejected */}
          {showOwnerActions && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="p-4 space-y-3">
                <p className="font-semibold text-red-800">
                  {allRejected ? 'All invitations were rejected' : 'Some invitations were rejected'}
                </p>
                <p className="text-sm text-gray-600">You can resend invitations or delete this bill from the bills list.</p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={handleReopenBill}
                    disabled={isReopening}
                    variant="outline"
                  >
                    <RefreshCw className="h-4 w-4 mr-1" />
                    {isReopening ? 'Resending...' : 'Resend Invitations'}
                  </Button>
                  <Button
                    onClick={handleDeleteBill}
                    disabled={isDeleting}
                    variant="outline"
                    className="text-red-600 hover:bg-red-100 hover:text-red-700"
                  >
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