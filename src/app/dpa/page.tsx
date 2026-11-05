import { LegalLayout, P, Ul, Li, InfoBox, Table } from '@/components/LegalLayout';
import { LEGAL } from '@/lib/legal';

export const metadata = {
  title: 'Data Processing Agreement — SecureVoult by Autisync',
  description: 'How Autisync processes personal data for businesses on SecureVoult company plans (UK GDPR Article 28).',
};

const who = [LEGAL.company, LEGAL.companyNumber && `company number ${LEGAL.companyNumber}`, LEGAL.address].filter(Boolean).join(', ');

const sections = [
  {
    id: 'scope',
    title: 'Scope',
    content: (
      <>
        <P>This agreement forms part of the <a href="/terms" className="underline underline-offset-2">Terms of Service</a> between a business on a SecureVoult company or enterprise plan (the &quot;Customer&quot;, as controller) and <strong>{who}</strong> (&quot;Autisync&quot;, as processor). It meets Article 28 of the UK GDPR.</P>
        <InfoBox color="green">Vault content and files are encrypted on each user&apos;s device. Autisync stores them only in that encrypted form and has no way to read them.</InfoBox>
      </>
    ),
  },
  {
    id: 'processing',
    title: 'What we process',
    content: (
      <Table
        headers={['', '']}
        rows={[
          ['Subject matter', 'Providing SecureVoult to the Customer\'s users'],
          ['Duration', 'While the Customer\'s plan is active, then deletion as below'],
          ['People', 'The Customer\'s staff and other users it invites'],
          ['Data', 'Name, work email, role, sessions (device, IP address, last seen), plan details, two-step sign-in data, encrypted vaults and files'],
          ['Purpose', 'Sign-in, sync, sharing within the company, security and support'],
        ]}
      />
    ),
  },
  {
    id: 'our-commitments',
    title: 'Autisync commits to',
    content: (
      <Ul>
        <Li>Process the data only on the Customer&apos;s documented instructions (these terms and the Customer&apos;s use of the admin settings), unless UK law requires otherwise</Li>
        <Li>Make sure anyone at Autisync with access is bound by confidentiality</Li>
        <Li>Keep the security measures below in place</Li>
        <Li>Only use the sub-processors listed below, and give 30 days&apos; notice of a new one so the Customer can object</Li>
        <Li>Help the Customer answer data-subject requests and with security, breach and impact-assessment duties, as far as our role allows</Li>
        <Li>Tell the Customer without undue delay, and within 48 hours, after becoming aware of a personal data breach affecting its data</Li>
        <Li>On request, provide the information needed to show we meet this agreement, and allow reasonable audits with 30 days&apos; notice</Li>
        <Li>When the plan ends, delete the Customer&apos;s data within 30 days (backups roll off within 14 more), unless the law requires us to keep it</Li>
      </Ul>
    ),
  },
  {
    id: 'security-measures',
    title: 'Security measures',
    content: (
      <Ul>
        <Li>End-to-end encryption of vaults and files on users&apos; devices (AES-256-GCM, Argon2id key derivation); keys never sent to Autisync</Li>
        <Li>HTTPS for all traffic</Li>
        <Li>Two-step sign-in available to every user; vault access requires it once switched on</Li>
        <Li>Rate limiting and session controls, with sessions that admins and users can end</Li>
        <Li>Server and database access limited to named Autisync administrators</Li>
        <Li>Nightly backups of the (encrypted) database, kept for 14 days</Li>
      </Ul>
    ),
  },
  {
    id: 'sub-processors',
    title: 'Sub-processors',
    content: (
      <>
        <Table
          headers={['Sub-processor', 'Purpose']}
          rows={[
            ['Google (Firebase Authentication)', 'User sign-in'],
            ['Cloudflare', 'DNS, TLS and network protection'],
            [`Hosting provider for Autisync's server${LEGAL.serverLocation ? ` (${LEGAL.serverLocation})` : ''}`, 'Runs the server, operated by Autisync'],
            ['Stripe', 'Subscription payments'],
          ]}
        />
        <P>Where a sub-processor handles data outside the UK, the transfer is covered by UK adequacy regulations or the UK International Data Transfer Addendum.</P>
      </>
    ),
  },
  {
    id: 'customer',
    title: 'The Customer commits to',
    content: (
      <Ul>
        <Li>Have a lawful basis for its users&apos; data and tell them how it is used</Li>
        <Li>Manage who it invites and what admins can do, and remove leavers promptly</Li>
      </Ul>
    ),
  },
  {
    id: 'law',
    title: 'Law',
    content: <P>This agreement is governed by the law of England and Wales. To sign a countersigned copy, email <strong>{LEGAL.email}</strong>.</P>,
  },
];

export default function DpaPage() {
  return (
    <LegalLayout
      title="Data Processing Agreement"
      subtitle="For businesses on SecureVoult company plans: how Autisync handles your team's data as your processor."
      lastUpdated={LEGAL.updated}
      effectiveDate={LEGAL.updated}
      badge="UK GDPR Article 28"
      sections={sections}
    />
  );
}
