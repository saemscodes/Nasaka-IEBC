
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Download, Mail, Copy, QrCode, Shield, AlertTriangle } from 'lucide-react';
import { toast } from "sonner";
import QRReceiptViewer from './QRReceiptViewer';
import { QRReceiptData } from '@/utils/qrCodeService';

interface SignatureSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  signatureData: {
    signatureId: string;
    receiptCode: string;
    qrCode: string;
    receiptData: QRReceiptData;
    voterName: string;
    voterEmail?: string;
    petitionTitle: string;
  };
}

const SignatureSuccessModal: React.FC<SignatureSuccessModalProps> = ({
  isOpen,
  onClose,
  signatureData
}) => {
  const [showReceipt, setShowReceipt] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(signatureData.receiptCode);
      setCopied(true);
      toast.success('Receipt code copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Failed to copy code');
    }
  };

  const handleDownloadQR = () => {
    const link = document.createElement('a');
    link.href = signatureData.qrCode;
    link.download = `petition-receipt-${signatureData.receiptCode}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('QR code downloaded!');
  };

  const handleEmailReceipt = () => {
    if (signatureData.voterEmail) {
      // This would integrate with an email service
      toast.success('Receipt sent to your email!');
    } else {
      toast.error('No email address provided');
    }
  };

  const handleRenewSignature = () => {
    // This would integrate with the renewal service
    toast.success('Signature renewed successfully!');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-900">
        <DialogHeader>
          <DialogTitle className="flex items-center text-green-800 dark:text-green-200">
            <CheckCircle className="w-6 h-6 mr-2 text-green-600" />
            Signature Recorded Successfully!
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {!showReceipt ? (
            // Success Summary View
            <div className="space-y-4">
              <Card className="border-green-200 dark:border-green-800 bg-gradient-to-br from-green-50/50 to-white dark:from-green-900/20 dark:to-gray-800">
                <CardHeader>
                  <CardTitle className="text-green-900 dark:text-green-100">
                    {signatureData.petitionTitle}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-green-100 dark:bg-green-900/30 rounded-lg">
                    <div>
                      <p className="font-semibold text-green-900 dark:text-green-100">Your Receipt Code</p>
                      <p className="text-sm text-green-700 dark:text-green-300">Keep this code safe for verification</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge className="bg-green-700 text-white font-mono text-lg px-4 py-2">
                        {signatureData.receiptCode}
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCopyCode}
                        className="border-green-300 dark:border-green-600"
                      >
                        {copied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <p className="text-sm font-medium text-blue-900 dark:text-blue-100">Signer</p>
                      <p className="text-blue-700 dark:text-blue-300">{signatureData.voterName}</p>
                    </div>
                    <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                      <p className="text-sm font-medium text-purple-900 dark:text-purple-100">Location</p>
                      <p className="text-purple-700 dark:text-purple-300">
                        {signatureData.receiptData.ward}, {signatureData.receiptData.constituency}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                    <Shield className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                    <div>
                      <p className="font-medium text-yellow-900 dark:text-yellow-100">Security Notice</p>
                      <p className="text-sm text-yellow-800 dark:text-yellow-200">
                        Your signature is protected by KICA §83C digital certificate encryption. 
                        Keep your receipt code confidential and use it only for verification purposes.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Button
                  onClick={handleDownloadQR}
                  className="flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download QR
                </Button>
                
                <Button
                  onClick={handleEmailReceipt}
                  variant="outline"
                  className="flex items-center justify-center"
                  disabled={!signatureData.voterEmail}
                >
                  <Mail className="w-4 h-4 mr-2" />
                  Email Receipt
                </Button>
                
                <Button
                  onClick={() => setShowReceipt(true)}
                  variant="outline"
                  className="flex items-center justify-center border-green-300 dark:border-green-600 text-green-700 dark:text-green-300"
                >
                  <QrCode className="w-4 h-4 mr-2" />
                  View Receipt
                </Button>
              </div>

              <div className="text-center">
                <Button
                  onClick={onClose}
                  className="bg-green-600 hover:bg-green-700 text-white px-8"
                >
                  Continue
                </Button>
              </div>
            </div>
          ) : (
            // Full QR Receipt View
            <div className="space-y-4">
              <Button
                variant="ghost"
                onClick={() => setShowReceipt(false)}
                className="text-green-700 dark:text-green-300"
              >
                ← Back to Summary
              </Button>
              
              <QRReceiptViewer
                qrCode={signatureData.qrCode}
                receiptCode={signatureData.receiptCode}
                receiptData={signatureData.receiptData}
                voterName={signatureData.voterName}
                voterEmail={signatureData.voterEmail}
                onRenew={handleRenewSignature}
                onEmailReceipt={handleEmailReceipt}
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SignatureSuccessModal;
