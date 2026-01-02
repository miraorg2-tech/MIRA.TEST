import React from 'react';
import { Loader2, Cpu, ArrowRight } from 'lucide-react';

interface ThinkingIndicatorProps {
  step: 'orchestrating' | 'generating';
  model?: string;
  taskType?: string;
}

export const ThinkingIndicator: React.FC<ThinkingIndicatorProps> = ({ step, model, taskType }) => {
  return (
    <div className="flex items-center space-x-3 text-sm text-indigo-300 bg-slate-800/50 p-3 rounded-lg border border-slate-700/50 backdrop-blur-sm animate-pulse w-fit mt-2">
      {step === 'orchestrating' ? (
        <>
          <Cpu className="w-4 h-4 animate-spin-slow" />
          <span>Analyzing intent & routing...</span>
        </>
      ) : (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          <div className="flex items-center gap-2">
            <span>Routing to</span>
            <span className="font-mono font-bold text-indigo-400 bg-indigo-950/50 px-2 py-0.5 rounded text-xs border border-indigo-500/30">
              {model}
            </span>
            <ArrowRight className="w-3 h-3" />
            <span className="capitalize">{taskType?.toLowerCase()} Generation</span>
          </div>
        </>
      )}
    </div>
  );
};