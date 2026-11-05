import { LegalLayout, P, H3, Ul, Li, InfoBox, Table } from '@/components/LegalLayout';
import { LEGAL } from '@/lib/legal';

export const metadata = {
  title: 'Security — SecureVoult by Autisync',
  description: 'How SecureVoult encrypts your vault, and how to report a security issue.',
};

const sections = [
  {
    id: 'design',
    title: 'How your vault is protected',
    content: (
      <>
        <Table
          headers={['Layer', 'What it does']}
          rows={[
            ['Argon2id (64 MiB, 3 passes)', 'Turns your master password into a key on your device. Each guess costs an attacker real memory and time'],
            ['Random vault key', 'Encrypts the vault; it is itself locked by your master-password key, and optionally by your recovery key'],
            ['AES-256-GCM', 'Encrypts the vault and each file, and detects any change to them'],
            ['Two-step sign-in', 'Authenticator-app codes, with one-time backup codes, needed before a device can download the vault'],
            ['Device unlock', 'Windows Hello, Touch ID or fingerprint via WebAuthn; or a time-limited "keep me unlocked" key that the browser cannot export'],
          ]}
        />
        <InfoBox color="green">Your master password and recovery key never leave your device. The server stores only encrypted vaults and files.</InfoBox>
        <H3>The browser extension</H3>
        <Ul>
          <Li>Offers logins only on the website they belong to (matching the site&apos;s domain), never on a look-alike</Li>
          <Li>Draws its menu in an isolated part of the page so the website can&apos;t read it</Li>
          <Li>Keeps the unlocked key in browser session storage and forgets it when it auto-locks</Li>
        </Ul>
      </>
    ),
  },
  {
    id: 'report',
    title: 'Reporting a security issue',
    content: (
      <>
        <P>If you think you have found a vulnerability, email <strong>{LEGAL.email}</strong> with &quot;Security&quot; in the subject, what you found, how to reproduce it and what an attacker could do with it.</P>
        <Ul>
          <Li>We&apos;ll confirm we received it within 3 working days</Li>
          <Li>We&apos;ll keep you updated while we fix it, and credit you if you&apos;d like</Li>
          <Li>We won&apos;t take legal action over good-faith research that follows the rules below</Li>
        </Ul>
      </>
    ),
  },
  {
    id: 'rules',
    title: 'Rules for research',
    content: (
      <Ul>
        <Li>Only test against accounts you own</Li>
        <Li>Don&apos;t access, change or delete other people&apos;s data, and stop as soon as you reach any</Li>
        <Li>No denial-of-service, spam or social engineering of Autisync staff or users</Li>
        <Li>Give us reasonable time to fix an issue before telling anyone else</Li>
      </Ul>
    ),
  },
  {
    id: 'in-scope',
    title: 'In scope',
    content: (
      <Ul>
        <Li>{LEGAL.site} and its API</Li>
        <Li>The SecureVoult browser extension</Li>
        <Li>The encryption design described above</Li>
      </Ul>
    ),
  },
];

export default function SecurityPage() {
  return (
    <LegalLayout
      title="Security"
      subtitle="How your vault is protected, and how to tell us if you find a problem."
      lastUpdated={LEGAL.updated}
      effectiveDate={LEGAL.updated}
      badge="Zero-knowledge"
      sections={sections}
    />
  );
}
