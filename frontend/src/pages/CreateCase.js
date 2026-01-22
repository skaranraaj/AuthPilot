import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Calendar } from '../components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { 
  ArrowLeft, 
  ArrowRight, 
  Upload, 
  FileText, 
  Calendar as CalendarIcon,
  Building,
  MapPin,
  User,
  AlertCircle,
  Check
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '../lib/utils';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PAYERS = [
  'Blue Cross Blue Shield',
  'Aetna',
  'UnitedHealthcare',
  'Cigna',
  'Humana',
  'Kaiser Permanente',
  'Anthem',
  'Medicare',
  'Medicaid',
  'Other'
];

const STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
];

const CreateCase = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [caseId, setCaseId] = useState(null);
  
  const [formData, setFormData] = useState({
    payer: '',
    state: '',
    cpt_codes: '',
    icd10_codes: '',
    request_type: 'Appeal',
    due_date: null,
    patient_name: '',
    patient_dob: '',
    patient_mrn: ''
  });

  const [documents, setDocuments] = useState({
    denial_letter: null,
    clinical_notes: null,
    imaging_report: null
  });

  const [uploadedDocs, setUploadedDocs] = useState([]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFileSelect = (type, file) => {
    setDocuments(prev => ({ ...prev, [type]: file }));
  };

  const createCase = async () => {
    if (!formData.payer || !formData.state || !formData.due_date) {
      toast.error('Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      const cptCodes = formData.cpt_codes.split(',').map(c => c.trim()).filter(Boolean);
      const icdCodes = formData.icd10_codes.split(',').map(c => c.trim()).filter(Boolean);

      const response = await axios.post(`${API}/cases`, {
        ...formData,
        cpt_codes: cptCodes,
        icd10_codes: icdCodes,
        due_date: format(formData.due_date, 'yyyy-MM-dd')
      });

      setCaseId(response.data.id);
      toast.success('Case created successfully');
      setStep(2);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create case');
    } finally {
      setLoading(false);
    }
  };

  const uploadDocument = async (type, file) => {
    if (!caseId || !file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('document_type', type);

    try {
      const response = await axios.post(`${API}/cases/${caseId}/documents`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setUploadedDocs(prev => [...prev, { type, filename: file.name, id: response.data.id }]);
      toast.success(`${type.replace('_', ' ')} uploaded`);
    } catch (error) {
      toast.error(`Failed to upload ${type.replace('_', ' ')}`);
    } finally {
      setUploading(false);
    }
  };

  const handleUploadAll = async () => {
    for (const [type, file] of Object.entries(documents)) {
      if (file) {
        await uploadDocument(type, file);
      }
    }
  };

  const proceedToCase = () => {
    if (uploadedDocs.length === 0 && !documents.denial_letter) {
      toast.error('Please upload at least the denial letter');
      return;
    }
    navigate(`/cases/${caseId}`);
  };

  const FileUploadBox = ({ type, label, required, file, onSelect }) => {
    const isUploaded = uploadedDocs.some(d => d.type === type);
    
    return (
      <div 
        className={cn(
          "border-2 border-dashed rounded-lg p-6 text-center transition-all",
          isUploaded 
            ? "border-emerald-300 bg-emerald-50" 
            : file 
              ? "border-teal-300 bg-teal-50" 
              : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
        )}
        data-testid={`upload-${type}`}
      >
        <input
          type="file"
          id={type}
          className="hidden"
          accept=".pdf,.png,.jpg,.jpeg,.txt,.doc,.docx"
          onChange={(e) => onSelect(type, e.target.files[0])}
        />
        <label htmlFor={type} className="cursor-pointer">
          {isUploaded ? (
            <Check className="w-8 h-8 mx-auto mb-2 text-emerald-600" />
          ) : file ? (
            <FileText className="w-8 h-8 mx-auto mb-2 text-teal-600" />
          ) : (
            <Upload className="w-8 h-8 mx-auto mb-2 text-slate-400" />
          )}
          <p className="font-medium text-slate-700">
            {label} {required && <span className="text-red-500">*</span>}
          </p>
          {isUploaded ? (
            <p className="text-sm text-emerald-600 mt-1">Uploaded successfully</p>
          ) : file ? (
            <p className="text-sm text-teal-600 mt-1">{file.name}</p>
          ) : (
            <p className="text-sm text-slate-500 mt-1">Click to select file</p>
          )}
        </label>
      </div>
    );
  };

  return (
    <div className="max-w-3xl mx-auto animate-fade-in" data-testid="create-case-page">
      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-center gap-4">
          <div className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-full",
            step === 1 ? "bg-teal-100 text-teal-700" : "bg-slate-100 text-slate-500"
          )}>
            <span className="w-6 h-6 rounded-full bg-current/20 flex items-center justify-center text-sm font-medium">
              {step > 1 ? <Check className="w-4 h-4" /> : '1'}
            </span>
            Case Details
          </div>
          <div className="w-8 h-px bg-slate-200" />
          <div className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-full",
            step === 2 ? "bg-teal-100 text-teal-700" : "bg-slate-100 text-slate-500"
          )}>
            <span className="w-6 h-6 rounded-full bg-current/20 flex items-center justify-center text-sm font-medium">
              2
            </span>
            Upload Documents
          </div>
        </div>
      </div>

      {step === 1 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl font-bold" style={{ fontFamily: 'Manrope' }}>
              Create New Case
            </CardTitle>
            <CardDescription>
              Enter the case details and payer information
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Payer & State */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Building className="w-4 h-4 text-slate-400" />
                  Payer <span className="text-red-500">*</span>
                </Label>
                <Select value={formData.payer} onValueChange={(v) => handleInputChange('payer', v)}>
                  <SelectTrigger data-testid="payer-select">
                    <SelectValue placeholder="Select payer" />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYERS.map(p => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  State <span className="text-red-500">*</span>
                </Label>
                <Select value={formData.state} onValueChange={(v) => handleInputChange('state', v)}>
                  <SelectTrigger data-testid="state-select">
                    <SelectValue placeholder="Select state" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATES.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Codes */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>CPT/HCPCS Codes</Label>
                <Input
                  placeholder="e.g., 72148, 72149"
                  value={formData.cpt_codes}
                  onChange={(e) => handleInputChange('cpt_codes', e.target.value)}
                  data-testid="cpt-codes-input"
                />
                <p className="text-xs text-slate-500">Comma-separated</p>
              </div>
              <div className="space-y-2">
                <Label>ICD-10 Codes</Label>
                <Input
                  placeholder="e.g., M54.5, G43.909"
                  value={formData.icd10_codes}
                  onChange={(e) => handleInputChange('icd10_codes', e.target.value)}
                  data-testid="icd10-codes-input"
                />
                <p className="text-xs text-slate-500">Comma-separated</p>
              </div>
            </div>

            {/* Due Date & Request Type */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4 text-slate-400" />
                  Due Date <span className="text-red-500">*</span>
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !formData.due_date && "text-slate-500"
                      )}
                      data-testid="due-date-btn"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.due_date ? format(formData.due_date, 'PPP') : 'Pick a date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={formData.due_date}
                      onSelect={(date) => handleInputChange('due_date', date)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>Request Type</Label>
                <Select value={formData.request_type} onValueChange={(v) => handleInputChange('request_type', v)}>
                  <SelectTrigger data-testid="request-type-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Appeal">Appeal</SelectItem>
                    <SelectItem value="Prior Authorization">Prior Authorization</SelectItem>
                    <SelectItem value="Reconsideration">Reconsideration</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Patient Info */}
            <div className="border-t border-slate-200 pt-6 mt-6">
              <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                <User className="w-4 h-4" />
                Patient Information (Optional)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Patient Name</Label>
                  <Input
                    placeholder="John Doe"
                    value={formData.patient_name}
                    onChange={(e) => handleInputChange('patient_name', e.target.value)}
                    data-testid="patient-name-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Date of Birth</Label>
                  <Input
                    type="date"
                    value={formData.patient_dob}
                    onChange={(e) => handleInputChange('patient_dob', e.target.value)}
                    data-testid="patient-dob-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label>MRN</Label>
                  <Input
                    placeholder="Medical Record Number"
                    value={formData.patient_mrn}
                    onChange={(e) => handleInputChange('patient_mrn', e.target.value)}
                    data-testid="patient-mrn-input"
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-between pt-4 border-t border-slate-200">
              <Button variant="ghost" onClick={() => navigate('/dashboard')}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Cancel
              </Button>
              <Button 
                onClick={createCase} 
                disabled={loading}
                className="bg-teal-700 hover:bg-teal-800"
                data-testid="create-case-btn"
              >
                {loading ? (
                  <div className="spinner w-4 h-4 mr-2" />
                ) : null}
                Continue to Upload
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl font-bold" style={{ fontFamily: 'Manrope' }}>
              Upload Documents
            </CardTitle>
            <CardDescription>
              Upload the denial letter and any supporting documentation
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="compliance-banner flex items-start gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Document Processing</p>
                <p className="text-sm mt-1">
                  Uploaded documents will be processed using OCR to extract text. 
                  Ensure documents are legible for best results.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FileUploadBox
                type="denial_letter"
                label="Denial Letter"
                required
                file={documents.denial_letter}
                onSelect={handleFileSelect}
              />
              <FileUploadBox
                type="clinical_notes"
                label="Clinical Notes"
                file={documents.clinical_notes}
                onSelect={handleFileSelect}
              />
              <FileUploadBox
                type="imaging_report"
                label="Imaging Report"
                file={documents.imaging_report}
                onSelect={handleFileSelect}
              />
            </div>

            {/* Actions */}
            <div className="flex justify-between pt-4 border-t border-slate-200">
              <Button variant="ghost" onClick={() => setStep(1)}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <div className="flex gap-3">
                <Button 
                  variant="outline"
                  onClick={handleUploadAll}
                  disabled={uploading || !Object.values(documents).some(Boolean)}
                  data-testid="upload-all-btn"
                >
                  {uploading && <div className="spinner w-4 h-4 mr-2" />}
                  Upload All
                </Button>
                <Button 
                  onClick={proceedToCase}
                  className="bg-teal-700 hover:bg-teal-800"
                  data-testid="proceed-btn"
                >
                  Process Case
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default CreateCase;
