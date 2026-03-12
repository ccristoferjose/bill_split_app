// frontend/src/components/Dashboard.jsx
import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Receipt, Users, Settings, UserPlus, CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, addMonths, subMonths, startOfMonth } from 'date-fns';
import Navbar from './Navbar';
import BillsList from './BillsList';
import BillCalendar from './BillCalendar';
import CreateTransactionModal from './CreateTransactionModal';
import BillDetails from './BillDetails';
import UserProfile from './UserProfile';
import FriendsList from './FriendsList';
import PersonalBillsList from './PersonalBillsList';
import TransactionInvitationsList from './TransactionInvitationsList';

const Dashboard = () => {
  const { user } = useSelector((state) => state.auth);
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'calendar');
  const [showCreateBill, setShowCreateBill] = useState(false);
  const [selectedBill, setSelectedBill] = useState(null);
  const [billsMonth, setBillsMonth] = useState(startOfMonth(new Date()));

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar
        onCreateBill={() => setShowCreateBill(true)}
        onNavigateToProfile={() => setActiveTab('profile')}
      />

      <main className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 sm:space-y-6">

          {/* ── Tabs — icon-only on mobile, icon+label on sm+ ── */}
          <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
            <TabsList className="flex w-max sm:w-full min-w-full h-10">
              <TabsTrigger value="calendar" className="flex-1 flex items-center justify-center gap-1.5 min-w-[44px] sm:min-w-0">
                <CalendarDays className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">Calendar</span>
              </TabsTrigger>
              <TabsTrigger value="bills" className="flex-1 flex items-center justify-center gap-1.5 min-w-[44px] sm:min-w-0">
                <Receipt className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">Bills</span>
              </TabsTrigger>
              <TabsTrigger value="invitations" className="flex-1 flex items-center justify-center gap-1.5 min-w-[44px] sm:min-w-0">
                <Users className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">Invitations</span>
              </TabsTrigger>
              <TabsTrigger value="friends" className="flex-1 flex items-center justify-center gap-1.5 min-w-[44px] sm:min-w-0">
                <UserPlus className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">Friends</span>
              </TabsTrigger>
              <TabsTrigger value="profile" className="flex-1 flex items-center justify-center gap-1.5 min-w-[44px] sm:min-w-0">
                <Settings className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">Profile</span>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* ── Calendar tab ── */}
          <TabsContent value="calendar">
            <BillCalendar
              userId={user.id}
              onSelectBill={(id, date) => setSelectedBill({ id, calendarDate: date })}
            />
          </TabsContent>

          {/* ── Bills tab ── */}
          <TabsContent value="bills">
            <Card>
              <CardHeader className="px-4 py-4 sm:px-6 sm:py-6">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base sm:text-lg">My Bills</CardTitle>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setBillsMonth(m => subMonths(m, 1))}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm font-medium w-28 text-center">
                      {format(billsMonth, 'MMMM yyyy')}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setBillsMonth(m => addMonths(m, 1))}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6 pt-0 space-y-3">
                <PersonalBillsList userId={user.id} viewMonth={billsMonth} />
                <div className="border-t pt-3">
                  <BillsList
                    userId={user.id}
                    type="all"
                    viewMonth={billsMonth}
                    onSelectBill={(id) => setSelectedBill({ id })}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Invitations tab ── */}
          <TabsContent value="invitations">
            <div className="space-y-4 sm:space-y-6">
              <Card>
                <CardHeader className="px-4 py-4 sm:px-6 sm:py-6">
                  <CardTitle className="text-base sm:text-lg">Bill Split Invitations</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6 pt-0">
                  <TransactionInvitationsList userId={user.id} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="px-4 py-4 sm:px-6 sm:py-6">
                  <CardTitle className="text-base sm:text-lg">Shared Bill Invitations</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6 pt-0">
                  <BillsList
                    userId={user.id}
                    type="invited"
                    onSelectBill={(id) => setSelectedBill({ id })}
                  />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ── Friends tab ── */}
          <TabsContent value="friends">
            <FriendsList userId={user.id} />
          </TabsContent>

          {/* ── Profile tab ── */}
          <TabsContent value="profile">
            <UserProfile userId={user.id} />
          </TabsContent>

        </Tabs>
      </main>

      {showCreateBill && (
        <CreateTransactionModal
          isOpen={showCreateBill}
          onClose={() => setShowCreateBill(false)}
          userId={user.id}
        />
      )}

      {selectedBill && (
        <BillDetails
          billId={selectedBill.id}
          calendarDate={selectedBill.calendarDate}
          onClose={() => setSelectedBill(null)}
        />
      )}
    </div>
  );
};

export default Dashboard;
