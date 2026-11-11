// Hand-written mirrors of backend/models/pandi.py — keep in sync with the Pydantic models.

export interface Profile {
  profile_id: string;
  name: string;
  avatar_data_url: string | null;
  memory: string[];
  voice_mode: "voice" | "text";
  theme: "agni" | "vajra";
  created_at: string;
  updated_at: string;
}

export interface ProfileUpsert {
  name: string;
  avatar_data_url?: string | null;
  voice_mode?: "voice" | "text" | null;
  theme?: "agni" | "vajra" | null;
}

export interface MemoryUpdate {
  memory: string[];
}

export interface SourceRef {
  url: string;
  title: string | null;
}

export interface SceneSpec {
  scene: string;
  params: Record<string, unknown>;
  title: string;
  steps: string[];
  stats: string[];
}

export interface ChatMessage {
  id: string;
  session_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  live_search: boolean;
  sources: SourceRef[];
  scene: SceneSpec | null;
  attachments: string[];
}

export interface ChatHistory {
  session_id: string;
  messages: ChatMessage[];
}

export interface ChatSession {
  session_id: string;
  profile_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface SessionRename {
  title: string;
}

export interface CustomObject {
  shape?: string;
  color?: string;
  position?: [number, number, number];
  size?: number | [number, number, number];
  label?: string;
  animation?: "none" | "rotate" | "orbit" | "pulse" | "bounce" | "float";
  orbitRadius?: number;
  speed?: number;
  wire?: boolean;
  opacity?: number;
  info?: string;
}

export interface ChatStreamRequest {
  session_id: string;
  profile_id: string | null;
  message: string;
  language?: string;
  model?: string;
  use_live_search?: boolean;
  file_ids?: string[];
}

export interface ModelInfo {
  id: string;
  provider: string;
  label: string;
}

export interface FileUploadResponse {
  file_id: string;
  filename: string;
  mime_type: string;
  size: number;
  status: "ready";
}

export interface TodayResponse {
  today: string;
  utc_timestamp: string;
}

export interface VoiceStatus {
  configured: boolean;
  provider: "fish_audio" | "elevenlabs" | "browser";
  voice_id: string | null;
  cloned: boolean;
  detail: string;
}

export interface TTSRequest {
  text: string;
}

export interface TranscribeResponse {
  text: string;
}

export interface IntroVideoResponse {
  video_url: string;
}

export interface CreationRequest {
  profile_id: string;
  prompt: string;
}

export interface Creation {
  id: string;
  profile_id: string;
  prompt: string;
  category: string;
  name: string;
  brief: string;
  limitations: string;
  scene: SceneSpec;
  image_data_url: string | null;
  model_url: string | null;
  model_source: "tripo" | "procedural";
  created_at: string;
}

export interface CreationSummary {
  id: string;
  prompt: string;
  category: string;
  name: string;
  image_data_url: string | null;
  created_at: string;
}

export interface OwnerStatus {
  is_owner: boolean;
  claimed: boolean;
}

export interface OwnerOverview {
  total_profiles: number;
  total_messages: number;
  total_creations: number;
  claimed_at: string;
}

export interface OwnerEvent {
  action: "claimed" | "opened";
  recovery_key: string | null;
}
