
import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, Shield, User, Phone, Mail, CreditCard, FileText, BookOpen, AlertTriangle } from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import SignatureCanvas from './SignatureCanvas';
import QRReceiptViewer from './QRReceiptViewer';
import { QRCodeService } from '@/utils/qrCodeService';
import { DeviceFingerprintService, DeviceFingerprint } from '@/utils/deviceFingerprintService';

interface SignatureData {
  petition_id: string;
  voter_name: string;
  identifier_type: 'national_id' | 'phone' | 'passport' | 'email' | 'other';
  identifier_value: string;
  constituency: string;
  ward: string;
  phone_number?: string;
  email_address?: string;
  signature_svg?: string;
  stroke_data?: any[];
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
    ward: '',
    phone_number: '',
    email_address: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deviceFingerprint, setDeviceFingerprint] = useState<DeviceFingerprint | null>(null);
  const [qrReceipt, setQrReceipt] = useState<{
    qrCode: string;
    receiptCode: string;
    receiptData: any;
  } | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [duplicateCheck, setDuplicateCheck] = useState<{
    checking: boolean;
    isDuplicate: boolean;
    message: string;
  }>({ checking: false, isDuplicate: false, message: '' });

  const identifierTypes = [
    { value: 'national_id', label: 'National ID', icon: CreditCard, placeholder: 'Enter your National ID number' },
    { value: 'phone', label: 'Phone Number', icon: Phone, placeholder: 'Enter your phone number (+254...)' },
    { value: 'passport', label: 'Passport', icon: BookOpen, placeholder: 'Enter your passport number' },
    { value: 'email', label: 'Email Address', icon: Mail, placeholder: 'Enter your email address' },
    { value: 'other', label: 'Other ID', icon: User, placeholder: 'Enter your identification' }
  ];

  // Generate device fingerprint on component mount
  useEffect(() => {
    const generateFingerprint = async () => {
      try {
        const fingerprint = await DeviceFingerprintService.generateFingerprint();
        setDeviceFingerprint(fingerprint);
      } catch (error) {
        console.error('Error generating device fingerprint:', error);
      }
    };

    generateFingerprint();
  }, []);

  const handleInputChange = (field: keyof SignatureData, value: string) => {
    setSignatureData(prev => ({ ...prev, [field]: value }));
  };

  const checkForDuplicates = async () => {
    if (!deviceFingerprint || !signatureData.petition_id || !signatureData.constituency || !signatureData.ward) {
      return;
    }

    setDuplicateCheck({ checking: true, isDuplicate: false, message: 'Checking for duplicates...' });

    try {
      // Check device fingerprint duplicate
      const deviceCheck = await DeviceFingerprintService.checkDuplicateDevice(
        deviceFingerprint,
        signatureData.petition_id,
        signatureData.constituency,
        signatureData.ward
      );

      if (deviceCheck.isDuplicate) {
        setDuplicateCheck({
          checking: false,
          isDuplicate: true,
          message: 'This device has already been used to sign this petition from your location.'
        });
        return;
      }

      // Check identity duplicate
      const { data: existingSignatures } = await supabase
        .from('signatures')
        .select('id, voter_name')
        .eq('petition_id', signatureData.petition_id)
        .eq('voter_id', signatureData.identifier_value)
        .eq('constituency', signatureData.constituency)
        .eq('ward', signatureData.ward);

      if (existingSignatures && existingSignatures.length > 0) {
        setDuplicateCheck({
          checking: false,
          isDuplicate: true,
          message: `You have already signed this petition. Previous signature by: ${existingSignatures[0].voter_name}`
        });
        return;
      }

      // Check name + location duplicate
      const { data: nameSignatures } = await supabase
        .from('signatures')
        .select('id, voter_id')
        .eq('petition_id', signatureData.petition_id)
        .eq('voter_name', signatureData.voter_name)
        .eq('constituency', signatureData.constituency)
        .eq('ward', signatureData.ward);

      if (nameSignatures && nameSignatures.length > 0) {
        setDuplicateCheck({
          checking: false,
          isDuplicate: true,
          message: 'A signature with your name already exists from this location for this petition.'
        });
        return;
      }

      setDuplicateCheck({
        checking: false,
        isDuplicate: false,
        message: 'No duplicates found. You can proceed with signing.'
      });

    } catch (error) {
      console.error('Error checking duplicates:', error);
      setDuplicateCheck({
        checking: false,
        isDuplicate: false,
        message: 'Unable to verify duplicates. Proceeding with caution.'
      });
    }
  };

  const handleNext = () => {
    if (step === 3) {
      checkForDuplicates();
    }
    if (step < 5) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const validateStep = () => {
    switch (step) {
      case 1:
        return signatureData.voter_name.trim().length > 0;
      case 2:
        const isEmailValid = signatureData.identifier_type === 'email' ? 
          /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(signatureData.identifier_value) : true;
        const isPhoneValid = signatureData.identifier_type === 'phone' ? 
          /^\+254\d{9}$/.test(signatureData.identifier_value) : true;
        return signatureData.identifier_value.trim().length > 0 && isEmailValid && isPhoneValid;
      case 3:
        return signatureData.constituency.trim().length > 0 && signatureData.ward.trim().length > 0;
      case 4:
        return !duplicateCheck.isDuplicate && signatureData.signature_svg !== undefined;
      case 5:
        return true;
      default:
        return false;
    }
  };

  const handleSignatureComplete = (signatureSvg: string, strokeData: any[]) => {
    setSignatureData(prev => ({
      ...prev,
      signature_svg: signatureSvg,
      stroke_data: strokeData
    }));
  };

  const handleSubmit = async () => {
    if (!validateStep() || !deviceFingerprint) {
      toast.error('Please complete all required fields');
      return;
    }

    if (!signatureData.petition_id || signatureData.petition_id.trim() === '') {
      toast.error('Invalid petition ID');
      return;
    }

    setIsSubmitting(true);
    try {
      const fingerprintHash = DeviceFingerprintService.generateFingerprintHash(deviceFingerprint);
      
      // Insert signature with enhanced data
      const { data: signature, error } = await supabase
        .from('signatures')
        .insert({
          petition_id: signatureData.petition_id,
          voter_id: signatureData.identifier_value,
          voter_name: signatureData.voter_name,
          constituency: signatureData.constituency,
          ward: signatureData.ward,
          csp_provider: 'enhanced_flow_v2',
          verification_status: {
            verified: true,
            timestamp: new Date().toISOString(),
            method: signatureData.identifier_type,
            phone_number: signatureData.phone_number,
            email_address: signatureData.email_address,
            signature_quality: {
              stroke_count: signatureData.stroke_data?.length || 0,
              has_signature_image: !!signatureData.signature_svg
            }
          },
          device_fingerprint: {
            hash: fingerprintHash,
            timestamp: new Date().toISOString(),
            visitor_id: deviceFingerprint.visitorId,
            platform: deviceFingerprint.platform,
            screen_resolution: deviceFingerprint.screenResolution,
            timezone: deviceFingerprint.timezone
          },
          signature_certificate: `CERT_ENH_${Date.now()}_${fingerprintHash.substring(0, 8)}`
        })
        .select()
        .single();

      if (error) throw error;

      // Generate QR receipt
      const receipt = await QRCodeService.generateQRReceipt({
        signatureId: signature.id,
        petitionId: signatureData.petition_id,
        voterName: signatureData.voter_name,
        voterPhone: signatureData.phone_number || '',
        constituency: signatureData.constituency,
        ward: signatureData.ward
      });

      setQrReceipt(receipt);
      setShowSuccess(true);
      onComplete?.(receipt.receiptCode);
      toast.success('Digital signature recorded successfully!');

    } catch (error) {
      console.error('Error submitting signature:', error);
      toast.error('Failed to submit signature. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRenewSignature = async () => {
    if (!qrReceipt) return;

    try {
      const result = await QRCodeService.renewSignature(qrReceipt.receiptCode);
      if (result.success && result.newReceiptCode) {
        toast.success('Signature renewed successfully!');
        // Update the QR receipt with new code
        setQrReceipt(prev => prev ? {
          ...prev,
          receiptCode: result.newReceiptCode!
        } : null);
      } else {
        toast.error(result.error || 'Failed to renew signature');
      }
    } catch (error) {
      toast.error('Failed to renew signature');
    }
  };

  const handleEmailReceipt = async () => {
    if (!qrReceipt || !signatureData.email_address) return;
    
    // This would integrate with an email service
    toast.success('Receipt email sent!');
  };

  const getSelectedIdentifierType = () => {
    return identifierTypes.find(type => type.value === signatureData.identifier_type);
  };

  if (showSuccess && qrReceipt) {
    return (
      <QRReceiptViewer
        qrCode={qrReceipt.qrCode}
        receiptCode={qrReceipt.receiptCode}
        receiptData={qrReceipt.receiptData}
        voterName={signatureData.voter_name}
        voterEmail={signatureData.email_address}
        onRenew={handleRenewSignature}
        onEmailReceipt={signatureData.email_address ? handleEmailReceipt : undefined}
      />
    );
  }

  // Show selection message if no petition ID
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
              Please select an active petition from the dashboard to begin the enhanced signing process.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-2xl mx-auto bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
      <CardHeader>
        <CardTitle className="text-gray-900 dark:text-white">
          Enhanced Digital Signature {petitionTitle && `- ${petitionTitle}`}
        </CardTitle>
        <div className="flex space-x-2">
          {[1, 2, 3, 4, 5].map((i) => (
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
        {/* Step 1: Personal Information */}
        {step === 1 && (
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Personal Information</h3>
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

        {/* Step 2: Identification Method */}
        {step === 2 && (
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Identification Method</h3>
            <div>
              <Label className="text-gray-700 dark:text-gray-300">Primary Identification *</Label>
              <Select
                value={signatureData.identifier_type}
                onValueChange={(value: any) => {
                  handleInputChange('identifier_type', value);
                  handleInputChange('identifier_value', '');
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
            </div>

            {/* Optional contact information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div>
                <Label htmlFor="phone_number" className="text-gray-700 dark:text-gray-300">Phone Number (Optional)</Label>
                <Input
                  id="phone_number"
                  type="tel"
                  placeholder="+254..."
                  value={signatureData.phone_number}
                  onChange={(e) => handleInputChange('phone_number', e.target.value)}
                  className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <Label htmlFor="email_address" className="text-gray-700 dark:text-gray-300">Email Address (Optional)</Label>
                <Input
                  id="email_address"
                  type="email"
                  placeholder="your@email.com"
                  value={signatureData.email_address}
                  onChange={(e) => handleInputChange('email_address', e.target.value)}
                  className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Location */}
        {step === 3 && (
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Electoral Location</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            </div>
          </div>
        )}

        {/* Step 4: Fraud Detection & Signature Capture */}
        {step === 4 && (
          <div className="space-y-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Signature Capture & Verification</h3>
            
            {/* Duplicate Check Status */}
            {duplicateCheck.checking && (
              <Alert className="border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/20">
                <AlertDescription className="text-blue-800 dark:text-blue-200">
                  {duplicateCheck.message}
                </AlertDescription>
              </Alert>
            )}

            {duplicateCheck.isDuplicate && (
              <Alert className="border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-950/20">
                <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                <AlertDescription className="text-red-800 dark:text-red-200">
                  <strong>Duplicate Detected:</strong> {duplicateCheck.message}
                </AlertDescription>
              </Alert>
            )}

            {!duplicateCheck.isDuplicate && !duplicateCheck.checking && (
              <>
                {duplicateCheck.message && (
                  <Alert className="border-green-200 dark:border-green-700 bg-green-50 dark:bg-green-950/20">
                    <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                    <AlertDescription className="text-green-800 dark:text-green-200">
                      {duplicateCheck.message}
                    </AlertDescription>
                  </Alert>
                )}

                <SignatureCanvas 
                  onSignatureComplete={handleSignatureComplete}
                  disabled={duplicateCheck.isDuplicate}
                />
              </>
            )}
          </div>
        )}

        {/* Step 5: Final Confirmation */}
        {step === 5 && (
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Final Confirmation</h3>
            
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 space-y-3">
              <div><strong>Name:</strong> {signatureData.voter_name}</div>
              <div><strong>ID:</strong> {signatureData.identifier_value}</div>
              <div><strong>Location:</strong> {signatureData.ward}, {signatureData.constituency}</div>
              {signatureData.phone_number && (
                <div><strong>Phone:</strong> {signatureData.phone_number}</div>
              )}
              {signatureData.email_address && (
                <div><strong>Email:</strong> {signatureData.email_address}</div>
              )}
            </div>

            <Alert className="border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/20">
              <Shield className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <AlertDescription className="text-blue-800 dark:text-blue-200">
                By proceeding, you confirm that you are a registered voter and support this recall petition 
                as per your constitutional right under Article 104. Your signature will be legally binding and 
                secured with a 60-day expiration period.
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* Navigation Buttons */}
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
          
          {step < 5 ? (
            <Button 
              onClick={handleNext}
              disabled={!validateStep() || duplicateCheck.checking}
              className="flex-1 bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 text-white"
            >
              {duplicateCheck.checking ? 'Checking...' : 'Next'}
            </Button>
          ) : (
            <Button 
              onClick={handleSubmit}
              disabled={!validateStep() || isSubmitting}
              className="flex-1 bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 text-white"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Enhanced Signature'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default EnhancedSignatureFlow;
