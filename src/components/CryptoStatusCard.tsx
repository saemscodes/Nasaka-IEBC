
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield, Key, Smartphone, RefreshCw, CheckCircle, AlertTriangle, Lock } from 'lucide-react';
import { getKeyInfo, generateKeyPair, clearCryptoData } from '@/utils/cryptoService';
import { toast } from 'sonner';

const CryptoStatusCard: React.FC = () => {
  const [keyInfo, setKeyInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    checkKeyStatus();
  }, []);

  const checkKeyStatus = async () => {
    try {
      const info = await getKeyInfo();
      setKeyInfo(info);
    } catch (error) {
      console.error('Error checking key status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateKeys = async () => {
    setGenerating(true);
    try {
      await generateKeyPair();
      await checkKeyStatus();
      toast.success('Cryptographic keys generated successfully!');
    } catch (error) {
      console.error('Key generation error:', error);
      toast.error('Failed to generate keys. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const handleClearKeys = async () => {
    try {
      await clearCryptoData();
      await checkKeyStatus();
      toast.success('All cryptographic data cleared');
    } catch (error) {
      console.error('Clear keys error:', error);
      toast.error('Failed to clear keys');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-KE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <Card className="border-blue-200 dark:border-blue-700">
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <RefreshCw className="w-5 h-5 animate-spin text-blue-600" />
            <span className="ml-2">Checking crypto status...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-blue-200 dark:border-blue-700 bg-gradient-to-br from-blue-50/50 to-white dark:from-blue-950/20 dark:to-gray-800">
      <CardHeader>
        <CardTitle className="flex items-center text-blue-900 dark:text-blue-100">
          <Shield className="w-5 h-5 mr-2" />
          Digital Signature Security
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {keyInfo?.hasKeys ? (
          <>
            <Alert className="border-green-200 dark:border-green-700 bg-green-50 dark:bg-green-950/20">
              <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
              <AlertDescription className="text-green-800 dark:text-green-200">
                <strong>Cryptographic Keys Active</strong> - Your signatures are secured with ECDSA-P384 encryption
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Key className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-medium">Key Information</span>
                </div>
                <div className="text-xs space-y-1 pl-6">
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Algorithm:</span>
                    <Badge variant="secondary" className="ml-1 text-xs">ECDSA-P384</Badge>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Created:</span>
                    <span className="ml-1 font-mono text-xs">{formatDate(keyInfo.created)}</span>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Version:</span>
                    <span className="ml-1 font-mono text-xs">{keyInfo.keyVersion?.substring(0, 8)}...</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Smartphone className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-medium">Device Security</span>
                </div>
                <div className="text-xs space-y-1 pl-6">
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Device ID:</span>
                    <span className="ml-1 font-mono text-xs">{keyInfo.deviceId?.substring(0, 8)}...</span>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Storage:</span>
                    <Badge variant="secondary" className="ml-1 text-xs">
                      <Lock className="w-3 h-3 mr-1" />
                      Encrypted
                    </Badge>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                onClick={handleGenerateKeys}
                disabled={generating}
                variant="outline"
                size="sm"
                className="border-blue-200 dark:border-blue-600 text-blue-700 dark:text-blue-300"
              >
                {generating ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Regenerate Keys
                  </>
                )}
              </Button>
              <Button
                onClick={handleClearKeys}
                variant="outline"
                size="sm"
                className="border-red-200 dark:border-red-600 text-red-700 dark:text-red-300"
              >
                Clear Keys
              </Button>
            </div>
          </>
        ) : (
          <>
            <Alert className="border-yellow-200 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-950/20">
              <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
              <AlertDescription className="text-yellow-800 dark:text-yellow-200">
                <strong>No Cryptographic Keys</strong> - Keys will be generated automatically when you sign a petition
              </AlertDescription>
            </Alert>

            <div className="space-y-3">
              <h4 className="font-medium text-gray-900 dark:text-white">Security Features:</h4>
              <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 text-green-600 mr-2" />
                  ECDSA-P384 cryptographic signatures
                </li>
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 text-green-600 mr-2" />
                  AES-256-GCM key encryption
                </li>
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 text-green-600 mr-2" />
                  Device-specific key generation
                </li>
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 text-green-600 mr-2" />
                  PBKDF2 key derivation (310,000 iterations)
                </li>
              </ul>
            </div>

            <Button
              onClick={handleGenerateKeys}
              disabled={generating}
              className="w-full bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600"
            >
              {generating ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Generating Cryptographic Keys...
                </>
              ) : (
                <>
                  <Key className="w-4 h-4 mr-2" />
                  Generate Cryptographic Keys
                </>
              )}
            </Button>
          </>
        )}

        <div className="text-xs text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-200 dark:border-gray-700">
          <p>🔒 All cryptographic operations use Web Crypto API</p>
          <p>🛡️ Keys are encrypted and stored locally on your device</p>
          <p>⚖️ Compliant with KICA §83C digital signature standards</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default CryptoStatusCard;
