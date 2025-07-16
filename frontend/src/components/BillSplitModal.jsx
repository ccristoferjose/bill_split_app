import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { useSearchUsersQuery, useInviteUsersToBillMutation } from '../services/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, X, Users, DollarSign } from 'lucide-react';
import { toast } from 'sonner';

const BillSplitModal = ({ billId, billAmount, billTitle, onClose }) => {
  const { user } = useSelector((state) => state.auth);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { data: searchResults, isLoading: isSearching } = useSearchUsersQuery(searchTerm, {
    skip: !searchTerm || searchTerm.length < 2
  });
  
  const [inviteUsers] = useInviteUsersToBillMutation();

  const addUser = (searchUser) => {
    if (selectedUsers.some(u => u.id === searchUser.id)) {
      toast.error('User already added');
      return;
    }
    
    const totalUsers = selectedUsers.length + 2; // +1 for new user, +1 for current user
    const defaultPercentage = parseFloat((100 / totalUsers).toFixed(1));
    
    setSelectedUsers([...selectedUsers, {
      id: searchUser.id,
      username: searchUser.username,
      email: searchUser.email,
      percentage: defaultPercentage
    }]);
    
    setSearchTerm('');
  };

  const removeUser = (userId) => {
    setSelectedUsers(selectedUsers.filter(u => u.id !== userId));
  };

  const updatePercentage = (userId, percentage) => {
    const numValue = parseFloat(percentage) || 0;
    setSelectedUsers(selectedUsers.map(u => 
      u.id === userId ? { ...u, percentage: Math.max(0, Math.min(100, numValue)) } : u
    ));
  };

  const getTotalPercentage = () => {
    return selectedUsers.reduce((sum, user) => sum + user.percentage, 0);
  };

  const getCreatorPercentage = () => {
    return Math.max(0, 100 - getTotalPercentage());
  };

  const getCalculatedAmount = (percentage) => {
    return ((percentage / 100) * billAmount).toFixed(2);
  };

  const handleSubmit = async () => {
    if (selectedUsers.length === 0) {
      toast.error('Please add at least one user to split the bill');
      return;
    }

    setIsSubmitting(true);
    
    try {
      const users = selectedUsers.map(user => ({
        user_id: user.id,
        proposed_amount: parseFloat(getCalculatedAmount(user.percentage))
      }));

      console.log('Sending invitation data:', { billId, invited_by: user.id, users });

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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Total Amount</p>
                  <p className="text-2xl font-bold">${billAmount}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">You Pay</p>
                  <p className="text-2xl font-bold text-blue-600">
                    ${getCalculatedAmount(getCreatorPercentage())}
                  </p>
                  <p className="text-sm text-gray-500">({getCreatorPercentage()}%)</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* User Search */}
          <Card>
            <CardHeader>
              <CardTitle>Add Users</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search users by username or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              {isSearching && <p className="text-sm text-gray-500">Searching...</p>}
              
              {searchResults?.users && searchResults.users.length > 0 && (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {searchResults.users
                    .filter(u => u.id !== user.id) // Don't show current user
                    .map(searchUser => (
                      <div
                        key={searchUser.id}
                        className="flex items-center justify-between p-2 border rounded hover:bg-gray-50"
                      >
                        <div>
                          <p className="font-medium">{searchUser.username}</p>
                          <p className="text-sm text-gray-500">{searchUser.email}</p>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => addUser(searchUser)}
                          disabled={selectedUsers.some(u => u.id === searchUser.id)}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Add
                        </Button>
                      </div>
                    ))}
                </div>
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
                {selectedUsers.map(user => (
                  <div key={user.id} className="flex items-center justify-between p-3 border rounded">
                    <div className="flex-1">
                      <p className="font-medium">{user.username}</p>
                      <p className="text-sm text-gray-500">{user.email}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Input
                        type="number"
                        value={user.percentage}
                        onChange={(e) => updatePercentage(user.id, e.target.value)}
                        className="w-20 text-center"
                        min="0"
                        max="100"
                        step="0.1"
                      />
                      <span className="text-sm">%</span>
                      <Badge variant="outline">
                        ${getCalculatedAmount(user.percentage)}
                      </Badge>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeUser(user.id)}
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
                    <Badge variant={Math.abs(getTotalPercentage() - 100) <= 0.5 ? "default" : "destructive"}>
                      {getTotalPercentage()}%
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center mt-2">
                    <span className="font-medium">Remaining for You:</span>
                    <Badge variant="outline">
                      {getCreatorPercentage()}% (${getCalculatedAmount(getCreatorPercentage())})
                    </Badge>
                  </div>
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
