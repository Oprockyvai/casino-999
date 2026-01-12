import React, { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  Users,
  DollarSign,
  Gamepad2,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    totalDeposits: 0,
    totalWithdrawals: 0,
    totalGames: 0,
    activeGames: 0,
  });

  const [recentTransactions, setRecentTransactions] = useState([]);
  const [topGames, setTopGames] = useState([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch('/api/admin/dashboard', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      setStats(data.stats);
      setRecentTransactions(data.recentTransactions);
      setTopGames(data.topGames);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    }
  };

  const depositData = [
    { day: 'Mon', bKash: 12000, Nagad: 8000, USDT: 5000 },
    { day: 'Tue', bKash: 15000, Nagad: 9000, USDT: 6000 },
    { day: 'Wed', bKash: 18000, Nagad: 10000, USDT: 7000 },
    { day: 'Thu', bKash: 14000, Nagad: 8500, USDT: 5500 },
    { day: 'Fri', bKash: 20000, Nagad: 12000, USDT: 8000 },
    { day: 'Sat', bKash: 25000, Nagad: 15000, USDT: 10000 },
    { day: 'Sun', bKash: 22000, Nagad: 13000, USDT: 9000 },
  ];

  const gameCategories = [
    { name: 'Slots', value: 35 },
    { name: 'Poker', value: 20 },
    { name: 'Sports', value: 15 },
    { name: 'Blackjack', value: 12 },
    { name: 'Roulette', value: 10 },
    { name: 'Others', value: 8 },
  ];

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="p-6">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">Total Users</p>
                <p className="text-3xl font-bold">{stats.totalUsers.toLocaleString()}</p>
              </div>
              <Users className="h-12 w-12 text-blue-500" />
            </div>
            <div className="mt-4 text-sm text-green-600 flex items-center">
              <TrendingUp className="h-4 w-4 mr-1" />
              +12.5% from last month
            </div>
          </div>

          <div className="bg-white rounded-xl shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">Total Deposits</p>
                <p className="text-3xl font-bold">৳{stats.totalDeposits.toLocaleString()}</p>
              </div>
              <DollarSign className="h-12 w-12 text-green-500" />
            </div>
            <div className="mt-4 text-sm text-green-600 flex items-center">
              <TrendingUp className="h-4 w-4 mr-1" />
              +18.3% from last month
            </div>
          </div>

          <div className="bg-white rounded-xl shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">Total Games</p>
                <p className="text-3xl font-bold">{stats.totalGames.toLocaleString()}</p>
              </div>
              <Gamepad2 className="h-12 w-12 text-purple-500" />
            </div>
            <div className="mt-4 text-sm text-green-600 flex items-center">
              <TrendingUp className="h-4 w-4 mr-1" />
              +24 new games this week
            </div>
          </div>

          <div className="bg-white rounded-xl shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">Active Users</p>
                <p className="text-3xl font-bold">{stats.activeUsers.toLocaleString()}</p>
              </div>
              <CheckCircle className="h-12 w-12 text-yellow-500" />
            </div>
            <div className="mt-4 text-sm">
              <span className="text-green-600">Online: 1,234</span>
              {' • '}
              <span className="text-blue-600">Playing: 890</span>
            </div>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Deposit Chart */}
          <div className="bg-white rounded-xl shadow p-6">
            <h3 className="text-lg font-bold mb-4">Daily Deposits by Method</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={depositData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="bKash" fill="#E2136E" />
                <Bar dataKey="Nagad" fill="#E02B2B" />
                <Bar dataKey="USDT" fill="#26A17B" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Game Categories */}
          <div className="bg-white rounded-xl shadow p-6">
            <h3 className="text-lg font-bold mb-4">Game Categories Distribution</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={gameCategories}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {gameCategories.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="text-lg font-bold mb-4">Recent Transactions</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Method
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Time
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {recentTransactions.map((tx: any) => (
                  <tr key={tx.id}>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {tx.user?.email?.split('@')[0]}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full
                        ${tx.type === 'deposit' ? 'bg-green-100 text-green-800' : 
                          tx.type === 'withdrawal' ? 'bg-yellow-100 text-yellow-800' : 
                          'bg-blue-100 text-blue-800'}`}>
                        {tx.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      ৳{tx.amount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex items-center">
                        <img
                          src={`/assets/payment/${tx.paymentMethod}.png`}
                          alt={tx.paymentMethod}
                          className="h-6 w-6 mr-2"
                        />
                        {tx.paymentMethod}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full
                        ${tx.status === 'completed' ? 'bg-green-100 text-green-800' : 
                          tx.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 
                          'bg-red-100 text-red-800'}`}>
                        {tx.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {new Date(tx.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <button className="p-4 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-center transition">
            Sync Games from Providers
          </button>
          <button className="p-4 bg-green-500 hover:bg-green-600 text-white rounded-lg text-center transition">
            Process Pending Withdrawals
          </button>
          <button className="p-4 bg-red-500 hover:bg-red-600 text-white rounded-lg text-center transition">
            View Suspicious Activity
          </button>
        </div>
      </div>
    </div>
  );
}