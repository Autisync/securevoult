export interface User {
  id: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  provider: string;
  emailVerified: boolean;
  createdAt: Date;
  role?: 'user' | 'admin';
  /** Plan in effect (admins count as enterprise). From the server at sign-in. */
  plan?: 'free' | 'pro' | 'company' | 'enterprise';
  billingCycle?: 'monthly' | 'yearly';
  planExpiresAt?: string | null;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface SignUpData {
  email: string;
  password: string;
  displayName?: string;
}

export interface SignInData {
  email: string;
  password: string;
}

export interface AuthContextType extends AuthState {
  authToken: string | null;
  signUp: (data: SignUpData) => Promise<void>;
  signIn: (data: SignInData) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}
