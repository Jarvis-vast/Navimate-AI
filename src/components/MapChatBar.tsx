import React, { useState } from 'react';
import { Mic, MicOff, Send, Sparkles, Navigation, Fuel, Hotel, RefreshCw } from 'lucide-react';
import { SpeechRecognitionState } from '../services/voice';

interface MapChatBarProps {
  onSendMessage: (text: string) => void;
  voiceState: SpeechRecognitionState;
  onToggleVoice: () => void;
  isLoading: boolean;
  onQuickQuery: (query: string) => void;
}

export const MapChatBar: React.FC<MapChatBarProps> = ({
  onSendMessage,
  voiceState,
  onToggleVoice,
  isLoading,
  onQuickQuery,
}) => {
  const [inputText, setInputText] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isLoading) return;
    onSendMessage(inputText.trim());
    setInputText('');
  };

  const getVoiceColor = () => {
    switch (voiceState) {
      case 'listening':
        return 'bg-red-600 text-white animate-pulse ring-4 ring-red-500/40';
      case 'thinking':
        return 'bg-amber-500 text-white animate-spin';
      case 'speaking':
        return 'bg-blue-600 text-white animate-bounce';
      case 'error':
        return 'bg-rose-700 text-white';
      default:
        return 'bg-blue-600 hover:bg-blue-500 text-white';
    }
  };

  return (
    <div className="w-full flex flex-col gap-2">
      {/* Quick Action Chips */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
        <button
          onClick={() => onQuickQuery('Find petrol pumps on my route')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/90 hover:bg-slate-800 border border-slate-700/70 text-xs font-medium text-slate-200 shadow-sm shrink-0 backdrop-blur-md active:scale-95 transition"
        >
          <Fuel className="w-3.5 h-3.5 text-emerald-400" />
          Petrol Pumps
        </button>

        <button
          onClick={() => onQuickQuery('Find hotels under ₹3000 near highway')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/90 hover:bg-slate-800 border border-slate-700/70 text-xs font-medium text-slate-200 shadow-sm shrink-0 backdrop-blur-md active:scale-95 transition"
        >
          <Hotel className="w-3.5 h-3.5 text-amber-400" />
          Hotels &lt; ₹3000
        </button>

        <button
          onClick={() => onQuickQuery('Reroute around traffic')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/90 hover:bg-slate-800 border border-slate-700/70 text-xs font-medium text-slate-200 shadow-sm shrink-0 backdrop-blur-md active:scale-95 transition"
        >
          <RefreshCw className="w-3.5 h-3.5 text-blue-400" />
          Reroute Traffic
        </button>

        <button
          onClick={() => onQuickQuery('How much fuel will this trip cost?')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/90 hover:bg-slate-800 border border-slate-700/70 text-xs font-medium text-slate-200 shadow-sm shrink-0 backdrop-blur-md active:scale-95 transition"
        >
          <Sparkles className="w-3.5 h-3.5 text-purple-400" />
          Fuel Economics
        </button>
      </div>

      {/* Main Bar */}
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 p-2 rounded-2xl bg-slate-900/95 border border-slate-700/80 shadow-2xl backdrop-blur-xl"
      >
        <button
          type="button"
          onClick={onToggleVoice}
          title={voiceState === 'listening' ? 'Listening...' : 'Voice Command'}
          className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-all ${getVoiceColor()}`}
        >
          {voiceState === 'listening' ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>

        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Where to? Ask NaviMate AI..."
          className="flex-1 bg-transparent px-2 text-sm text-white placeholder-slate-400 focus:outline-none"
        />

        <button
          type="submit"
          disabled={!inputText.trim() || isLoading}
          className="w-11 h-11 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-blue-400 flex items-center justify-center shrink-0 active:scale-95 transition border border-slate-700/50"
        >
          {isLoading ? (
            <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </button>
      </form>
    </div>
  );
};
