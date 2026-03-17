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

    const totalUsers = selectedUsers.length + 2; // +1 for new user, +1 for creator
    const defaultPercentage = parseFloat((100 / totalUsers).toFixed(1));

    const updatedUsers = selectedUsers.map(u => ({
      ...u,
      percentage: defaultPercentage,
    }));

    setSelectedUsers([...updatedUsers, {
      id: searchUser.id,
      username: searchUser.username,
      email: searchUser.email,
      percentage: defaultPercentage,
    }]);
  };

  const removeUser = (userId) => {
    const remainingUsers = selectedUsers.filter(u => u.id !== userId);

    if (remainingUsers.length > 0) {
      const totalUsers = remainingUsers.length + 1;
      const defaultPercentage = parseFloat((100 / totalUsers).toFixed(1));
      setSelectedUsers(remainingUsers.map(u => ({ ...u, percentage: defaultPercentage })));
    } else {
      setSelectedUsers([]);
    }
  };

  const updatePercentage = (userId, value) => {
    const num = Math.max(0, Math.min(100, parseFloat(value) || 0));
    setSelectedUsers(selectedUsers.map(u =>
      u.id === userId ? { ...u, percentage: num } : u
    ));
  };

  const updateAmount = (userId, value) => {
    const num = parseFloat(value) || 0;
    const percentage = splittableAmount > 0
      ? parseFloat(((num / splittableAmount) * 100).toFixed(1))
      : 0;
    setSelectedUsers(selectedUsers.map(u =>
      u.id === userId ? { ...u, percentage: Math.max(0, Math.min(100, percentage)) } : u
    ));
  };

  const getTotalPercentage = () =>
    parseFloat(selectedUsers.reduce((sum, u) => sum + u.percentage, 0).toFixed(1));

  const getCreatorPercentage = () =>
    parseFloat(Math.max(0, 100 - getTotalPercentage()).toFixed(1));

  const getCalculatedAmount = (percentage) =>
    ((percentage / 100) * splittableAmount).toFixed(2);

  const handleSubmit = async () => {
    if (selectedUsers.length === 0) {
      toast.error('Please add at least one user to split the bill');
      return;
    }

    const zeroAmountUsers = selectedUsers.filter(
      u => parseFloat(getCalculatedAmount(u.percentage)) <= 0
    );
    if (zeroAmountUsers.length > 0) {
      toast.error(`${zeroAmountUsers.map(u => u.username).join(', ')} would owe $0. Adjust the split.`);
      return;
    }

    const totalPercentage = getTotalPercentage();
    if (totalPercentage > 100) {
      toast.error(`Total exceeds 100% (currently ${totalPercentage}%)`);
      return;
    }

    if (parseFloat(getCalculatedAmount(getCreatorPercentage())) <= 0 && getCreatorPercentage() > 0) {
      toast.error('Your share amount cannot be $0. Adjust the split.');
      return;
    }

    setIsSubmitting(true);
    try {
      const users = selectedUsers.map(u => ({
        user_id: u.id,
        proposed_amount: parseFloat(getCalculatedAmount(u.percentage)),
      }));

      await inviteUsers({ billId, invited_by: user.id, users }).unwrap();
      toast.success(`Successfully sent ${selectedUsers.length} invitation(s)`);
      onClose();
    } catch (error) {
      console.error('Error sending invitations:', error);
      toast.error(error?.data?.message || error?.message || 'Failed to send invitations');
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
                      : `$${splittableAmount.toFixed(2)}`}
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
                    .filter(f =>
                      f.id !== user.id &&
                      !paidUserIds.includes(f.id) &&
                      !selectedUsers.some(u => u.id === f.id)
                    )
                    .map(friend => (
                      <div
                        key={friend.id}
                        className="flex items-center justify-between p-2 border rounded hover:bg-gray-50"
                      >
                        <div>
                          <p className="font-medium">{friend.username}</p>
                          <p className="text-sm text-gray-500">{friend.email}</p>
                        </div>
                        <Button size="sm" onClick={() => addUser(friend)}>
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

          {/* Split Configuration */}
          {selectedUsers.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Split Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {selectedUsers.map(u => {
                  const amount = getCalculatedAmount(u.percentage);
                  const isZero = parseFloat(amount) <= 0;
                  return (
                    <div key={u.id} className={`p-3 border rounded space-y-3 ${isZero ? 'border-red-300 bg-red-50' : ''}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{u.username}</p>
                          <p className="text-sm text-gray-500">{u.email}</p>
                        </div>
                        <Button size="sm" variant="ghost" onClick={() => removeUser(u.id)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>

                      {/* Slider */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs text-gray-500">
                          <span>0%</span>
                          <span className="font-medium text-gray-700">{u.percentage}%</span>
                          <span>100%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          step="0.1"
                          value={u.percentage}
                          onChange={(e) => updatePercentage(u.id, e.target.value)}
                          className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-blue-600"
                        />
                      </div>

                      {/* Amount + Percentage inputs */}
                      <div className="flex items-center gap-2">
                        <div className="flex items-center flex-1 border rounded overflow-hidden focus-within:ring-1 focus-within:ring-blue-500">
                          <span className="px-2 text-gray-500 text-sm bg-gray-50 border-r">$</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={amount}
                            onChange={(e) => updateAmount(u.id, e.target.value)}
                            className="flex-1 px-2 py-1.5 text-sm outline-none bg-white"
                          />
                        </div>
                        <div className="flex items-center border rounded overflow-hidden w-24 focus-within:ring-1 focus-within:ring-blue-500">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.1"
                            value={u.percentage}
                            onChange={(e) => updatePercentage(u.id, e.target.value)}
                            className="flex-1 px-2 py-1.5 text-sm outline-none bg-white w-0"
                          />
                          <span className="px-2 text-gray-500 text-sm bg-gray-50 border-l">%</span>
                        </div>
                      </div>

                      {isZero && (
                        <p className="text-xs text-red-600">Amount cannot be $0</p>
                      )}
                    </div>
                  );
                })}

                {/* Total Summary */}
                <div className="border-t pt-3 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Total assigned:</span>
                    <Badge variant={getTotalPercentage() <= 100 ? 'default' : 'destructive'}>
                      {getTotalPercentage()}%
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Your share:</span>
                    <Badge variant="outline">
                      {getCreatorPercentage()}% (${getCalculatedAmount(getCreatorPercentage())})
                    </Badge>
                  </div>
                  {paidParticipants.length > 0 && (
                    <p className="text-xs text-gray-500">
                      Percentages are calculated on the remaining ${splittableAmount.toFixed(2)}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="flex justify-end space-x-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
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
