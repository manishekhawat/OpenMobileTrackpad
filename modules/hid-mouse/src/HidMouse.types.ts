export type StatusEvent = { text: string };

export type HostChangedEvent = {
  connected: boolean;
  name: string | null;
  address: string | null;
};

export type PairedDevice = { name: string; address: string };

export type HidMouseModuleEvents = {
  onStatus: (event: StatusEvent) => void;
  onHostChanged: (event: HostChangedEvent) => void;
};

export const Button = {
  Left: 1,
  Right: 2,
  Middle: 4,
} as const;
