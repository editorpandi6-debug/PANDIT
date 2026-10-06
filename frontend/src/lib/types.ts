export interface Profile {
  profile_id: string;
  name: string;
  avatar_data_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface SourceRef {
  url: string;
  title: string | null;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  live_search: boolean;
  sources: SourceRef[];
  visual_scene: string | null;
}

export interface ChatHistory {
  session_id: string;
  messages: ChatMessage[];
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

export type SceneKey = "solar-system" | "atom" | "geometry" | "math-surface";
