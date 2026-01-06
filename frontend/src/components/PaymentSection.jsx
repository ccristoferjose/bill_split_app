import { useMarkBillAsPaidMutation } from '../services/api';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle, DollarSign, User, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';


// PaymentSection.jsx
const PaymentSection = ({ bill, participants, currentUserId }) => {
    const [markAsPaid, { isLoading }] = useMarkBillAsPaidMutation();
    
    const currentUserParticipant = participants.find(p => p.user_id === currentUserId);
    const hasPaid = currentUserParticipant?.payment_status === 'paid';
    
    const paidCount = participants.filter(p => p.payment_status === 'paid').length;
    const totalCount = participants.length;
    
    const handleMarkPaid = async () => {
        try {
          await markAsPaid({
            billId: bill.id,
            user_id: currentUserId
          }).unwrap();
          
          toast.success('Payment marked successfully!');
        } catch (error) {
          toast.error('Failed to mark payment');
        }
      };
    
    return (
      <Card>
        <CardHeader>
          <CardTitle>Payment Status</CardTitle>
          <div className="text-sm text-gray-600">
            {paidCount} of {totalCount} participants paid
          </div>
          <Progress value={(paidCount / totalCount) * 100} />
        </CardHeader>
        
        <CardContent>
          {/* Your Payment */}
          <div className="mb-4 p-4 border rounded">
            <div className="flex justify-between items-center">
              <div>
                <p className="font-semibold">Your Payment</p>
                <p className="text-2xl">${currentUserParticipant?.amount_owed}</p>
              </div>
              
              {hasPaid ? (
                <Badge className="bg-green-100 text-green-800">
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Paid on {format(new Date(currentUserParticipant.paid_date), 'MMM dd')}
                </Badge>
              ) : (
                <Button 
                  onClick={handleMarkPaid}
                  disabled={isLoading}
                  className="bg-green-600"
                >
                  <DollarSign className="h-4 w-4 mr-1" />
                  Mark as Paid
                </Button>
              )}
            </div>
          </div>
          
          {/* All Participants */}
          <div className="space-y-2">
            <p className="font-semibold text-sm mb-2">All Participants</p>
            {participants.map(participant => (
              <div key={participant.user_id} className="flex justify-between items-center py-2 border-b">
                <div className="flex items-center space-x-2">
                  <User className="h-4 w-4 text-gray-400" />
                  <span>{participant.username}</span>
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