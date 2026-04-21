import { LegalLayout, P, H3, Ul, Li, InfoBox, Table } from '@/components/LegalLayout';

export const metadata = {
  title: 'Cookie Policy — SecureVoult',
  description: 'How SecureVoult uses cookies and similar tracking technologies. Manage your preferences.',
};

const sections = [
  {
    id: 'what-are-cookies',
    title: 'What Are Cookies?',
    content: (
      <>
        <P>Cookies are small text files placed on your device when you visit a website. They are widely used to make websites work more efficiently and to provide information to site owners.</P>
        <P>We also use similar technologies such as local storage, session storage, and IndexedDB. This policy covers all of these collectively as &quot;cookies&quot;.</P>
        <InfoBox color="blue">
          SecureVoult uses the minimum cookies necessary to provide the service. We do not use advertising cookies, cross-site tracking pixels, or any fingerprinting technology.
        </InfoBox>
      </>
    ),
  },
  {
    id: 'our-cookies',
    title: 'Cookies We Use',
    content: (
      <>
        <H3>1. Strictly necessary cookies</H3>
        <P>These cookies are essential for the Service to function and cannot be disabled. They include:</P>
        <Table
          headers={['Name', 'Purpose', 'Duration', 'Type']}
          rows={[
            ['sv_session', 'Authenticates your logged-in session', 'Session', 'HttpOnly, Secure'],
            ['sv_csrf', 'CSRF protection token', 'Session', 'HttpOnly, Secure'],
            ['sv_2fa_verified', 'Tracks 2FA verification state', '24 hours', 'HttpOnly, Secure'],
            ['__Host-sv_session', 'Strict session binding (path + host)', 'Session', 'HttpOnly, Secure, SameSite=Strict'],
          ]}
        />
        <H3>2. Functional cookies</H3>
        <P>These cookies remember your preferences and improve your experience. You may disable them, but some features may be affected.</P>
        <Table
          headers={['Name', 'Purpose', 'Duration', 'Type']}
          rows={[
            ['sv_theme', 'Stores your dark/light mode preference', '1 year', 'localStorage'],
            ['sv_lang', 'Stores your language preference', '1 year', 'localStorage'],
            ['sv_cookie_consent', 'Records your cookie consent choice', '1 year', 'localStorage'],
            ['sv_vault_lock_timeout', 'Stores your vault auto-lock timeout setting', '1 year', 'localStorage'],
          ]}
        />
        <H3>3. Analytics cookies</H3>
        <P>We use privacy-respecting analytics to understand how people use SecureVoult. These are anonymised and never linked to your personal identity. We use <strong>Plausible Analytics</strong> (EU-hosted, no personal data collected, GDPR compliant by design).</P>
        <Table
          headers={['Name', 'Purpose', 'Duration', 'Provider']}
          rows={[
            ['plausible_session', 'Anonymous session tracking (no cross-site)', '30 minutes', 'Plausible (self-hosted EU)'],
          ]}
        />
        <InfoBox color="green">
          Plausible Analytics does not use cookies in the traditional sense. It uses a daily hash of your IP + user agent that cannot be used to track you across sessions or sites.
        </InfoBox>
      </>
    ),
  },
  {
    id: 'no-ad-tracking',
    title: 'What We Do NOT Use',
    content: (
      <>
        <P>SecureVoult explicitly does not use:</P>
        <Ul>
          <Li>Third-party advertising cookies (Google Ads, Meta Pixel, etc.)</Li>
          <Li>Cross-site tracking pixels or beacons</Li>
          <Li>Browser fingerprinting</Li>
          <Li>Device ID tracking</Li>
          <Li>Behavioural profiling or retargeting</Li>
          <Li>Any data broker integrations</Li>
        </Ul>
        <P>This is consistent with our zero-knowledge privacy principles — your activity stays yours.</P>
      </>
    ),
  },
  {
    id: 'third-party',
    title: 'Third-Party Cookies',
    content: (
      <>
        <P>Some third-party services embedded in our Service may set their own cookies:</P>
        <Table
          headers={['Provider', 'Purpose', 'Their Privacy Policy']}
          rows={[
            ['Stripe', 'Payment fraud prevention', 'stripe.com/privacy'],
            ['Firebase', 'Authentication tokens', 'firebase.google.com/support/privacy'],
          ]}
        />
        <P>We require all third parties to comply with GDPR and our <a href="/dpa" className="underline underline-offset-2 hover:opacity-80">Data Processing Agreement</a>. We do not permit them to use your data for their own advertising purposes.</P>
      </>
    ),
  },
  {
    id: 'manage-preferences',
    title: 'Managing Your Preferences',
    content: (
      <>
        <H3>Cookie banner</H3>
        <P>When you first visit SecureVoult, we show a cookie consent banner. You may accept all cookies, or select only essential cookies. You can change this at any time by clicking <strong>Cookie settings</strong> in the footer.</P>
        <H3>Browser settings</H3>
        <P>Most browsers allow you to view, block, or delete cookies. Instructions for popular browsers:</P>
        <Ul>
          <Li><strong>Chrome:</strong> Settings → Privacy and security → Cookies and other site data</Li>
          <Li><strong>Firefox:</strong> Preferences → Privacy &amp; Security → Cookies and Site Data</Li>
          <Li><strong>Safari:</strong> Preferences → Privacy → Manage Website Data</Li>
          <Li><strong>Edge:</strong> Settings → Cookies and site permissions → Cookies and site data</Li>
        </Ul>
        <InfoBox color="amber">
          Blocking strictly necessary cookies will prevent you from logging in to SecureVoult, as they are required for authentication and security.
        </InfoBox>
        <H3>Do Not Track</H3>
        <P>We honour the Do Not Track (DNT) browser signal. If DNT is enabled, we disable all non-essential cookies automatically.</P>
      </>
    ),
  },
  {
    id: 'updates',
    title: 'Updates to This Policy',
    content: (
      <P>We may update this Cookie Policy to reflect changes in technology or regulation. We will notify you of material changes through the cookie consent banner or by email. The &quot;Last updated&quot; date at the top indicates the most recent version.</P>
    ),
  },
  {
    id: 'contact',
    title: 'Contact',
    content: (
      <P>Questions about our use of cookies? Email <strong>privacy@securevoult.com</strong> or visit our <a href="/privacy" className="underline underline-offset-2 hover:opacity-80">Privacy Policy</a> for full details on how we handle your data.</P>
    ),
  },
];

export default function CookiesPage() {
  return (
    <LegalLayout
      title="Cookie Policy"
      subtitle="We use the minimum cookies necessary to run SecureVoult securely. No ads, no tracking, no profiling."
      lastUpdated="1 August 2025"
      effectiveDate="1 August 2025"
      badge="Cookie Policy"
      badgeColor="bg-orange-500/10 text-orange-400 border-orange-500/20"
      sections={sections}
    />
  );
}
