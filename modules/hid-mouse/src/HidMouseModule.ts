import { NativeModule, requireNativeModule } from 'expo';

import { HidMouseModuleEvents, PairedDevice } from './HidMouse.types';

declare class HidMouseModule extends NativeModule<HidMouseModuleEvents> {
  /** Registers the phone as a Bluetooth mouse. Request permissions first. */
  start(): void;
  stop(): void;
  isConnected(): boolean;
  pairedDevices(): PairedDevice[];
  connect(address: string): void;
  disconnect(): void;
  /** Shows Android's "make visible" prompt so the laptop can find the phone. */
  makeDiscoverable(seconds: number): void;
  move(dx: number, dy: number): void;
  /** Positive = scroll up, negative = scroll down. */
  scroll(steps: number): void;
  press(button: number): void;
  release(button: number): void;
  click(button: number): void;
}

export default requireNativeModule<HidMouseModule>('HidMouse');
