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
  image_url: string | null;
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
  force_search?: boolean;
  force_image?: boolean;
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
  credits_charged: number;
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

// ---- mirrors of backend/models/account.py ----
export interface UserSettings {
  voice_speed: number;
  silence_ms: number;
  start_word: string;
  wake_enabled: boolean;
  large_text: boolean;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface GoogleSessionRequest {
  session_id: string;
}

export interface AgeUpdate {
  age: number;
  parent_email?: string | null;
  parent_consent?: boolean;
}

export interface AuthUser {
  user_id: string;
  email: string;
  name: string;
  picture: string | null;
  provider: "google" | "email";
  age: number | null;
  parent_email: string | null;
  parent_consent: boolean;
  needs_age: boolean;
  needs_consent: boolean;
  settings: UserSettings;
}

export interface CreditEvent {
  kind: "image" | "3d" | "refund";
  credits: number;
  note: string;
  at: string;
}

export interface CreditStatus {
  tier: "Guest" | "Member";
  credits_total: number;
  credits_left: number;
  images_total: number;
  images_used: number;
  images_left: number;
  seconds_to_reset: number;
  low: boolean;
  locked: boolean;
  image_cost: number;
  model3d_cost: number;
  events: CreditEvent[];
}
