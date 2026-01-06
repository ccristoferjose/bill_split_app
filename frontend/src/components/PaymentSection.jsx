import { useMarkBillAsPaidMutation } from '../services/api';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle, DollarSign, User, Clock, Crown, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

const PaymentSection = ({ bill, participants, currentUserId }) => {
  const [markAsPaid, { isLoading }] = useMarkBillAsPaidMutation();

  // Find current user's participant record
  const currentUserParticipant = participants.find(
    (p) => p.user_id === currentUserId
  );

  // Check if current user has already paid
  const hasPaid = currentUserParticipant?.payment_status === 'paid';

  // Calculate payment progress
  const paidCount = participants.filter((p) => p.payment_status === 'paid').length;
  const totalCount = participants.length;
  const progressPercentage = totalCount > 0 ? (paidCount / totalCount) * 100 : 0;

  // Check if bill allows payments (must be finalized or partially paid)
  const canMakePayment = bill.status === 'finalized' || bill.status === 'paid';

  const handleMarkPaid = async () => {
    if (!currentUserParticipant) {
      toast.error('You are not a participant of this bill');
      return;
    }

    try {
      const result = await markAsPaid({
        billId: bill.id,
        user_id: currentUserId,
      }).unwrap();

      if (result.data?.billFullyPaid) {
        toast.success('Bill fully paid! All participants have paid their share.');
      } else {
        toast.success('Payment marked successfully!');
      }
    } catch (error) {
      const errorMessage = error?.data?.message || 'Failed to mark payment';
      toast.error(errorMessage);
    }
  };

  // If user is not a participant, show a message
  if (!currentUserParticipant) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Payment Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2 text-yellow-600">
            <AlertCircle className="h-5 w-5" />
            <span>You are not a participant of this bill</span>
          </div>
          
          {/* Still show all participants */}
          {participants.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="font-semibold text-sm mb-2">All Participants</p>
              {participants.map((participant) => (
                <div
                  key={participant.user_id}
                  className="flex justify-between items-center py-2 border-b last:border-b-0"
                >
                  <div className="flex items-center space-x-2">
                    {participant.is_creator ? (
                      <Crown className="h-4 w-4 text-yellow-500" />
                    ) : (
                      <User className="h-4 w-4 text-gray-400" />
                    )}
                    <span>
                      {participant.username}
                      {participant.is_creator && (
                        <span className="text-xs text-gray-500 ml-1">(Creator)</span>
                      )}
                    </span>
                  </div>

                  <div className="flex items-center space-x-3">
                    <span className="font-semibold">${participant.amount_owed}</span>
                    {participant.payment_status === 'paid' ? (
                      <Badge className="bg-green-100 text-green-800">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Paid
                      </Badge>
                    ) : (
                      <Badge className="bg-orange-100 text-orange-800">
                        <Clock className="h-3 w-3 mr-1" />
                        Pending
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Payment Status</span>
          {bill.status === 'paid' && (
            <Badge className="bg-green-100 text-green-800">
              <CheckCircle className="h-4 w-4 mr-1" />
              Fully Paid
            </Badge>
          )}
        </CardTitle>
        <div className="text-sm text-gray-600">
          {paidCount} of {totalCount} participants paid
        </div>
        <Progress value={progressPercentage} className="mt-2" />
      </CardHeader>

      <CardContent>
        {/* Your Payment Section */}
        <div className="mb-4 p-4 border rounded-lg bg-gray-50">
          <div className="flex justify-between items-center">
            <div>
              <div className="flex items-center space-x-2">
                <p className="font-semibold">Your Payment</p>
                {currentUserParticipant.is_creator && (
                  <Badge variant="outline" className="text-xs">
                    <Crown className="h-3 w-3 mr-1" />
                    Creator
                  </Badge>
                )}
              </div>
              <p className="text-2xl font-bold mt-1">
                ${currentUserParticipant.amount_owed}
              </p>
            </div>

            {hasPaid ? (
              <Badge className="bg-green-100 text-green-800 py-2 px-3">
                <CheckCircle className="h-4 w-4 mr-1" />
                Paid on{' '}
                {currentUserParticipant.paid_date
                  ? format(new Date(currentUserParticipant.paid_date), 'MMM dd, yyyy')
                  : 'N/A'}
              </Badge>
            ) : canMakePayment ? (
              <Button
                onClick={handleMarkPaid}
                disabled={isLoading}
                className="bg-green-600 hover:bg-green-700"
              >
                {isLoading ? (
                  <span className="flex items-center">
                    <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></span>
                    Processing...
                  </span>
                ) : (
                  <>
                    <DollarSign className="h-4 w-4 mr-1" />
                    Mark as Paid
                  </>
                )}
              </Button>
            ) : (
              <Badge className="bg-gray-100 text-gray-800">
                <Clock className="h-4 w-4 mr-1" />
                Awaiting Finalization
              </Badge>
            )}
          </div>
        </div>

        {/* All Participants List */}
        <div className="space-y-2">
          <p className="font-semibold text-sm mb-2">All Participants</p>
          {participants.map((participant) => (
            <div
              key={participant.user_id}
              className={`flex justify-between items-center py-2 px-2 border-b last:border-b-0 rounded ${
                participant.user_id === currentUserId ? 'bg-blue-50' : ''
              }`}
            >
              <div className="flex items-center space-x-2">
                {participant.is_creator ? (
                  <Crown className="h-4 w-4 text-yellow-500" />
                ) : (
                  <User className="h-4 w-4 text-gray-400" />
                )}
                <span>
                  {participant.username}
                  {participant.user_id === currentUserId && (
                    <span className="text-xs text-blue-600 ml-1">(You)</span>
                  )}
                  {participant.is_creator && participant.user_id !== currentUserId && (
                    <span className="text-xs text-gray-500 ml-1">(Creator)</span>
                  )}
                </span>
              </div>

              <div className="flex items-center space-x-3">
                <span className="font-semibold">${participant.amount_owed}</span>
                {participant.payment_status === 'paid' ? (
                  <Badge className="bg-green-100 text-green-800">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Paid
                  </Badge>
                ) : (
                  <Badge className="bg-orange-100 text-orange-800">
                    <Clock className="h-3 w-3 mr-1" />
                    Pending
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default PaymentSection;
