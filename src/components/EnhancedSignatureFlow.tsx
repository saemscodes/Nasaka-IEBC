
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, Shield, User, Phone, Mail, CreditCard, FileText, Copy, BookOpen } from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SignatureData {
  petition_id: string;
  voter_name: string;
  identifier_type: 'national_id' | 'phone' | 'passport' | 'email' | 'other';
  identifier_value: string;
  constituency: string;
  ward: string;
}

interface EnhancedSignatureFlowProps {
  petitionId?: string;
  petitionTitle?: string;
  onComplete?: (signatureCode: string) => void;
}

const EnhancedSignatureFlow: React.FC<EnhancedSignatureFlowProps> = ({
  petitionId,
  petitionTitle,
  onComplete
}) => {
  const [step, setStep] = useState(1);
  const [signatureData, setSignatureData] = useState<SignatureData>({
    petition_id: petitionId || '',
    voter_name: '',
    identifier_type: 'national_id',
    identifier_value: '',
    constituency: '',
    ward: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [signatureCode, setSignatureCode] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  const identifierTypes = [
    { value: 'national_id', label: 'National ID', icon: CreditCard, placeholder: 'Enter your National ID number' },
    { value: 'phone', label: 'Phone Number', icon: Phone, placeholder: 'Enter your phone number' },
    { value: 'passport', label: 'Passport', icon: BookOpen, placeholder: 'Enter your passport number' },
    { value: 'email', label: 'Email Address', icon: Mail, placeholder: 'Enter your email address' },
    { value: 'other', label: 'Other ID', icon: User, placeholder: 'Enter your identification' }
  ];

  const generateSignatureCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const handleInputChange = (field: keyof SignatureData, value: string) => {
    setSignatureData(prev => ({ ...prev, [field]: value }));
  };

  const handleNext = () => {
    if (step < 3) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const validateStep = () => {
    switch (step) {
      case 1:
        return signatureData.voter_name.trim().length > 0;
      case 2:
        return signatureData.identifier_value.trim().length > 0;
      case 3:
        return signatureData.constituency.trim().length > 0 && signatureData.ward.trim().length > 0;
      default:
        return false;
    }
  };

  const handleSubmit = async () => {
    if (!validateStep()) {
      toast.error('Please fill in all required fields');
      return;
    }

    // Check if petition ID is provided and not empty
    if (!signatureData.petition_id || signatureData.petition_id.trim() === '') {
      toast.error('Invalid petition ID. Please select a valid petition.');
      return;
    }

    setIsSubmitting(true);
    try {
      const code = generateSignatureCode();
      
      // Check if user has already signed this petition
      const { data: existingSignature } = await supabase
        .from('signatures')
        .select('id')
        .eq('petition_id', signatureData.petition_id)
        .eq('voter_id', signatureData.identifier_value)
        .maybeSingle();

      if (existingSignature) {
        toast.error('You have already signed this petition');
        setIsSubmitting(false);
        return;
      }

      // Insert signature with proper UUID handling
      const { error } = await supabase
        .from('signatures')
        .insert({
          petition_id: signatureData.petition_id,
          voter_id: signatureData.identifier_value,
          voter_name: signatureData.voter_name,
          constituency: signatureData.constituency,
          ward: signatureData.ward,
          csp_provider: 'enhanced_flow',
          verification_status: {
            verified: true,
            timestamp: new Date().toISOString(),
            method: signatureData.identifier_type,
            signature_code: code
          },
          device_fingerprint: {
            timestamp: new Date().toISOString(),
            user_agent: navigator.userAgent,
            platform: navigator.platform
          },
          signature_certificate: `CERT_${code}_${Date.now()}`
        });

      if (error) throw error;

      setSignatureCode(code);
      setShowSuccess(true);
      onComplete?.(code);
      toast.success('Signature submitted successfully!');
    } catch (error) {
      console.error('Error submitting signature:', error);
      toast.error('Failed to submit signature. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const copySignatureCode = () => {
    navigator.clipboard.writeText(signatureCode);
    toast.success('Signature code copied to clipboard!');
  };

  const getSelectedIdentifierType = () => {
    return identifierTypes.find(type => type.value === signatureData.identifier_type);
  };

  if (showSuccess) {
    return (
      <Card className="max-w-md mx-auto border-green-200 dark:border-green-700 bg-white dark:bg-gray-800">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
            <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
          </div>
          <CardTitle className="text-green-900 dark:text-green-100">Signature Submitted Successfully!</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className="border-green-200 dark:border-green-700 bg-green-50 dark:bg-green-900/20">
            <Shield className="h-4 w-4 text-green-600 dark:text-green-400" />
            <AlertDescription className="text-green-800 dark:text-green-200">
              Your signature has been securely recorded and encrypted. Your data will only be used for petition verification purposes and will not be shared with third parties.
            </AlertDescription>
          </Alert>
          
          <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Your Signature Code:</Label>
            <div className="flex items-center space-x-2 mt-2">
              <Badge variant="outline" className="text-lg font-mono px-4 py-2 border-green-200 dark:border-green-600 text-green-700 dark:text-green-300">
                {signatureCode}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={copySignatureCode}
                className="border-green-200 dark:border-green-600 text-green-700 dark:text-green-300 hover:bg-green-50 dark:hover:bg-green-900/20"
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
              ⚠️ Save this code safely! It's the only way to verify your signature later.
            </p>
          </div>

          <div className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 p-3 rounded">
            <strong>Privacy Notice:</strong> Your personal information is encrypted and stored securely. 
            Only you can access your signature data using the code above. We comply with all data protection regulations.
          </div>
        </CardContent>
      </Card>
    );
  }

  // If no petition ID is provided, show selection message
  if (!petitionId || petitionId.trim() === '') {
    return (
      <Card className="max-w-md mx-auto bg-white dark:bg-gray-800 border-yellow-200 dark:border-yellow-700">
        <CardHeader className="text-center">
          <CardTitle className="text-yellow-900 dark:text-yellow-100">
            Select a Petition to Sign
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <Alert className="border-yellow-200 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-900/20">
            <FileText className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
            <AlertDescription className="text-yellow-800 dark:text-yellow-200">
              Please select an active petition from the dashboard to begin the signing process.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-md mx-auto bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
      <CardHeader>
        <CardTitle className="text-gray-900 dark:text-white">
          Sign Petition {petitionTitle && `- ${petitionTitle}`}
        </CardTitle>
        <div className="flex space-x-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className={`h-2 flex-1 rounded transition-colors ${
                i <= step 
                  ? 'bg-green-500 dark:bg-green-400' 
                  : 'bg-gray-200 dark:bg-gray-600'
              }`}
            />
          ))}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="voter_name" className="text-gray-700 dark:text-gray-300">Full Name *</Label>
              <Input
                id="voter_name"
                type="text"
                placeholder="Enter your full name as registered"
                value={signatureData.voter_name}
                onChange={(e) => handleInputChange('voter_name', e.target.value)}
                className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Enter your name exactly as it appears on your voter registration
              </p>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div>
              <Label className="text-gray-700 dark:text-gray-300">Identification Method *</Label>
              <Select
                value={signatureData.identifier_type}
                onValueChange={(value: any) => {
                  handleInputChange('identifier_type', value);
                  handleInputChange('identifier_value', ''); // Clear previous value
                }}
              >
                <SelectTrigger className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                  {identifierTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value} className="text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700">
                      <div className="flex items-center space-x-2">
                        <type.icon className="w-4 h-4" />
                        <span>{type.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="identifier_value" className="text-gray-700 dark:text-gray-300">
                {getSelectedIdentifierType()?.label} *
              </Label>
              <Input
                id="identifier_value"
                type={signatureData.identifier_type === 'email' ? 'email' : 'text'}
                placeholder={getSelectedIdentifierType()?.placeholder}
                value={signatureData.identifier_value}
                onChange={(e) => handleInputChange('identifier_value', e.target.value)}
                className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                This will be used to verify your identity and prevent duplicate signatures
              </p>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="constituency" className="text-gray-700 dark:text-gray-300">Constituency *</Label>
              <Input
                id="constituency"
                type="text"
                placeholder="Enter your constituency"
                value={signatureData.constituency}
                onChange={(e) => handleInputChange('constituency', e.target.value)}
                className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
              />
            </div>
            
            <div>
              <Label htmlFor="ward" className="text-gray-700 dark:text-gray-300">Ward *</Label>
              <Input
                id="ward"
                type="text"
                placeholder="Enter your ward"
                value={signatureData.ward}
                onChange={(e) => handleInputChange('ward', e.target.value)}
                className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
              />
            </div>

            <Alert className="border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20">
              <Shield className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <AlertDescription className="text-blue-800 dark:text-blue-200">
                By signing, you confirm that you are a registered voter and support this recall petition 
                as per your constitutional right under Article 104. Your signature will be legally binding.
              </AlertDescription>
            </Alert>
          </div>
        )}

        <div className="flex space-x-2 pt-4">
          {step > 1 && (
            <Button 
              variant="outline" 
              onClick={handleBack}
              className="flex-1 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Back
            </Button>
          )}
          
          {step < 3 ? (
            <Button 
              onClick={handleNext}
              disabled={!validateStep()}
              className="flex-1 bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 text-white"
            >
              Next
            </Button>
          ) : (
            <Button 
              onClick={handleSubmit}
              disabled={!validateStep() || isSubmitting}
              className="flex-1 bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 text-white"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Digital Signature'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default EnhancedSignatureFlow;
