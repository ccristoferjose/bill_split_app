import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle, DollarSign } from 'lucide-react';
import { useMarkBillAsPaidMutation } from '../services/api';

const PaymentButton = ({ bill, userId, userPaymentStatus }) => {
    const [markBillAsPaid, { isLoading }] = useMarkBillAsPaidMutation();
    
    if (userPaymentStatus === 'paid') {
      return (
        <Badge className="bg-green-100 text-green-800">
          <CheckCircle className="h-4 w-4 mr-1" />
          You've Paid
        </Badge>
      );
    }
    
    return (
      <Button
        onClick={() => markBillAsPaid({ billId: bill.id, user_id: userId })}
        disabled={isLoading || bill.status !== 'finalized'}
        className="bg-green-600 hover:bg-green-700"
      >
        <DollarSign className="h-4 w-4 mr-1" />
        {isLoading ? 'Processing...' : 'Mark as Paid'}
      </Button>
    );
  };

export default PaymentButton;