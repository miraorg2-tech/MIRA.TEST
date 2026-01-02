import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Message, TaskType } from '../types';
import { Bot, User, Play, Pause, MapPin, Search } from 'lucide-react';
import { decodeAudio } from '../services/geminiService';

interface ChatMessageProps {
  message: Message;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isUser = message.role === 'user';
  const [isPlaying, setIsPlaying] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  
  // Play Audio Logic
  const handlePlayAudio = async () => {
    if (!message.audioData) return;
    
    if (isPlaying) {
      audioContextRef.current?.close();
      audioContextRef.current = null;
      setIsPlaying(false);
      return;
    }

    try {
      setIsPlaying(true);
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      audioContextRef.current = ctx;
      
      const buffer = await decodeAudio(message.audioData, ctx);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.onended = () => setIsPlaying(false);
      source.start();
    } catch (e) {
      console.error("Audio playback error", e);
      setIsPlaying(false);
    }
  };

  return (
    <div className={`flex w-full mb-6 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex max-w-[85%] md:max-w-[75%] gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        
        {/* Avatar */}
        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${isUser ? 'bg-indigo-600' : 'bg-emerald-600'}`}>
          {isUser ? <User size={16} /> : <Bot size={16} />}
        </div>

        {/* Content Bubble */}
        <div className={`flex flex-col gap-2 ${isUser ? 'items-end' : 'items-start'}`}>
          
          {/* Metadata Badge (Assistant only) */}
          {!isUser && message.orchestrationData && (
            <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
              <span className="bg-slate-800 px-2 py-0.5 rounded border border-slate-700 text-indigo-300 font-mono">
                {message.usedModel}
              </span>
              <span className="text-slate-500">
                • {message.orchestrationData.reasoning}
              </span>
            </div>
          )}

          <div className={`p-4 rounded-2xl ${
            isUser 
              ? 'bg-indigo-600 text-white rounded-tr-none' 
              : 'bg-slate-800 text-slate-100 border border-slate-700 rounded-tl-none shadow-lg'
          }`}>
            
            {/* TEXT CONTENT */}
            {message.content && (
              <div className="prose prose-invert prose-sm max-w-none">
                <ReactMarkdown>{message.content}</ReactMarkdown>
              </div>
            )}

            {/* SEARCH RESULTS */}
            {message.groundingUrls && message.groundingUrls.length > 0 && (
              <div className="mt-3 flex flex-col gap-1">
                <div className="text-xs font-semibold text-slate-400 flex items-center gap-1">
                  <Search size={12} /> Sources
                </div>
                {message.groundingUrls.map((url, idx) => (
                  <a 
                    key={idx} 
                    href={url.uri} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-xs text-blue-400 hover:underline truncate block max-w-[300px]"
                  >
                    {url.title || url.uri}
                  </a>
                ))}
              </div>
            )}

            {/* IMAGE CONTENT */}
            {message.taskType === TaskType.IMAGE && message.attachmentUrl && (
              <div className="mt-3 relative group">
                <img 
                  src={message.attachmentUrl} 
                  alt="Generated content" 
                  className="rounded-lg max-w-full h-auto max-h-[400px] border border-slate-600"
                />
                <a 
                  href={message.attachmentUrl} 
                  download="generated-image.png"
                  className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  Download
                </a>
              </div>
            )}

            {/* VIDEO CONTENT */}
            {message.taskType === TaskType.VIDEO && message.attachmentUrl && (
              <div className="mt-3">
                 <video 
                   controls 
                   autoPlay 
                   loop 
                   className="rounded-lg max-w-full border border-slate-600"
                 >
                   <source src={message.attachmentUrl} type="video/mp4" />
                   Your browser does not support the video tag.
                 </video>
              </div>
            )}

            {/* AUDIO CONTENT */}
            {message.taskType === TaskType.AUDIO && (
              <div className="mt-3 flex items-center gap-3 bg-slate-900/50 p-3 rounded-lg border border-slate-700">
                <button 
                  onClick={handlePlayAudio}
                  className="w-10 h-10 rounded-full bg-indigo-500 hover:bg-indigo-400 flex items-center justify-center transition-colors"
                >
                  {isPlaying ? <Pause size={18} fill="white" /> : <Play size={18} fill="white" className="ml-1" />}
                </button>
                <div className="flex flex-col">
                  <span className="text-sm font-medium">Audio Response</span>
                  <span className="text-xs text-slate-400">Generated by Gemini TTS</span>
                </div>
                {isPlaying && (
                   <div className="flex gap-1 items-end h-4 ml-2">
                     <div className="w-1 bg-indigo-400 h-2 animate-pulse"></div>
                     <div className="w-1 bg-indigo-400 h-4 animate-pulse delay-75"></div>
                     <div className="w-1 bg-indigo-400 h-3 animate-pulse delay-150"></div>
                   </div>
                )}
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
};