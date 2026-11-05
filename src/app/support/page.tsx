import { LegalLayout, P, H3, Ul, Li, InfoBox } from '@/components/LegalLayout';
import { LEGAL } from '@/lib/legal';

export const metadata = {
  title: 'Support — SecureVoult by Autisync',
  description: 'Help with your SecureVoult account, vault, extension and recovery.',
};

const sections = [
  {
    id: 'contact',
    title: 'Contact us',
    content: (
      <>
        <InfoBox color="blue"><strong>Email:</strong> {LEGAL.email}</InfoBox>
        <P>Write from your account&apos;s email address and tell us what you were doing and what happened. Never send us your master password or recovery key; we will never ask for them.</P>
      </>
    ),
  },
  {
    id: 'forgot',
    title: 'Forgot your master password',
    content: (
      <>
        <P>Use your Recovery Kit. On the unlock screen choose <strong>Forgot master password?</strong>, type the recovery key, then choose a new master password. You&apos;ll get a new recovery key; print the new kit and destroy the old one.</P>
        <P>No Recovery Kit yet? While you still know your master password, make one in <strong>Settings → Security → Recovery Kit</strong>. Without the master password or the recovery key, nobody can open the vault, including us.</P>
      </>
    ),
  },
  {
    id: 'unlock',
    title: 'Unlocking without typing your master password',
    content: (
      <>
        <H3>Windows Hello, Touch ID or fingerprint</H3>
        <P>Turn it on in <strong>Settings → Security → Quick unlock</strong> on each device. If your browser or device can&apos;t do it yet, you&apos;ll see a message saying so; use the option below instead.</P>
        <H3>Keep me unlocked</H3>
        <P>Tick <strong>Keep me unlocked on this device</strong> on the unlock screen, or set the number of days in Settings. Only use it on a computer that only you use.</P>
      </>
    ),
  },
  {
    id: 'moving',
    title: 'Moving from another password manager',
    content: (
      <Ul>
        <Li>Export a CSV from your old manager (in NordPass: Settings → Export items)</Li>
        <Li>In SecureVoult open <strong>Settings → Import / Export</strong> and choose <strong>Select CSV file</strong></Li>
        <Li>Delete the CSV afterwards: it contains your passwords in plain text</Li>
      </Ul>
    ),
  },
  {
    id: 'sync',
    title: 'Sync and the extension',
    content: (
      <>
        <H3>Shows &quot;Offline&quot; or changes don&apos;t appear</H3>
        <Ul>
          <Li>Your changes are kept on the device and upload when you&apos;re back online</Li>
          <Li>Make sure each device is signed in with the same email</Li>
          <Li>If two-step sign-in is on, a new device asks for a code before it can sync</Li>
        </Ul>
        <H3>Extension not offering a login</H3>
        <Ul>
          <Li>Unlock it from the toolbar icon</Li>
          <Li>Check the item&apos;s web address matches the site. The extension deliberately won&apos;t offer logins on a different domain</Li>
        </Ul>
      </>
    ),
  },
  {
    id: 'account',
    title: 'Plans and closing your account',
    content: (
      <>
        <P>Change or cancel your plan in <strong>Settings → Billing</strong>. To close your account and delete your data, export your vault first, then email {LEGAL.email} from your account&apos;s address. We delete it within one month.</P>
        <P>Found a security problem? See the <a href="/security" className="underline underline-offset-2">security page</a>.</P>
      </>
    ),
  },
];

export default function SupportPage() {
  return (
    <LegalLayout
      title="Support"
      subtitle="Help with your SecureVoult account, vault, extension and recovery."
      lastUpdated={LEGAL.updated}
      effectiveDate={LEGAL.updated}
      badge="Help"
      sections={sections}
    />
  );
}
