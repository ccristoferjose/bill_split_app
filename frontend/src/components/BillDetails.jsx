import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { useGetBillDetailsQuery } from '../services/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, DollarSign, User, X, Users } from 'lucide-react';
import BillSplitModal from './BillSplitModal';
import PaymentSection from './PaymentSection';


const BillDetails = ({ billId, onClose }) => {
  const { user } = useSelector((state) => state.auth);
  const [showSplitModal, setShowSplitModal] = useState(false);
  const { data, isLoading, error } = useGetBillDetailsQuery(billId);

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
      finalized: 'bg-blue-100 text-blue-800',
      paid: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

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
                  {bill.status.replace('_', ' ')}
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

           {/* Payment Section */}
            {data?.participants && data.participants.length > 0 && (
              <PaymentSection 
                bill={bill}
                participants={data.participants}
                currentUserId={user?.id}
              />
            )}
        </div>

        <div className="flex justify-between">
          <div>
            {/* Show Split Bill button only for bill creator when bill is in draft status */}
            {bill.created_by === user?.id && bill.status === 'draft' && (
              <Button 
                onClick={() => setShowSplitModal(true)}
                className="bg-green-600 hover:bg-green-700"
              >
                <Users className="h-4 w-4 mr-2" />
                Split Bill
              </Button>
            )}
          </div>
          <Button onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
      
      {/* Split Bill Modal */}
      {showSplitModal && (
        <BillSplitModal
          billId={billId}
          billAmount={bill.total_amount}
          billTitle={bill.title}
          onClose={() => setShowSplitModal(false)}
        />
      )}
    </Dialog>
  );
};

export default BillDetails;