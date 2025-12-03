import React, { useEffect, useState } from 'react';
import { Users, Trophy, DollarSign, TrendingUp, Sparkles } from 'lucide-react';
import { StatCardProps } from '../types';
import { MOCK_CONTESTS, MOCK_USERS } from '../constants';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { analyzePlatformStats } from '../services/geminiService';

const StatCard: React.FC<StatCardProps> = ({ title, value, trend, trendUp, icon: Icon }) => (
  <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm font-medium text-gray-500">{title}</p>
        <h3 className="text-2xl font-bold text-gray-900 mt-2">{value}</h3>
      </div>
      <div className="p-3 bg-emerald-50 rounded-lg">
        <Icon className="text-emerald-600" size={24} />
      </div>
    </div>
    {trend && (
      <div className="mt-4 flex items-center gap-2 text-sm">
        <span className={trendUp ? 'text-green-600 flex items-center' : 'text-red-600 flex items-center'}>
          <TrendingUp size={14} className={`mr-1 ${!trendUp && 'rotate-180'}`} />
          {trend}
        </span>
        <span className="text-gray-400">vs last month</span>
      </div>
    )}
  </div>
);

const DashboardHome: React.FC = () => {
  const [aiInsight, setAiInsight] = useState<string>('Analyzing platform data...');

  const chartData = [
    { name: 'Mon', revenue: 4000 },
    { name: 'Tue', revenue: 3000 },
    { name: 'Wed', revenue: 2000 },
    { name: 'Thu', revenue: 2780 },
    { name: 'Fri', revenue: 1890 },
    { name: 'Sat', revenue: 2390 },
    { name: 'Sun', revenue: 3490 },
  ];

  useEffect(() => {
    // Mock async loading of AI insight
    const fetchInsight = async () => {
      const stats = {
        activeUsers: MOCK_USERS.length,
        contests: MOCK_CONTESTS.length,
        revenueTrend: "Up 12%"
      };
      const insight = await analyzePlatformStats(stats);
      setAiInsight(insight);
    };
    fetchInsight();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Overview</h2>
        <div className="flex gap-2">
          <select
            title="Chọn khoảng thời gian"
            aria-label="Chọn khoảng thời gian"
            className="bg-white border border-gray-300 text-gray-700 text-sm rounded-lg focus:ring-emerald-500 focus:border-emerald-500 block p-2.5 outline-none"
          >
            <option>Last 7 Days</option>
            <option>Last 30 Days</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total Students" value="2,543" trend="12.5%" trendUp={true} icon={Users} />
        <StatCard title="Active Contests" value={MOCK_CONTESTS.length} trend="2 New" trendUp={true} icon={Trophy} />
        <StatCard title="Total Revenue" value="₫145M" trend="4.2%" trendUp={false} icon={DollarSign} />
        <StatCard title="Course Completion" value="84%" trend="1.2%" trendUp={true} icon={TrendingUp} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart Section */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 lg:col-span-2">
          <h3 className="text-lg font-bold text-gray-900 mb-6">Revenue Analytics</h3>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} />
                <Tooltip
                  cursor={{ fill: '#F9FAFB' }}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === 6 ? '#059669' : '#D1FAE5'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* AI Insight Section */}
        <div className="bg-linear-to-br from-emerald-900 to-emerald-700 text-white p-6 rounded-xl shadow-md flex flex-col justify-between relative overflow-hidden">
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="text-yellow-300" />
              <h3 className="font-bold text-lg">Gemini Insights</h3>
            </div>
            <p className="text-emerald-100 text-sm leading-relaxed mb-4 min-h-[100px]">
              {aiInsight}
            </p>
            <button className="bg-white/10 hover:bg-white/20 text-white text-sm py-2 px-4 rounded-lg transition-colors border border-white/20 w-full backdrop-blur-sm">
              View Detailed Report
            </button>
          </div>
          {/* Decoration */}
          <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-emerald-500 rounded-full blur-3xl opacity-30"></div>
        </div>
      </div>
    </div>
  );
};

export default DashboardHome;
