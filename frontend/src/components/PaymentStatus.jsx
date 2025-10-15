import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';

const PaymentStatus = ({ bill, participants }) => {
    const paidCount = participants.filter(p => p.payment_status === 'paid').length;
    const totalCount = participants.length;
    
    return (
      <div className="space-y-2">
        {/* Progress Bar */}
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-green-600 h-2 rounded-full transition-all"
            style={{ width: `${(paidCount / totalCount) * 100}%` }}
          />
        </div>
        
        {/* Payment Summary */}
        <p className="text-sm text-gray-600">
          {paidCount} of {totalCount} participants have paid
        </p>
        
        {/* Individual Status */}
        <div className="space-y-1">
          {participants.map(participant => (
            <div key={participant.user_id} className="flex items-center justify-between">
              <span>{participant.user_name}</span>
              <Badge className={
                participant.payment_status === 'paid' 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-yellow-100 text-yellow-800'
              }>
                {participant.payment_status === 'paid' ? (
                  <>✓ Paid {format(new Date(participant.paid_date), 'MMM dd')}</>
                ) : (
                  <>Pending - ${participant.amount}</>
                )}
              </Badge>
            </div>
          ))}
        </div>
      </div>
    );
  };


export default PaymentStatus;