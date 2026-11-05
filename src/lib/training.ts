/**
 * The training videos on /training. Each is a short screen recording with a
 * voiceover, hosted on YouTube (nothing stored on our server).
 *
 * To publish one: upload it to YouTube (Unlisted or Public), copy the id from
 * its link (youtube.com/watch?v=THIS_PART) into `youtube`, and redeploy.
 * Lessons without an id show as "Coming soon".
 */
export type Audience = 'employees' | 'admins';
export type Topic = 'start' | 'data' | 'security' | 'productivity';

export interface Lesson {
  id: string;
  audience: Audience;
  topic: Topic;
  title: string;
  /** What you learn, one or two sentences. */
  summary: string;
  minutes: number;
  /** YouTube video id, e.g. "dQw4w9WgXcQ". Empty until uploaded. */
  youtube: string;
}

export const TOPICS: Record<Audience, { id: Topic; label: string }[]> = {
  employees: [
    { id: 'start', label: 'Getting started' },
    { id: 'data', label: 'Passwords and data' },
    { id: 'security', label: 'Security and monitoring' },
    { id: 'productivity', label: 'Productivity' },
  ],
  admins: [
    { id: 'start', label: 'Setting up' },
    { id: 'security', label: 'Security and monitoring' },
  ],
};

export const LESSONS: Lesson[] = [
  // Employees: getting started
  { id: 'create-vault', audience: 'employees', topic: 'start', minutes: 2, youtube: '', title: 'Create your account and vault', summary: 'Sign up, choose a master password you can remember, and print your Recovery Kit so a forgotten password never locks you out.' },
  { id: 'extension', audience: 'employees', topic: 'start', minutes: 1, youtube: '', title: 'Install the browser extension', summary: 'Add SecureVoult to Chrome or Edge, pin it, and sign in once so it fills your logins on every site.' },
  { id: 'import', audience: 'employees', topic: 'start', minutes: 2, youtube: '', title: 'Move from NordPass or another manager', summary: 'Export a CSV from your old password manager or browser, import it in Settings, then delete the CSV.' },
  { id: 'quick-unlock', audience: 'employees', topic: 'start', minutes: 1, youtube: '', title: 'Unlock with Windows Hello or a fingerprint', summary: 'Turn on quick unlock so you open the vault with your face or finger instead of typing the master password each time.' },
  // Employees: passwords and data
  { id: 'save-fill', audience: 'employees', topic: 'data', minutes: 1, youtube: '', title: 'Save and fill passwords', summary: 'Sign in to a site as usual and SecureVoult offers to save it. Next time, one click fills it in.' },
  { id: 'documents', audience: 'employees', topic: 'data', minutes: 2, youtube: '', title: 'Keep ID documents with photos', summary: 'Add your passport, ID card or driving licence with photos of the front and back, and get a reminder before it expires.' },
  { id: 'cards-notes', audience: 'employees', topic: 'data', minutes: 1, youtube: '', title: 'Cards, secure notes and contact info', summary: 'Store payment cards, Wi-Fi passwords, recovery codes and your address for forms, all encrypted.' },
  { id: 'trash', audience: 'employees', topic: 'data', minutes: 1, youtube: '', title: 'Restore something you deleted', summary: 'Deleted items wait in Trash for 30 days. Bring one back, or delete it for good.' },
  // Employees: security and monitoring
  { id: 'health', audience: 'employees', topic: 'security', minutes: 2, youtube: '', title: 'Fix weak and reused passwords', summary: 'Password health lists weak, reused and leaked passwords. Fix the riskiest first with the generator.' },
  { id: 'breach', audience: 'employees', topic: 'security', minutes: 2, youtube: '', title: 'Data breach scanner', summary: 'See whether your email addresses appeared in a data breach, what leaked, and what to change.' },
  { id: 'two-step', audience: 'employees', topic: 'security', minutes: 2, youtube: '', title: 'Two-step sign-in', summary: 'Add an authenticator app so a stolen password alone can\'t open your account.' },
  { id: 'masking', audience: 'employees', topic: 'security', minutes: 1, youtube: '', title: 'Email masking', summary: 'Give sites a mask instead of your real address. Switch it off if it starts getting spam.' },
  // Employees: productivity
  { id: 'passkeys', audience: 'employees', topic: 'productivity', minutes: 1, youtube: '', title: 'Passkeys saved in your vault', summary: 'When a site offers a passkey, save it in SecureVoult and use it on any computer you sign in on.' },
  { id: 'search', audience: 'employees', topic: 'productivity', minutes: 1, youtube: '', title: 'Find anything in seconds', summary: 'Press Ctrl + F, use the tabs for passwords, cards and documents, and star the ones you use most.' },
  // IT admins
  { id: 'company', audience: 'admins', topic: 'start', minutes: 2, youtube: '', title: 'Set up your company and invite the team', summary: 'Create the company, invite people by email, and see who has joined from the admin console.' },
  { id: 'self-host', audience: 'admins', topic: 'start', minutes: 3, youtube: '', title: 'Run SecureVoult on your own server', summary: 'What the self-hosted Enterprise plan needs: a Linux server with Docker, your domain, email settings and backups.' },
  { id: 'security-log', audience: 'admins', topic: 'security', minutes: 2, youtube: '', title: 'Read the security log and alerts', summary: 'Every sign-in, failed attempt and change, with IP, device and country. Serious events are emailed straight away.' },
  { id: 'sessions', audience: 'admins', topic: 'security', minutes: 1, youtube: '', title: 'Sign a device out remotely', summary: 'Someone lost a laptop or left the company? End their sessions from the admin console in two clicks.' },
];
