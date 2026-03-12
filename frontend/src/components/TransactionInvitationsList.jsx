import React, { useState } from 'react';
import { format } from 'date-fns';
import { useGetTransactionInvitationsQuery } from '../services/api';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CalendarDays, DollarSign, Users, User } from 'lucide-react';
import TransactionBillDetailModal from './TransactionBillDetailModal';

const parseLocalDate = (raw) => {
  if (!raw) return null;
  const [y, m, d] = raw.split('T')[0].split('-').map(Number);
  return new Date(y, m - 1, d);
};

const TransactionInvitationsList = ({ userId }) => {
  const [selectedInvitation, setSelectedInvitation] = useState(null);
  const { data, isLoading, error } = useGetTransactionInvitationsQuery(userId);
  const invitations = data?.invitations || [];

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(2)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
              <div className="h-3 bg-gray-200 rounded w-1/2" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) return <p className="text-sm text-red-500 text-center py-4">Failed to load invitations</p>;

  if (invitations.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        <CalendarDays className="h-10 w-10 mx-auto mb-2 opacity-40" />
        <p className="text-sm">No pending bill invitations</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {invitations.map(inv => {
          const dueDate = parseLocalDate(inv.due_date);
          return (
            <Card key={inv.id} className="hover:shadow-md transition-shadow border-yellow-200 bg-yellow-50/40">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">

                    {/* Title + badge */}
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <CalendarDays className="h-4 w-4 text-blue-500 shrink-0" />
                      <h3 className="font-semibold text-sm truncate">{inv.title}</h3>
                      <Badge className="bg-yellow-100 text-yellow-800 text-xs border border-yellow-200">
                        Awaiting Response
                      </Badge>
                    </div>

                    {/* Meta */}
                    <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600 mb-2">
                      <span className="flex items-center gap-0.5">
                        <DollarSign className="h-3.5 w-3.5" />
                        Total: <span className="font-medium ml-0.5">${Number(inv.amount).toFixed(2)}</span>
                      </span>
                      <span className="flex items-center gap-1 text-blue-700 font-medium">
                        Your share: ${Number(inv.my_amount).toFixed(2)}
                      </span>
                      {dueDate && (
                        <span className="flex items-center gap-1 text-gray-500">
                          Due {format(dueDate, 'MMM dd, yyyy')}
                        </span>
                      )}
                    </div>

                    {/* Owner */}
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                      <User className="h-3 w-3" />
                      From <span className="font-medium">{inv.owner_username}</span>
                    </p>

                    {/* All participants preview */}
                    {inv.participants?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        <span className="text-xs text-gray-400 flex items-center gap-1 mr-1">
                          <Users className="h-3 w-3" />Split with:
                        </span>
                        {inv.participants.map(p => (
                          <span
                            key={p.user_id}
                            className={`text-xs rounded-full px-2 py-0.5 border ${
                              Number(p.user_id) === Number(userId)
                                ? 'bg-blue-100 border-blue-200 text-blue-700 font-medium'
                                : 'bg-gray-100 border-gray-200 text-gray-600'
                            }`}
                          >
                            {p.username}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Action */}
                  <Button
                    size="sm"
                    onClick={() => setSelectedInvitation(inv)}
                    className="bg-blue-600 hover:bg-blue-700 shrink-0"
                  >
                    Respond
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {selectedInvitation && (
        <TransactionBillDetailModal
          transaction={{ ...selectedInvitation, _role: 'participant' }}
          userId={userId}
          onClose={() => setSelectedInvitation(null)}
        />
      )}
    </>
  );
};

export default TransactionInvitationsList;
