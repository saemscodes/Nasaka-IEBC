
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { FileText, Users, Scale, CheckCircle, Calendar, AlertTriangle } from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const PetitionWizard = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    mpName: '',
    constituency: '',
    county: '',
    description: '',
    grounds: [] as string[],
    signatureTarget: 0,
    wardTarget: 0,
    deadline: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const totalSteps = 4;
  const progress = (currentStep / totalSteps) * 100;

  const availableGrounds = [
    { id: 'chapter_6', label: 'Chapter 6 Violation', description: 'Violation of leadership and integrity provisions' },
    { id: 'funds_misuse', label: 'Funds Misappropriation', description: 'Misuse of public funds and resources' },
    { id: 'electoral_crime', label: 'Electoral Offense', description: 'Violation of electoral laws and regulations' },
    { id: 'abuse_of_office', label: 'Abuse of Office', description: 'Using official position for personal gain' },
    { id: 'corruption', label: 'Corruption', description: 'Engaging in or facilitating corrupt practices' },
    { id: 'gross_misconduct', label: 'Gross Misconduct', description: 'Serious breach of professional conduct' },
    { id: 'incompetence', label: 'Incompetence', description: 'Failure to perform duties effectively' },
    { id: 'constitutional_violation', label: 'Constitutional Violation', description: 'Breach of constitutional provisions' }
  ];

  const handleGroundsChange = (groundId: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      grounds: checked 
        ? [...prev.grounds, groundId]
        : prev.grounds.filter(g => g !== groundId)
    }));
  };

  const handleNext = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const validateStep = () => {
    switch (currentStep) {
      case 1:
        return formData.mpName.trim() && formData.constituency.trim() && formData.county.trim() && formData.deadline;
      case 2:
        return formData.grounds.length > 0;
      case 3:
        return formData.description.trim() && formData.signatureTarget > 0 && formData.wardTarget > 0;
      case 4:
        return true; // Review step
      default:
        return false;
    }
  };

  const calculateDefaultTargets = () => {
    // This would typically fetch from database based on constituency
    // For now, using placeholder values
    const estimatedVoters = 100000; // This should come from database
    const estimatedWards = 6; // This should come from database
    
    return {
      signatureTarget: Math.ceil(estimatedVoters * 0.3), // 30% of registered voters
      wardTarget: Math.ceil(estimatedWards * 0.5) // 50% of wards
    };
  };

  const handleSubmit = async () => {
    if (!validateStep()) {
      toast.error('Please complete all required fields');
      return;
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase
        .from('petitions')
        .insert([{
          mp_name: formData.mpName,
          constituency: formData.constituency,
          county: formData.county,
          description: formData.description,
          grounds: formData.grounds,
          signature_target: formData.signatureTarget,
          ward_target: formData.wardTarget,
          deadline: formData.deadline,
          status: 'active'
        }])
        .select();

      if (error) throw error;
      
      toast.success('Petition created successfully!');
      
      // Reset form
      setFormData({
        mpName: '',
        constituency: '',
        county: '',
        description: '',
        grounds: [],
        signatureTarget: 0,
        wardTarget: 0,
        deadline: ''
      });
      setCurrentStep(1);
      
    } catch (error) {
      console.error('Error creating petition:', error);
      toast.error('Failed to create petition. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Card className="border-green-200 dark:border-green-800 bg-white dark:bg-gray-900">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center text-green-900 dark:text-green-100">
            <FileText className="w-6 h-6 mr-2" />
            Create Recall Petition
          </CardTitle>
          <CardDescription className="text-green-700 dark:text-green-300">
            Step {currentStep} of {totalSteps} - Build your constitutional petition
          </CardDescription>
          <Progress value={progress} className="mt-4" />
        </CardHeader>
        <CardContent className="p-8">
          {/* Step 1: Basic Information */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <h3 className="text-xl font-semibold text-green-900 dark:text-green-100 mb-2">Basic Information</h3>
                <p className="text-green-700 dark:text-green-300">Provide details about the MP and petition timeline</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="mpName" className="text-green-800 dark:text-green-200">MP Name *</Label>
                  <Input
                    id="mpName"
                    value={formData.mpName}
                    onChange={(e) => setFormData(prev => ({ ...prev, mpName: e.target.value }))}
                    placeholder="Enter MP's full name"
                    className="border-green-200 dark:border-green-700 focus:border-green-500 dark:focus:border-green-400 bg-white dark:bg-gray-800"
                  />
                </div>
                
                <div>
                  <Label htmlFor="constituency" className="text-green-800 dark:text-green-200">Constituency *</Label>
                  <Input
                    id="constituency"
                    value={formData.constituency}
                    onChange={(e) => setFormData(prev => ({ ...prev, constituency: e.target.value }))}
                    placeholder="Enter constituency name"
                    className="border-green-200 dark:border-green-700 focus:border-green-500 dark:focus:border-green-400 bg-white dark:bg-gray-800"
                  />
                </div>
                
                <div>
                  <Label htmlFor="county" className="text-green-800 dark:text-green-200">County *</Label>
                  <Input
                    id="county"
                    value={formData.county}
                    onChange={(e) => setFormData(prev => ({ ...prev, county: e.target.value }))}
                    placeholder="Enter county name"
                    className="border-green-200 dark:border-green-700 focus:border-green-500 dark:focus:border-green-400 bg-white dark:bg-gray-800"
                  />
                </div>
                
                <div>
                  <Label htmlFor="deadline" className="text-green-800 dark:text-green-200">Petition Deadline *</Label>
                  <Input
                    id="deadline"
                    type="date"
                    value={formData.deadline}
                    onChange={(e) => setFormData(prev => ({ ...prev, deadline: e.target.value }))}
                    min={new Date().toISOString().split('T')[0]}
                    className="border-green-200 dark:border-green-700 focus:border-green-500 dark:focus:border-green-400 bg-white dark:bg-gray-800"
                  />
                  <p className="text-xs text-green-600 dark:text-green-400 mt-1">Must allow sufficient time for signature collection</p>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Grounds for Recall */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <h3 className="text-xl font-semibold text-green-900 dark:text-green-100 mb-2">Legal Grounds for Recall</h3>
                <p className="text-green-700 dark:text-green-300">Select all applicable constitutional violations (minimum 1 required)</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {availableGrounds.map((ground) => (
                  <div key={ground.id} className="flex items-start space-x-3 p-4 border border-green-200 dark:border-green-700 rounded-lg hover:bg-green-50/50 dark:hover:bg-green-950/20 transition-colors">
                    <Checkbox
                      id={ground.id}
                      checked={formData.grounds.includes(ground.id)}
                      onCheckedChange={(checked) => handleGroundsChange(ground.id, checked as boolean)}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <label htmlFor={ground.id} className="text-sm font-medium text-green-900 dark:text-green-100 cursor-pointer block">
                        {ground.label}
                      </label>
                      <p className="text-xs text-green-700 dark:text-green-300 mt-1">{ground.description}</p>
                    </div>
                  </div>
                ))}
              </div>

              {formData.grounds.length > 0 && (
                <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                  <h4 className="font-medium text-green-900 dark:text-green-100 mb-2">Selected Grounds:</h4>
                  <div className="flex flex-wrap gap-2">
                    {formData.grounds.map(groundId => {
                      const ground = availableGrounds.find(g => g.id === groundId);
                      return ground ? (
                        <span key={groundId} className="px-2 py-1 bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-200 rounded text-xs">
                          {ground.label}
                        </span>
                      ) : null;
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Petition Details */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <h3 className="text-xl font-semibold text-green-900 dark:text-green-100 mb-2">Petition Details</h3>
                <p className="text-green-700 dark:text-green-300">Provide detailed information and set collection targets</p>
              </div>
              
              <div>
                <Label htmlFor="description" className="text-green-800 dark:text-green-200">Detailed Description *</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Provide detailed reasons for the recall petition, including specific incidents, evidence, and impact on constituents..."
                  rows={6}
                  className="border-green-200 dark:border-green-700 focus:border-green-500 dark:focus:border-green-400 bg-white dark:bg-gray-800"
                />
                <p className="text-xs text-green-600 dark:text-green-400 mt-1">Be specific and factual. This will be public information.</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="signatureTarget" className="text-green-800 dark:text-green-200">Signature Target *</Label>
                  <Input
                    id="signatureTarget"
                    type="number"
                    value={formData.signatureTarget}
                    onChange={(e) => setFormData(prev => ({ ...prev, signatureTarget: parseInt(e.target.value) || 0 }))}
                    placeholder="Number of signatures needed"
                    min="1"
                    className="border-green-200 dark:border-green-700 focus:border-green-500 dark:focus:border-green-400 bg-white dark:bg-gray-800"
                  />
                  <p className="text-xs text-green-600 dark:text-green-400 mt-1">Minimum 30% of registered voters required by law</p>
                </div>
                
                <div>
                  <Label htmlFor="wardTarget" className="text-green-800 dark:text-green-200">Ward Coverage Target *</Label>
                  <Input
                    id="wardTarget"
                    type="number"
                    value={formData.wardTarget}
                    onChange={(e) => setFormData(prev => ({ ...prev, wardTarget: parseInt(e.target.value) || 0 }))}
                    placeholder="Number of wards to cover"
                    min="1"
                    className="border-green-200 dark:border-green-700 focus:border-green-500 dark:focus:border-green-400 bg-white dark:bg-gray-800"
                  />
                  <p className="text-xs text-green-600 dark:text-green-400 mt-1">Recommended: At least 50% of constituency wards</p>
                </div>
              </div>

              <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex items-start">
                  <AlertTriangle className="w-5 h-5 text-blue-600 dark:text-blue-400 mr-2 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-1">Constitutional Requirements</h4>
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                      Your petition must meet the legal threshold of 30% of registered voters and adequate ward distribution 
                      as required by the Constitution of Kenya 2010 and the Elections Act.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Review and Submit */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <h3 className="text-xl font-semibold text-green-900 dark:text-green-100 mb-2">Review Your Petition</h3>
                <p className="text-green-700 dark:text-green-300">Please review all details before submitting</p>
              </div>
              
              <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-4">
                  <div>
                    <strong className="text-green-900 dark:text-green-100">MP Name:</strong>
                    <p className="text-green-800 dark:text-green-200">{formData.mpName}</p>
                  </div>
                  <div>
                    <strong className="text-green-900 dark:text-green-100">Constituency:</strong>
                    <p className="text-green-800 dark:text-green-200">{formData.constituency}</p>
                  </div>
                  <div>
                    <strong className="text-green-900 dark:text-green-100">County:</strong>
                    <p className="text-green-800 dark:text-green-200">{formData.county}</p>
                  </div>
                  <div>
                    <strong className="text-green-900 dark:text-green-100">Deadline:</strong>
                    <p className="text-green-800 dark:text-green-200">{new Date(formData.deadline).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <strong className="text-green-900 dark:text-green-100">Signature Target:</strong>
                    <p className="text-green-800 dark:text-green-200">{formData.signatureTarget.toLocaleString()}</p>
                  </div>
                  <div>
                    <strong className="text-green-900 dark:text-green-100">Ward Target:</strong>
                    <p className="text-green-800 dark:text-green-200">{formData.wardTarget}</p>
                  </div>
                </div>
                
                <div className="mb-4">
                  <strong className="text-green-900 dark:text-green-100">Legal Grounds:</strong>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {formData.grounds.map(groundId => {
                      const ground = availableGrounds.find(g => g.id === groundId);
                      return ground ? (
                        <span key={groundId} className="px-2 py-1 bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-200 rounded text-xs">
                          {ground.label}
                        </span>
                      ) : null;
                    })}
                  </div>
                </div>
                
                <div>
                  <strong className="text-green-900 dark:text-green-100">Description:</strong>
                  <p className="mt-2 text-green-800 dark:text-green-200 text-sm leading-relaxed">{formData.description}</p>
                </div>
              </div>
              
              <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                <div className="flex items-start">
                  <Scale className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mr-2 mt-0.5" />
                  <div>
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                      <strong>Legal Declaration:</strong> By submitting this petition, you confirm that all information is accurate 
                      and that you have legal grounds for this recall as per Article 104 of the Constitution of Kenya 2010. 
                      False or malicious petitions may be subject to legal action.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between mt-8">
            <Button
              onClick={handlePrevious}
              disabled={currentStep === 1}
              variant="outline"
              className="border-green-600 dark:border-green-400 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950/20"
            >
              Previous
            </Button>
            
            {currentStep < totalSteps ? (
              <Button
                onClick={handleNext}
                disabled={!validateStep()}
                className="bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 text-white"
              >
                Next
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={!validateStep() || isSubmitting}
                className="bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 text-white"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Creating...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Create Petition
                  </>
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PetitionWizard;
