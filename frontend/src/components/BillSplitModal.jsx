import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { useGetFriendsQuery, useInviteUsersToBillMutation, useGetBillDetailsQuery } from '../services/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, X, Users, DollarSign, Lock } from 'lucide-react';
import { toast } from 'sonner';

const BillSplitModal = ({ billId, billAmount, billTitle, onClose }) => {
  const { user } = useSelector((state) => state.auth);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: billData } = useGetBillDetailsQuery(billId);
  const { data: friendsData, isLoading: friendsLoading } = useGetFriendsQuery(user.id);

  const [inviteUsers] = useInviteUsersToBillMutation();

  // Participants who already paid — locked, cannot be re-split
  const paidParticipants = (billData?.participants || []).filter(
    p => p.payment_status === 'paid' && !p.is_creator
  );
  const paidUserIds = paidParticipants.map(p => p.user_id);
  const paidTotal = paidParticipants.reduce((sum, p) => sum + parseFloat(p.amount_owed), 0);
  const splittableAmount = parseFloat(billAmount) - paidTotal;

  const addUser = (searchUser) => {
    if (selectedUsers.some(u => u.id === searchUser.id)) {
      toast.error('User already added');
      return;
    }

    const totalUsers = selectedUsers.length + 2; // +1 for new user, +1 for current user
    const defaultPercentage = parseFloat((100 / totalUsers).toFixed(1));

    const updatedUsers = selectedUsers.map(u => ({
      ...u,
      percentage: defaultPercentage
    }));

    setSelectedUsers([...updatedUsers, {
      id: searchUser.id,
      username: searchUser.username,
      email: searchUser.email,
      percentage: defaultPercentage
    }]);
  };

  const removeUser = (userId) => {
    const remainingUsers = selectedUsers.filter(u => u.id !== userId);

    if (remainingUsers.length > 0) {
      const totalUsers = remainingUsers.length + 1;
      const defaultPercentage = parseFloat((100 / totalUsers).toFixed(1));

      const updatedUsers = remainingUsers.map(u => ({
        ...u,
        percentage: defaultPercentage
      }));

      setSelectedUsers(updatedUsers);
    } else {
      setSelectedUsers([]);
    }
  };

  const updatePercentage = (userId, percentage) => {
    const numValue = parseFloat(percentage) || 0;
    setSelectedUsers(selectedUsers.map(u =>
      u.id === userId ? { ...u, percentage: Math.max(0, Math.min(100, numValue)) } : u
    ));
  };

  const getTotalPercentage = () => {
    return selectedUsers.reduce((sum, u) => sum + u.percentage, 0);
  };

  const getCreatorPercentage = () => {
    return Math.max(0, 100 - getTotalPercentage());
  };

  const getCalculatedAmount = (percentage) => {
    return ((percentage / 100) * splittableAmount).toFixed(2);
  };

  const handleSubmit = async () => {
    if (selectedUsers.length === 0) {
      toast.error('Please add at least one user to split the bill');
      return;
    }

    const invalidUsers = selectedUsers.filter(u => u.percentage <= 0);
    if (invalidUsers.length > 0) {
      toast.error('All users must have a percentage greater than 0%');
      return;
    }

    const totalPercentage = getTotalPercentage();
    if (totalPercentage > 100) {
      toast.error(`Total percentage cannot exceed 100%. Currently at ${totalPercentage}%`);
      return;
    }

    setIsSubmitting(true);

    try {
      const users = selectedUsers.map(u => ({
        user_id: u.id,
        proposed_amount: parseFloat(getCalculatedAmount(u.percentage))
      }));

      await inviteUsers({
        billId,
        invited_by: user.id,
        users
      }).unwrap();

      toast.success(`Successfully sent ${selectedUsers.length} invitation(s)`);
      onClose();
    } catch (error) {
      console.error('Error sending invitations:', error);
      const errorMessage = error?.data?.message || error?.message || 'Failed to send invitations';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Users className="h-5 w-5 mr-2" />
            Split Bill: {billTitle}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Bill Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center text-lg">
                <DollarSign className="h-4 w-4 mr-2" />
                Bill Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`grid ${paidParticipants.length > 0 ? 'grid-cols-3' : 'grid-cols-2'} gap-4`}>
                <div>
                  <p className="text-sm text-gray-600">Total Amount</p>
                  <p className="text-2xl font-bold">${billAmount}</p>
                </div>
                {paidParticipants.length > 0 && (
                  <div>
                    <p className="text-sm text-gray-600">Already Paid</p>
                    <p className="text-2xl font-bold text-green-600">${paidTotal.toFixed(2)}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-gray-600">
                    {paidParticipants.length > 0 ? 'Remaining to Split' : 'You Pay'}
                  </p>
                  <p className="text-2xl font-bold text-blue-600">
                    {selectedUsers.length > 0
                      ? `$${getCalculatedAmount(getCreatorPercentage())}`
                      : `$${splittableAmount.toFixed(2)}`
                    }
                  </p>
                  {selectedUsers.length > 0 && (
                    <p className="text-sm text-gray-500">({getCreatorPercentage()}%)</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Paid Participants (locked) */}
          {paidParticipants.length > 0 && (
            <Card className="border-green-200 bg-green-50">
              <CardHeader>
                <CardTitle className="text-sm flex items-center">
                  <Lock className="h-4 w-4 mr-2" />
                  Already Paid (cannot be changed)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {paidParticipants.map(p => (
                  <div key={p.user_id} className="flex justify-between items-center p-2 bg-white rounded border">
                    <span className="font-medium">{p.username}</span>
                    <Badge className="bg-green-100 text-green-800">${parseFloat(p.amount_owed).toFixed(2)} Paid</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Friends Picker */}
          <Card>
            <CardHeader>
              <CardTitle>Add Friends</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {friendsLoading && <p className="text-sm text-gray-500">Loading friends...</p>}

              {friendsData?.friends && friendsData.friends.length > 0 ? (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {friendsData.friends
                    .filter(f => f.id !== user.id && !paidUserIds.includes(f.id) && !selectedUsers.some(u => u.id === f.id))
                    .map(friend => (
                      <div
                        key={friend.id}
                        className="flex items-center justify-between p-2 border rounded hover:bg-gray-50"
                      >
                        <div>
                          <p className="font-medium">{friend.username}</p>
                          <p className="text-sm text-gray-500">{friend.email}</p>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => addUser(friend)}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Add
                        </Button>
                      </div>
                    ))}
                </div>
              ) : (
                !friendsLoading && (
                  <p className="text-sm text-gray-500">
                    No friends available. Add friends from the Friends tab first.
                  </p>
                )
              )}
            </CardContent>
          </Card>

          {/* Selected Users */}
          {selectedUsers.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Split Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedUsers.map(u => (
                  <div key={u.id} className="flex items-center justify-between p-3 border rounded">
                    <div className="flex-1">
                      <p className="font-medium">{u.username}</p>
                      <p className="text-sm text-gray-500">{u.email}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Input
                        type="number"
                        value={u.percentage}
                        onChange={(e) => updatePercentage(u.id, e.target.value)}
                        className="w-20 text-center"
                        min="0"
                        max="100"
                        step="0.1"
                      />
                      <span className="text-sm">%</span>
                      <Badge variant="outline">
                        ${getCalculatedAmount(u.percentage)}
                      </Badge>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeUser(u.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}

                {/* Total Summary */}
                <div className="border-t pt-3">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Total Percentage:</span>
                    <Badge variant={getTotalPercentage() <= 100 ? "default" : "destructive"}>
                      {getTotalPercentage()}%
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center mt-2">
                    <span className="font-medium">Remaining for You:</span>
                    <Badge variant="outline">
                      {getCreatorPercentage()}% (${getCalculatedAmount(getCreatorPercentage())})
                    </Badge>
                  </div>
                  {paidParticipants.length > 0 && (
                    <p className="text-xs text-gray-500 mt-2">
                      Percentages are calculated on the remaining ${splittableAmount.toFixed(2)} (after paid shares)
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="flex justify-end space-x-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || selectedUsers.length === 0}
          >
            {isSubmitting ? 'Sending...' : `Send ${selectedUsers.length} Invitation(s)`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BillSplitModal;
