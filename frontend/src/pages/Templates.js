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
  Plus, 
  FileEdit, 
  Trash2, 
  Edit2,
  Save
} from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const TEMPLATE_TYPES = [
  { value: 'appeal', label: 'Appeal Letter' },
  { value: 'prior_auth', label: 'Prior Authorization' },
  { value: 'reconsideration', label: 'Reconsideration' },
  { value: 'peer_to_peer', label: 'Peer-to-Peer Request' }
];

const TONES = [
  { value: 'professional', label: 'Professional' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'formal', label: 'Formal' },
  { value: 'collaborative', label: 'Collaborative' }
];

const Templates = () => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  
  const [formData, setFormData] = useState({
    name: '',
    type: '',
    tone: 'professional',
    content: ''
  });

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/templates`);
      setTemplates(response.data);
    } catch (error) {
      toast.error('Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const openEditDialog = (template) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      type: template.type,
      tone: template.tone,
      content: template.content
    });
    setShowDialog(true);
  };

  const openNewDialog = () => {
    setEditingTemplate(null);
    setFormData({ name: '', type: '', tone: 'professional', content: '' });
    setShowDialog(true);
  };

  const saveTemplate = async () => {
    if (!formData.name || !formData.type || !formData.content) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      if (editingTemplate) {
        await axios.put(`${API}/templates/${editingTemplate.id}`, formData);
        toast.success('Template updated');
      } else {
        await axios.post(`${API}/templates`, formData);
        toast.success('Template created');
      }
      setShowDialog(false);
      fetchTemplates();
    } catch (error) {
      toast.error('Failed to save template');
    }
  };

  const deleteTemplate = async (templateId) => {
    if (!window.confirm('Are you sure you want to delete this template?')) return;
    
    try {
      await axios.delete(`${API}/templates/${templateId}`);
      toast.success('Template deleted');
      fetchTemplates();
    } catch (error) {
      toast.error('Failed to delete template');
    }
  };

  const getTypeLabel = (type) => TEMPLATE_TYPES.find(t => t.value === type)?.label || type;
  const getToneLabel = (tone) => TONES.find(t => t.value === tone)?.label || tone;

  return (
    <div className="space-y-6 animate-fade-in" data-testid="templates-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900" style={{ fontFamily: 'Manrope' }}>
            Letter Templates
          </h1>
          <p className="text-slate-600 mt-1">
            Manage templates and tone controls for appeal generation
          </p>
        </div>
        <Button onClick={openNewDialog} className="bg-teal-700 hover:bg-teal-800" data-testid="add-template-btn">
          <Plus className="w-4 h-4 mr-2" />
          Add Template
        </Button>
      </div>

      {/* Templates Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="spinner w-8 h-8" />
        </div>
      ) : templates.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileEdit className="w-12 h-12 mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-semibold text-slate-700">No templates yet</h3>
            <p className="text-slate-500 mt-1">Create templates to customize appeal letter generation</p>
            <Button onClick={openNewDialog} className="mt-4 bg-teal-700 hover:bg-teal-800">
              <Plus className="w-4 h-4 mr-2" />
              Create Template
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((template) => (
            <Card key={template.id} className="card-hover" data-testid={`template-card-${template.id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{template.name}</CardTitle>
                    <div className="flex gap-2 mt-2">
                      <Badge variant="outline">{getTypeLabel(template.type)}</Badge>
                      <Badge className="bg-slate-100 text-slate-600 border-slate-200">
                        {getToneLabel(template.tone)}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => openEditDialog(template)}
                      data-testid={`edit-template-${template.id}`}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                      onClick={() => deleteTemplate(template.id)}
                      data-testid={`delete-template-${template.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-600 line-clamp-4 whitespace-pre-wrap">
                  {template.content}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Template Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? 'Edit Template' : 'Create Template'}
            </DialogTitle>
            <DialogDescription>
              {editingTemplate 
                ? 'Update the template details and content' 
                : 'Create a new template for appeal letter generation'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Template Name <span className="text-red-500">*</span></Label>
              <Input
                placeholder="e.g., Standard Appeal Letter"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                data-testid="template-name-input"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type <span className="text-red-500">*</span></Label>
                <Select value={formData.type} onValueChange={(v) => handleInputChange('type', v)}>
                  <SelectTrigger data-testid="template-type-select">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {TEMPLATE_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tone</Label>
                <Select value={formData.tone} onValueChange={(v) => handleInputChange('tone', v)}>
                  <SelectTrigger data-testid="template-tone-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TONES.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Template Content <span className="text-red-500">*</span></Label>
              <Textarea
                placeholder="Enter the template content. Use placeholders like [PAYER], [SERVICE], [PATIENT] for dynamic content..."
                value={formData.content}
                onChange={(e) => handleInputChange('content', e.target.value)}
                rows={10}
                className="font-mono text-sm"
                data-testid="template-content-input"
              />
              <p className="text-xs text-slate-500">
                Available placeholders: [PAYER], [PATIENT], [SERVICE], [DATE], [CODES]
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button 
              onClick={saveTemplate}
              className="bg-teal-700 hover:bg-teal-800"
              data-testid="save-template-btn"
            >
              <Save className="w-4 h-4 mr-2" />
              {editingTemplate ? 'Update' : 'Create'} Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Templates;
