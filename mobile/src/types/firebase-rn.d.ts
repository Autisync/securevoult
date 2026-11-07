/**
 * Firebase's package lists its browser typings first, so TypeScript doesn't see
 * the React Native build's extra export. Metro loads the React Native build
 * (the "react-native" condition), which has it.
 */
import type { Persistence } from '@firebase/auth';

declare module '@firebase/auth' {
  export function getReactNativePersistence(storage: {
    setItem(key: string, value: string): Promise<void>;
    getItem(key: string): Promise<string | null>;
    removeItem(key: string): Promise<void>;
  }): Persistence;
}
