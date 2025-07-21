import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Shield, 
  Key, 
  Smartphone, 
  RefreshCw, 
  CheckCircle, 
  AlertTriangle, 
  Lock, 
  Download, 
  Copy, 
  FileText,
  RotateCw,
  AlertCircle
} from 'lucide-react';
import { 
  getKeyInfo, 
  generateKeyPair, 
  clearCryptoData, 
  generateKeyBackup, 
  downloadKeyBackup, 
  exportKeyBackupAsMarkdown,
  recoverKeys,
  validateKeyConsistency
} from '@/utils/cryptoService';
import { toast } from 'sonner';

// Define proper types for key info
interface KeyInfo {
  hasKeys: boolean;
  deviceId?: string;
  keyVersion?: string;
  publicKey?: JsonWebKey;
  created?: string;
}

const CryptoStatusCard: React.FC<{ onSign?: () => void }> = ({ onSign }) => {
  const [keyInfo, setKeyInfo] = useState<KeyInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [keyError, setKeyError] = useState('');

  useEffect(() => {
  const checkKeys = async () => {
    const valid = await validateKeyConsistency();
    if (!valid) {
      setKeyError('KEY_STORAGE_MISMATCH');
      toast.warning('Security keys need regeneration');
    }
  };
  checkKeys();
}, []);

  useEffect(() => {
    checkKeyStatus();
  }, []);

  const checkKeyStatus = async () => {
    try {
      const info = await getKeyInfo();
      setKeyInfo(info);
      setKeyError('');
    } catch (error) {
      console.error('Error checking key status:', error);
      setKeyError('KEY_CHECK_FAILED');
      toast.error('Failed to check key status');
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
      setKeyError('KEY_GENERATION_FAILED');
      toast.error('Failed to generate keys. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const handleRecoverKeys = async () => {
    setRecovering(true);
    try {
      const oldPassphrase = await securePrompt('Enter your old passphrase');
      const newPassphrase = await securePrompt('Enter a new security passphrase');
      
      const success = await recoverKeys(oldPassphrase, newPassphrase);
      if (success) {
        await checkKeyStatus();
        toast.success('Keys successfully recovered!');
      }
    } catch (error) {
      console.error('Key recovery failed:', error);
      setKeyError('KEY_RECOVERY_FAILED');
      toast.error('Key recovery failed. Please try again.');
    } finally {
      setRecovering(false);
    }
  };

  const handleClearKeys = async () => {
    try {
      await clearCryptoData();
      await checkKeyStatus();
      toast.success('All cryptographic data cleared');
    } catch (error) {
      console.error('Clear keys error:', error);
      setKeyError('CLEAR_KEYS_FAILED');
      toast.error('Failed to clear keys');
    }
  };

  const handleDownloadBackup = async () => {
    try {
      const backupData = await generateKeyBackup();
      if (!backupData) {
        toast.error('No keys available for backup');
        return;
      }
      
      downloadKeyBackup(backupData);
      toast.success('Key backup downloaded successfully');
    } catch (error) {
      console.error('Backup download error:', error);
      setKeyError('BACKUP_FAILED');
      toast.error('Failed to download key backup');
    }
  };

  const handleCopyBackup = async () => {
    try {
      const backupData = await generateKeyBackup();
      if (!backupData) {
        toast.error('No keys available for backup');
        return;
      }
      
      const markdown = exportKeyBackupAsMarkdown(backupData);
      await navigator.clipboard.writeText(markdown);
      toast.success('Key backup copied to clipboard');
    } catch (error) {
      console.error('Backup copy error:', error);
      setKeyError('COPY_FAILED');
      toast.error('Failed to copy key backup');
    }
  };

  const securePrompt = (message: string): Promise<string> => {
  return new Promise((resolve, reject) => {  // Added reject parameter
    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0,0,0,0.5); z-index: 10000; display: flex;
      align-items: center; justify-content: center;
    `;
    
    const container = document.createElement('div');
    container.style.cssText = `
      background: white; padding: 20px; border-radius: 8px;
      width: 300px; text-align: center; box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    `;
    
    const label = document.createElement('p');
    label.textContent = message;
    label.style.marginBottom = '10px';
    label.style.fontWeight = '500';
    
    const input = document.createElement('input');
    input.type = 'password';
    input.style.cssText = `
      width: 100%; padding: 10px; margin-bottom: 15px;
      border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box;
    `;

    const button = document.createElement('button');  // Moved button creation up
    button.textContent = 'Submit';
    button.style.cssText = `
      padding: 8px 15px; background: #15803d; color: white;
      border: none; border-radius: 4px; cursor: pointer; font-weight: 500;
    `;

    const timeout = setTimeout(() => {
      document.body.removeChild(modal);
      reject(new Error('PROMPT_TIMEOUT'));
    }, 120000); // 2-minute timeout

    button.addEventListener('click', () => {
      clearTimeout(timeout);
      document.body.removeChild(modal);
      resolve(input.value);
    });
    
    container.appendChild(label);
    container.appendChild(input);
    container.appendChild(button);
    modal.appendChild(container);
    document.body.appendChild(modal);
    input.focus();
  });
};
  
  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'Unknown';
    try {
      return new Date(dateString).toLocaleDateString('en-KE', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return 'Invalid date';
    }
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
        {keyError && (
          <Alert className="border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-950/20">
            <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
            <AlertDescription className="text-red-800 dark:text-red-200">
              <strong>Security Error:</strong> Operation failed ({keyError})
            </AlertDescription>
          </Alert>
        )}

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
                      AES-256-GCM Encrypted
                    </Badge>
                  </div>
                </div>
              </div>
            </div>

            {/* Key Backup Section */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <div className="flex items-center space-x-2 mb-3">
                <FileText className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium">Key Backup & Verification</span>
              </div>
              
              <Alert className="border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/20 mb-3">
                <AlertDescription className="text-blue-800 dark:text-blue-200 text-xs">
                  <strong>Security Note:</strong> Key backups contain only your PUBLIC key for verification. 
                  Your private key remains encrypted with PBKDF2 (310,000 iterations) and secure on your device.
                </AlertDescription>
              </Alert>

              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  onClick={handleDownloadBackup}
                  variant="outline"
                  size="sm"
                  className="border-blue-200 dark:border-blue-600 text-blue-700 dark:text-blue-300"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download Backup
                </Button>
                <Button
                  onClick={handleCopyBackup}
                  variant="outline"
                  size="sm"
                  className="border-blue-200 dark:border-blue-600 text-blue-700 dark:text-blue-300"
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Copy to Clipboard
                </Button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                onClick={handleGenerateKeys}
                disabled={generating || recovering}
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
                onClick={handleRecoverKeys}
                disabled={recovering || generating}
                variant="outline"
                size="sm"
                className="border-purple-200 dark:border-purple-600 text-purple-700 dark:text-purple-300"
              >
                {recovering ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Recovering...
                  </>
                ) : (
                  <>
                    <RotateCw className="w-4 h-4 mr-2" />
                    Recover Keys
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

              {onSign && (
            <Button
              onClick={onSign}
              className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white"
              >
              Test Signing Function
            </Button>
          )}
            
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
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 text-green-600 mr-2" />
                  Downloadable key backup for verification
                </li>
              </ul>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                onClick={handleGenerateKeys}
                disabled={generating || recovering}
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
              <Button
                onClick={handleRecoverKeys}
                disabled={recovering || generating}
                variant="outline"
                className="w-full border-purple-200 dark:border-purple-600 text-purple-700 dark:text-purple-300"
              >
                {recovering ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Recovering Keys...
                  </>
                ) : (
                  <>
                    <RotateCw className="w-4 h-4 mr-2" />
                    Recover Existing Keys
                  </>
                )}
              </Button>
            </div>
          </>
        )}

        <div className="text-xs text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-200 dark:border-gray-700">
          <p>🔐 All cryptographic operations use Web Crypto API</p>
          <p>🛡️ Keys are encrypted with PBKDF2 and stored in IndexedDB</p>
          <p>📁 Public key backups available for verification purposes</p>
          <p>⚖️ Compliant with KICA §83C digital signature standards</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default CryptoStatusCard;
