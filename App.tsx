import React, { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, AlertCircle } from 'lucide-react';
import { 
  orchestrateRequest, 
  generateTextResponse, 
  generateImageResponse, 
  generateVideoResponse, 
  generateAudioResponse 
} from './services/geminiService';
import { Message, TaskType } from './types';
import { ChatMessage } from './components/ChatMessage';
import { ThinkingIndicator } from './components/ThinkingIndicator';

// Extend window for AI Studio check
declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
  interface Window {
    aistudio?: AIStudio;
  }
}

export default function App() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: "I'm Nexus, your AI Orchestrator. Tell me what you need, and I'll route it to the perfect Gemini model—whether it's generating 4K images, Veo videos, speech, or complex reasoning.",
      timestamp: Date.now()
    }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState<'orchestrating' | 'generating' | null>(null);
  const [currentModel, setCurrentModel] = useState<string | undefined>();
  const [currentTask, setCurrentTask] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loadingStep]);

  // Handle API Key Selection for Paid Models (Veo/Pro Image)
  const ensurePaidKeySelection = async () => {
    if (window.aistudio) {
      const hasKey = await window.aistudio.hasSelectedApiKey();
      if (!hasKey) {
        await window.aistudio.openSelectKey();
        // Assume success after dialog interaction per guidelines
        return true; 
      }
      return true;
    }
    return true; // If not in AI Studio environment, we proceed with env key
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);
    setError(null);
    setLoadingStep('orchestrating');

    try {
      // 1. Orchestrate
      const decision = await orchestrateRequest(userMsg.content);
      console.log("Orchestration Decision:", decision);

      setCurrentModel(decision.model);
      setCurrentTask(decision.type);
      setLoadingStep('generating');

      // Check for Paid Key requirement (Veo, Pro Image)
      if (decision.requiresPaidKey) {
        try {
          await ensurePaidKeySelection();
        } catch (keyError) {
           throw new Error("API Key selection failed or was cancelled.");
        }
      }

      // 2. Execute
      let responseContent: Partial<Message> = {
        role: 'assistant',
        taskType: decision.type,
        usedModel: decision.model,
        orchestrationData: decision,
      };

      switch (decision.type) {
        case TaskType.TEXT:
        case TaskType.SEARCH:
          const textResult = await generateTextResponse(
            decision.model, 
            decision.refinedPrompt, 
            decision.type === TaskType.SEARCH
          );
          responseContent.content = textResult.text;
          responseContent.groundingUrls = textResult.groundingChunks?.map((c: any) => ({
            uri: c.web?.uri || c.maps?.uri,
            title: c.web?.title || c.maps?.title || "Source"
          })).filter((x: any) => x.uri);
          break;

        case TaskType.IMAGE:
          const imageResult = await generateImageResponse(decision.model, decision.refinedPrompt);
          responseContent.content = `I've generated an image based on your description: "${decision.refinedPrompt}"`;
          responseContent.attachmentUrl = `data:${imageResult.mimeType};base64,${imageResult.base64}`;
          break;

        case TaskType.VIDEO:
          responseContent.content = `I've generated a video for: "${decision.refinedPrompt}". This process took some time to render using Veo.`;
          const videoUrl = await generateVideoResponse(decision.model, decision.refinedPrompt);
          responseContent.attachmentUrl = videoUrl;
          break;

        case TaskType.AUDIO:
          const audioBase64 = await generateAudioResponse(decision.model, decision.refinedPrompt);
          responseContent.content = `Here is the audio playback for your text.`;
          responseContent.audioData = audioBase64;
          break;
      }

      setMessages(prev => [...prev, { id: Date.now().toString(), timestamp: Date.now(), ...responseContent } as Message]);

    } catch (err: any) {
      console.error(err);
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setIsLoading(false);
      setLoadingStep(null);
      setCurrentModel(undefined);
      setCurrentTask(undefined);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-slate-100 font-sans selection:bg-indigo-500/30">
      
      {/* Header */}
      <header className="flex-none p-4 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg shadow-lg shadow-indigo-500/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg tracking-tight">Nexus AI</h1>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-xs text-slate-400 font-mono">ORCHESTRATOR ONLINE</span>
              </div>
            </div>
          </div>
          <div className="hidden sm:flex text-xs text-slate-500 gap-4">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-indigo-500"></span>Text</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-pink-500"></span>Image</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-blue-500"></span>Video</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-orange-500"></span>Audio</span>
          </div>
        </div>
      </header>

      {/* Main Chat Area */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 scroll-smooth">
        <div className="max-w-3xl mx-auto">
          {messages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} />
          ))}
          
          {isLoading && loadingStep && (
            <div className="ml-12 mb-6">
              <ThinkingIndicator step={loadingStep} model={currentModel} taskType={currentTask} />
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 p-4 mb-4 text-sm text-red-200 bg-red-900/20 border border-red-800 rounded-lg ml-12 animate-in fade-in slide-in-from-bottom-2">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Input Area */}
      <footer className="flex-none p-4 bg-slate-900 border-t border-slate-800">
        <div className="max-w-3xl mx-auto relative">
          <form onSubmit={handleSubmit} className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl opacity-20 group-hover:opacity-40 transition duration-500 blur"></div>
            <div className="relative flex items-end gap-2 bg-slate-950 rounded-xl p-2 border border-slate-800 shadow-xl">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
                placeholder="Describe your task (e.g., 'Draw a cyberpunk city', 'Explain quantum physics', 'Create a video of a cat running')..."
                className="w-full bg-transparent border-none focus:ring-0 text-slate-200 placeholder-slate-500 resize-none max-h-32 min-h-[50px] py-3 px-3 text-sm scrollbar-thin"
                rows={1}
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="p-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:hover:bg-indigo-600 text-white rounded-lg transition-all duration-200 shadow-lg shadow-indigo-500/20 mb-0.5"
              >
                <Send size={18} />
              </button>
            </div>
          </form>
          <div className="text-center mt-3">
             <p className="text-[10px] text-slate-600">
               Powered by Google Gemini 2.5 & 3.0 • Veo • Imagen
             </p>
          </div>
        </div>
      </footer>
    </div>
  );
}