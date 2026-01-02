import { GoogleGenAI, Type, Modality } from "@google/genai";
import { TaskType, OrchestrationDecision } from "../types";

// Helper to get client instance - recreated to ensure fresh API key usage
const getClient = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * 1. ORCHESTRATION LAYER
 * Analyzes the user intent and selects the best model.
 */
export const orchestrateRequest = async (userPrompt: string): Promise<OrchestrationDecision> => {
  const ai = getClient();
  
  // We use Flash for the "Brain" logic as it's fast and cheap.
  const orchestratorModel = "gemini-3-flash-preview";

  const systemInstruction = `
    You are an AI Orchestrator. Your goal is to analyze the user's request and categorize it into one of the following tasks:
    - TEXT: General questions, writing, coding, reasoning.
    - IMAGE: Requests to draw, paint, generate, or create an image/picture/photo.
    - VIDEO: Requests to create, generate, or animate a video/movie/clip.
    - AUDIO: Requests to speak, say, or generate speech/audio.
    - SEARCH: Requests specifically asking for current events, news, or real-time info.

    You must also select the best Google Gemini model based on these rules:
    - Simple Text/Search -> 'gemini-3-flash-preview'
    - Complex Text/Reasoning/Coding -> 'gemini-3-pro-preview'
    - Image Generation -> 'gemini-2.5-flash-image' (Default) or 'gemini-3-pro-image-preview' (if high quality/HD/4k mentioned)
    - Video Generation -> 'veo-3.1-fast-generate-preview'
    - Audio/TTS -> 'gemini-2.5-flash-preview-tts'

    Refine the prompt to be optimal for the target model.
  `;

  const response = await ai.models.generateContent({
    model: orchestratorModel,
    contents: userPrompt,
    config: {
      systemInstruction: systemInstruction,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          type: { type: Type.STRING, enum: [TaskType.TEXT, TaskType.IMAGE, TaskType.VIDEO, TaskType.AUDIO, TaskType.SEARCH] },
          model: { type: Type.STRING },
          reasoning: { type: Type.STRING },
          refinedPrompt: { type: Type.STRING },
        },
        required: ["type", "model", "reasoning", "refinedPrompt"]
      }
    }
  });

  const result = JSON.parse(response.text || "{}");
  
  // Flag if Veo or Pro Image is used, as they might need paid key check in UI
  const requiresPaidKey = result.model.includes('veo') || result.model.includes('pro-image');

  return {
    type: result.type as TaskType,
    model: result.model,
    reasoning: result.reasoning,
    refinedPrompt: result.refinedPrompt,
    requiresPaidKey
  };
};

/**
 * 2. EXECUTION LAYER
 * Handlers for specific content types.
 */

// Text & Search
export const generateTextResponse = async (model: string, prompt: string, useSearch: boolean) => {
  const ai = getClient();
  const config: any = {
    // Basic text config
  };

  if (useSearch) {
    config.tools = [{ googleSearch: {} }];
  } else if (model.includes('pro')) {
     // Enable thinking for complex tasks if using Pro model
     config.thinkingConfig = { thinkingBudget: 1024 }; 
  }

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config
  });

  return {
    text: response.text,
    groundingChunks: response.candidates?.[0]?.groundingMetadata?.groundingChunks
  };
};

// Image Generation
export const generateImageResponse = async (model: string, prompt: string) => {
  const ai = getClient();
  
  // Specific check for Pro Image model capabilities
  const isPro = model === 'gemini-3-pro-image-preview';
  
  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      // Pro supports resolution, Flash does not (defaults to 1:1 usually)
      imageConfig: isPro ? { imageSize: "2K", aspectRatio: "16:9" } : { aspectRatio: "1:1" }
    }
  });

  // Extract image
  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return {
        base64: part.inlineData.data,
        mimeType: part.inlineData.mimeType || 'image/png'
      };
    }
  }
  throw new Error("No image data returned from API.");
};

// Video Generation
export const generateVideoResponse = async (model: string, prompt: string) => {
  const ai = getClient();
  
  let operation = await ai.models.generateVideos({
    model,
    prompt,
    config: {
      numberOfVideos: 1,
      resolution: '720p',
      aspectRatio: '16:9'
    }
  });

  // Poll for completion
  while (!operation.done) {
    await new Promise(resolve => setTimeout(resolve, 5000)); // Poll every 5s
    operation = await ai.operations.getVideosOperation({ operation });
  }

  const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
  if (!videoUri) throw new Error("Video generation failed or returned no URI.");

  // Fetch the actual bytes using the API key
  const fileResponse = await fetch(`${videoUri}&key=${process.env.API_KEY}`);
  if (!fileResponse.ok) throw new Error("Failed to download generated video.");
  
  const blob = await fileResponse.blob();
  return URL.createObjectURL(blob);
};

// Audio Generation (TTS)
export const generateAudioResponse = async (model: string, text: string) => {
  const ai = getClient();
  
  const response = await ai.models.generateContent({
    model,
    contents: [{ parts: [{ text }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Fenrir' }, // Deep, narrator voice
        },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) throw new Error("No audio data returned.");
  
  return base64Audio;
};

// Audio Decoding Helper
export const decodeAudio = async (base64: string, ctx: AudioContext) => {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
  // Simplified decoding for playback
  // Note: In a real robust app, we might handle headers manually if raw PCM, 
  // but Gemini TTS usually returns a container format decodable by browser if properly handled.
  // However, the docs say raw PCM often. 
  // For this implementation, we will try standard decodeAudioData which works if the API returns a WAV container 
  // or if we wrap the PCM. 
  
  // The guide mentions raw PCM. Let's implement the specific PCM decoder from the guide just in case.
  const audioBuffer = await decodeAudioDataRaw(bytes, ctx, 24000, 1);
  return audioBuffer;
};

async function decodeAudioDataRaw(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  // Convert Uint8 (bytes) to Int16 (PCM values)
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      // Normalize Int16 to Float32 (-1.0 to 1.0)
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}