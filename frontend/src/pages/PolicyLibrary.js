import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';
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
  Plus, 
  Upload, 
  BookOpen, 
  Trash2, 
  FileText, 
  Building,
  MapPin,
  Calendar,
  Search,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const CATEGORIES = [
  'Medical Policy',
  'Coverage Guidelines',
  'Prior Authorization',
  'DME Policy',
  'Pharmacy Policy',
  'Appeals Process',
  'Clinical Criteria',
  'Other'
];

const PolicyLibrary = () => {
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [search, setSearch] = useState('');
  const [uploading, setUploading] = useState(false);
  const [selectedPolicy, setSelectedPolicy] = useState(null);
  
  const [formData, setFormData] = useState({
    name: '',
    payer: '',
    state: '',
    effective_date: '',
    category: '',
    content: ''
  });
  const [file, setFile] = useState(null);

  useEffect(() => {
    fetchPolicies();
  }, []);

  const fetchPolicies = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/policies`);
      setPolicies(response.data);
    } catch (error) {
      toast.error('Failed to load policies');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const createPolicy = async () => {
    if (!formData.name || !formData.payer || !formData.state || !formData.effective_date || !formData.category) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      const response = await axios.post(`${API}/policies`, formData);
      const newPolicy = response.data;

      // If file selected, upload it
      if (file) {
        setUploading(true);
        const uploadData = new FormData();
        uploadData.append('file', file);
        await axios.post(`${API}/policies/${newPolicy.id}/upload`, uploadData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }

      toast.success('Policy created successfully');
      setShowAddDialog(false);
      setFormData({ name: '', payer: '', state: '', effective_date: '', category: '', content: '' });
      setFile(null);
      fetchPolicies();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create policy');
    } finally {
      setUploading(false);
    }
  };

  const deletePolicy = async (policyId) => {
    if (!window.confirm('Are you sure you want to delete this policy?')) return;
    
    try {
      await axios.delete(`${API}/policies/${policyId}`);
      toast.success('Policy deleted');
      fetchPolicies();
    } catch (error) {
      toast.error('Failed to delete policy');
    }
  };

  const filteredPolicies = policies.filter(p => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      p.name?.toLowerCase().includes(searchLower) ||
      p.payer?.toLowerCase().includes(searchLower) ||
      p.state?.toLowerCase().includes(searchLower) ||
      p.category?.toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="space-y-6 animate-fade-in" data-testid="policy-library-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900" style={{ fontFamily: 'Manrope' }}>
            Policy Library
          </h1>
          <p className="text-slate-600 mt-1">
            Manage payer policies for RAG-based retrieval
          </p>
        </div>
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button className="bg-teal-700 hover:bg-teal-800" data-testid="add-policy-btn">
              <Plus className="w-4 h-4 mr-2" />
              Add Policy
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Add New Policy</DialogTitle>
              <DialogDescription>
                Upload a payer policy document for RAG indexing
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Policy Name <span className="text-red-500">*</span></Label>
                <Input
                  placeholder="e.g., BCBS CA - Prior Auth Guidelines"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  data-testid="policy-name-input"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Payer <span className="text-red-500">*</span></Label>
                  <Input
                    placeholder="Blue Cross Blue Shield"
                    value={formData.payer}
                    onChange={(e) => handleInputChange('payer', e.target.value)}
                    data-testid="policy-payer-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label>State <span className="text-red-500">*</span></Label>
                  <Input
                    placeholder="CA"
                    value={formData.state}
                    onChange={(e) => handleInputChange('state', e.target.value)}
                    data-testid="policy-state-input"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Effective Date <span className="text-red-500">*</span></Label>
                  <Input
                    type="date"
                    value={formData.effective_date}
                    onChange={(e) => handleInputChange('effective_date', e.target.value)}
                    data-testid="policy-date-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Category <span className="text-red-500">*</span></Label>
                  <Select value={formData.category} onValueChange={(v) => handleInputChange('category', v)}>
                    <SelectTrigger data-testid="policy-category-select">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(c => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Upload Policy Document</Label>
                <div className="border-2 border-dashed border-slate-200 rounded-lg p-4 text-center hover:border-slate-300 transition-colors">
                  <input
                    type="file"
                    id="policy-file"
                    className="hidden"
                    accept=".pdf,.txt,.doc,.docx"
                    onChange={(e) => setFile(e.target.files[0])}
                  />
                  <label htmlFor="policy-file" className="cursor-pointer">
                    {file ? (
                      <div className="flex items-center justify-center gap-2 text-teal-600">
                        <FileText className="w-5 h-5" />
                        {file.name}
                      </div>
                    ) : (
                      <div className="text-slate-500">
                        <Upload className="w-6 h-6 mx-auto mb-2" />
                        <p className="text-sm">Click to upload PDF or text file</p>
                      </div>
                    )}
                  </label>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Or paste policy text</Label>
                <Textarea
                  placeholder="Paste policy content here..."
                  value={formData.content}
                  onChange={(e) => handleInputChange('content', e.target.value)}
                  rows={4}
                  data-testid="policy-content-input"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
              <Button 
                onClick={createPolicy}
                disabled={uploading}
                className="bg-teal-700 hover:bg-teal-800"
                data-testid="save-policy-btn"
              >
                {uploading && <div className="spinner w-4 h-4 mr-2" />}
                Save Policy
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search policies..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
                data-testid="search-policies-input"
              />
            </div>
            <Button variant="outline" onClick={fetchPolicies} data-testid="refresh-policies-btn">
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Policies Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="spinner w-8 h-8" />
            </div>
          ) : filteredPolicies.length === 0 ? (
            <div className="text-center py-12">
              <BookOpen className="w-12 h-12 mx-auto text-slate-300 mb-4" />
              <h3 className="text-lg font-semibold text-slate-700">No policies found</h3>
              <p className="text-slate-500 mt-1">Add your first policy to enable RAG-based retrieval</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50">
                  <TableHead className="font-semibold">Policy Name</TableHead>
                  <TableHead className="font-semibold">Payer</TableHead>
                  <TableHead className="font-semibold">State</TableHead>
                  <TableHead className="font-semibold">Category</TableHead>
                  <TableHead className="font-semibold">Effective Date</TableHead>
                  <TableHead className="font-semibold w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPolicies.map((policy) => (
                  <TableRow key={policy.id} className="table-row-hover" data-testid={`policy-row-${policy.id}`}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-teal-600" />
                        <span className="font-medium text-slate-900">{policy.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building className="w-4 h-4 text-slate-400" />
                        {policy.payer}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-slate-400" />
                        {policy.state}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{policy.category}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-slate-600">
                        <Calendar className="w-4 h-4 text-slate-400" />
                        {policy.effective_date}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-red-500 hover:text-red-600 hover:bg-red-50"
                        onClick={() => deletePolicy(policy.id)}
                        data-testid={`delete-policy-${policy.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PolicyLibrary;
