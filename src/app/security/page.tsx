import { LegalLayout, P, H3, Ul, Li, InfoBox, Table } from '@/components/LegalLayout';

export const metadata = {
  title: 'Security Disclosure — SecureVoult',
  description: 'SecureVoult\'s responsible disclosure policy. How to report security vulnerabilities and what to expect.',
};

const sections = [
  {
    id: 'introduction',
    title: 'Our Commitment to Security',
    content: (
      <>
        <P>Security is fundamental to everything SecureVoult builds. We take all vulnerability reports seriously and are committed to working with the security research community to identify and fix issues quickly.</P>
        <P>This policy describes how to responsibly disclose security vulnerabilities to us, what you can expect from us, and what we ask of researchers in return.</P>
        <InfoBox color="green">
          <strong>Thank you.</strong> We are grateful to security researchers who help make SecureVoult safer for everyone. All valid, first-report findings are acknowledged — we are working toward a formal bug bounty programme.
        </InfoBox>
      </>
    ),
  },
  {
    id: 'scope',
    title: 'Scope',
    content: (
      <>
        <H3>In scope</H3>
        <Table
          headers={['Target', 'Description']}
          rows={[
            ['securevoult.com', 'Main web application and marketing site'],
            ['api.securevoult.com', 'API endpoints'],
            ['app.securevoult.com', 'Authenticated vault application'],
            ['SecureVoult browser extension', 'Chrome, Firefox, Edge, Brave, Opera, Safari'],
            ['SecureVoult desktop app', 'Windows, macOS, Linux (Electron)'],
            ['SecureVoult mobile app', 'iOS and Android'],
          ]}
        />
        <H3>Out of scope</H3>
        <Ul>
          <Li>Third-party services and infrastructure we do not control (Firebase, Stripe, MongoDB Atlas)</Li>
          <Li>Social engineering attacks against SecureVoult employees</Li>
          <Li>Physical attacks against SecureVoult offices or staff</Li>
          <Li>Denial of service (DoS/DDoS) attacks</Li>
          <Li>Issues in outdated or end-of-life browser versions</Li>
          <Li>Self-XSS or attacks requiring physical access to an unlocked device</Li>
          <Li>Security vulnerabilities in third-party libraries that have not yet been patched upstream</Li>
          <Li>Issues found through automated scanners without proof of exploitability</Li>
        </Ul>
      </>
    ),
  },
  {
    id: 'report-a-vulnerability',
    title: 'How to Report a Vulnerability',
    content: (
      <>
        <H3>Preferred method: encrypted email</H3>
        <P>Email <strong>security@securevoult.com</strong> with the following information:</P>
        <Ul>
          <Li>A clear description of the vulnerability and its potential impact</Li>
          <Li>Step-by-step reproduction instructions</Li>
          <Li>Affected URL, endpoint, or platform</Li>
          <Li>Any supporting evidence (screenshots, HTTP request/response, proof-of-concept code)</Li>
          <Li>Your preferred contact method and, if applicable, your PGP public key</Li>
        </Ul>
        <H3>PGP key</H3>
        <P>You may encrypt your report using our security team&apos;s PGP key. The fingerprint is published on our Keybase profile at <strong>keybase.io/securevoult</strong>. We strongly encourage encryption for sensitive findings.</P>
        <H3>What to include</H3>
        <P>The more detail you provide, the faster we can triage and remediate. Proof-of-concept code demonstrating the issue (without causing harm) is welcome.</P>
        <InfoBox color="amber">
          Please do not publicly disclose vulnerability details before we have had a reasonable opportunity to investigate and fix the issue (see coordinated disclosure policy below).
        </InfoBox>
      </>
    ),
  },
  {
    id: 'our-commitments',
    title: 'Our Commitments to You',
    content: (
      <>
        <P>When you report a valid vulnerability in good faith, we commit to:</P>
        <Ul>
          <Li><strong>Acknowledgement within 2 business days</strong> — you will receive a confirmation that we received your report</Li>
          <Li><strong>Initial triage within 5 business days</strong> — we will confirm whether the issue is in scope and our initial severity assessment</Li>
          <Li><strong>Regular updates</strong> — we will keep you informed of our progress at least every 10 business days</Li>
          <Li><strong>Credit</strong> — with your permission, we will publicly thank you in our Hall of Fame once the issue is resolved</Li>
          <Li><strong>No legal action</strong> — we will not pursue civil or criminal legal action against you for good-faith research that complies with this policy</Li>
          <Li><strong>Safe harbour</strong> — we extend safe harbour to researchers acting in compliance with this policy under our interpretation of the Computer Misuse Act 1990</Li>
        </Ul>
      </>
    ),
  },
  {
    id: 'researcher-guidelines',
    title: 'Guidelines for Researchers',
    content: (
      <>
        <P>We ask that you:</P>
        <Ul>
          <Li>Test only against accounts and data you own or have explicit permission to test</Li>
          <Li>Do not access, modify, or delete data belonging to other users</Li>
          <Li>Do not perform actions that degrade the availability of the service for others</Li>
          <Li>Do not use automated vulnerability scanners without prior written permission</Li>
          <Li>Follow coordinated disclosure: allow us time to fix the issue before publishing</Li>
          <Li>Act in good faith and minimise any potential impact to users</Li>
          <Li>Do not demand payment as a condition of disclosure (extortion is not permitted)</Li>
        </Ul>
        <InfoBox color="blue">
          Testing against your own free account for security research purposes is permitted. Please use the dedicated test environment at <strong>test.securevoult.com</strong> where available.
        </InfoBox>
      </>
    ),
  },
  {
    id: 'severity-and-response',
    title: 'Severity Levels & Response Times',
    content: (
      <>
        <Table
          headers={['Severity', 'Examples', 'Target Fix Time']}
          rows={[
            ['Critical', 'Remote code execution, vault data exposure, authentication bypass', '24–48 hours'],
            ['High', 'Privilege escalation, session hijacking, significant data leakage', '7 days'],
            ['Medium', 'Stored XSS, CSRF, insecure direct object reference (limited impact)', '30 days'],
            ['Low', 'Information disclosure (non-sensitive), UI defects with minor security impact', '90 days'],
            ['Informational', 'Best-practice improvements, hardening recommendations', 'Next release cycle'],
          ]}
        />
        <P>We publish resolved vulnerabilities in our <strong>Security Advisories</strong> page (see below) after fixes are deployed.</P>
      </>
    ),
  },
  {
    id: 'coordinated-disclosure',
    title: 'Coordinated Disclosure Policy',
    content: (
      <>
        <P>We follow a <strong>90-day coordinated disclosure</strong> policy, consistent with industry best practice (Google Project Zero, CVD):</P>
        <Ul>
          <Li>We will make every effort to fix critical and high-severity issues within the timeframes above</Li>
          <Li>If we require more time, we will communicate this to you and request an extension</Li>
          <Li>After 90 days from our initial triage confirmation, you are free to publish your findings even if a fix has not been deployed</Li>
          <Li>We ask that you give us at least 7 days&apos; notice before publishing to allow us to coordinate release notes</Li>
        </Ul>
        <P>For zero-day vulnerabilities being actively exploited in the wild, we may expedite this timeline significantly.</P>
      </>
    ),
  },
  {
    id: 'security-architecture',
    title: 'Our Security Architecture',
    content: (
      <>
        <P>Understanding our architecture helps focus research on meaningful targets:</P>
        <H3>Zero-knowledge encryption</H3>
        <P>All vault data is encrypted client-side using AES-256-GCM with keys derived from your master password (PBKDF2/Argon2id). Our servers store only ciphertext — even a full database compromise would not expose vault contents.</P>
        <H3>Authentication</H3>
        <Ul>
          <Li>Firebase Authentication (email/password + Google OAuth)</Li>
          <Li>TOTP-based multi-factor authentication</Li>
          <Li>Passkey (WebAuthn) support</Li>
          <Li>Rate limiting on all authentication endpoints</Li>
        </Ul>
        <H3>Transport security</H3>
        <Ul>
          <Li>TLS 1.3 with HSTS preloading</Li>
          <Li>Certificate pinning in mobile apps</Li>
          <Li>Content Security Policy (CSP) headers on all pages</Li>
          <Li>Subresource Integrity (SRI) for all third-party assets</Li>
        </Ul>
        <H3>Infrastructure</H3>
        <Ul>
          <Li>MongoDB Atlas (EU region) — encryption at rest and in transit</Li>
          <Li>Vercel Edge Network — WAF and DDoS protection</Li>
          <Li>No direct database access from the internet</Li>
          <Li>Production access requires hardware key + IP allowlist</Li>
        </Ul>
      </>
    ),
  },
  {
    id: 'past-advisories',
    title: 'Security Advisories',
    content: (
      <>
        <P>We publish details of resolved security vulnerabilities in the interest of transparency. Advisories are published at <strong>securevoult.com/advisories</strong> after fixes are deployed.</P>
        <P>SecureVoult was founded in 2024. No security advisories have been published to date.</P>
        <InfoBox color="green">
          We are committed to transparent security communication. If we ever experience a data breach or significant security incident, we will notify affected users within 72 hours and publish a full post-mortem.
        </InfoBox>
      </>
    ),
  },
  {
    id: 'hall-of-fame',
    title: 'Hall of Fame',
    content: (
      <>
        <P>We are grateful to the following researchers for helping us improve SecureVoult&apos;s security:</P>
        <p className="text-sm italic text-muted-foreground/50 mb-4">No entries yet — be the first to find a valid vulnerability!</p>
        <P>To be included in our Hall of Fame, your finding must be in scope, not previously known to us, and you must consent to public recognition.</P>
      </>
    ),
  },
  {
    id: 'contact-security',
    title: 'Security Contact',
    content: (
      <>
        <Ul>
          <Li>Security disclosures: security@securevoult.com</Li>
          <Li>PGP key: keybase.io/securevoult</Li>
          <Li>General security enquiries: security@securevoult.com</Li>
          <Li>For urgent incidents: include [URGENT] in the subject line for faster triage</Li>
        </Ul>
        <P>For non-security issues (billing, account access, general support), please use the in-app help system or email support@securevoult.com.</P>
      </>
    ),
  },
];

export default function SecurityPage() {
  return (
    <LegalLayout
      title="Security Disclosure"
      subtitle="Our responsible disclosure policy, security architecture, and how to report vulnerabilities to us."
      lastUpdated="1 August 2025"
      effectiveDate="1 August 2025"
      badge="Responsible Disclosure"
      badgeColor="bg-red-500/10 text-red-400 border-red-500/20"
      sections={sections}
    />
  );
}
