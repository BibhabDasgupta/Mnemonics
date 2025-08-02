import { useRef, useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { encrypt } from '@/utils/encryption';

interface SignatureRegistrationProps {
  onBack: () => void;
  onProceed: () => void;
  phoneNumber: string;
  customerId: string | undefined;
}

const SignatureRegistration = ({ onBack, onProceed, phoneNumber, customerId }: SignatureRegistrationProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [lastX, setLastX] = useState(0);
  const [lastY, setLastY] = useState(0);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#fafafa';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#2d3748';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsDrawing(true);
    const { x, y } = getCoordinates(e);
    setLastX(x);
    setLastY(y);

    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo(x, y);
    }
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault();

    const { x, y } = getCoordinates(e);
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      ctx.lineTo(x, y);
      ctx.stroke();
      setLastX(x);
      setLastY(y);
      setHasDrawn(true);
    }
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#fafafa';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      setHasDrawn(false);
      setError('');
    }
  };

  const submitSignature = async () => {
    if (!hasDrawn) {
      setError('Please draw your signature first.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const canvas = canvasRef.current;
      if (!canvas) throw new Error('Canvas not found');

      const dataURL = canvas.toDataURL('image/png');
      const encryptedPhoneNumber = await encrypt(phoneNumber);
      const encryptedCustomerId = customerId ? await encrypt(customerId) : '';

      const response = await fetch('http://localhost:8000/api/v1/register/signature', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: encryptedPhoneNumber,
          customerId: encryptedCustomerId,
          signature: dataURL, // Send unencrypted
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      await response.json();
      onProceed();
    } catch (err) {
      setError(`Failed to register signature: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-surface flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 shadow-card animate-slide-up">
        <div className="flex items-center mb-6">
          <Button variant="ghost" size="icon" onClick={onBack} className="mr-2">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-2xl font-bold text-foreground">Register Your Signature</h1>
        </div>
        <p className="text-muted-foreground mb-4">
          Draw your signature below for added security during restoration. This is optional.
        </p>
        <canvas
          ref={canvasRef}
          width={600}
          height={300}
          className="border-2 border-blue-500 rounded-lg bg-gray-50 mb-4 w-full"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          onTouchCancel={stopDrawing}
        />
        {error && <p className="text-red-500 mb-4">{error}</p>}
        <div className="flex gap-4 justify-center">
          <Button
            variant="outline"
            size="xl"
            onClick={clearCanvas}
            disabled={isSubmitting}
          >
            Clear
          </Button>
          <Button
            variant="banking"
            size="xl"
            onClick={submitSignature}
            disabled={!hasDrawn || isSubmitting}
          >
            {isSubmitting ? 'Submitting...' : 'Submit'}
          </Button>
        </div>
        <Button
          variant="outline"
          size="xl"
          className="w-full mt-4"
          onClick={onProceed}
          disabled={isSubmitting}
        >
          Skip
        </Button>
      </Card>
    </div>
  );
};

export default SignatureRegistration;