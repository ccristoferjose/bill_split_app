import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { useRespondToBillInvitationMutation } from '../services/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DollarSign, Calendar, User, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const InvitationResponseModal = ({ bill, invitation, onClose, onResponse }) => {
  const { user } = useSelector((state) => state.auth);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [respondToBillInvitation] = useRespondToBillInvitationMutation();

  const handleResponse = async (action) => {
    setIsSubmitting(true);
    
    try {
      await respondToBillInvitation({
        billId: bill.id,
        user_id: user.id,
        action
      }).unwrap();
  
      // Remove this line - let SocketContext handle the toast
      // toast.success(`Invitation ${action}ed successfully!`);
      
      onResponse?.(action);
      onClose();
    } catch (error) {
      console.error('Error responding to invitation:', error);
      const errorMessage = error?.data?.message || error?.message || `Failed to ${action} invitation`;
      toast.error(errorMessage); // Keep error toasts as they're local failures
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!bill || !invitation) {
    return null;
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <DollarSign className="h-5 w-5 mr-2" />
            Bill Invitation
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Bill Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{bill.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Total Amount:</span>
                <span className="font-semibold">${bill.total_amount}</span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Your Share:</span>
                <span className="font-semibold text-blue-600">${invitation.proposed_amount}</span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Bill Date:</span>
                <span className="text-sm">{format(new Date(bill.bill_date), 'MMM dd, yyyy')}</span>
              </div>
              
              {bill.due_date && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Due Date:</span>
                  <span className="text-sm">{format(new Date(bill.due_date), 'MMM dd, yyyy')}</span>
                </div>
              )}
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Created by:</span>
                <span className="text-sm">{bill.creator_name}</span>
              </div>
              
              {bill.bill_type === 'monthly' && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Type:</span>
                  <Badge variant="outline">Monthly Recurring</Badge>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Notes */}
          {bill.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600">{bill.notes}</p>
              </CardContent>
            </Card>
          )}

          {/* Invitation Status */}
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-4">
              You've been invited to contribute <strong>${invitation.proposed_amount}</strong> to this bill.
            </p>
            
            {invitation.status === 'pending' && (
              <div className="flex space-x-3 justify-center">
                <Button
                  onClick={() => handleResponse('accept')}
                  disabled={isSubmitting}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  {isSubmitting ? 'Processing...' : 'Accept'}
                </Button>
                
                <Button
                  onClick={() => handleResponse('reject')}
                  disabled={isSubmitting}
                  variant="destructive"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  {isSubmitting ? 'Processing...' : 'Reject'}
                </Button>
              </div>
            )}
            
            {invitation.status === 'accepted' && (
              <Badge className="bg-green-100 text-green-800">
                <CheckCircle className="h-4 w-4 mr-1" />
                Already Accepted
              </Badge>
            )}
            
            {invitation.status === 'rejected' && (
              <Badge className="bg-red-100 text-red-800">
                <XCircle className="h-4 w-4 mr-1" />
                Already Rejected
              </Badge>
            )}
          </div>
        </div>

        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default InvitationResponseModal;
