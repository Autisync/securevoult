import { LegalLayout, P, InfoBox, Table } from '@/components/LegalLayout';
import { LEGAL } from '@/lib/legal';

export const metadata = {
  title: 'Cookie Policy — SecureVoult by Autisync',
  description: 'The small amount SecureVoult stores in your browser, and why. No advertising or analytics cookies.',
};

const sections = [
  {
    id: 'summary',
    title: 'Summary',
    content: (
      <>
        <InfoBox color="green">
          SecureVoult uses no advertising, analytics or tracking cookies. Everything it stores in your browser is needed for the app to work, so under the UK&apos;s PECR rules we don&apos;t need to ask for consent, and there is no cookie banner.
        </InfoBox>
        <P>Besides cookies, browsers have local storage and IndexedDB. We use these rather than cookies, and this page covers all of them.</P>
      </>
    ),
  },
  {
    id: 'what-we-store',
    title: 'What we store and why',
    content: (
      <Table
        headers={['What', 'Why', 'How long']}
        rows={[
          ['Sign-in (Firebase, IndexedDB)', 'Keeps you signed in', 'Until you sign out'],
          ['Encrypted vault copy', 'Lets you open your vault offline and sync changes later. Locked with your master password', 'Until you sign out or clear site data'],
          ['Two-step sign-in proof', 'Shows the server you passed two-step sign-in on this device', 'Up to 30 days'],
          ['"Keep me unlocked" key (IndexedDB)', 'Only if you turn it on: keeps the vault unlocked on this device, itself encrypted with a key the browser won\'t export', 'The number of days you chose'],
          ['Windows Hello / Touch ID unlock', 'Only if you set it up: an encrypted copy of the vault key that only your device\'s authenticator can open', 'Until you remove it in Settings'],
          ['Settings (theme, filters, auto-lock, clipboard timer)', 'Remembers your choices', 'Until you change them'],
        ]}
      />
    ),
  },
  {
    id: 'extension',
    title: 'The browser extension',
    content: (
      <P>The extension keeps an encrypted copy of your vault in the browser&apos;s extension storage. While it is unlocked, it holds the key in session storage, which the browser clears when it closes or when SecureVoult auto-locks.</P>
    ),
  },
  {
    id: 'control',
    title: 'Clearing it',
    content: (
      <P>Signing out or locking clears the unlocked state. You can remove everything by clearing this site&apos;s data in your browser settings; you&apos;ll then need to sign in again. Questions: <strong>{LEGAL.email}</strong>.</P>
    ),
  },
];

export default function CookiesPage() {
  return (
    <LegalLayout
      title="Cookie Policy"
      subtitle="The small amount SecureVoult keeps in your browser, and why. Nothing for advertising, nothing for tracking."
      lastUpdated={LEGAL.updated}
      effectiveDate={LEGAL.updated}
      badge="No tracking"
      sections={sections}
    />
  );
}
