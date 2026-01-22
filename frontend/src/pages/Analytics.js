import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { 
  Trophy, 
  XCircle, 
  TrendingUp, 
  Clock,
  FileText,
  AlertCircle,
  Building
} from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const COLORS = ['#0F766E', '#F59E0B', '#3B82F6', '#EF4444', '#6B7280', '#10B981'];

const Analytics = () => {
  const [summary, setSummary] = useState(null);
  const [denialTypes, setDenialTypes] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const [summaryRes, denialRes] = await Promise.all([
        axios.get(`${API}/analytics/summary`),
        axios.get(`${API}/analytics/denial-types`)
      ]);
      setSummary(summaryRes.data);
      setDenialTypes(denialRes.data);
    } catch (error) {
      toast.error('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="spinner w-10 h-10" />
      </div>
    );
  }

  const statusData = summary?.status_breakdown 
    ? Object.entries(summary.status_breakdown).map(([name, value]) => ({
        name: name.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
        value
      }))
    : [];

  const payerData = summary?.payer_breakdown
    ? Object.entries(summary.payer_breakdown).map(([name, value]) => ({
        name,
        cases: value
      }))
    : [];

  const denialTypeData = denialTypes?.denial_types
    ? Object.entries(denialTypes.denial_types).map(([name, value]) => ({
        name: name.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
        value
      }))
    : [];

  const StatCard = ({ title, value, icon: Icon, color, subtitle }) => (
    <Card className="card-hover">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">{title}</p>
            <p className="text-3xl font-bold text-slate-900 mt-1" style={{ fontFamily: 'Manrope' }}>
              {value}
            </p>
            {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
          </div>
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
            <Icon className="w-6 h-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-8 animate-fade-in" data-testid="analytics-page">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900" style={{ fontFamily: 'Manrope' }}>
          Analytics
        </h1>
        <p className="text-slate-600 mt-1">
          Track appeal outcomes and identify trends
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Win Rate"
          value={`${summary?.win_rate || 0}%`}
          icon={Trophy}
          color="bg-emerald-100 text-emerald-600"
          subtitle="Of resolved appeals"
        />
        <StatCard
          title="Total Cases"
          value={summary?.total_cases || 0}
          icon={FileText}
          color="bg-teal-100 text-teal-600"
        />
        <StatCard
          title="Pending Review"
          value={(summary?.status_breakdown?.new_denial || 0) + (summary?.status_breakdown?.draft_appeal || 0)}
          icon={Clock}
          color="bg-amber-100 text-amber-600"
          subtitle="New denials + drafts"
        />
        <StatCard
          title="Submitted"
          value={summary?.status_breakdown?.submitted || 0}
          icon={TrendingUp}
          color="bg-blue-100 text-blue-600"
          subtitle="Awaiting decision"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Cases by Status</CardTitle>
            <CardDescription>Distribution of all cases</CardDescription>
          </CardHeader>
          <CardContent>
            {statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-slate-500">
                No data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Cases by Payer */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Cases by Payer</CardTitle>
            <CardDescription>Volume breakdown by insurance company</CardDescription>
          </CardHeader>
          <CardContent>
            {payerData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={payerData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" tick={{ fill: '#64748b', fontSize: 12 }} />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    width={150}
                    tick={{ fill: '#64748b', fontSize: 12 }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#fff', 
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px'
                    }}
                  />
                  <Bar dataKey="cases" fill="#0F766E" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-slate-500">
                No data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Denial Types */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Denial Reason Categories</CardTitle>
          <CardDescription>Most common reasons for claim denials</CardDescription>
        </CardHeader>
        <CardContent>
          {denialTypeData.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {denialTypeData.map((type, index) => (
                <div 
                  key={type.name}
                  className="p-4 rounded-lg border border-slate-200 bg-slate-50/50 text-center"
                >
                  <AlertCircle className="w-6 h-6 mx-auto mb-2" style={{ color: COLORS[index % COLORS.length] }} />
                  <p className="text-2xl font-bold text-slate-900">{type.value}</p>
                  <p className="text-xs text-slate-500 mt-1">{type.name}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-32 text-slate-500">
              <div className="text-center">
                <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No denial analysis data yet</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payer Performance */}
      {summary?.payer_breakdown && Object.keys(summary.payer_breakdown).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Payer Summary</CardTitle>
            <CardDescription>Quick view of cases by payer</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {Object.entries(summary.payer_breakdown).map(([payer, count]) => (
                <Badge key={payer} variant="outline" className="px-4 py-2 text-sm">
                  <Building className="w-4 h-4 mr-2 text-slate-400" />
                  {payer}: {count} cases
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Analytics;
