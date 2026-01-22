import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { 
  FileText, 
  AlertCircle, 
  Clock, 
  Send, 
  Trophy, 
  XCircle,
  Plus,
  Search,
  Calendar,
  Building,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO, differenceInDays } from 'date-fns';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const statusConfig = {
  new_denial: { label: 'New Denial', icon: AlertCircle, className: 'status-new-denial' },
  draft_appeal: { label: 'Draft Appeal', icon: FileText, className: 'status-draft-appeal' },
  submitted: { label: 'Submitted', icon: Send, className: 'status-submitted' },
  won: { label: 'Won', icon: Trophy, className: 'status-won' },
  lost: { label: 'Lost', icon: XCircle, className: 'status-lost' },
};

const Dashboard = () => {
  const navigate = useNavigate();
  const [cases, setCases] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchData();
  }, [filter]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [casesRes, statsRes] = await Promise.all([
        axios.get(`${API}/cases${filter !== 'all' ? `?status=${filter}` : ''}`),
        axios.get(`${API}/dashboard/stats`)
      ]);
      setCases(casesRes.data);
      setStats(statsRes.data);
    } catch (error) {
      toast.error('Failed to load dashboard data');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const filteredCases = cases.filter(c => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      c.payer?.toLowerCase().includes(searchLower) ||
      c.patient_name?.toLowerCase().includes(searchLower) ||
      c.cpt_codes?.some(code => code.toLowerCase().includes(searchLower))
    );
  });

  const getDueSoonStatus = (dueDate) => {
    if (!dueDate) return null;
    const days = differenceInDays(parseISO(dueDate), new Date());
    if (days < 0) return { label: 'Overdue', className: 'bg-red-500 text-white' };
    if (days <= 3) return { label: `${days}d left`, className: 'bg-orange-500 text-white' };
    if (days <= 7) return { label: `${days}d left`, className: 'bg-amber-500 text-white' };
    return null;
  };

  const StatCard = ({ title, value, icon: Icon, color, onClick }) => (
    <Card 
      className={`card-hover cursor-pointer ${onClick ? 'hover:border-teal-300' : ''}`}
      onClick={onClick}
      data-testid={`stat-card-${title.toLowerCase().replace(/\s/g, '-')}`}
    >
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">{title}</p>
            <p className="text-3xl font-bold text-slate-900 mt-1" style={{ fontFamily: 'Manrope' }}>
              {value ?? '-'}
            </p>
          </div>
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
            <Icon className="w-6 h-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-8 animate-fade-in" data-testid="dashboard-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900" style={{ fontFamily: 'Manrope' }}>
            Work Queue
          </h1>
          <p className="text-slate-600 mt-1">Manage your prior authorization cases and appeals</p>
        </div>
        <Button 
          onClick={() => navigate('/cases/new')}
          className="bg-teal-700 hover:bg-teal-800 text-white"
          data-testid="new-case-btn"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Case
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard 
          title="New Denials" 
          value={stats?.new_denials} 
          icon={AlertCircle} 
          color="bg-red-100 text-red-600"
          onClick={() => setFilter('new_denial')}
        />
        <StatCard 
          title="Draft Appeals" 
          value={stats?.draft_appeals} 
          icon={FileText} 
          color="bg-amber-100 text-amber-600"
          onClick={() => setFilter('draft_appeal')}
        />
        <StatCard 
          title="Due Soon" 
          value={stats?.due_soon} 
          icon={Clock} 
          color="bg-orange-100 text-orange-600"
        />
        <StatCard 
          title="Submitted" 
          value={stats?.submitted} 
          icon={Send} 
          color="bg-blue-100 text-blue-600"
          onClick={() => setFilter('submitted')}
        />
        <StatCard 
          title="Won" 
          value={stats?.won} 
          icon={Trophy} 
          color="bg-emerald-100 text-emerald-600"
          onClick={() => setFilter('won')}
        />
        <StatCard 
          title="Lost" 
          value={stats?.lost} 
          icon={XCircle} 
          color="bg-slate-100 text-slate-600"
          onClick={() => setFilter('lost')}
        />
      </div>

      {/* Cases Table */}
      <Card data-testid="cases-table-card">
        <CardHeader className="border-b border-slate-100 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CardTitle className="text-lg font-semibold text-slate-900" style={{ fontFamily: 'Manrope' }}>
              Cases
            </CardTitle>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search cases..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 w-64"
                  data-testid="search-cases-input"
                />
              </div>
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="w-40" data-testid="filter-select">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Cases</SelectItem>
                  <SelectItem value="new_denial">New Denials</SelectItem>
                  <SelectItem value="draft_appeal">Draft Appeals</SelectItem>
                  <SelectItem value="submitted">Submitted</SelectItem>
                  <SelectItem value="won">Won</SelectItem>
                  <SelectItem value="lost">Lost</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" onClick={fetchData} data-testid="refresh-btn">
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="spinner w-8 h-8" />
            </div>
          ) : filteredCases.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <img 
                src="https://images.unsplash.com/photo-1758691461888-b74515208d7a?crop=entropy&cs=srgb&fm=jpg&q=85&w=400"
                alt="Empty state"
                className="w-48 h-48 object-cover rounded-xl mb-4 opacity-50"
              />
              <h3 className="text-lg font-semibold text-slate-700">No cases found</h3>
              <p className="text-slate-500 mt-1">Create your first case to get started</p>
              <Button 
                onClick={() => navigate('/cases/new')}
                className="mt-4 bg-teal-700 hover:bg-teal-800"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Case
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50">
                  <TableHead className="font-semibold">Patient / Case</TableHead>
                  <TableHead className="font-semibold">Payer</TableHead>
                  <TableHead className="font-semibold">Codes</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="font-semibold">Due Date</TableHead>
                  <TableHead className="font-semibold">Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCases.map((caseItem, index) => {
                  const status = statusConfig[caseItem.status] || statusConfig.new_denial;
                  const StatusIcon = status.icon;
                  const dueSoon = getDueSoonStatus(caseItem.due_date);
                  
                  return (
                    <TableRow 
                      key={caseItem.id}
                      className="table-row-hover cursor-pointer"
                      onClick={() => navigate(`/cases/${caseItem.id}`)}
                      style={{ animationDelay: `${index * 50}ms` }}
                      data-testid={`case-row-${caseItem.id}`}
                    >
                      <TableCell>
                        <div>
                          <p className="font-medium text-slate-900">
                            {caseItem.patient_name || 'Unnamed Patient'}
                          </p>
                          <p className="text-xs text-slate-500 font-mono">
                            {caseItem.id.slice(0, 8)}...
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building className="w-4 h-4 text-slate-400" />
                          <span className="text-slate-700">{caseItem.payer}</span>
                        </div>
                        <p className="text-xs text-slate-500">{caseItem.state}</p>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {caseItem.cpt_codes?.slice(0, 2).map(code => (
                            <Badge key={code} variant="outline" className="mr-1 text-xs">
                              {code}
                            </Badge>
                          ))}
                          {caseItem.cpt_codes?.length > 2 && (
                            <Badge variant="outline" className="text-xs">
                              +{caseItem.cpt_codes.length - 2}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={`${status.className} border gap-1`}>
                          <StatusIcon className="w-3 h-3" />
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-slate-400" />
                          <span className="text-slate-700">
                            {caseItem.due_date ? format(parseISO(caseItem.due_date), 'MMM d, yyyy') : '-'}
                          </span>
                        </div>
                        {dueSoon && (
                          <Badge className={`${dueSoon.className} text-xs mt-1`}>
                            {dueSoon.label}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-slate-500 text-sm">
                        {format(parseISO(caseItem.created_at), 'MMM d, yyyy')}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
