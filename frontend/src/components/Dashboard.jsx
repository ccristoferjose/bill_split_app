// frontend/src/components/Dashboard.jsx
import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Receipt, Users, User, Settings } from 'lucide-react';
import BillsList from './bills/BillsList';
import CreateBillModal from './bills/CreateBillModal';
import BillDetails from './bills/BillDetails';
import UserProfile from './profile/UserProfile';

const Dashboard = () => {
  const { user } = useSelector((state) => state.auth);
  const [activeTab, setActiveTab] = useState('bills');
  const [showCreateBill, setShowCreateBill] = useState(false);
  const [selectedBillId, setSelectedBillId] = useState(null);

  if (!user) {
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Receipt className="h-8 w-8 text-blue-600 mr-3" />
              <h1 className="text-xl font-semibold text-gray-900">BillSplit</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700">Welcome, {user.username}</span>
              <Button
                onClick={() => setShowCreateBill(true)}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                New Bill
              </Button>
            </div>
          </div>
        </div>
      </header>

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
            <TabsTrigger value="participating" className="flex items-center">
              <User className="h-4 w-4 mr-2" />
              Participating
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
                  type="created"
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

          <TabsContent value="participating" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Bills I'm Participating In</CardTitle>
              </CardHeader>
              <CardContent>
                <BillsList 
                  userId={user.id} 
                  type="participating"
                  onSelectBill={setSelectedBillId}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="profile" className="space-y-6">
            <UserProfile userId={user.id} />
          </TabsContent>
        </Tabs>
      </main>

      {/* Modals */}
      {showCreateBill && (
        <CreateBillModal
          isOpen={showCreateBill}
          onClose={() => setShowCreateBill(false)}
          userId={user.id}
        />
      )}

      {selectedBillId && (
        <BillDetails
          billId={selectedBillId}
          userId={user.id}
          onClose={() => setSelectedBillId(null)}
        />
      )}
    </div>
  );
};

export default Dashboard;