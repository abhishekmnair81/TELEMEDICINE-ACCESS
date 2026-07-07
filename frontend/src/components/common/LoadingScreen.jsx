import React from 'react';

const LoadingScreen = ({ message = "Loading..." }) => {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-white relative overflow-hidden transition-colors duration-300">
      { }
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,179,142,0.05)_0%,transparent_65%)] pointer-events-none"></div>

      { }
      <style>{`
        @keyframes logoPulseAndFlip {
          0% {
            transform: perspective(1000px) rotateY(0deg) scale(1);
            filter: drop-shadow(0 0 8px rgba(0, 179, 142, 0.25)) drop-shadow(0 0 20px rgba(0, 179, 142, 0.15));
          }
          50% {
            transform: perspective(1000px) rotateY(180deg) scale(1.08);
            filter: drop-shadow(0 0 16px rgba(0, 179, 142, 0.45)) drop-shadow(0 0 35px rgba(0, 179, 142, 0.25));
          }
          100% {
            transform: perspective(1000px) rotateY(360deg) scale(1);
            filter: drop-shadow(0 0 8px rgba(0, 179, 142, 0.25)) drop-shadow(0 0 20px rgba(0, 179, 142, 0.15));
          }
        }
        .glowing-logo {
          animation: logoPulseAndFlip 4s ease-in-out infinite;
          transform-style: preserve-3d;
        }
        @keyframes pulseLine {
          0%, 100% { stroke-dashoffset: 120; opacity: 0.8; }
          50% { stroke-dashoffset: 0; opacity: 1; }
        }
        .ecg-pulse-line {
          stroke-dasharray: 120;
          animation: pulseLine 2.5s linear infinite;
        }
      `}</style>

      { }
      <div className="flex flex-col items-center justify-center z-10">
        <svg
          viewBox="0 0 100 100"
          className="w-36 h-36 glowing-logo select-none"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <defs>
            { }
            <filter id="green-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          { }
          <path
            d="M50 35 L38 25 L24 35 L24 50 L50 78 L76 50 L76 35 L62 25 Z"
            fill="none"
            stroke="#00b38e"
            strokeWidth="3.5"
            opacity="0.3"
            filter="url(#green-glow)"
          />

          { }
          <path
            d="M50 35 L38 25 L24 35 L24 50 L50 78 L76 50 L76 35 L62 25 Z"
            fill="none"
            stroke="#00b38e"
            strokeWidth="2"
            opacity="0.95"
          />

          { }
          <path
            d="M 12 50 L 32 50 L 37 42 L 42 58 L 47 22 L 53 74 L 59 44 L 64 54 L 68 50 L 88 50"
            fill="none"
            stroke="#00b38e"
            strokeWidth="3.5"
            opacity="0.3"
            filter="url(#green-glow)"
            className="ecg-pulse-line"
          />

          { }
          <path
            d="M 12 50 L 32 50 L 37 42 L 42 58 L 47 22 L 53 74 L 59 44 L 64 54 L 68 50 L 88 50"
            fill="none"
            stroke="#00b38e"
            strokeWidth="2.25"
            className="ecg-pulse-line"
          />
        </svg>

        { }
        <p className="text-slate-500 font-bold uppercase tracking-[0.25em] mt-8 select-none animate-pulse text-[10px]">
          {message}
        </p>
      </div>
    </div>
  );
};

export default LoadingScreen;
