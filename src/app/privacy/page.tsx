import { LegalLayout, P, H3, Ul, Li, InfoBox, Table } from '@/components/LegalLayout';
import { LEGAL } from '@/lib/legal';

export const metadata = {
  title: 'Privacy Policy — SecureVoult by Autisync',
  description: 'What SecureVoult stores, why, for how long, and your rights under UK GDPR.',
};

const who = [LEGAL.company, LEGAL.companyNumber, LEGAL.address].filter(Boolean).join(', ');

const sections = [
  {
    id: 'who-we-are',
    title: 'Who we are',
    content: (
      <>
        <P>{LEGAL.product} is a password manager made and run by <strong>{who}</strong> (&quot;Autisync&quot;, &quot;we&quot;, &quot;us&quot;). This policy covers the web app at <strong>{LEGAL.site}</strong>, the browser extension and any SecureVoult apps.</P>
        <P>For your account data, we are the <strong>data controller</strong>. We follow the UK GDPR and Data Protection Act 2018, the EU GDPR for people in the EU, and Angola&apos;s data protection law (Lei n.º 22/11).{LEGAL.icoNumber ? <> Our ICO registration number is <strong>{LEGAL.icoNumber}</strong>.</> : null} If you use SecureVoult through your employer&apos;s company plan, your employer is the controller for that use and we act as its processor (see the <a href="/dpa" className="underline underline-offset-2">Data Processing Agreement</a>).</P>
        <InfoBox color="green">
          <strong>The short version:</strong> your vault and your files are encrypted on your own device with a key made from your master password. We store only the locked copy and cannot open it. Your master password and recovery key never reach us.
        </InfoBox>
      </>
    ),
  },
  {
    id: 'what-we-store',
    title: 'What we store',
    content: (
      <>
        <H3>Your account</H3>
        <Ul>
          <Li>Email address, display name (if you give one) and a sign-in ID from Firebase Authentication</Li>
          <Li>Your plan, billing period and plan dates, and your role (user, company admin or admin)</Li>
          <Li>If you turn on two-step sign-in: the authenticator secret (encrypted with a server key) and one-way hashes of your backup codes</Li>
          <Li>If you add a passkey for signing in: its public key and a label. The private key stays on your device</Li>
        </Ul>
        <H3>Your vault (encrypted, unreadable to us)</H3>
        <Ul>
          <Li>The encrypted vault, its version number and when it last synced</Li>
          <Li>Encrypted file attachments, each with a random ID and its size. File names and contents are inside the encryption</Li>
          <Li>The number of items, which your app sends so plan limits can apply</Li>
        </Ul>
        <H3>Security and sessions</H3>
        <Ul>
          <Li>Signed-in sessions: device type, browser user-agent, IP address and last-seen time, so you can see and end sessions</Li>
          <Li>Short-lived rate-limit counters keyed by IP address, to stop password-guessing and abuse</Li>
          <Li>Records of plan-limit events and admin actions, with the IP address they came from</Li>
        </Ul>
        <H3>Payments</H3>
        <P>When paid plans are switched on, payments are taken by Stripe. We receive your subscription status and a customer reference, never your card details.</P>
        <H3>What we do not collect</H3>
        <P>No master password, no recovery key, no readable vault content, no advertising identifiers and no analytics or tracking scripts.</P>
      </>
    ),
  },
  {
    id: 'why',
    title: 'Why we use it, and our lawful basis',
    content: (
      <Table
        headers={['Purpose', 'Lawful basis (UK GDPR Art. 6)']}
        rows={[
          ['Running your account, syncing your vault and files', 'Contract, 6(1)(b)'],
          ['Two-step sign-in, sessions, rate limits, abuse prevention', 'Legitimate interests in keeping accounts secure, 6(1)(f)'],
          ['Taking payment for paid plans', 'Contract, 6(1)(b)'],
          ['Answering your emails and support requests', 'Contract or legitimate interests'],
          ['Keeping financial records', 'Legal obligation, 6(1)(c)'],
          ['Product news by email (only if you opt in)', 'Consent, 6(1)(a)'],
        ]}
      />
    ),
  },
  {
    id: 'services',
    title: 'Services we use',
    content: (
      <>
        <P>We do not sell or rent personal data. These providers handle some of it for us:</P>
        <Table
          headers={['Provider', 'What for', 'What they see']}
          rows={[
            ['Firebase Authentication (Google)', 'Signing in', 'Email, sign-in ID, sign-in events'],
            ['Cloudflare', 'DNS, TLS and protection in front of our server', 'IP address and request details, encrypted vault traffic'],
            [`Our own server${LEGAL.serverLocation ? ` (${LEGAL.serverLocation})` : ''}`, 'App, database and nightly backups, run by Autisync', 'Everything listed above; vaults and files stay encrypted'],
            ['Stripe', 'Payments, once switched on', 'Billing details you give Stripe'],
          ]}
        />
        <H3>Requests your device makes directly</H3>
        <Ul>
          <Li><strong>Leaked-password check (Have I Been Pwned):</strong> your device sends the first 5 characters of a password&apos;s SHA-1 hash and gets back a list to compare against. The password and the full hash never leave your device.</Li>
          <Li><strong>Website icons (DuckDuckGo):</strong> to show a site&apos;s icon next to an item, your device asks DuckDuckGo&apos;s icon service for that website&apos;s address. DuckDuckGo can see which website icons are requested and your IP address.</Li>
        </Ul>
        <P>Google, Cloudflare and Stripe may process data outside the UK. Where they do, transfers rely on the UK&apos;s adequacy regulations, the UK International Data Transfer Addendum or equivalent safeguards in their terms.</P>
      </>
    ),
  },
  {
    id: 'retention',
    title: 'How long we keep it',
    content: (
      <Ul>
        <Li>Account and vault: while your account is open. When you ask us to close it, we delete it within one month</Li>
        <Li>Deleted vault items: a deletion marker (no content) is kept for 180 days so other devices don&apos;t bring the item back</Li>
        <Li>Backups: nightly encrypted-vault backups are kept for 14 days, then overwritten</Li>
        <Li>Sessions: until you sign out or end them, or the account closes</Li>
        <Li>Payment and tax records: 6 years, as UK law requires</Li>
        <Li>Support emails: up to 2 years</Li>
      </Ul>
    ),
  },
  {
    id: 'rights',
    title: 'Your rights',
    content: (
      <>
        <P>You can ask us to give you a copy of your data, correct it, delete it, restrict or object to how we use it, or give it to you in a portable format. You can export your vault yourself at any time from Settings → Import / Export.</P>
        <P>To make a request, email <strong>{LEGAL.email}</strong> from your account&apos;s address. We reply within one month. We may ask you to confirm it&apos;s you before acting.</P>
        <P>If you are unhappy with how we handle your data, you can complain to the data protection authority where you live: in the UK the <a href="https://ico.org.uk/make-a-complaint/" className="underline underline-offset-2" target="_blank" rel="noopener noreferrer">Information Commissioner&apos;s Office</a>, in Portugal the <a href="https://www.cnpd.pt" className="underline underline-offset-2" target="_blank" rel="noopener noreferrer">CNPD</a>, in Angola the Agência de Protecção de Dados (APD). We&apos;d appreciate the chance to put it right first.</P>
      </>
    ),
  },
  {
    id: 'security',
    title: 'How we protect it',
    content: (
      <>
        <Ul>
          <Li>Vault and files encrypted on your device with AES-256-GCM, using a key derived with Argon2id (64 MiB, 3 passes)</Li>
          <Li>All traffic over HTTPS</Li>
          <Li>Optional two-step sign-in with an authenticator app, required for vault access when it is on</Li>
          <Li>Server access limited to Autisync administrators</Li>
        </Ul>
        <InfoBox color="green">If our server were ever breached, your vault and files would still be locked without your master password or recovery key.</InfoBox>
        <P>If we have a personal data breach that is likely to put you at risk, we will tell you and, where required, the ICO within 72 hours of finding out.</P>
      </>
    ),
  },
  {
    id: 'storage-on-device',
    title: 'Cookies and storage on your device',
    content: (
      <P>We only store what the app needs to work: your sign-in, an encrypted copy of your vault for offline use, and your settings. There are no advertising or analytics cookies. Details are in the <a href="/cookies" className="underline underline-offset-2">Cookie Policy</a>.</P>
    ),
  },
  {
    id: 'children',
    title: 'Children',
    content: <P>SecureVoult is not meant for children under 13, and we don&apos;t knowingly hold their data. If you think a child has given us data, email us and we&apos;ll delete it.</P>,
  },
  {
    id: 'changes',
    title: 'Changes to this policy',
    content: <P>If we make an important change, we&apos;ll tell you by email or in the app before it takes effect. The date at the top shows the latest version.</P>,
  },
];

export default function PrivacyPage() {
  return (
    <LegalLayout
      title="Privacy Policy"
      subtitle="What SecureVoult stores, why, for how long, and what you can ask us to do with it."
      lastUpdated={LEGAL.updated}
      effectiveDate={LEGAL.updated}
      badge="UK GDPR"
      sections={sections}
    />
  );
}
