export enum TaskType {
  TEXT = 'TEXT',
  IMAGE = 'IMAGE',
  VIDEO = 'VIDEO',
  AUDIO = 'AUDIO',
  SEARCH = 'SEARCH',
}

export interface OrchestrationDecision {
  type: TaskType;
  model: string;
  reasoning: string;
  refinedPrompt: string;
  requiresPaidKey?: boolean;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  // Metadata for assistant responses
  taskType?: TaskType;
  usedModel?: string;
  attachmentUrl?: string; // For images/videos
  audioData?: string; // For base64 audio
  groundingUrls?: Array<{ title: string; uri: string }>;
  isThinking?: boolean; // UI state
  orchestrationData?: OrchestrationDecision;
}

export interface VideoOperationResponse {
  name: string;
  done: boolean;
  response?: {
    generatedVideos?: Array<{
      video: {
        uri: string;
      }
    }>
  }
}