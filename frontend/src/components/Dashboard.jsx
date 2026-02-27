// frontend/src/components/Dashboard.jsx
import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Receipt, Users, Settings, UserPlus } from 'lucide-react';
import Navbar from './Navbar';
import BillsList from './BillsList';
import CreateBilModal from './CreateBilModal';
import BillDetails from './BillDetails';
import UserProfile from './UserProfile';
import FriendsList from './FriendsList';

const Dashboard = () => {
  const { user } = useSelector((state) => state.auth);
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'bills');
  const [showCreateBill, setShowCreateBill] = useState(false);
  const [selectedBillId, setSelectedBillId] = useState(null);

  // Loading state
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar Component */}
      <Navbar 
        onCreateBill={() => setShowCreateBill(true)}
        onNavigateToProfile={() => setActiveTab('profile')}
      />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="bills" className="flex items-center">
              <Receipt className="h-4 w-4 mr-2" />
              Bills
            </TabsTrigger>
            <TabsTrigger value="invitations" className="flex items-center">
              <Users className="h-4 w-4 mr-2" />
              Invitations
            </TabsTrigger>
            <TabsTrigger value="friends" className="flex items-center">
              <UserPlus className="h-4 w-4 mr-2" />
              Friends
            </TabsTrigger>
            <TabsTrigger value="profile" className="flex items-center">
              <Settings className="h-4 w-4 mr-2" />
              Profile
            </TabsTrigger>
          </TabsList>

          <TabsContent value="bills" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>My Bills</CardTitle>
              </CardHeader>
              <CardContent>
                <BillsList
                  userId={user.id}
                  type="all"
                  onSelectBill={setSelectedBillId}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="invitations" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Bill Invitations</CardTitle>
              </CardHeader>
              <CardContent>
                <BillsList
                  userId={user.id}
                  type="invited"
                  onSelectBill={setSelectedBillId}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="friends" className="space-y-6">
            <FriendsList userId={user.id} />
          </TabsContent>

          <TabsContent value="profile" className="space-y-6">
            <UserProfile userId={user.id} />
          </TabsContent>
        </Tabs>
      </main>

      {/* Modals */}
      {showCreateBill && (
        <CreateBilModal
          isOpen={showCreateBill}
          onClose={() => setShowCreateBill(false)}
          userId={user.id}
        />
      )}

      {selectedBillId && (
        <BillDetails
          billId={selectedBillId}
          onClose={() => setSelectedBillId(null)}
        />
      )}
    </div>
  );
};

export default Dashboard;