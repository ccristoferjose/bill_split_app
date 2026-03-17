import React, { useState, useEffect } from 'react';
import {
  useGetFriendsQuery, useGetPendingRequestsQuery, useGetSentRequestsQuery,
  useSearchNonFriendsQuery, useSendFriendRequestMutation,
  useRespondToFriendRequestMutation, useRemoveFriendMutation
} from '../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, UserPlus, UserMinus, Check, X, Clock, Send, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

const FriendsList = ({ userId }) => {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 400);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const { data: friendsData, isLoading: friendsLoading } = useGetFriendsQuery(userId);
  const { data: pendingData } = useGetPendingRequestsQuery(userId);
  const { data: sentData } = useGetSentRequestsQuery(userId);
  const { data: searchData, isFetching: isSearching } = useSearchNonFriendsQuery(
    { userId, searchTerm: debouncedSearch },
    { skip: !debouncedSearch || debouncedSearch.length < 2 }
  );

  const [sendRequest] = useSendFriendRequestMutation();
  const [respondToRequest] = useRespondToFriendRequestMutation();
  const [removeFriend] = useRemoveFriendMutation();

  const handleSendRequest = async (addresseeId) => {
    try {
      await sendRequest({ requester_id: userId, addressee_id: addresseeId }).unwrap();
      toast.success(t('friends.requestSent'));
      setSearchTerm('');
    } catch (error) {
      toast.error(error?.data?.message || t('friends.failedSendRequest'));
    }
  };

  const handleRespond = async (friendshipId, action) => {
    try {
      await respondToRequest({ friendship_id: friendshipId, user_id: userId, action }).unwrap();
      toast.success(action === 'accepted' ? t('friends.requestAccepted') : t('friends.requestDeclined'));
    } catch (error) {
      toast.error(error?.data?.message || t('friends.failedRespond'));
    }
  };

  const handleRemove = async (friendshipId) => {
    try {
      await removeFriend(friendshipId).unwrap();
      toast.success(t('friends.friendRemoved'));
    } catch (error) {
      toast.error(error?.data?.message || t('friends.failedRemove'));
    }
  };

  const friends = friendsData?.friends || [];
  const pendingRequests = pendingData?.requests || [];
  const sentRequests = sentData?.requests || [];
  const searchResults = searchData?.users || [];

  return (
    <div className="space-y-6">
      {/* Search for new friends */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Search className="h-4 w-4 mr-2" />
            {t('friends.addFriends')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              placeholder={t('friends.searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {isSearching && <p className="text-sm text-gray-500">{t('friends.searching')}</p>}

          {searchResults.length > 0 && (
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {searchResults.map(u => (
                <div key={u.id} className="flex items-center justify-between p-2 border rounded hover:bg-gray-50">
                  <div>
                    <p className="font-medium">{u.username}</p>
                    <p className="text-sm text-gray-500">{u.email}</p>
                  </div>
                  <Button size="sm" onClick={() => handleSendRequest(u.id)}>
                    <UserPlus className="h-4 w-4 mr-1" />
                    {t('friends.addFriend')}
                  </Button>
                </div>
              ))}
            </div>
          )}

          {debouncedSearch.length >= 2 && !isSearching && searchResults.length === 0 && (
            <p className="text-sm text-gray-500">{t('friends.noUsersFound')}</p>
          )}
        </CardContent>
      </Card>

      {/* Pending Requests */}
      {(pendingRequests.length > 0 || sentRequests.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Clock className="h-4 w-4 mr-2" />
              {t('friends.pendingRequests')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Incoming */}
            {pendingRequests.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-600">{t('friends.incoming')}</p>
                {pendingRequests.map(r => (
                  <div key={r.friendship_id} className="flex items-center justify-between p-3 border rounded">
                    <div>
                      <p className="font-medium">{r.username}</p>
                      <p className="text-sm text-gray-500">{r.email}</p>
                    </div>
                    <div className="flex space-x-2">
                      <Button size="sm" onClick={() => handleRespond(r.friendship_id, 'accepted')}>
                        <Check className="h-4 w-4 mr-1" />
                        {t('common.accept')}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleRespond(r.friendship_id, 'blocked')}>
                        <X className="h-4 w-4 mr-1" />
                        {t('common.decline')}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Outgoing */}
            {sentRequests.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-600">{t('friends.sent')}</p>
                {sentRequests.map(r => (
                  <div key={r.friendship_id} className="flex items-center justify-between p-3 border rounded">
                    <div>
                      <p className="font-medium">{r.username}</p>
                      <p className="text-sm text-gray-500">{r.email}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline">
                        <Send className="h-3 w-3 mr-1" />
                        {t('common.pending')}
                      </Badge>
                      <Button size="sm" variant="ghost" onClick={() => handleRemove(r.friendship_id)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Friends List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Users className="h-4 w-4 mr-2" />
            {t('friends.friendsList')} ({friends.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {friendsLoading ? (
            <p className="text-sm text-gray-500">{t('friends.loadingFriends')}</p>
          ) : friends.length === 0 ? (
            <p className="text-sm text-gray-500">{t('friends.noFriendsYet')}</p>
          ) : (
            <div className="space-y-2">
              {friends.map(f => (
                <div key={f.friendship_id} className="flex items-center justify-between p-3 border rounded">
                  <div>
                    <p className="font-medium">{f.username}</p>
                    <p className="text-sm text-gray-500">{f.email}</p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => handleRemove(f.friendship_id)}>
                    <UserMinus className="h-4 w-4 mr-1" />
                    {t('common.remove')}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default FriendsList;
