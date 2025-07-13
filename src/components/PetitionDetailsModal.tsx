
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Scale, Users, Calendar, MapPin, Upload, CheckCircle, AlertTriangle } from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import EnhancedSignatureFlow from './EnhancedSignatureFlow';

interface PetitionDetailsModalProps {
  petition: {
    id: string;
    mp_name: string;
    constituency: string;
    county: string;
    grounds: string[];
    description: string;
    signature_target: number;
    current_signatures: number;
    ward_target: number;
    wards_covered: number;
    deadline: string;
    status: string;
  };
  isOpen: boolean;
  onClose: () => void;
}

const PetitionDetailsModal: React.FC<PetitionDetailsModalProps> = ({ petition, isOpen, onClose }) => {
  const [currentView, setCurrentView] = useState<'details' | 'evidence' | 'sign'>('details');
  const [isUploading, setIsUploading] = useState(false);
  const [evidenceForm, setEvidenceForm] = useState({
    title: '',
    description: '',
    documentType: '',
    file: null as File | null
  });

  const progressPercentage = (petition.current_signatures / petition.signature_target) * 100;
  const wardProgress = (petition.wards_covered / petition.ward_target) * 100;
  const daysRemaining = Math.ceil((new Date(petition.deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));

  const getGroundsDetails = (grounds: string[]) => {
    const groundsMap: { [key: string]: { title: string; description: string; article: string } } = {
      'chapter_6': {
        title: 'Chapter 6 Violation',
        description: 'Violation of leadership and integrity provisions under Chapter 6 of the Constitution',
        article: 'Article 73-80'
      },
      'funds_misuse': {
        title: 'Funds Misappropriation',
        description: 'Misuse or misappropriation of public funds and resources',
        article: 'Article 201-207'
      },
      'electoral_crime': {
        title: 'Electoral Offense',
        description: 'Violation of electoral laws and regulations',
        article: 'Elections Act'
      },
      'abuse_of_office': {
        title: 'Abuse of Office',
        description: 'Using official position for personal gain or improper conduct',
        article: 'Article 232'
      },
      'corruption': {
        title: 'Corruption',
        description: 'Engaging in corrupt practices or facilitating corruption',
        article: 'Anti-Corruption Act'
      }
    };

    return grounds.map(ground => groundsMap[ground] || {
      title: ground.replace('_', ' ').toUpperCase(),
      description: 'Constitutional violation requiring accountability',
      article: 'Constitution of Kenya 2010'
    });
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        toast.error('File size must be less than 10MB');
        return;
      }
      setEvidenceForm(prev => ({ ...prev, file }));
    }
  };

  const handleEvidenceSubmit = async () => {
    if (!evidenceForm.title || !evidenceForm.documentType) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsUploading(true);
    try {
      let filePath = null;
      
      if (evidenceForm.file) {
        const fileExt = evidenceForm.file.name.split('.').pop();
        const fileName = `${Date.now()}.${fileExt}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('evidence')
          .upload(`evidence/${fileName}`, evidenceForm.file);

        if (uploadError) throw uploadError;
        filePath = uploadData.path;
      }

      const { error } = await supabase
        .from('evidence_documents')
        .insert({
          petition_id: petition.id,
          document_title: evidenceForm.title,
          document_type: evidenceForm.documentType,
          file_path: filePath,
          verification_status: 'pending'
        });

      if (error) throw error;

      toast.success('Evidence submitted successfully!');
      setEvidenceForm({ title: '', description: '', documentType: '', file: null });
      setCurrentView('details');
    } catch (error) {
      console.error('Error uploading evidence:', error);
      toast.error('Failed to submit evidence. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const renderDetailsView = () => (
    <div className="space-y-6">
      {/* Petition Header */}
      <div className="bg-gradient-to-r from-red-50 to-red-100 dark:from-red-950/20 dark:to-red-900/20 p-6 rounded-lg border border-red-200 dark:border-red-800">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold text-red-900 dark:text-red-100 mb-2">
              Recall Petition Against {petition.mp_name}
            </h2>
            <div className="flex items-center text-red-700 dark:text-red-300 mb-2">
              <MapPin className="w-4 h-4 mr-1" />
              {petition.constituency}, {petition.county}
            </div>
            <div className="flex items-center text-red-600 dark:text-red-400">
              <Calendar className="w-4 h-4 mr-1" />
              {daysRemaining} days remaining
            </div>
          </div>
          <Badge className="bg-red-600 text-white">
            {petition.status.toUpperCase()}
          </Badge>
        </div>
      </div>

      {/* Legal Grounds */}
      <Card className="border-orange-200 dark:border-orange-800">
        <CardHeader>
          <CardTitle className="flex items-center text-orange-900 dark:text-orange-100">
            <Scale className="w-5 h-5 mr-2" />
            Legal Grounds for Recall
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {getGroundsDetails(petition.grounds).map((ground, index) => (
            <div key={index} className="p-4 bg-orange-50 dark:bg-orange-950/20 rounded-lg border border-orange-200 dark:border-orange-800">
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-semibold text-orange-900 dark:text-orange-100">{ground.title}</h4>
                <Badge variant="outline" className="text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-700">
                  {ground.article}
                </Badge>
              </div>
              <p className="text-orange-800 dark:text-orange-200 text-sm">{ground.description}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Petition Description */}
      <Card className="border-blue-200 dark:border-blue-800">
        <CardHeader>
          <CardTitle className="flex items-center text-blue-900 dark:text-blue-100">
            <FileText className="w-5 h-5 mr-2" />
            Detailed Allegations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-blue-800 dark:text-blue-200 leading-relaxed">{petition.description}</p>
        </CardContent>
      </Card>

      {/* Constitutional Requirements */}
      <Card className="border-green-200 dark:border-green-800">
        <CardHeader>
          <CardTitle className="flex items-center text-green-900 dark:text-green-100">
            <CheckCircle className="w-5 h-5 mr-2" />
            Constitutional Compliance Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-green-50 dark:bg-green-950/20 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <span className="text-green-800 dark:text-green-200 font-medium">Signature Progress</span>
                <span className="text-green-900 dark:text-green-100 font-bold">
                  {Math.round(progressPercentage)}%
                </span>
              </div>
              <div className="w-full bg-green-200 dark:bg-green-800 rounded-full h-2">
                <div 
                  className="bg-green-600 dark:bg-green-400 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(progressPercentage, 100)}%` }}
                />
              </div>
              <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                {petition.current_signatures.toLocaleString()} / {petition.signature_target.toLocaleString()} signatures
              </p>
            </div>

            <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <span className="text-blue-800 dark:text-blue-200 font-medium">Ward Coverage</span>
                <span className="text-blue-900 dark:text-blue-100 font-bold">
                  {Math.round(wardProgress)}%
                </span>
              </div>
              <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-2">
                <div 
                  className="bg-blue-600 dark:bg-blue-400 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(wardProgress, 100)}%` }}
                />
              </div>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                {petition.wards_covered} / {petition.ward_target} wards covered
              </p>
            </div>
          </div>

          <div className="flex items-center justify-center space-x-4 text-sm">
            <div className="flex items-center">
              {progressPercentage >= 30 ? (
                <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 mr-1" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mr-1" />
              )}
              <span className="text-gray-700 dark:text-gray-300">
                30% Threshold: {progressPercentage >= 30 ? 'Met' : 'Pending'}
              </span>
            </div>
            <div className="flex items-center">
              {wardProgress >= 50 ? (
                <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 mr-1" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mr-1" />
              )}
              <span className="text-gray-700 dark:text-gray-300">
                Ward Distribution: {wardProgress >= 50 ? 'Compliant' : 'Needs More'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex space-x-4">
        <Button 
          onClick={() => setCurrentView('evidence')}
          className="flex-1 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white"
        >
          <Upload className="w-4 h-4 mr-2" />
          Submit Evidence
        </Button>
        <Button 
          onClick={() => setCurrentView('sign')}
          className="flex-1 bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 text-white"
        >
          <Users className="w-4 h-4 mr-2" />
          Sign Petition
        </Button>
      </div>
    </div>
  );

  const renderEvidenceView = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Submit Supporting Evidence</h3>
        <p className="text-gray-600 dark:text-gray-400">
          Upload documents, photos, or other evidence supporting the allegations against {petition.mp_name}
        </p>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div>
            <Label htmlFor="evidenceTitle" className="text-gray-700 dark:text-gray-300">Evidence Title *</Label>
            <Input
              id="evidenceTitle"
              value={evidenceForm.title}
              onChange={(e) => setEvidenceForm(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Brief title describing the evidence"
              className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
            />
          </div>

          <div>
            <Label htmlFor="documentType" className="text-gray-700 dark:text-gray-300">Document Type *</Label>
            <Select 
              value={evidenceForm.documentType}
              onValueChange={(value) => setEvidenceForm(prev => ({ ...prev, documentType: value }))}
            >
              <SelectTrigger className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
                <SelectValue placeholder="Select document type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="financial_record">Financial Record</SelectItem>
                <SelectItem value="correspondence">Official Correspondence</SelectItem>
                <SelectItem value="media_report">Media Report</SelectItem>
                <SelectItem value="witness_statement">Witness Statement</SelectItem>
                <SelectItem value="court_document">Court Document</SelectItem>
                <SelectItem value="audit_report">Audit Report</SelectItem>
                <SelectItem value="photograph">Photograph</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="evidenceDescription" className="text-gray-700 dark:text-gray-300">Description</Label>
            <Textarea
              id="evidenceDescription"
              value={evidenceForm.description}
              onChange={(e) => setEvidenceForm(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Detailed description of the evidence and its relevance"
              rows={3}
              className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
            />
          </div>

          <div>
            <Label htmlFor="evidenceFile" className="text-gray-700 dark:text-gray-300">Upload File (optional)</Label>
            <Input
              id="evidenceFile"
              type="file"
              onChange={handleFileUpload}
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif"
              className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Supported formats: PDF, DOC, DOCX, JPG, PNG, GIF (Max 10MB)
            </p>
            {evidenceForm.file && (
              <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                Selected: {evidenceForm.file.name}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex space-x-4">
        <Button 
          variant="outline" 
          onClick={() => setCurrentView('details')}
          className="flex-1"
        >
          Back to Details
        </Button>
        <Button 
          onClick={handleEvidenceSubmit}
          disabled={isUploading || !evidenceForm.title || !evidenceForm.documentType}
          className="flex-1 bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white"
        >
          {isUploading ? 'Uploading...' : 'Submit Evidence'}
        </Button>
      </div>
    </div>
  );

  const renderSignView = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Sign the Petition</h3>
        <p className="text-gray-600 dark:text-gray-400">
          Add your digital signature to support the recall of {petition.mp_name}
        </p>
      </div>

      <EnhancedSignatureFlow 
        petitionId={petition.id}
        petitionTitle={`Recall ${petition.mp_name}`}
        onComplete={(code) => {
          toast.success(`Signature recorded! Your code: ${code}`);
          onClose();
        }}
      />

      <Button 
        variant="outline" 
        onClick={() => setCurrentView('details')}
        className="w-full"
      >
        Back to Details
      </Button>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-900">
        <DialogHeader>
          <DialogTitle className="text-gray-900 dark:text-white">
            {currentView === 'details' && 'Petition Details'}
            {currentView === 'evidence' && 'Submit Evidence'}
            {currentView === 'sign' && 'Sign Petition'}
          </DialogTitle>
        </DialogHeader>

        {currentView === 'details' && renderDetailsView()}
        {currentView === 'evidence' && renderEvidenceView()}
        {currentView === 'sign' && renderSignView()}
      </DialogContent>
    </Dialog>
  );
};

export default PetitionDetailsModal;
