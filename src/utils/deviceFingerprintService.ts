
import FingerprintJS from '@fingerprintjs/fingerprintjs';

export interface DeviceFingerprint {
  visitorId: string;
  screenResolution: string;
  timezone: string;
  language: string;
  platform: string;
  cookiesEnabled: boolean;
  sessionStorage: boolean;
  localStorage: boolean;
  canvas: string;
  webgl: string;
  audio: string;
  fonts: string[];
  plugins: string[];
  cpuCores: number;
  deviceMemory: number;
  hardwareConcurrency: number;
  connection: string;
  colorDepth: number;
}

export class DeviceFingerprintService {
  private static fpPromise: Promise<any> | null = null;

  private static async initializeFingerprint() {
    if (!this.fpPromise) {
      this.fpPromise = FingerprintJS.load();
    }
    return this.fpPromise;
  }

  static async generateFingerprint(): Promise<DeviceFingerprint> {
    try {
      const fp = await this.initializeFingerprint();
      const result = await fp.get();

      // Additional browser fingerprinting
      const screenRes = `${screen.width}x${screen.height}`;
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const language = navigator.language;
      const platform = navigator.platform;
      
      // Canvas fingerprinting
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      ctx!.textBaseline = 'top';
      ctx!.font = '14px Arial';
      ctx!.fillText('Browser fingerprint test 🔒', 2, 2);
      const canvasFingerprint = canvas.toDataURL();

      // WebGL fingerprinting
      const webglCanvas = document.createElement('canvas');
      const webglCtx = webglCanvas.getContext('webgl') || webglCanvas.getContext('experimental-webgl');
      let webglFingerprint = '';
      if (webglCtx && webglCtx instanceof WebGLRenderingContext) {
        const renderer = webglCtx.getParameter(webglCtx.RENDERER);
        const vendor = webglCtx.getParameter(webglCtx.VENDOR);
        webglFingerprint = `${vendor}~${renderer}`;
      }

      // Audio fingerprinting
      let audioFingerprint = '';
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const analyser = audioCtx.createAnalyser();
        const gainNode = audioCtx.createGain();
        
        oscillator.type = 'triangle';
        oscillator.frequency.value = 10000;
        gainNode.gain.value = 0;
        
        oscillator.connect(analyser);
        analyser.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        oscillator.start();
        
        const freqData = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(freqData);
        audioFingerprint = Array.from(freqData).slice(0, 10).join('');
        
        oscillator.stop();
        audioCtx.close();
      } catch (e) {
        audioFingerprint = 'unavailable';
      }

      // Font detection
      const baseFonts = ['monospace', 'sans-serif', 'serif'];
      const testFonts = [
        'Arial', 'Helvetica', 'Times New Roman', 'Courier New', 'Verdana',
        'Georgia', 'Palatino', 'Garamond', 'Bookman', 'Tahoma',
        'Comic Sans MS', 'Impact', 'Arial Black', 'Trebuchet MS'
      ];
      
      const detectedFonts: string[] = [];
      const testString = 'mmmmmmmmmmlli';
      const testSize = '72px';
      
      const canvas2 = document.createElement('canvas');
      const context = canvas2.getContext('2d')!;
      
      for (const font of testFonts) {
        let detected = false;
        for (const baseFont of baseFonts) {
          context.font = `${testSize} ${baseFont}`;
          const baseWidth = context.measureText(testString).width;
          
          context.font = `${testSize} ${font}, ${baseFont}`;
          const testWidth = context.measureText(testString).width;
          
          if (baseWidth !== testWidth) {
            detected = true;
            break;
          }
        }
        if (detected) {
          detectedFonts.push(font);
        }
      }

      // Plugin detection
      const plugins = Array.from(navigator.plugins).map(plugin => plugin.name);

      const fingerprint: DeviceFingerprint = {
        visitorId: result.visitorId,
        screenResolution: screenRes,
        timezone,
        language,
        platform,
        cookiesEnabled: navigator.cookieEnabled,
        sessionStorage: typeof sessionStorage !== 'undefined',
        localStorage: typeof localStorage !== 'undefined',
        canvas: canvasFingerprint.substring(0, 50),
        webgl: webglFingerprint,
        audio: audioFingerprint,
        fonts: detectedFonts,
        plugins,
        cpuCores: navigator.hardwareConcurrency || 0,
        deviceMemory: (navigator as any).deviceMemory || 0,
        hardwareConcurrency: navigator.hardwareConcurrency || 0,
        connection: (navigator as any).connection?.effectiveType || 'unknown',
        colorDepth: screen.colorDepth
      };

      return fingerprint;
    } catch (error) {
      console.error('Error generating device fingerprint:', error);
      // Return minimal fingerprint on error
      return {
        visitorId: 'error_' + Date.now(),
        screenResolution: `${screen.width}x${screen.height}`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        language: navigator.language,
        platform: navigator.platform,
        cookiesEnabled: navigator.cookieEnabled,
        sessionStorage: typeof sessionStorage !== 'undefined',
        localStorage: typeof localStorage !== 'undefined',
        canvas: 'unavailable',
        webgl: 'unavailable',
        audio: 'unavailable',
        fonts: [],
        plugins: [],
        cpuCores: navigator.hardwareConcurrency || 0,
        deviceMemory: 0,
        hardwareConcurrency: navigator.hardwareConcurrency || 0,
        connection: 'unknown',
        colorDepth: screen.colorDepth
      };
    }
  }

  static generateFingerprintHash(fingerprint: DeviceFingerprint): string {
    const fingerprintString = JSON.stringify(fingerprint);
    let hash = 0;
    for (let i = 0; i < fingerprintString.length; i++) {
      const char = fingerprintString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }

  static async checkDuplicateDevice(
    fingerprint: DeviceFingerprint,
    petitionId: string,
    constituency: string,
    ward: string
  ): Promise<{ isDuplicate: boolean; existingSignature?: any }> {
    try {
      const fingerprintHash = this.generateFingerprintHash(fingerprint);
      
      // Import supabase here to avoid circular dependency
      const { supabase } = await import('@/integrations/supabase/client');
      
      const { data: signatures, error } = await supabase
        .from('signatures')
        .select('*')
        .eq('petition_id', petitionId)
        .eq('constituency', constituency)
        .eq('ward', ward)
        .contains('device_fingerprint', { hash: fingerprintHash });

      if (error) {
        console.error('Error checking duplicate device:', error);
        return { isDuplicate: false };
      }

      if (signatures && signatures.length > 0) {
        return {
          isDuplicate: true,
          existingSignature: signatures[0]
        };
      }

      return { isDuplicate: false };
    } catch (error) {
      console.error('Error in duplicate device check:', error);
      return { isDuplicate: false };
    }
  }
}
