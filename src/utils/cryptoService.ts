import { get, set, del } from 'idb-keyval';

const PRIVATE_KEY_NAME = 'recall254_private_key';
const PUBLIC_KEY_NAME = 'recall254_public_key';
const KEY_VERSION = 'recall254_key_version';
const DEVICE_ID = 'recall254_device_id';

export interface CryptoKeyData {
  wrappedKey: ArrayBuffer;
  salt: Uint8Array;
  iv: Uint8Array;
  version: string;
  deviceId: string;
  created: string;
}

export interface SignatureResult {
  payload: string;
  signature: string;
  publicKeyJwk: JsonWebKey;
  keyVersion: string;
  deviceId: string;
  timestamp: number;
}

export interface VerificationData {
  isValid: boolean;
  data?: any;
  context?: string;
  timestamp?: string;
  error?: string;
}

export interface KeyBackupData {
  publicKey: JsonWebKey;
  keyVersion: string;
  deviceId: string;
  created: string;
  algorithm: string;
  curve: string;
}

// Generate device-specific key pair with secure storage
export async function generateKeyPair(userPassphrase?: string): Promise<JsonWebKey> {
  try {
    // Generate or retrieve device ID
    let deviceId = await get(DEVICE_ID);
    if (!deviceId) {
      deviceId = crypto.randomUUID();
      await set(DEVICE_ID, deviceId);
    }

    // Create salt and IV for encryption
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    // Derive encryption key from passphrase or device-specific data
    const passphraseData = userPassphrase || `${deviceId}-${Date.now()}`;
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(passphraseData),
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );

    const encryptionKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: 310000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['wrapKey', 'unwrapKey']
    );

    // Generate ECDSA key pair (P-384 for enhanced security)
    const keyPair = await crypto.subtle.generateKey(
      {
        name: 'ECDSA',
        namedCurve: 'P-384'
      },
      true,
      ['sign', 'verify']
    );

    // Wrap private key for secure storage
    const wrappedPrivateKey = await crypto.subtle.wrapKey(
      'pkcs8',
      keyPair.privateKey,
      encryptionKey,
      {
        name: 'AES-GCM',
        iv: iv
      }
    );

    // Export public key
    const publicKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);

    // Store encrypted private key data
    const keyVersion = Date.now().toString();
    const cryptoKeyData: CryptoKeyData = {
      wrappedKey: wrappedPrivateKey,
      salt,
      iv,
      version: keyVersion,
      deviceId,
      created: userPassphrase ? "user-passphrase" : keyVersion // Add flag
    };

    await set(PRIVATE_KEY_NAME, cryptoKeyData);
    await set(PUBLIC_KEY_NAME, publicKeyJwk);
    await set(KEY_VERSION, keyVersion);

    console.log('🔐 Cryptographic keys generated successfully');
    return publicKeyJwk;
  } catch (error) {
    console.error('Key generation error:', error);
    throw new Error('SECURE_KEY_GENERATION_FAILED');
  }
}

// Sign petition data with cryptographic signature
export async function signPetitionData(
  petitionData: any,
  voterData: any,
  context = 'PETITION_SIGNATURE'
): Promise<SignatureResult> {
  try {
    // Check if keys exist
    const keyData = await get(PRIVATE_KEY_NAME) as CryptoKeyData;
    const publicKeyJwk = await get(PUBLIC_KEY_NAME);
    
    if (!keyData || !publicKeyJwk) {
      // Generate keys if they don't exist
      await generateKeyPair();
      return signPetitionData(petitionData, voterData, context);
    }

    const { wrappedKey, salt, iv, version, deviceId } = keyData as CryptoKeyData;
    const storedDeviceId = await get(DEVICE_ID) || deviceId; // Critical fix

    // Handle device ID mismatch
    if (deviceId !== storedDeviceId) {
      console.warn('Device ID mismatch detected. Regenerating keys...');
      await clearCryptoData();
      await generateKeyPair();
      return signPetitionData(petitionData, voterData, context);
    }

    // Recreate encryption key
    const passphraseData = useUserPassphrase 
      ? await securePrompt('Enter your security passphrase to sign')
      : `${storedDeviceId}-${version}`;  // Use stored ID

    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(passphraseData),
      'PBKDF2',
      false,
      ['deriveKey']
    );
    
    const encryptionKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: 310000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['unwrapKey']
    );
    
    // Unwrap private key
    const privateKey = await crypto.subtle.unwrapKey(
      'pkcs8',
      wrappedKey,
      encryptionKey,
      {
        name: 'AES-GCM',
        iv: iv
      },
      {
        name: 'ECDSA',
        namedCurve: 'P-384'
      },
      false,
      ['sign']
    );
    
    // Create secure payload with all petition data
    const timestamp = Date.now();
    const payload = JSON.stringify({
      petitionId: petitionData.petitionId,
      petitionTitle: petitionData.petitionTitle,
      voterName: voterData.voterName,
      voterId: voterData.voterId,
      constituency: voterData.constituency,
      ward: voterData.ward,
      context,
      timestamp,
      version,
      deviceId,
      userAgent: navigator.userAgent,
      location: window.location.origin
    });
    
    // Generate cryptographic signature
    const signature = await crypto.subtle.sign(
      {
        name: 'ECDSA',
        hash: 'SHA-384'
      },
      privateKey,
      new TextEncoder().encode(payload)
    );
    
    console.log('✍️ Petition data cryptographically signed');
    
    return {
      payload,
      signature: arrayBufferToBase64(signature),
      publicKeyJwk,
      keyVersion: version,
      deviceId,
      timestamp
    };
  } catch (error) {
    console.error('Signing error:', error);
    if (error.name === 'OperationError') {
      throw new Error('KEY_DERIVATION_FAILED');
    }
    throw new Error('CRYPTOGRAPHIC_SIGNING_FAILED');
  }
}
export async function securePrompt(message: string): Promise<string> {
    return new Promise((resolve) => {
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
      
      const button = document.createElement('button');
      button.textContent = 'Submit';
      button.style.cssText = `
        padding: 8px 15px; background: #15803d; color: white;
        border: none; border-radius: 4px; cursor: pointer; font-weight: 500;
      `;
      
      button.addEventListener('click', () => {
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

export async function validateKeyConsistency(): Promise<boolean> {
  const keyData = await get(PRIVATE_KEY_NAME) as CryptoKeyData;
  if (!keyData) return false;
  
  const storedDeviceId = await get(DEVICE_ID);
  return keyData.deviceId === storedDeviceId;
}

// Verify signature locally (for immediate feedback)
export async function verifySignatureLocally(signatureResult: SignatureResult): Promise<VerificationData> {
  try {
    const { payload, signature, publicKeyJwk } = signatureResult;
    
    // Import public key
    const publicKey = await crypto.subtle.importKey(
      'jwk',
      publicKeyJwk,
      {
        name: 'ECDSA',
        namedCurve: 'P-384'
      },
      false,
      ['verify']
    );
    
    // Verify signature
    const isValid = await crypto.subtle.verify(
      {
        name: 'ECDSA',
        hash: 'SHA-384'
      },
      publicKey,
      base64ToArrayBuffer(signature),
      new TextEncoder().encode(payload)
    );
    
    if (isValid) {
      const parsedPayload = JSON.parse(payload);
      return {
        isValid: true,
        data: parsedPayload,
        context: parsedPayload.context,
        timestamp: new Date(parsedPayload.timestamp).toISOString()
      };
    }
    
    return { isValid: false, error: 'SIGNATURE_VERIFICATION_FAILED' };
  } catch (error) {
    console.error('Local verification error:', error);
    return { isValid: false, error: error.message };
  }
}

// Generate key backup data for download/copy
export async function generateKeyBackup(): Promise<KeyBackupData | null> {
  try {
    const keyData = await get(PRIVATE_KEY_NAME) as CryptoKeyData;
    const publicKey = await get(PUBLIC_KEY_NAME);
    const deviceId = await get(DEVICE_ID);
    
    if (!keyData || !publicKey) {
      return null;
    }
    
    return {
      publicKey,
      keyVersion: keyData.version,
      deviceId: deviceId || keyData.deviceId,
      created: keyData.created,
      algorithm: 'ECDSA-P384-SHA384',
      curve: 'P-384'
    };
  } catch (error) {
    console.error('Key backup generation error:', error);
    return null;
  }
}

// Export key backup as markdown
export function exportKeyBackupAsMarkdown(backupData: KeyBackupData): string {
  const timestamp = new Date().toISOString();
  
  return `# Recall254 Cryptographic Key Backup

## Key Information
- **Algorithm**: ${backupData.algorithm}
- **Curve**: ${backupData.curve}
- **Key Version**: ${backupData.keyVersion}
- **Device ID**: ${backupData.deviceId}
- **Created**: ${backupData.created}
- **Backup Generated**: ${timestamp}

## Public Key (JWK Format)
\`\`\`json
${JSON.stringify(backupData.publicKey, null, 2)}
\`\`\`

## Security Notes
- ✅ This backup contains only your PUBLIC key - it's safe to store
- ✅ Your private key remains encrypted and secured on your device
- ✅ This backup can be used to verify signatures you've created
- ✅ Keep this backup safe for key verification purposes

## Verification
- **Key Type**: ${backupData.publicKey.kty}
- **Curve**: ${backupData.publicKey.crv}
- **Use**: ${backupData.publicKey.use || 'sig'}
- **Algorithm**: ${backupData.publicKey.alg || 'ES384'}

---
*Generated by Recall254 Digital Signature System*
*Compliant with KICA §83C Digital Signature Standards*
`;
}

// Download key backup as file
export function downloadKeyBackup(backupData: KeyBackupData): void {
  const markdown = exportKeyBackupAsMarkdown(backupData);
  const blob = new Blob([markdown], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `recall254-key-backup-${backupData.keyVersion}.md`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}

// Get current device and key info
export async function getKeyInfo(): Promise<{
  hasKeys: boolean;
  deviceId?: string;
  keyVersion?: string;
  publicKey?: JsonWebKey;
  created?: string;
}> {
  try {
    const keyData = await get(PRIVATE_KEY_NAME) as CryptoKeyData;
    const publicKey = await get(PUBLIC_KEY_NAME);
    const deviceId = await get(DEVICE_ID);
    
    if (!keyData || !publicKey) {
      return { hasKeys: false };
    }
    
    return {
      hasKeys: true,
      deviceId: deviceId || keyData.deviceId,
      keyVersion: keyData.version,
      publicKey,
      created: keyData.created
    };
  } catch (error) {
    console.error('Key info error:', error);
    return { hasKeys: false };
  }
}

// Clear all crypto data (for testing/reset)
export async function clearCryptoData(): Promise<void> {
  try {
    await del(PRIVATE_KEY_NAME);
    await del(PUBLIC_KEY_NAME);
    await del(KEY_VERSION);
    await del(DEVICE_ID);
    console.log('🗑️ All cryptographic data cleared');
  } catch (error) {
    console.error('Clear crypto data error:', error);
  }
}

// Helper functions
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

// Key recovery function
export async function recoverKeys(oldPassphrase: string, newPassphrase: string): Promise<boolean> {
  try {
    const keyData = await get(PRIVATE_KEY_NAME) as CryptoKeyData;
    if (!keyData) throw new Error('NO_KEYS_FOUND');
    
    // Unwrap with old passphrase
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(oldPassphrase),
      'PBKDF2',
      false,
      ['deriveKey']
    );
    
    const encryptionKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: keyData.salt,
        iterations: 310000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['unwrapKey']
    );
    
    const privateKey = await crypto.subtle.unwrapKey(
      'pkcs8',
      keyData.wrappedKey,
      encryptionKey,
      {
        name: 'AES-GCM',
        iv: keyData.iv
      },
      {
        name: 'ECDSA',
        namedCurve: 'P-384'
      },
      false,
      ['sign']
    );
    
    // Re-wrap with new passphrase
    const newSalt = crypto.getRandomValues(new Uint8Array(16));
    const newIv = crypto.getRandomValues(new Uint8Array(12));
    const newKeyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(newPassphrase),
      'PBKDF2',
      false,
      ['deriveKey']
    );
    
    const newEncryptionKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: newSalt,
        iterations: 310000,
        hash: 'SHA-256'
      },
      newKeyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['wrapKey']
    );
    
    const rewrappedKey = await crypto.subtle.wrapKey(
      'pkcs8',
      privateKey,
      newEncryptionKey,
      { name: 'AES-GCM', iv: newIv }
    );
    
    // Update stored keys
    const updatedKeyData: CryptoKeyData = {
      ...keyData,
      wrappedKey: rewrappedKey,
      salt: newSalt,
      iv: newIv
    };
    
    await set(PRIVATE_KEY_NAME, updatedKeyData);
    console.log('🔑 Keys successfully recovered with new passphrase');
    return true;
  } catch (error) {
    console.error('Key recovery failed:', error);
    throw new Error('KEY_RECOVERY_FAILED');
  }
}

// Browser compatibility check
export function checkCryptoSupport(): {
  supported: boolean;
  reason?: string;
} {
  if (!window.crypto || !window.crypto.subtle) {
    return {
      supported: false,
      reason: 'Web Cryptography API not supported'
    };
  }
  
  if (!window.indexedDB) {
    return {
      supported: false,
      reason: 'IndexedDB not supported'
    };
  }
  
  return { supported: true };
}
