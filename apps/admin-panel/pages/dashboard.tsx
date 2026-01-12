import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import {
  Users,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  RefreshCw,
} from 'lucide-react';

export default function AdminDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [adminInfo, setAdminInfo] = useState<any>(null);

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    const adminUser = localStorage.getItem('adminUser');
    
    if (!token || !adminUser) {
      router.push('/login');
      return;
    }

    setAdminInfo(JSON.parse(adminUser));
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch('/api/admin/dashboard/stats', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">Admin Dashboard</h1>
            <p className="text-gray-400">Welcome back, {adminInfo?.username}</p>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={fetchStats}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg flex items-center"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </button>
            <button
              onClick={() => router.push('/admin/payments')}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg"
            >
              Manage Payments
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-gray-800 rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Total Users</p>
                <p className="text-3xl font-bold mt-2">{stats?.totalUsers || 0}</p>
              </div>
              <Users className="h-10 w-10 text-blue-500" />
            </div>
            <div className="mt-4 flex items-center text-green-500 text-sm">
              <TrendingUp className="h-4 w-4 mr-1" />
              Active: {stats?.activeUsers || 0}
            </div>
          </div>

          <div className="bg-gray-800 rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Pending Actions</p>
                <p className="text-3xl font-bold mt-2">
                  {(stats?.pendingDeposits || 0) + (stats?.pendingWithdrawals || 0)}
                </p>
                <div className="text-sm text-gray-400 mt-1">
                  Deposits: {stats?.pendingDeposits} • Withdrawals: {stats?.pendingWithdrawals}
                </div>
              </div>
              <AlertTriangle className="h-10 w-10 text-yellow-500" />
            </div>
          </div>

          <div className="bg-gray-800 rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Total Deposits</p>
                <p className="text-3xl font-bold mt-2">
                  ৳{(stats?.totalDeposits || 0).toLocaleString()}
                </p>
              </div>
              <DollarSign className="h-10 w-10 text-green-500" />
            </div>
          </div>

          <div className="bg-gray-800 rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Net Revenue</p>
                <p className="text-3xl font-bold mt-2">
                  ৳{(stats?.revenue || 0).toLocaleString()}
                </p>
                <div className="text-sm text-gray-400 mt-1">
                  Deposits - Withdrawals
                </div>
              </div>
              <CheckCircle className="h-10 w-10 text-purple-500" />
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div
            onClick={() => router.push('/admin/payments')}
            className="bg-gradient-to-r from-green-900/30 to-green-800/10 border border-green-700 rounded-xl p-6 cursor-pointer hover:border-green-600 transition"
          >
            <h3 className="text-lg font-bold mb-2 flex items-center">
              <CheckCircle className="h-5 w-5 mr-2 text-green-500" />
              Process Payments
            </h3>
            <p className="text-gray-400 text-sm">
              Approve or reject pending payment requests
            </p>
          </div>

          <div
            onClick={() => router.push('/admin/users')}
            className="bg-gradient-to-r from-blue-900/30 to-blue-800/10 border border-blue-700 rounded-xl p-6 cursor-pointer hover:border-blue-600 transition"
          >
            <h3 className="text-lg font-bold mb-2 flex items-center">
              <Users className="h-5 w-5 mr-2 text-blue-500" />
              Manage Users
            </h3>
            <p className="text-gray-400 text-sm">
              View and manage all user accounts
            </p>
          </div>

          <div
            onClick={() => router.push('/admin/settings')}
            className="bg-gradient-to-r from-purple-900/30 to-purple-800/10 border border-purple-700 rounded-xl p-6 cursor-pointer hover:border-purple-600 transition"
          >
            <h3 className="text-lg font-bold mb-2 flex items-center">
              <AlertTriangle className="h-5 w-5 mr-2 text-purple-500" />
              Security Settings
            </h3>
            <p className="text-gray-400 text-sm">
              Configure admin access and security
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}