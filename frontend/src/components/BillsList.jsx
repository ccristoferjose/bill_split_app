// frontend/src/components/bills/BillsList.jsx
import React, { useState } from 'react';
import { 
  useGetUserCreatedBillsQuery, 
  useGetUserInvitedBillsQuery, 
  useGetUserParticipatingBillsQuery
} from '../services/api';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, DollarSign, Users, Clock, Receipt, CheckCircle, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import InvitationResponseModal from './InvitationResponseModal';

const BillsList = ({ userId, type, onSelectBill }) => {
  const [selectedInvitation, setSelectedInvitation] = useState(null);
  const {
    data: createdBills,
    isLoading: isLoadingCreated,
    error: createdError
  } = useGetUserCreatedBillsQuery(userId, { skip: type !== 'created' });

  const {
    data: invitedBills,
    isLoading: isLoadingInvited,
    error: invitedError
  } = useGetUserInvitedBillsQuery(userId, { skip: type !== 'invited' });

  const {
    data: participatingBills,
    isLoading: isLoadingParticipating,
    error: participatingError
  } = useGetUserParticipatingBillsQuery(userId, { skip: type !== 'participating' });

  const getBillsData = () => {
    switch (type) {
      case 'created':
        return { bills: createdBills?.bills || [], isLoading: isLoadingCreated, error: createdError };
      case 'invited':
        return { bills: invitedBills?.bills || [], isLoading: isLoadingInvited, error: invitedError };
      case 'participating':
        return { bills: participatingBills?.bills || [], isLoading: isLoadingParticipating, error: participatingError };
      default:
        return { bills: [], isLoading: false, error: null };
    }
  };

  const { bills, isLoading, error } = getBillsData();

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

  const getBillTypeIcon = (billType) => {
    return billType === 'monthly' ? <Clock className="h-4 w-4" /> : <Calendar className="h-4 w-4" />;
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600">Error loading bills: {error.message}</p>
      </div>
    );
  }

  if (bills.length === 0) {
    return (
      <div className="text-center py-8">
        <Receipt className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500">No bills found</p>
      </div>
    );
  }

  const handleInvitationResponse = (action) => {
    // Refresh the bills list after response
    // The query will automatically refetch due to cache invalidation
    toast.success(`Invitation ${action}ed successfully!`);
  };

  return (
    <>
      <div className="space-y-4">
        {bills.map((bill) => (
          <Card key={bill.id} className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    {getBillTypeIcon(bill.bill_type)}
                    <h3 className="font-semibold text-lg">{bill.title}</h3>
                    <Badge className={getStatusColor(bill.status)}>
                      {bill.status.replace('_', ' ')}
                    </Badge>
                    {bill.bill_type === 'monthly' && (
                      <Badge variant="outline">Monthly</Badge>
                    )}
                  </div>
                  
                  <div className="flex items-center space-x-4 text-sm text-gray-600 mb-3">
                    <div className="flex items-center">
                      <DollarSign className="h-4 w-4 mr-1" />
                      ${bill.total_amount}
                    </div>
                    <div className="flex items-center">
                      <Calendar className="h-4 w-4 mr-1" />
                      {format(new Date(bill.bill_date), 'MMM dd, yyyy')}
                    </div>
                    {type === 'created' && (
                      <div className="flex items-center">
                        <Users className="h-4 w-4 mr-1" />
                        {bill.total_invitations || 0} invited
                      </div>
                    )}
                    {type === 'invited' && bill.creator_name && (
                      <div>
                        Created by {bill.creator_name}
                      </div>
                    )}
                    {type === 'participating' && (
                      <div className="flex items-center">
                        <DollarSign className="h-4 w-4 mr-1" />
                        You owe: ${bill.amount_owed}
                      </div>
                    )}
                  </div>

                  {bill.due_date && (
                    <p className="text-sm text-gray-500">
                      Due: {format(new Date(bill.due_date), 'MMM dd, yyyy')}
                    </p>
                  )}

                  {type === 'invited' && bill.invitation_status === 'pending' && (
                    <div className="mt-3 flex space-x-2">
                      <Badge className="bg-orange-100 text-orange-800">
                        Awaiting your response - ${bill.proposed_amount}
                      </Badge>
                    </div>
                  )}
                </div>
                
                <div className="flex space-x-2">
                  {type === 'invited' && bill.invitation_status === 'pending' && (
                    <>
                      <Button
                        size="sm"
                        onClick={() => setSelectedInvitation(bill)}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Respond
                      </Button>
                    </>
                  )}
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onSelectBill(bill.id)}
                  >
                    View Details
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Invitation Response Modal */}
      {selectedInvitation && (
        <InvitationResponseModal
          bill={selectedInvitation}
          invitation={{
            status: selectedInvitation.invitation_status,
            proposed_amount: selectedInvitation.proposed_amount
          }}
          onClose={() => setSelectedInvitation(null)}
          onResponse={handleInvitationResponse}
        />
      )}
    </>
  );
};

export default BillsList;
