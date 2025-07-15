
import React, { useRef, useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RefreshCw, Download, Upload, CheckCircle } from 'lucide-react';

interface SignatureCanvasProps {
  onSignatureComplete: (signatureData: string, strokeData: any[]) => void;
  disabled?: boolean;
}

interface StrokeData {
  x: number;
  y: number;
  pressure: number;
  timestamp: number;
  velocity: number;
}

const SignatureCanvas: React.FC<SignatureCanvasProps> = ({ 
  onSignatureComplete, 
  disabled = false 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [strokes, setStrokes] = useState<StrokeData[][]>([]);
  const [currentStroke, setCurrentStroke] = useState<StrokeData[]>([]);
  const [lastPoint, setLastPoint] = useState<{ x: number; y: number; time: number } | null>(null);
  const [signatureQuality, setSignatureQuality] = useState<{
    strokeCount: number;
    totalLength: number;
    isValid: boolean;
  }>({ strokeCount: 0, totalLength: 0, isValid: false });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set up canvas
    canvas.width = canvas.offsetWidth * 2;
    canvas.height = canvas.offsetHeight * 2;
    ctx.scale(2, 2);

    ctx.strokeStyle = '#15803d';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Clear canvas
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Add signature guidelines
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(50, canvas.offsetHeight * 0.7);
    ctx.lineTo(canvas.offsetWidth - 50, canvas.offsetHeight * 0.7);
    ctx.stroke();
    ctx.setLineDash([]);

    // Add placeholder text
    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#9ca3af';
    ctx.textAlign = 'center';
    ctx.fillText('Sign here as you would on official documents', canvas.offsetWidth / 2, canvas.offsetHeight * 0.9);

    ctx.strokeStyle = '#15803d';
    ctx.lineWidth = 2;
  }, []);

  const getPointerPosition = (e: React.PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const calculateVelocity = (currentPoint: { x: number; y: number }, currentTime: number): number => {
    if (!lastPoint) return 0;

    const dx = currentPoint.x - lastPoint.x;
    const dy = currentPoint.y - lastPoint.y;
    const dt = currentTime - lastPoint.time;
    
    if (dt === 0) return 0;
    
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance / dt;
  };

  const startDrawing = (e: React.PointerEvent) => {
    if (disabled) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    setIsDrawing(true);
    const point = getPointerPosition(e);
    const currentTime = Date.now();

    const strokeData: StrokeData = {
      x: point.x,
      y: point.y,
      pressure: (e as any).pressure || 1,
      timestamp: currentTime,
      velocity: 0
    };

    setCurrentStroke([strokeData]);
    setLastPoint({ x: point.x, y: point.y, time: currentTime });

    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
  };

  const draw = (e: React.PointerEvent) => {
    if (!isDrawing || disabled) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const point = getPointerPosition(e);
    const currentTime = Date.now();
    const velocity = calculateVelocity(point, currentTime);

    const strokeData: StrokeData = {
      x: point.x,
      y: point.y,
      pressure: (e as any).pressure || 1,
      timestamp: currentTime,
      velocity
    };

    setCurrentStroke(prev => [...prev, strokeData]);
    setLastPoint({ x: point.x, y: point.y, time: currentTime });

    ctx.lineTo(point.x, point.y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing || disabled) return;

    setIsDrawing(false);
    setStrokes(prev => [...prev, currentStroke]);
    setCurrentStroke([]);
    setLastPoint(null);

    // Analyze signature quality
    analyzeSignature();
  };

  const analyzeSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const newStrokeCount = strokes.length + (currentStroke.length > 0 ? 1 : 0);
    let totalLength = 0;

    [...strokes, currentStroke].forEach(stroke => {
      for (let i = 1; i < stroke.length; i++) {
        const dx = stroke[i].x - stroke[i-1].x;
        const dy = stroke[i].y - stroke[i-1].y;
        totalLength += Math.sqrt(dx * dx + dy * dy);
      }
    });

    const quality = {
      strokeCount: newStrokeCount,
      totalLength,
      isValid: newStrokeCount >= 3 && totalLength > 100
    };

    setSignatureQuality(quality);

    if (quality.isValid) {
      const signatureData = canvas.toDataURL('image/png');
      const allStrokes = [...strokes, currentStroke].filter(stroke => stroke.length > 0);
      onSignatureComplete(signatureData, allStrokes);
    }
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    setStrokes([]);
    setCurrentStroke([]);
    setLastPoint(null);
    setSignatureQuality({ strokeCount: 0, totalLength: 0, isValid: false });

    // Clear and redraw canvas
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Redraw guidelines
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(50, canvas.offsetHeight * 0.7);
    ctx.lineTo(canvas.offsetWidth - 50, canvas.offsetHeight * 0.7);
    ctx.stroke();
    ctx.setLineDash([]);

    // Redraw placeholder text
    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#9ca3af';
    ctx.textAlign = 'center';
    ctx.fillText('Sign here as you would on official documents', canvas.offsetWidth / 2, canvas.offsetHeight * 0.9);

    ctx.strokeStyle = '#15803d';
    ctx.lineWidth = 2;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;

        // Clear canvas
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw uploaded image
        ctx.drawImage(img, 0, 0, canvas.offsetWidth, canvas.offsetHeight);

        // Simulate stroke data for uploaded signature
        const mockStroke: StrokeData[] = [
          { x: 50, y: canvas.offsetHeight * 0.7, pressure: 1, timestamp: Date.now(), velocity: 0 },
          { x: canvas.offsetWidth - 50, y: canvas.offsetHeight * 0.7, pressure: 1, timestamp: Date.now() + 100, velocity: 1 }
        ];

        setStrokes([mockStroke]);
        setSignatureQuality({ strokeCount: 1, totalLength: canvas.offsetWidth - 100, isValid: true });

        const signatureData = canvas.toDataURL('image/png');
        onSignatureComplete(signatureData, [mockStroke]);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center text-green-900 dark:text-green-100">
          Digital Signature Capture
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <canvas
            ref={canvasRef}
            className="w-full h-48 border-2 border-green-200 dark:border-green-700 rounded-lg cursor-crosshair"
            onPointerDown={startDrawing}
            onPointerMove={draw}
            onPointerUp={stopDrawing}
            onPointerLeave={stopDrawing}
            style={{ touchAction: 'none' }}
          />
          {disabled && (
            <div className="absolute inset-0 bg-gray-500/20 rounded-lg flex items-center justify-center">
              <span className="text-gray-600 dark:text-gray-400">Signature captured</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="outline"
              size="sm"
              onClick={clearSignature}
              disabled={disabled}
              className="border-green-200 dark:border-green-700"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Clear
            </Button>
            
            <div className="relative">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="absolute inset-0 opacity-0 cursor-pointer"
                disabled={disabled}
              />
              <Button
                variant="outline"
                size="sm"
                disabled={disabled}
                className="border-green-200 dark:border-green-700"
              >
                <Upload className="w-4 h-4 mr-2" />
                Upload
              </Button>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {signatureQuality.isValid ? (
              <div className="flex items-center text-green-600 dark:text-green-400">
                <CheckCircle className="w-4 h-4 mr-1" />
                <span className="text-sm">Valid signature</span>
              </div>
            ) : signatureQuality.strokeCount > 0 ? (
              <span className="text-sm text-amber-600 dark:text-amber-400">
                Continue signing...
              </span>
            ) : (
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Start signing
              </span>
            )}
          </div>
        </div>

        <Alert className="border-green-200 dark:border-green-700 bg-green-50 dark:bg-green-950/20">
          <AlertDescription className="text-green-800 dark:text-green-200 text-sm">
            <strong>Signature Tips:</strong> Sign naturally as you would on official documents. 
            Your signature will be analyzed for authenticity patterns.
            Minimum 3 strokes required for validation.
          </AlertDescription>
        </Alert>

        {signatureQuality.strokeCount > 0 && (
          <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
            <div>Strokes: {signatureQuality.strokeCount}</div>
            <div>Length: {Math.round(signatureQuality.totalLength)}px</div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SignatureCanvas;
