// frontend/src/components/Dashboard.jsx
import React from 'react';
import { useSelector } from 'react-redux';
import { useGetBillsQuery, useGetInvitedBillsQuery, useGetParticipatingBillsQuery } from '../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

const Dashboard = () => {
  const user = useSelector((state) => state.auth.user);
  const { data: createdBills } = useGetBillsQuery(user?.id, { skip: !user });
  const { data: invitedBills } = useGetInvitedBillsQuery(user?.id, { skip: !user });
  const { data: participatingBills } = useGetParticipatingBillsQuery(user?.id, { skip: !user });

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Created Bills</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{createdBills?.bills?.length || 0}</p>
            <Link to="/bills/created">
              <Button variant="outline" className="mt-2">View All</Button>
            </Link>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Invited To</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{invitedBills?.bills?.length || 0}</p>
            <Link to="/bills/invited">
              <Button variant="outline" className="mt-2">View All</Button>
            </Link>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Participating In</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{participatingBills?.bills?.length || 0}</p>
            <Link to="/bills/participating">
              <Button variant="outline" className="mt-2">View All</Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button as={Link} to="/bills/create" className="w-full">Create New Bill</Button>
            <Button as={Link} to="/profile" variant="outline" className="w-full">My Profile</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {/* TODO: Implement recent activity feed */}
            <p className="text-gray-500">No recent activity</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;