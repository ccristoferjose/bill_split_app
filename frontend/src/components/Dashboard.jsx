// frontend/src/components/Dashboard.jsx
import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { useSearchParams, useLocation } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Receipt, Users, Settings, UserPlus, CalendarDays, ChevronLeft, ChevronRight, Download, FileText, Loader2 } from 'lucide-react';
import { format, addMonths, subMonths, startOfMonth, subDays } from 'date-fns';
import { useTranslation } from 'react-i18next';
import Navbar from './Navbar';
import BillsList from './BillsList';
import BillCalendar from './BillCalendar';
import CreateTransactionModal from './CreateTransactionModal';
import BillDetails from './BillDetails';
import UserProfile from './UserProfile';
import FriendsList from './FriendsList';
import PersonalBillsList from './PersonalBillsList';
import TransactionInvitationsList from './TransactionInvitationsList';
import WelcomeModal from './WelcomeModal';
import { useGetTransactionInvitationsQuery, useGetPendingRequestsQuery, useGetUserProfileQuery, useGetUserInvitedBillsQuery } from '../services/api';
import { toast } from 'sonner';
import { fetchAuthSession } from 'aws-amplify/auth';

const Dashboard = () => {
  const { t } = useTranslation();
  const { user } = useSelector((state) => state.auth);
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'calendar');
  const [showCreateBill, setShowCreateBill] = useState(false);
  const [selectedBill, setSelectedBill] = useState(null);
  const [billsMonth, setBillsMonth] = useState(startOfMonth(new Date()));
  const [showReportPanel, setShowReportPanel] = useState(false);
  const [reportFrom, setReportFrom] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [reportTo, setReportTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [isReportLoading, setIsReportLoading] = useState(false);
  const [showWelcome, setShowWelcome] = useState(
    () => location.state?.isNew === true
  );

  const { data: invitationsData } = useGetTransactionInvitationsQuery(user?.id, { skip: !user });
  const { data: pendingFriendsData } = useGetPendingRequestsQuery(user?.id, { skip: !user });
  const { data: billInvitationsData } = useGetUserInvitedBillsQuery(user?.id, { skip: !user });

  const { data: profileData } = useGetUserProfileQuery(user?.id, { skip: !user });

  const pendingBillInvitations = (billInvitationsData?.bills || []).filter(b => b.invitation_status === 'pending').length;
  const pendingInvitations = (invitationsData?.transactions?.length || 0) + pendingBillInvitations;
  const pendingFriendRequests = pendingFriendsData?.requests?.length || pendingFriendsData?.length || 0;
  const isPro = profileData?.subscription_tier === 'pro';

  const handleExport = async () => {
    if (!isPro) {
      toast.error(t('dashboard.exportProOnly'));
      return;
    }
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.accessToken?.toString();
      const year = billsMonth.getFullYear();
      const month = billsMonth.getMonth() + 1;
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001';
      const res = await fetch(`${apiUrl}/export/transactions/${user.id}?year=${year}&month=${month}&format=csv`, {
        headers: { authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `spendsync-${year}-${String(month).padStart(2, '0')}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(t('dashboard.exportFailed'));
    }
  };

  const handleReportDownload = async () => {
    if (!isPro) {
      toast.error(t('dashboard.exportProOnly'));
      return;
    }
    if (!reportFrom || !reportTo) {
      toast.error(t('dashboard.reportSelectDates'));
      return;
    }
    setIsReportLoading(true);
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.accessToken?.toString();
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001';
      const res = await fetch(`${apiUrl}/export/report/${user.id}?from=${reportFrom}&to=${reportTo}`, {
        headers: { authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Report generation failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `spendsync-report-${reportFrom}-to-${reportTo}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      setShowReportPanel(false);
    } catch (err) {
      toast.error(t('dashboard.reportFailed'));
    } finally {
      setIsReportLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar
        onCreateBill={() => setShowCreateBill(true)}
        onNavigateToProfile={() => setActiveTab('profile')}
        onNavigateToCalendar={() => setActiveTab('calendar')}
      />

      <main className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 sm:space-y-6">

          {/* ── Tabs — icon-only on mobile, icon+label on sm+ ── */}
          <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
            <TabsList className="flex w-max sm:w-full min-w-full h-10">
              <TabsTrigger value="calendar" className="flex-1 flex items-center justify-center gap-1.5 min-w-[44px] sm:min-w-0">
                <CalendarDays className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">{t('tabs.calendar')}</span>
              </TabsTrigger>
              <TabsTrigger value="bills" className="flex-1 flex items-center justify-center gap-1.5 min-w-[44px] sm:min-w-0">
                <Receipt className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">{t('tabs.bills')}</span>
              </TabsTrigger>
              <TabsTrigger value="invitations" className="relative flex-1 flex items-center justify-center gap-1.5 min-w-[44px] sm:min-w-0">
                <Users className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">{t('tabs.invitations')}</span>
                {pendingInvitations > 0 && (
                  <span className="absolute -top-1 -right-1 sm:relative sm:top-auto sm:right-auto bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                    {pendingInvitations}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="friends" className="relative flex-1 flex items-center justify-center gap-1.5 min-w-[44px] sm:min-w-0">
                <UserPlus className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">{t('tabs.friends')}</span>
                {pendingFriendRequests > 0 && (
                  <span className="absolute -top-1 -right-1 sm:relative sm:top-auto sm:right-auto bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                    {pendingFriendRequests}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="profile" className="flex-1 flex items-center justify-center gap-1.5 min-w-[44px] sm:min-w-0">
                <Settings className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">{t('tabs.profile')}</span>
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
                  <CardTitle className="text-base sm:text-lg">{t('dashboard.myBills')}</CardTitle>
                  <div className="flex items-center gap-2">
                    {isPro && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs"
                          onClick={handleExport}
                        >
                          <Download className="h-3.5 w-3.5 mr-1" />
                          CSV
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs"
                          onClick={() => setShowReportPanel(p => !p)}
                        >
                          <FileText className="h-3.5 w-3.5 mr-1" />
                          {t('dashboard.pdfReport')}
                        </Button>
                      </>
                    )}
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
              {showReportPanel && (
                <div className="mx-4 sm:mx-6 mb-2 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                  <p className="text-sm font-medium text-purple-800 mb-3">{t('dashboard.reportTitle')}</p>
                  <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3">
                    <div>
                      <label className="block text-xs text-purple-600 mb-1">{t('dashboard.reportFrom')}</label>
                      <input
                        type="date"
                        value={reportFrom}
                        onChange={(e) => setReportFrom(e.target.value)}
                        className="h-8 px-2 text-sm border border-purple-300 rounded-md bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-purple-600 mb-1">{t('dashboard.reportTo')}</label>
                      <input
                        type="date"
                        value={reportTo}
                        onChange={(e) => setReportTo(e.target.value)}
                        className="h-8 px-2 text-sm border border-purple-300 rounded-md bg-white"
                      />
                    </div>
                    <Button
                      size="sm"
                      className="h-8 bg-purple-600 hover:bg-purple-700 text-white text-xs"
                      onClick={handleReportDownload}
                      disabled={isReportLoading}
                    >
                      {isReportLoading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                      ) : (
                        <Download className="h-3.5 w-3.5 mr-1" />
                      )}
                      {t('dashboard.reportDownload')}
                    </Button>
                  </div>
                  <p className="text-xs text-purple-500 mt-2">{t('dashboard.reportHint')}</p>
                </div>
              )}
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
                  <CardTitle className="text-base sm:text-lg">{t('dashboard.billSplitInvitations')}</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6 pt-0">
                  <TransactionInvitationsList userId={user.id} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="px-4 py-4 sm:px-6 sm:py-6">
                  <CardTitle className="text-base sm:text-lg">{t('dashboard.sharedBillInvitations')}</CardTitle>
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

      <WelcomeModal open={showWelcome} onClose={() => setShowWelcome(false)} />
    </div>
  );
};

export default Dashboard;
