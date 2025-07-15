
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { QrCode, Search, CheckCircle, XCircle, Calendar, MapPin, User } from 'lucide-react';
import { QRCodeService } from '@/utils/qrCodeService';

const QRVerificationPage: React.FC = () => {
  const [receiptCode, setReceiptCode] = useState('');
  const [lastFourDigits, setLastFourDigits] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{
    isValid: boolean;
    data?: any;
    error?: string;
  } | null>(null);

  const handleVerify = async () => {
    if (!receiptCode.trim() || !lastFourDigits.trim()) {
      setVerificationResult({
        isValid: false,
        error: 'Please enter both receipt code and verification digits'
      });
      return;
    }

    setIsVerifying(true);
    try {
      const result = await QRCodeService.verifyQRReceipt(receiptCode, lastFourDigits);
      setVerificationResult(result);
    } catch (error) {
      setVerificationResult({
        isValid: false,
        error: 'Verification failed. Please try again.'
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-KE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-white dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl border-green-200 dark:border-green-700">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
            <QrCode className="w-8 h-8 text-green-600 dark:text-green-400" />
          </div>
          <CardTitle className="text-green-900 dark:text-green-100">
            Verify Petition Signature
          </CardTitle>
          <p className="text-green-700 dark:text-green-300">
            Enter your receipt code to verify your petition signature
          </p>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div>
              <Label htmlFor="receiptCode" className="text-gray-700 dark:text-gray-300">
                Receipt Code *
              </Label>
              <Input
                id="receiptCode"
                type="text"
                placeholder="REC254-XXXXXXXX-XXXXXXXXXXXX-XXXXXX"
                value={receiptCode}
                onChange={(e) => setReceiptCode(e.target.value.toUpperCase())}
                className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white font-mono"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Enter the full receipt code from your QR receipt
              </p>
            </div>

            <div>
              <Label htmlFor="lastFourDigits" className="text-gray-700 dark:text-gray-300">
                Last 4 Digits of ID *
              </Label>
              <Input
                id="lastFourDigits"
                type="text"
                placeholder="XXXX"
                maxLength={4}
                value={lastFourDigits}
                onChange={(e) => setLastFourDigits(e.target.value)}
                className="bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Enter the last 4 digits/characters of your identification document
              </p>
            </div>
          </div>

          <Button
            onClick={handleVerify}
            disabled={isVerifying || !receiptCode.trim() || !lastFourDigits.trim()}
            className="w-full bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 text-white"
          >
            {isVerifying ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Verifying...
              </>
            ) : (
              <>
                <Search className="w-4 h-4 mr-2" />
                Verify Signature
              </>
            )}
          </Button>

          {/* Verification Results */}
          {verificationResult && (
            <div className="space-y-4">
              {verificationResult.isValid ? (
                <Alert className="border-green-200 dark:border-green-700 bg-green-50 dark:bg-green-950/20">
                  <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                  <AlertDescription className="text-green-800 dark:text-green-200">
                    <strong>Signature Verified!</strong> Your petition signature is valid and recorded.
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert className="border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-950/20">
                  <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                  <AlertDescription className="text-red-800 dark:text-red-200">
                    <strong>Verification Failed:</strong> {verificationResult.error}
                  </AlertDescription>
                </Alert>
              )}

              {verificationResult.isValid && verificationResult.data && (
                <Card className="border-green-200 dark:border-green-700 bg-green-50/50 dark:bg-green-950/10">
                  <CardHeader>
                    <CardTitle className="text-green-900 dark:text-green-100 text-lg">
                      Signature Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex items-center space-x-2">
                        <MapPin className="w-4 h-4 text-gray-500" />
                        <div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">Location</div>
                          <div className="font-medium">
                            {verificationResult.data.ward}, {verificationResult.data.constituency}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Calendar className="w-4 h-4 text-gray-500" />
                        <div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">Signed At</div>
                          <div className="font-medium">{formatDate(verificationResult.data.timestamp)}</div>
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-green-200 dark:border-green-700">
                      <div className="text-sm text-gray-600 dark:text-gray-400">System Code</div>
                      <div className="font-mono text-sm">{verificationResult.data.systemCode}</div>
                    </div>

                    <div className="text-sm text-green-700 dark:text-green-300">
                      Valid until: {formatDate(verificationResult.data.expiresAt)}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          <Alert className="border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/20">
            <AlertDescription className="text-blue-800 dark:text-blue-200 text-sm">
              <strong>Privacy Protected:</strong> We only store encrypted fingerprints of your data. 
              Your verification request is logged for security but your personal information remains confidential.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
};

export default QRVerificationPage;
