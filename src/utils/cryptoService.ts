// src/utils/cryptoService.ts
import { toast } from 'sonner';
import { supabase } from "@/integrations/supabase/client";

const DB_NAME = 'cryptoDB';
const STORE_NAME = 'keys';
const KEY_ID = 'current';

// Database helper functions
const openDB = () => {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    
    request.onupgradeneeded = (event) => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const getKeyRecord = async () => {
  const db = await openDB();
  return new Promise<any>((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(KEY_ID);
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const storeKeyRecord = async (record: any) => {
  const db = await openDB();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    store.put(record);
    
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
};

// Key generation and management
export const generateKeyPair = async (passphrase: string) => {
  try {
    // Validate passphrase
    if (passphrase.length < 8) {
      throw new Error('PASSPHRASE_TOO_SHORT');
    }
    if (!/(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{8,}/.test(passphrase)) {
      throw new Error('PASSPHRASE_WEAK');
    }

    // Generate ECDSA key pair
    const keyPair = await crypto.subtle.generateKey(
      {
        name: 'ECDSA',
        namedCurve: 'P-384',
      },
      true,
      ['sign', 'verify']
    );

    // Export public key
    const publicKey = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
    
    // Export and encrypt private key
    const privateKey = await crypto.subtle.exportKey('jwk', keyPair.privateKey);
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const keyMaterial = await getKeyMaterial(passphrase);
    const encryptionKey = await deriveEncryptionKey(keyMaterial, salt);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encryptedPrivateKey = await encryptData(
      JSON.stringify(privateKey),
      encryptionKey,
      iv
    );

    // Create storage record
    const record = {
      id: KEY_ID,
      deviceId: crypto.randomUUID(),
      keyVersion: `v${Date.now()}`,
      publicKey,
      encryptedPrivateKey: Array.from(new Uint8Array(encryptedPrivateKey)),
      salt: Array.from(salt),
      iv: Array.from(iv),
      createdAt: new Date().toISOString(),
    };

    await storeKeyRecord(record);
    return true;
  } catch (error) {
    console.error('Key generation failed:', error);
    toast.error('Key generation failed');
    throw error;
  }
};

// Sign petition data
export const signPetitionData = async (
  petition: { petitionId: string; petitionTitle: string },
  formData: any
) => {
  try {
    // Get key record
    const record = await getKeyRecord();
    if (!record) throw new Error('NO_KEYS_FOUND');

    // Prompt for passphrase
    const passphrase = await securePrompt('Enter your security passphrase to sign');
    const keyMaterial = await getKeyMaterial(passphrase);
    const encryptionKey = await deriveEncryptionKey(
      keyMaterial, 
      new Uint8Array(record.salt)
    );
    
    // Decrypt private key
    const decryptedPrivateKey = await decryptData(
      new Uint8Array(record.encryptedPrivateKey).buffer,
      encryptionKey,
      new Uint8Array(record.iv)
    );
    
    // Import private key
    const privateKey = await crypto.subtle.importKey(
      'jwk',
      JSON.parse(decryptedPrivateKey),
      { name: 'ECDSA', namedCurve: 'P-384' },
      true,
      ['sign']
    );

    // Prepare data to sign
    const payload = {
      petitionId: petition.petitionId,
      petitionTitle: petition.petitionTitle,
      voterName: formData.voterName,
      voterId: formData.voterId,
      voterPhone: formData.voterPhone,
      constituency: formData.constituency,
      ward: formData.ward,
      timestamp: new Date().toISOString()
    };

    const encoder = new TextEncoder();
    const data = encoder.encode(JSON.stringify(payload));

    // Sign data
    const signature = await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-384' },
      privateKey,
      data
    );

    // Convert to base64
    const signatureBase64 = arrayBufferToBase64(signature);

    return {
      payload,
      signature: signatureBase64,
      publicKeyJwk: record.publicKey,
      keyVersion: record.keyVersion,
      deviceId: record.deviceId
    };
  } catch (error) {
    console.error('Signing failed:', error);
    throw error;
  }
};

// Verify signature on server
export const verifySignature = async (
  payload: any,
  signature: string,
  publicKeyJwk: JsonWebKey
) => {
  try {
    // Import public key
    const publicKey = await crypto.subtle.importKey(
      'jwk',
      publicKeyJwk,
      { name: 'ECDSA', namedCurve: 'P-384' },
      true,
      ['verify']
    );

    // Prepare data
    const encoder = new TextEncoder();
    const data = encoder.encode(JSON.stringify(payload));
    const signatureBuffer = base64ToArrayBuffer(signature);

    // Verify signature
    return await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-384' },
      publicKey,
      signatureBuffer,
      data
    );
  } catch (error) {
    console.error('Verification failed:', error);
    return false;
  }
};

// Submit signature to Supabase
export const submitSignature = async (signatureData: any) => {
  const { data, error } = await supabase
    .from('signatures')
    .insert({
      petition_id: signatureData.payload.petitionId,
      voter_id: signatureData.payload.voterId,
      voter_name: signatureData.payload.voterName,
      constituency: signatureData.payload.constituency,
      ward: signatureData.payload.ward,
      signature_value: signatureData.signature,
      public_key: signatureData.publicKeyJwk,
      key_version: signatureData.keyVersion,
      device_id: signatureData.deviceId,
      csp_provider: 'web-crypto'
    });

  if (error) throw error;
  return data;
};

// Helper functions
const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

const base64ToArrayBuffer = (base64: string) => {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
};

const getKeyMaterial = (passphrase: string) => {
  const encoder = new TextEncoder();
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );
};

const deriveEncryptionKey = async (keyMaterial: CryptoKey, salt: Uint8Array) => {
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 310000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
};

const encryptData = async (data: string, key: CryptoKey, iv: Uint8Array) => {
  const encoder = new TextEncoder();
  return crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(data)
  );
};

const decryptData = async (encryptedData: ArrayBuffer, key: CryptoKey, iv: Uint8Array) => {
  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      encryptedData
    );
    
    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch (error) {
    console.error('Decryption failed:', error);
    throw new Error('DECRYPTION_FAILED');
  }
};

// Key operations
export interface KeyInfo {
  hasKeys: boolean;
  deviceId?: string;
  keyVersion?: string;
  publicKey?: JsonWebKey;
  created?: string;
}

export const getKeyInfo = async (): Promise<KeyInfo> => {
  try {
    const record = await getKeyRecord();
    if (!record) return { hasKeys: false };

    return {
      hasKeys: true,
      deviceId: record.deviceId,
      keyVersion: record.keyVersion,
      publicKey: record.publicKey,
      created: record.createdAt,
    };
  } catch (error) {
    return { hasKeys: false };
  }
};

export const clearCryptoData = async () => {
  const db = await openDB();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    store.delete(KEY_ID);
    
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
};

// Key backup functions
export const generateKeyBackup = async () => {
  const record = await getKeyRecord();
  if (!record) return null;

  return {
    publicKey: record.publicKey,
    deviceId: record.deviceId,
    keyVersion: record.keyVersion,
    createdAt: record.createdAt,
  };
};

export const downloadKeyBackup = (backupData: any) => {
  const blob = new Blob([JSON.stringify(backupData, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `crypto-backup-${new Date().toISOString()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const exportKeyBackupAsMarkdown = (backupData: any) => {
  return `# CRYPTO KEY BACKUP\n\n**Device ID**: ${backupData.deviceId}\n\n` +
    `**Key Version**: ${backupData.keyVersion}\n\n` +
    `**Created**: ${new Date(backupData.createdAt).toLocaleString()}\n\n` +
    '```json\n' +
    JSON.stringify(backupData.publicKey, null, 2) +
    '\n```';
};

// Key recovery
export const recoverKeys = async (oldPassphrase: string, newPassphrase: string) => {
  try {
    const record = await getKeyRecord();
    if (!record) throw new Error('No keys found');

    // Decrypt with old passphrase
    const keyMaterial = await getKeyMaterial(oldPassphrase);
    const encryptionKey = await deriveEncryptionKey(
      keyMaterial, 
      new Uint8Array(record.salt)
    );
    const decryptedPrivateKey = await decryptData(
      new Uint8Array(record.encryptedPrivateKey).buffer,
      encryptionKey,
      new Uint8Array(record.iv)
    );
    
    // Re-encrypt with new passphrase
    const newSalt = crypto.getRandomValues(new Uint8Array(16));
    const newKeyMaterial = await getKeyMaterial(newPassphrase);
    const newEncryptionKey = await deriveEncryptionKey(newKeyMaterial, newSalt);
    const newIv = crypto.getRandomValues(new Uint8Array(12));
    const newEncryptedPrivateKey = await encryptData(
      decryptedPrivateKey,
      newEncryptionKey,
      newIv
    );

    // Update record
    await storeKeyRecord({
      ...record,
      encryptedPrivateKey: Array.from(new Uint8Array(newEncryptedPrivateKey)),
      salt: Array.from(newSalt),
      iv: Array.from(newIv),
    });

    return true;
  } catch (error) {
    console.error('Key recovery failed:', error);
    throw error;
  }
};

// Key validation
export const validateKeyConsistency = async () => {
  try {
    const record = await getKeyRecord();
    if (!record) return false;
    
    // Simple validation - check required fields exist
    return !!(
      record.publicKey && 
      record.encryptedPrivateKey &&
      record.salt &&
      record.iv
    );
  } catch (error) {
    return false;
  }
};

// Secure prompt function
export const securePrompt = (message: string): Promise<string> => {
  return new Promise((resolve, reject) => {
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

    const timeout = setTimeout(() => {
      document.body.removeChild(modal);
      reject(new Error('PROMPT_TIMEOUT'));
    }, 120000); // 2-minute timeout

    const cleanup = () => {
      clearTimeout(timeout);
      document.body.removeChild(modal);
    };

    button.addEventListener('click', () => {
      if (input.value.trim()) {
        cleanup();
        resolve(input.value);
      }
    });

    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && input.value.trim()) {
        cleanup();
        resolve(input.value);
      }
    });

    container.appendChild(label);
    container.appendChild(input);
    container.appendChild(button);
    modal.appendChild(container);
    document.body.appendChild(modal);
    input.focus();
  });
};

// Check crypto support
export const checkCryptoSupport = () => {
  const results = {
    supported: true,
    reason: '',
    details: {} as Record<string, boolean>
  };

  if (!window.crypto || !window.crypto.subtle) {
    results.supported = false;
    results.reason = 'Web Crypto API not supported';
    results.details.webCrypto = false;
    return results;
  }
  results.details.webCrypto = true;

  if (!window.indexedDB) {
    results.supported = false;
    results.reason = 'IndexedDB not supported';
    results.details.indexedDB = false;
    return results;
  }
  results.details.indexedDB = true;

  try {
    crypto.subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-384' },
      true,
      ['sign', 'verify']
    );
    results.details.ecdsaP384 = true;
  } catch (e) {
    results.supported = false;
    results.reason = 'ECDSA-P384 algorithm not supported';
    results.details.ecdsaP384 = false;
  }

  return results;
};
