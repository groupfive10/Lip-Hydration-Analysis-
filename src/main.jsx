import React, { useState, useRef, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { Camera, Upload, Droplets, Activity, CheckCircle, AlertTriangle, ChevronRight, RefreshCw, Info, X } from 'lucide-react';

/**
 * API KEY SECURITY NOTE:
 * Ensuring the app doesn't crash if environment variables are missing.
 */
const getApiKey = () => {
  try {
    const key = import.meta.env?.VITE_GEMINI_API_KEY;
    return key || "";
  } catch (e) {
    return "";
  }
};

const apiKey = getApiKey();

function App() {
  const [image, setImage] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setError('Please upload a valid image file.');
        return;
      }
      
      const reader = new FileReader();
      reader.onload = (event) => {
        setImage(event.target.result);
        setResults(null);
        setError('');
      };
      reader.readAsDataURL(file);
    }
  };

  const triggerFileInput = () => fileInputRef.current.click();

  const startCamera = async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' }
      });
      streamRef.current = stream;
      setIsCameraActive(true);
    } catch (err) {
      setError("Could not access camera. Please check permissions or upload a photo.");
    }
  };

  useEffect(() => {
    if (isCameraActive && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [isCameraActive]);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(videoRef.current, 0, 0);
      setImage(canvas.toDataURL('image/jpeg', 0.8));
      stopCamera();
    }
  };

  const analyzeLips = async () => {
    if (!image) return;
    setIsAnalyzing(true);
    setError('');

    try {
      const base64Data = image.split(',')[1];
      const prompt = "Analyze these lips for hydration levels. Provide a 1-100 hydration score and status.";

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType: "image/jpeg", data: base64Data } }] }],
            generationConfig: {
              responseMimeType: "application/json",
              responseSchema: {
                type: "OBJECT",
                properties: {
                  overallStatus: { type: "STRING" },
                  dehydrationScore: { type: "INTEGER" },
                  crackness: { type: "STRING" },
                  dryness: { type: "STRING" },
                  moisture: { type: "STRING" },
                  color: { type: "STRING" },
                  recommendations: { type: "ARRAY", items: { type: "STRING" } }
                }
              }
            }
          })
        }
      );

      const data = await response.json();
      const resultText = data.candidates[0].content.parts[0].text;
      setResults(JSON.parse(resultText));
    } catch (err) {
      setError('Analysis failed. Check your API key in Vercel settings.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getStatusColor = (status, type = 'bg') => {
    const s = status?.toLowerCase() || '';
    if (s.includes('well')) return type === 'bg' ? 'bg-emerald-500' : 'text-emerald-600';
    if (s.includes('mild')) return type === 'bg' ? 'bg-amber-500' : 'text-amber-600';
    return type === 'bg' ? 'bg-rose-500' : 'text-rose-600';
  };

  return (
    <div className="min-h-screen bg-slate-50 flex justify-center p-4">
      <div className="w-full max-w-md bg-white shadow-2xl rounded-3xl overflow-hidden flex flex-col border border-slate-100">
        <header className="bg-gradient-to-r from-cyan-600 to-blue-600 p-6 text-white text-center">
          <Droplets className="w-8 h-8 mx-auto mb-2" />
          <h1 className="text-xl font-bold">HydroLip Scanner</h1>
        </header>

        <main className="p-6 flex-1">
          {error && <div className="p-3 bg-red-50 text-red-600 rounded-lg mb-4 text-sm">{error}</div>}

          {!image && !isCameraActive && (
            <div className="grid grid-cols-2 gap-4">
              <button onClick={startCamera} className="p-8 border-2 border-dashed border-slate-200 rounded-2xl hover:bg-slate-50 flex flex-col items-center">
                <Camera className="mb-2" /> <span>Camera</span>
              </button>
              <button onClick={triggerFileInput} className="p-8 border-2 border-dashed border-slate-200 rounded-2xl hover:bg-slate-50 flex flex-col items-center">
                <Upload className="mb-2" /> <span>Upload</span>
              </button>
            </div>
          )}

          {isCameraActive && (
            <div className="relative rounded-2xl overflow-hidden bg-black aspect-square">
              <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover scale-x-[-1]" />
              <button onClick={capturePhoto} className="absolute bottom-4 left-1/2 -translate-x-1/2 w-12 h-12 bg-white rounded-full border-4 border-cyan-500" />
            </div>
          )}

          {image && !results && !isAnalyzing && (
            <div className="flex flex-col items-center">
              <img src={image} className="w-full aspect-square object-cover rounded-2xl mb-4" />
              <button onClick={analyzeLips} className="w-full py-4 bg-cyan-600 text-white rounded-xl font-bold shadow-lg">Analyze Now</button>
              <button onClick={() => setImage(null)} className="mt-2 text-slate-400 text-sm">Retake</button>
            </div>
          )}

          {isAnalyzing && <div className="text-center py-10"><RefreshCw className="w-10 h-10 animate-spin mx-auto text-cyan-500 mb-2" /> <p>AI is scanning...</p></div>}

          {results && (
            <div className="animate-in fade-in">
               <div className={`p-6 rounded-2xl text-center mb-4 ${getStatusColor(results.overallStatus, 'bg')} text-white`}>
                  <p className="text-sm opacity-80 uppercase tracking-widest font-bold">Hydration Level</p>
                  <h2 className="text-4xl font-black">{results.dehydrationScore}%</h2>
                  <p className="font-bold">{results.overallStatus}</p>
               </div>
               <div className="space-y-2">
                  <div className="p-3 bg-slate-50 rounded-lg text-sm"><strong>Moisture:</strong> {results.moisture}</div>
                  <div className="p-3 bg-slate-50 rounded-lg text-sm"><strong>Texture:</strong> {results.dryness}</div>
               </div>
               <button onClick={() => setResults(null)} className="w-full mt-6 py-3 bg-slate-100 rounded-xl text-slate-600 font-bold">Try Again</button>
            </div>
          )}

          <input type="file" ref={fileInputRef} onChange={handleImageUpload} className="hidden" accept="image/*" />
        </main>
      </div>
    </div>
  );
}

// THIS PART IS CRITICAL: It connects the code to your index.html
const container = document.getElementById('root');
const root = createRoot(container);
root.render(<App />);
