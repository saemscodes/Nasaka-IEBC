
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
      created: new Date().toISOString()
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
    const keyData = await get(PRIVATE_KEY_NAME);
    const publicKeyJwk = await get(PUBLIC_KEY_NAME);
    
    if (!keyData || !publicKeyJwk) {
      // Generate keys if they don't exist
      await generateKeyPair();
      return signPetitionData(petitionData, voterData, context);
    }

    const { wrappedKey, salt, iv, version, deviceId } = keyData as CryptoKeyData;

    // Recreate encryption key
    const passphraseData = `${deviceId}-${version}`;
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
    throw new Error('CRYPTOGRAPHIC_SIGNING_FAILED');
  }
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
