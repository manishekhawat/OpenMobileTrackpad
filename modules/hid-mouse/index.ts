// Re-export the native module. On web, it will be resolved to HidMouseModule.web.ts
// and on native platforms to HidMouseModule.ts
export { default } from './src/HidMouseModule';
export * from './src/HidMouse.types';
