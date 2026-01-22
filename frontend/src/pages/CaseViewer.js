import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { ScrollArea } from '../components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Checkbox } from '../components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import { 
  ArrowLeft, 
  FileText, 
  BookOpen, 
  AlertTriangle, 
  Wand2,
  RefreshCw,
  Download,
  CheckCircle,
  Clock,
  Edit2,
  Save,
  X,
  ExternalLink,
  AlertCircle,
  Sparkles,
  FileCheck
} from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const statusConfig = {
  new_denial: { label: 'New Denial', className: 'status-new-denial' },
  draft_appeal: { label: 'Draft Appeal', className: 'status-draft-appeal' },
  submitted: { label: 'Submitted', className: 'status-submitted' },
  won: { label: 'Won', className: 'status-won' },
  lost: { label: 'Lost', className: 'status-lost' },
};

const CaseViewer = () => {
  const { caseId } = useParams();
  const navigate = useNavigate();
  const [caseData, setCaseData] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState({ extract: false, match: false, analyze: false, generate: false });
  const [editingFacts, setEditingFacts] = useState(false);
  const [editedFacts, setEditedFacts] = useState({});
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportAcknowledged, setExportAcknowledged] = useState(false);
  const [showStatusDialog, setShowStatusDialog] = useState(false);

  useEffect(() => {
    fetchCaseData();
  }, [caseId]);

  const fetchCaseData = async () => {
    setLoading(true);
    try {
      const [caseRes, docsRes] = await Promise.all([
        axios.get(`${API}/cases/${caseId}`),
        axios.get(`${API}/cases/${caseId}/documents`)
      ]);
      setCaseData(caseRes.data);
      setDocuments(docsRes.data);
      setEditedFacts(caseRes.data.extracted_facts || {});
    } catch (error) {
      toast.error('Failed to load case');
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const extractFacts = async () => {
    setProcessing(prev => ({ ...prev, extract: true }));
    try {
      const response = await axios.post(`${API}/cases/${caseId}/extract`);
      setCaseData(prev => ({ ...prev, extracted_facts: response.data.extracted_facts }));
      setEditedFacts(response.data.extracted_facts);
      toast.success('Facts extracted successfully');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Extraction failed');
    } finally {
      setProcessing(prev => ({ ...prev, extract: false }));
    }
  };

  const matchPolicies = async () => {
    setProcessing(prev => ({ ...prev, match: true }));
    try {
      const response = await axios.post(`${API}/cases/${caseId}/match-policies`);
      setCaseData(prev => ({ ...prev, policy_matches: response.data.policy_matches }));
      toast.success('Policy matches found');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Policy matching failed');
    } finally {
      setProcessing(prev => ({ ...prev, match: false }));
    }
  };

  const analyzeDenial = async () => {
    setProcessing(prev => ({ ...prev, analyze: true }));
    try {
      const response = await axios.post(`${API}/cases/${caseId}/analyze`);
      setCaseData(prev => ({ ...prev, denial_analysis: response.data.denial_analysis }));
      toast.success('Denial analyzed');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Analysis failed');
    } finally {
      setProcessing(prev => ({ ...prev, analyze: false }));
    }
  };

  const generateDraft = async () => {
    setProcessing(prev => ({ ...prev, generate: true }));
    try {
      const response = await axios.post(`${API}/cases/${caseId}/generate-draft`);
      setCaseData(prev => ({ ...prev, generated_draft: response.data.generated_draft, status: 'draft_appeal' }));
      toast.success('Appeal draft generated');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Draft generation failed');
    } finally {
      setProcessing(prev => ({ ...prev, generate: false }));
    }
  };

  const regenerateDraft = async () => {
    setProcessing(prev => ({ ...prev, generate: true }));
    try {
      const response = await axios.post(`${API}/cases/${caseId}/regenerate`);
      setCaseData(prev => ({ ...prev, generated_draft: response.data.generated_draft }));
      toast.success('Draft regenerated');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Regeneration failed');
    } finally {
      setProcessing(prev => ({ ...prev, generate: false }));
    }
  };

  const saveFacts = async () => {
    try {
      await axios.put(`${API}/cases/${caseId}`, { extracted_facts: editedFacts });
      setCaseData(prev => ({ ...prev, extracted_facts: editedFacts }));
      setEditingFacts(false);
      toast.success('Facts saved');
    } catch (error) {
      toast.error('Failed to save facts');
    }
  };

  const updateStatus = async (newStatus) => {
    try {
      await axios.put(`${API}/cases/${caseId}`, { status: newStatus });
      setCaseData(prev => ({ ...prev, status: newStatus }));
      setShowStatusDialog(false);
      toast.success('Status updated');
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const markReviewed = async () => {
    try {
      await axios.post(`${API}/cases/${caseId}/mark-reviewed`);
      setCaseData(prev => ({ ...prev, reviewed: true }));
      toast.success('Marked as reviewed');
    } catch (error) {
      toast.error('Failed to mark as reviewed');
    }
  };

  const exportPDF = async () => {
    if (!exportAcknowledged) {
      toast.error('Please acknowledge the disclaimer');
      return;
    }
    
    try {
      const response = await axios.post(`${API}/cases/${caseId}/export?format=pdf`, {}, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `appeal_letter_${caseId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      setShowExportDialog(false);
      toast.success('PDF exported');
    } catch (error) {
      toast.error('Export failed');
    }
  };

  const runFullProcess = async () => {
    await extractFacts();
    await matchPolicies();
    await analyzeDenial();
    await generateDraft();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="spinner w-10 h-10" />
      </div>
    );
  }

  if (!caseData) return null;

  const status = statusConfig[caseData.status] || statusConfig.new_denial;
  const extractedFacts = caseData.extracted_facts || {};
  const policyMatches = caseData.policy_matches || [];
  const denialAnalysis = caseData.denial_analysis || {};
  const generatedDraft = caseData.generated_draft || {};

  return (
    <div className="space-y-6 animate-fade-in" data-testid="case-viewer-page">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/dashboard')} data-testid="back-btn">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Manrope' }}>
                {caseData.patient_name || 'Unnamed Patient'}
              </h1>
              <Badge className={`${status.className} border cursor-pointer`} onClick={() => setShowStatusDialog(true)}>
                {status.label}
              </Badge>
              {caseData.reviewed && (
                <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Reviewed
                </Badge>
              )}
            </div>
            <p className="text-sm text-slate-500 mt-1">
              {caseData.payer} • {caseData.state} • Due: {caseData.due_date ? format(parseISO(caseData.due_date), 'MMM d, yyyy') : 'Not set'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={runFullProcess}
            disabled={Object.values(processing).some(Boolean)}
            data-testid="process-all-btn"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Process All
          </Button>
          {!caseData.reviewed && (
            <Button variant="outline" onClick={markReviewed} data-testid="mark-reviewed-btn">
              <FileCheck className="w-4 h-4 mr-2" />
              Mark Reviewed
            </Button>
          )}
          <Button 
            onClick={() => setShowExportDialog(true)}
            className="bg-teal-700 hover:bg-teal-800"
            disabled={!generatedDraft.appeal_letter}
            data-testid="export-btn"
          >
            <Download className="w-4 h-4 mr-2" />
            Export PDF
          </Button>
        </div>
      </div>

      {/* Uploaded Documents */}
      {documents.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {documents.map(doc => (
            <Badge key={doc.id} variant="outline" className="gap-1">
              <FileText className="w-3 h-3" />
              {doc.type.replace('_', ' ')}: {doc.filename}
            </Badge>
          ))}
        </div>
      )}

      {/* 4-Panel Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Panel 1: Extracted Facts */}
        <Card className="lg:col-span-1" data-testid="panel-facts">
          <CardHeader className="panel-header flex flex-row items-center justify-between space-y-0 py-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <FileText className="w-4 h-4 text-teal-600" />
              Extracted Facts
            </CardTitle>
            <div className="flex items-center gap-1">
              {editingFacts ? (
                <>
                  <Button size="icon" variant="ghost" onClick={saveFacts} className="h-7 w-7">
                    <Save className="w-4 h-4 text-emerald-600" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => setEditingFacts(false)} className="h-7 w-7">
                    <X className="w-4 h-4 text-slate-500" />
                  </Button>
                </>
              ) : (
                <Button size="icon" variant="ghost" onClick={() => setEditingFacts(true)} className="h-7 w-7">
                  <Edit2 className="w-4 h-4" />
                </Button>
              )}
              <Button 
                size="icon" 
                variant="ghost" 
                onClick={extractFacts}
                disabled={processing.extract}
                className="h-7 w-7"
                data-testid="extract-btn"
              >
                {processing.extract ? <div className="spinner w-4 h-4" /> : <RefreshCw className="w-4 h-4" />}
              </Button>
            </div>
          </CardHeader>
          <ScrollArea className="h-[400px]">
            <CardContent className="p-4 space-y-4 text-sm">
              {Object.keys(extractedFacts).length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <Wand2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No facts extracted yet</p>
                  <Button 
                    size="sm" 
                    className="mt-3"
                    onClick={extractFacts}
                    disabled={processing.extract || documents.length === 0}
                  >
                    Extract Facts
                  </Button>
                </div>
              ) : (
                <>
                  <FactField 
                    label="Payer" 
                    value={editedFacts.payer_name} 
                    editing={editingFacts}
                    onChange={(v) => setEditedFacts(p => ({ ...p, payer_name: v }))}
                  />
                  <FactField 
                    label="Requested Service" 
                    value={editedFacts.requested_service} 
                    editing={editingFacts}
                    onChange={(v) => setEditedFacts(p => ({ ...p, requested_service: v }))}
                  />
                  <FactField 
                    label="Denial Category" 
                    value={editedFacts.denial_reason_category} 
                    editing={editingFacts}
                    onChange={(v) => setEditedFacts(p => ({ ...p, denial_reason_category: v }))}
                  />
                  <div>
                    <p className="font-medium text-slate-700 mb-1">Denial Reasons</p>
                    <ul className="list-disc list-inside text-slate-600 space-y-1">
                      {(extractedFacts.denial_reasons || []).map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="font-medium text-slate-700 mb-1">CPT/HCPCS Codes</p>
                    <div className="flex flex-wrap gap-1">
                      {(extractedFacts.CPT_HCPCS_codes || []).map((c, i) => (
                        <Badge key={i} variant="outline" className="text-xs">{c}</Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="font-medium text-slate-700 mb-1">ICD-10 Codes</p>
                    <div className="flex flex-wrap gap-1">
                      {(extractedFacts.ICD10_codes || []).map((c, i) => (
                        <Badge key={i} variant="outline" className="text-xs">{c}</Badge>
                      ))}
                    </div>
                  </div>
                  {extractedFacts.patient_age && (
                    <FactField label="Patient Age" value={extractedFacts.patient_age} />
                  )}
                  {extractedFacts.dates && (
                    <div>
                      <p className="font-medium text-slate-700 mb-1">Dates</p>
                      <div className="text-slate-600 space-y-0.5">
                        {extractedFacts.dates.date_of_service && <p>Service: {extractedFacts.dates.date_of_service}</p>}
                        {extractedFacts.dates.denial_date && <p>Denial: {extractedFacts.dates.denial_date}</p>}
                      </div>
                    </div>
                  )}
                  {extractedFacts.missing_information?.length > 0 && (
                    <div className="border-t pt-3 mt-3">
                      <p className="font-medium text-amber-700 mb-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        Missing Information
                      </p>
                      <ul className="list-disc list-inside text-amber-600 space-y-0.5">
                        {extractedFacts.missing_information.map((m, i) => (
                          <li key={i}>{m}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </ScrollArea>
        </Card>

        {/* Panel 2: Policy Match */}
        <Card className="lg:col-span-1" data-testid="panel-policy">
          <CardHeader className="panel-header flex flex-row items-center justify-between space-y-0 py-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-teal-600" />
              Policy Match
            </CardTitle>
            <Button 
              size="icon" 
              variant="ghost" 
              onClick={matchPolicies}
              disabled={processing.match}
              className="h-7 w-7"
              data-testid="match-policies-btn"
            >
              {processing.match ? <div className="spinner w-4 h-4" /> : <RefreshCw className="w-4 h-4" />}
            </Button>
          </CardHeader>
          <ScrollArea className="h-[400px]">
            <CardContent className="p-4 space-y-3">
              {policyMatches.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No policy matches yet</p>
                  <Button 
                    size="sm" 
                    className="mt-3"
                    onClick={matchPolicies}
                    disabled={processing.match || Object.keys(extractedFacts).length === 0}
                  >
                    Find Policies
                  </Button>
                </div>
              ) : (
                policyMatches.map((match, i) => (
                  <div key={i} className="border border-slate-200 rounded-lg p-3 bg-slate-50/50 hover:bg-slate-50 transition-colors">
                    <div className="flex items-start justify-between mb-2">
                      <p className="font-medium text-slate-800 text-sm">{match.policy_name}</p>
                      <Badge variant="outline" className="text-xs">
                        {Math.round(match.score * 100)}% match
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-500 mb-2">
                      {match.section} • Page {match.page} • {match.effective_date}
                    </p>
                    <p className="text-sm text-slate-600 line-clamp-3">
                      {match.text}
                    </p>
                    <p className="citation mt-2">
                      [CITATION: {match.policy_name} | {match.effective_date} | {match.section}/Page {match.page} | {match.excerpt_id?.slice(0, 8)}]
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </ScrollArea>
        </Card>

        {/* Panel 3: Denial Analysis */}
        <Card className="lg:col-span-1" data-testid="panel-analysis">
          <CardHeader className="panel-header flex flex-row items-center justify-between space-y-0 py-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              Denial Analysis
            </CardTitle>
            <Button 
              size="icon" 
              variant="ghost" 
              onClick={analyzeDenial}
              disabled={processing.analyze}
              className="h-7 w-7"
              data-testid="analyze-btn"
            >
              {processing.analyze ? <div className="spinner w-4 h-4" /> : <RefreshCw className="w-4 h-4" />}
            </Button>
          </CardHeader>
          <ScrollArea className="h-[400px]">
            <CardContent className="p-4 space-y-4">
              {!denialAnalysis.denial_category && (!denialAnalysis.missing_docs_checklist || denialAnalysis.missing_docs_checklist.length === 0) ? (
                <div className="text-center py-8 text-slate-500">
                  <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No analysis yet</p>
                  <Button 
                    size="sm" 
                    className="mt-3"
                    onClick={analyzeDenial}
                    disabled={processing.analyze || Object.keys(extractedFacts).length === 0}
                  >
                    Analyze Denial
                  </Button>
                </div>
              ) : (
                <>
                  {denialAnalysis.denial_category && (
                    <div className="mb-4">
                      <p className="font-medium text-slate-700 mb-2">Denial Category</p>
                      <Badge className="status-draft-appeal border capitalize">
                        {denialAnalysis.denial_category?.replace(/_/g, ' ')}
                      </Badge>
                    </div>
                  )}
                  
                  {denialAnalysis.denial_reasons?.length > 0 && (
                    <div className="mb-4">
                      <p className="font-medium text-slate-700 mb-2">Denial Reasons</p>
                      <ul className="list-disc list-inside text-sm text-slate-600 space-y-1">
                        {denialAnalysis.denial_reasons.map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div>
                    <p className="font-medium text-slate-700 mb-2">Missing Documentation Checklist</p>
                    <div className="space-y-2">
                      {(denialAnalysis.missing_docs_checklist || []).map((item, i) => (
                        <div key={i} className="border border-slate-200 rounded-lg p-3 text-sm">
                          <div className="flex items-start gap-2">
                            {item.status === 'Present' ? (
                              <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                            ) : item.status === 'Missing' ? (
                              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                            ) : (
                              <Clock className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                            )}
                            <div className="flex-1">
                              <p className="font-medium text-slate-800">{item.item}</p>
                              <Badge 
                                variant="outline" 
                                className={`text-xs mt-1 ${
                                  item.status === 'Present' 
                                    ? 'border-emerald-200 text-emerald-700 bg-emerald-50' 
                                    : item.status === 'Missing' 
                                      ? 'border-red-200 text-red-700 bg-red-50'
                                      : 'border-amber-200 text-amber-700 bg-amber-50'
                                }`}
                              >
                                {item.status}
                              </Badge>
                              {item.required_by_policy_citation && (
                                <p className="citation mt-2">{item.required_by_policy_citation}</p>
                              )}
                              {item.notes && (
                                <p className="text-slate-500 mt-1 text-xs">{item.notes}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </ScrollArea>
        </Card>

        {/* Panel 4: Generated Draft */}
        <Card className="lg:col-span-1" data-testid="panel-draft">
          <CardHeader className="panel-header flex flex-row items-center justify-between space-y-0 py-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Wand2 className="w-4 h-4 text-teal-600" />
              Generated Draft
            </CardTitle>
            <div className="flex items-center gap-1">
              {generatedDraft.appeal_letter && (
                <Button 
                  size="icon" 
                  variant="ghost" 
                  onClick={regenerateDraft}
                  disabled={processing.generate}
                  className="h-7 w-7"
                  data-testid="regenerate-btn"
                >
                  {processing.generate ? <div className="spinner w-4 h-4" /> : <RefreshCw className="w-4 h-4" />}
                </Button>
              )}
            </div>
          </CardHeader>
          <ScrollArea className="h-[400px]">
            <CardContent className="p-4">
              {!generatedDraft.appeal_letter ? (
                <div className="text-center py-8 text-slate-500">
                  <Wand2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No draft generated yet</p>
                  <Button 
                    size="sm" 
                    className="mt-3 bg-teal-700 hover:bg-teal-800"
                    onClick={generateDraft}
                    disabled={processing.generate}
                    data-testid="generate-draft-btn"
                  >
                    {processing.generate && <div className="spinner w-4 h-4 mr-2" />}
                    Generate Draft
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Reviewable Status */}
                  {generatedDraft.reviewable === false && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-amber-800 text-sm">Not Reviewable</p>
                        <p className="text-amber-700 text-xs">
                          Insufficient policy support found. Human review required.
                        </p>
                      </div>
                    </div>
                  )}
                  
                  {generatedDraft.reviewable === true && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-emerald-800 text-sm">Reviewable</p>
                        <p className="text-emerald-700 text-xs">
                          Draft has policy citations and is ready for review.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Appeal Letter */}
                  <div className="prose prose-sm max-w-none">
                    <pre className="whitespace-pre-wrap text-sm text-slate-700 bg-white border border-slate-200 rounded-lg p-4 font-sans">
                      {generatedDraft.appeal_letter}
                    </pre>
                  </div>

                  {/* Attachments Checklist */}
                  {generatedDraft.attachments_checklist?.length > 0 && (
                    <div className="border-t pt-4">
                      <p className="font-medium text-slate-700 mb-2 text-sm">Attachments Checklist</p>
                      <ul className="list-disc list-inside text-sm text-slate-600 space-y-1">
                        {generatedDraft.attachments_checklist.map((a, i) => (
                          <li key={i}>{a}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Citations Used */}
                  {generatedDraft.citations_used?.length > 0 && (
                    <div className="border-t pt-4">
                      <p className="font-medium text-slate-700 mb-2 text-sm">Citations Used</p>
                      <div className="space-y-1">
                        {generatedDraft.citations_used.map((c, i) => (
                          <p key={i} className="citation">{c}</p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </ScrollArea>
        </Card>
      </div>

      {/* Export Dialog */}
      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Export Appeal Letter</DialogTitle>
            <DialogDescription>
              Please review and acknowledge before exporting
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="compliance-banner">
              <p className="font-medium">Important Disclaimer</p>
              <p className="text-sm mt-1">
                This document was generated by an AI administrative assistant. It is not medical advice 
                and requires human review before submission. Verify all facts, citations, and medical 
                information before using.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <Checkbox 
                id="acknowledge" 
                checked={exportAcknowledged}
                onCheckedChange={setExportAcknowledged}
                data-testid="export-acknowledge-checkbox"
              />
              <label htmlFor="acknowledge" className="text-sm text-slate-600 cursor-pointer">
                I acknowledge that this is an AI-generated draft requiring human review. 
                I will verify all information before submission.
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExportDialog(false)}>Cancel</Button>
            <Button 
              onClick={exportPDF}
              disabled={!exportAcknowledged}
              className="bg-teal-700 hover:bg-teal-800"
              data-testid="confirm-export-btn"
            >
              <Download className="w-4 h-4 mr-2" />
              Export PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Status Update Dialog */}
      <AlertDialog open={showStatusDialog} onOpenChange={setShowStatusDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Update Case Status</AlertDialogTitle>
            <AlertDialogDescription>
              Select the new status for this case
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid grid-cols-2 gap-2 py-4">
            {Object.entries(statusConfig).map(([key, config]) => (
              <Button
                key={key}
                variant="outline"
                className={`justify-start ${caseData.status === key ? 'border-teal-500 bg-teal-50' : ''}`}
                onClick={() => updateStatus(key)}
              >
                <Badge className={`${config.className} border mr-2`}>
                  {config.label}
                </Badge>
              </Button>
            ))}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const FactField = ({ label, value, editing, onChange }) => (
  <div>
    <p className="font-medium text-slate-700 mb-1">{label}</p>
    {editing ? (
      <Input
        value={value || ''}
        onChange={(e) => onChange?.(e.target.value)}
        className="h-8 text-sm"
      />
    ) : (
      <p className="text-slate-600">{value || '-'}</p>
    )}
  </div>
);

export default CaseViewer;
