import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Users } from 'lucide-react';
import { toast } from 'sonner';
import { useGetFriendsQuery, useUpdateTransactionParticipantsMutation } from '../services/api';

const TransactionSplitModal = ({ bill, userId, onClose }) => {
  const { data: friendsData } = useGetFriendsQuery(userId);
  const friends = friendsData?.friends || [];

  // Pre-populate with existing participants
  const [participants, setParticipants] = useState(
    bill.participants?.map(p => ({ userId: p.user_id, username: p.username, amount: String(p.amount_owed) })) || []
  );
  const [search, setSearch] = useState('');
  const [updateParticipants, { isLoading }] = useUpdateTransactionParticipantsMutation();

  const filteredFriends = friends.filter(f =>
    f.username.toLowerCase().includes(search.toLowerCase())
  );

  const toggle = (friend) => {
    setParticipants(prev => {
      const exists = prev.find(p => p.userId === friend.id);
      if (exists) return prev.filter(p => p.userId !== friend.id);
      return [...prev, { userId: friend.id, username: friend.username, amount: '' }];
    });
  };

  const setAmount = (friendId, amount) => {
    setParticipants(prev =>
      prev.map(p => p.userId === friendId ? { ...p, amount } : p)
    );
  };

  const handleSave = async () => {
    try {
      await updateParticipants({
        transactionId: bill.id,
        user_id: userId,
        participants: participants.map(p => ({
          user_id: p.userId,
          amount_owed: parseFloat(p.amount) || 0,
        })),
      }).unwrap();
      toast.success('Split updated');
      onClose();
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to update split');
    }
  };

  const totalAssigned = participants.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
  const remaining = Number(bill.amount) - totalAssigned;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-500" />
            Split "{bill.title}"
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Summary */}
          <div className="flex justify-between text-sm bg-gray-50 rounded-lg px-3 py-2">
            <span className="text-gray-500">Total</span>
            <span className="font-semibold">${Number(bill.amount).toFixed(2)}</span>
          </div>

          {/* Friend search */}
          {friends.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">
              No friends added yet. Add friends to split bills.
            </p>
          ) : (
            <>
              <Input
                placeholder="Search friends..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <div className="max-h-48 overflow-y-auto border rounded-lg divide-y">
                {filteredFriends.map(friend => {
                  const selected = participants.find(p => p.userId === friend.id);
                  return (
                    <div key={friend.id} className="flex items-center gap-2 px-3 py-2">
                      <button
                        type="button"
                        onClick={() => toggle(friend)}
                        className={[
                          'flex-1 text-left text-sm px-2 py-1 rounded transition-colors',
                          selected
                            ? 'bg-blue-50 text-blue-700 font-medium'
                            : 'hover:bg-gray-50 text-gray-700',
                        ].join(' ')}
                      >
                        {friend.username}
                      </button>
                      {selected && (
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="Amount"
                          value={selected.amount}
                          onChange={(e) => setAmount(friend.id, e.target.value)}
                          className="w-24 h-8 text-sm"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Assigned summary */}
          {participants.length > 0 && (
            <div className="text-sm space-y-1">
              <div className="flex justify-between text-gray-500">
                <span>Assigned to others</span>
                <span>${totalAssigned.toFixed(2)}</span>
              </div>
              <div className={`flex justify-between font-medium ${remaining < 0 ? 'text-red-600' : 'text-gray-700'}`}>
                <span>Your share (remaining)</span>
                <span>${remaining.toFixed(2)}</span>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} disabled={isLoading || remaining < 0}>
              {isLoading ? 'Saving...' : 'Save Split'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TransactionSplitModal;
