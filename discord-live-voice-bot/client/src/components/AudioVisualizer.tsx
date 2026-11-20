import React, { useEffect, useRef } from 'react';
import { Activity } from 'lucide-react';

interface Props {
  analyserNode: AnalyserNode | null;
  audioLevel: number; // 0 - 100
  decibels: number; // -100 to 0
  isSpeaking: boolean;
  micActive: boolean;
}

export const AudioVisualizer: React.FC<Props> = ({
  analyserNode,
  audioLevel,
  decibels,
  isSpeaking,
  micActive,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!analyserNode || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyserNode.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    let animationId: number;

    const render = () => {
      animationId = requestAnimationFrame(render);
      analyserNode.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / bufferLength) * 2.2;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height;

        // Gradient based on speaking state
        const gradient = ctx.createLinearGradient(0, canvas.height, 0, 0);
        if (isSpeaking) {
          gradient.addColorStop(0, '#ff0055');
          gradient.addColorStop(0.5, '#a600ff');
          gradient.addColorStop(1, '#00ffea');
        } else {
          gradient.addColorStop(0, '#5865F2');
          gradient.addColorStop(1, '#a855f7');
        }

        ctx.fillStyle = gradient;
        ctx.fillRect(x, canvas.height - barHeight, barWidth - 1, barHeight);

        x += barWidth;
        if (x > canvas.width) break;
      }
    };

    render();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [analyserNode, isSpeaking]);

  const numSegs = 20;
  const activeCount = Math.round((Math.max(0, decibels + 60) / 60) * numSegs);

  return (
    <div className="bg-[#1e1f22] border border-[#2b2d31] rounded-2xl p-4 shadow-lg">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          <Activity className="w-4 h-4 text-[#ff0055]" />
          <span className="text-xs font-bold text-white uppercase tracking-wider font-mono">Digital Power Spectrum & Peak Meter</span>
        </div>
        <div className="flex items-center space-x-3 text-xs font-mono">
          <span className="text-gray-400">
            Peak: <strong className="text-white">{audioLevel}%</strong>
          </span>
          <span className="text-gray-400">
            dBFS: <strong className={decibels >= -0.5 ? 'text-[#ff0055] font-black' : decibels > -6 ? 'text-yellow-400' : 'text-emerald-400'}>
              {decibels <= -90 ? '-∞ dBFS' : decibels >= -0.5 ? '0.0 dB (MAX)' : `${decibels} dBFS`}
            </strong>
          </span>
        </div>
      </div>

      {/* Real-time Frequency Spectrum Waveform */}
      <div className="bg-[#141518] rounded-xl p-2 border border-[#2b2d31] mb-3 relative overflow-hidden">
        <canvas
          ref={canvasRef}
          width={400}
          height={65}
          className="w-full h-16 rounded block"
        />
        {!micActive && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#141518]/90 text-xs text-gray-500 font-medium">
            Microphone offline • Start Engine to activate
          </div>
        )}
      </div>

      {/* 20-Segment LED Meter Bar */}
      <div>
        <div className="flex items-center justify-between text-[9px] text-gray-500 mb-1 font-mono">
          <span>-60 dB</span>
          <span>-36 dB</span>
          <span>-18 dB</span>
          <span>-6 dB</span>
          <span className="text-[#ff0055] font-bold">0 dBFS (TRUE PEAK LIMITER)</span>
        </div>
        <div className="flex gap-1 h-3 w-full bg-[#0a0105] p-1 rounded-md border border-[#350012]">
          {Array.from({ length: numSegs }).map((_, i) => {
            const isActive = micActive && i < activeCount;
            let activeClass = 'bg-[#1f0510]';
            if (isActive) {
              if (i < 10) activeClass = 'bg-[#00ff66] shadow-[0_0_6px_#00ff66]';
              else if (i < 14) activeClass = 'bg-[#ffcc00] shadow-[0_0_6px_#ffcc00]';
              else if (i < 17) activeClass = 'bg-[#ff6600] shadow-[0_0_6px_#ff6600]';
              else activeClass = 'bg-[#ff0055] shadow-[0_0_8px_#ff0055]';
            }
            return (
              <div
                key={i}
                className={`flex-1 rounded-sm transition-colors duration-75 ${activeClass}`}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};
