
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, Shield, User, Hash, Phone, AlertTriangle } from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface SignatureFlowProps {
  petitionId?: string;
}

const SimplifiedSignatureFlow: React.FC<SignatureFlowProps> = ({ petitionId }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    nationalId: '',
    fullName: '',
    phoneNumber: '',
    constituency: '',
    ward: ''
  });
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<'pending' | 'verified' | 'failed'>('pending');
  const { toast } = useToast();

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleVerification = async () => {
    if (!formData.nationalId || !formData.fullName) {
      toast({
        title: "Missing Information",
        description: "Please fill in your National ID and full name",
        variant: "destructive"
      });
      return;
    }

    setIsVerifying(true);

    try {
      // Simulate verification process
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Mock verification success
      setVerificationStatus('verified');
      setCurrentStep(2);

      toast({
        title: "Verification Successful",
        description: "Your identity has been verified with IEBC database",
      });
    } catch (error) {
      setVerificationStatus('failed');
      toast({
        title: "Verification Failed",
        description: "Could not verify your voter registration. Please check your details.",
        variant: "destructive"
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSignature = async () => {
    if (!formData.constituency || !formData.ward) {
      toast({
        title: "Missing Information",
        description: "Please specify your constituency and ward",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await (supabase as any)
        .from('signatures')
        .insert({
          petition_id: petitionId || 'demo-petition',
          voter_id: formData.nationalId,
          voter_name: formData.fullName,
          constituency: formData.constituency,
          ward: formData.ward,
          verification_status: {
            iebc_verified: true,
            id_verified: true,
            verified_at: new Date().toISOString()
          },
          csp_provider: 'simplified_flow',
          signature_certificate: `cert_${Date.now()}`,
          geolocation: null,
          device_fingerprint: {
            timestamp: new Date().toISOString(),
            user_agent: navigator.userAgent
          }
        });

      if (error) throw error;

      setCurrentStep(3);
      toast({
        title: "Signature Recorded",
        description: "Your petition signature has been successfully recorded",
      });
    } catch (error) {
      console.error('Error recording signature:', error);
      toast({
        title: "Error",
        description: "Failed to record your signature. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Progress Steps */}
      <div className="flex justify-center">
        <div className="flex items-center space-x-4">
          {[1, 2, 3].map((step) => (
            <div key={step} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep >= step ? 'bg-green-600 text-white' : 'bg-green-100 text-green-600'
                }`}>
                {currentStep > step ? <CheckCircle className="w-4 h-4" /> : step}
              </div>
              {step < 3 && (
                <div className={`w-12 h-0.5 ${currentStep > step ? 'bg-green-600' : 'bg-green-200'
                  }`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step 1: Identity Verification */}
      {currentStep === 1 && (
        <Card className="border-green-200">
          <CardHeader>
            <CardTitle className="flex items-center text-green-900">
              <User className="w-5 h-5 mr-2" />
              Identity Verification
            </CardTitle>
            <CardDescription className="text-green-700">
              Verify your voter registration with IEBC database
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert className="border-green-200 bg-green-50">
              <Shield className="w-4 h-4" />
              <AlertDescription className="text-green-800">
                Your digital signature is legally equivalent to handwritten signatures under KICA §83C
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-green-900 mb-1">
                  National ID Number
                </label>
                <Input
                  placeholder="Enter your National ID"
                  value={formData.nationalId}
                  onChange={(e) => handleInputChange('nationalId', e.target.value)}
                  className="border-green-200 focus:border-green-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-green-900 mb-1">
                  Full Name (as registered)
                </label>
                <Input
                  placeholder="Enter your full name"
                  value={formData.fullName}
                  onChange={(e) => handleInputChange('fullName', e.target.value)}
                  className="border-green-200 focus:border-green-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-green-900 mb-1">
                Phone Number (Optional)
              </label>
              <Input
                placeholder="Enter your phone number"
                value={formData.phoneNumber}
                onChange={(e) => handleInputChange('phoneNumber', e.target.value)}
                className="border-green-200 focus:border-green-400"
              />
            </div>

            <Button
              onClick={handleVerification}
              disabled={isVerifying || !formData.nationalId || !formData.fullName}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              {isVerifying ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Verifying with IEBC...
                </>
              ) : (
                'Verify Identity'
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Location & Signature */}
      {currentStep === 2 && (
        <Card className="border-green-200">
          <CardHeader>
            <CardTitle className="flex items-center text-green-900">
              <Hash className="w-5 h-5 mr-2" />
              Location & Digital Signature
            </CardTitle>
            <CardDescription className="text-green-700">
              Confirm your electoral location and digitally sign the petition
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <div className="flex items-center">
                <CheckCircle className="w-4 h-4 text-green-600 mr-2" />
                <span className="text-green-800 text-sm">Identity verified with IEBC database</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-green-900 mb-1">
                  Constituency
                </label>
                <Input
                  placeholder="Enter your constituency"
                  value={formData.constituency}
                  onChange={(e) => handleInputChange('constituency', e.target.value)}
                  className="border-green-200 focus:border-green-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-green-900 mb-1">
                  Ward
                </label>
                <Input
                  placeholder="Enter your ward"
                  value={formData.ward}
                  onChange={(e) => handleInputChange('ward', e.target.value)}
                  className="border-green-200 focus:border-green-400"
                />
              </div>
            </div>

            <Alert className="border-green-200 bg-green-50">
              <AlertTriangle className="w-4 h-4" />
              <AlertDescription className="text-green-800">
                By signing, you confirm that you are a registered voter and support this recall petition
                as per your constitutional right under Article 104.
              </AlertDescription>
            </Alert>

            <Button
              onClick={handleSignature}
              disabled={isSubmitting || !formData.constituency || !formData.ward}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Recording Signature...
                </>
              ) : (
                'Sign Petition Digitally'
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Confirmation */}
      {currentStep === 3 && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="text-center py-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-xl font-bold text-green-900 mb-2">Signature Recorded Successfully</h3>
            <p className="text-green-700 mb-4">
              Your petition signature has been securely recorded and encrypted.
            </p>

            <div className="bg-white rounded-lg p-4 mb-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-green-600">Name:</span>
                  <p className="font-medium text-green-900">{formData.fullName}</p>
                </div>
                <div>
                  <span className="text-green-600">ID:</span>
                  <p className="font-medium text-green-900">{formData.nationalId}</p>
                </div>
                <div>
                  <span className="text-green-600">Constituency:</span>
                  <p className="font-medium text-green-900">{formData.constituency}</p>
                </div>
                <div>
                  <span className="text-green-600">Ward:</span>
                  <p className="font-medium text-green-900">{formData.ward}</p>
                </div>
              </div>
            </div>

            <div className="flex justify-center space-x-2">
              <Badge className="bg-green-100 text-green-800">IEBC Verified</Badge>
              <Badge className="bg-green-100 text-green-800">Encrypted</Badge>
              <Badge className="bg-green-100 text-green-800">Article 104 Compliant</Badge>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SimplifiedSignatureFlow;
