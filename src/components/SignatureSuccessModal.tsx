
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, Download, Mail, Copy, Shield, Lock } from 'lucide-react';
import QRReceiptViewer from './QRReceiptViewer';
import { toast } from 'sonner';

interface SignatureSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  signatureData: {
    signatureId: string;
    receiptCode: string;
    qrCode: string;
    receiptData: any;
    voterName: string;
    voterEmail?: string;
    petitionTitle: string;
    blockchainHash?: string;
  };
}

const SignatureSuccessModal: React.FC<SignatureSuccessModalProps> = ({
  isOpen,
  onClose,
  signatureData
}) => {
  const [showQRReceipt, setShowQRReceipt] = useState(false);

  const copyBlockchainHash = () => {
    if (signatureData.blockchainHash) {
      navigator.clipboard.writeText(signatureData.blockchainHash);
      toast.success('Blockchain hash copied to clipboard!');
    }
  };

  const downloadReceipt = () => {
    const receiptData = {
      signatureId: signatureData.signatureId,
      receiptCode: signatureData.receiptCode,
      petitionTitle: signatureData.petitionTitle,
      voterName: signatureData.voterName,
      timestamp: new Date().toISOString(),
      blockchainHash: signatureData.blockchainHash
    };

    const blob = new Blob([JSON.stringify(receiptData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `petition-signature-receipt-${signatureData.receiptCode}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center text-green-900 dark:text-green-100">
            <CheckCircle className="w-6 h-6 mr-2 text-green-600" />
            Petition Signature Successfully Recorded
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Success Summary */}
          <Alert className="border-green-200 dark:border-green-700 bg-green-50 dark:bg-green-950/20">
            <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
            <AlertDescription className="text-green-800 dark:text-green-200">
              <strong>Congratulations!</strong> Your signature for "{signatureData.petitionTitle}" has been securely recorded and verified.
            </AlertDescription>
          </Alert>

          {/* Blockchain Security Info */}
          {signatureData.blockchainHash && (
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <div className="flex items-center mb-3">
                <Shield className="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400" />
                <h3 className="font-semibold text-gray-900 dark:text-white">Blockchain Security</h3>
                <Badge variant="secondary" className="ml-2">
                  <Lock className="w-3 h-3 mr-1" />
                  Secured
                </Badge>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                Your signature has been secured with blockchain-level cryptographic hashing for maximum integrity and tamper-proof verification.
              </p>
              <div className="flex items-center space-x-2">
                <div className="flex-1">
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
                    Blockchain Hash:
                  </label>
                  <div className="font-mono text-sm bg-white dark:bg-gray-700 p-2 rounded border break-all">
                    {signatureData.blockchainHash}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyBlockchainHash}
                  className="border-blue-200 dark:border-blue-600 text-blue-700 dark:text-blue-300"
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={() => setShowQRReceipt(!showQRReceipt)}
              className="flex-1 bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600"
            >
              {showQRReceipt ? 'Hide' : 'Show'} QR Receipt
            </Button>
            <Button
              onClick={downloadReceipt}
              variant="outline"
              className="flex-1 border-green-200 dark:border-green-600 text-green-700 dark:text-green-300"
            >
              <Download className="w-4 h-4 mr-2" />
              Download Receipt
            </Button>
            {signatureData.voterEmail && (
              <Button
                variant="outline"
                className="flex-1 border-blue-200 dark:border-blue-600 text-blue-700 dark:text-blue-300"
              >
                <Mail className="w-4 h-4 mr-2" />
                Email Receipt
              </Button>
            )}
          </div>

          {/* QR Receipt Viewer */}
          {showQRReceipt && (
            <div className="border-t pt-6">
              <QRReceiptViewer
                qrCode={signatureData.qrCode}
                receiptCode={signatureData.receiptCode}
                receiptData={signatureData.receiptData}
                voterName={signatureData.voterName}
                voterEmail={signatureData.voterEmail}
              />
            </div>
          )}

          {/* Important Information */}
          <Alert className="border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/20">
            <AlertDescription className="text-blue-800 dark:text-blue-200">
              <strong>Important:</strong> Save your receipt code and blockchain hash safely. These are your proof of signature and cannot be recovered if lost. Your signature is now part of the official petition record.
            </AlertDescription>
          </Alert>

          {/* Close Button */}
          <div className="flex justify-end pt-4 border-t">
            <Button onClick={onClose} variant="outline">
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SignatureSuccessModal;
