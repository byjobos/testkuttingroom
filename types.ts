
export enum Role {
  User = 'user',
  AI = 'ai',
  System = 'system',
}

export interface TranscriptEntry {
  id: number;
  role: Role;
  text: string;
}

export enum Status {
  Idle = 'idle',
  Connecting = 'connecting',
  Listening = 'listening',
  Processing = 'processing',
  Error = 'error',
}
