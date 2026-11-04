import { LegalLayout, P, H3, Ul, Li, InfoBox, Table } from '@/components/LegalLayout';

export const metadata = {
  title: 'Privacy Policy — SecureVoult',
  description: 'How SecureVoult collects, processes, and protects your personal data. GDPR compliant.',
};

const sections = [
  {
    id: 'introduction',
    title: 'Introduction',
    content: (
      <>
        <P>SecureVoult Ltd (&quot;SecureVoult&quot;, &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) is committed to protecting your personal data and respecting your privacy. This Privacy Policy explains how we collect, use, store, and share information about you when you use our website (<strong>securevoult.co.uk</strong>), desktop apps, mobile apps, and browser extensions (collectively, the &quot;Services&quot;).</P>
        <P>We are the <strong>data controller</strong> for the personal data described in this policy. Our registered address is SecureVoult Ltd, 20 Finsbury Street, London, EC2Y 9AQ, United Kingdom.</P>
        <InfoBox color="green">
          <strong>Zero-knowledge summary:</strong> Your vault data is encrypted on your device before it ever reaches our servers. We cannot read your passwords, notes, or any vault content. We only hold the metadata required to run the service.
        </InfoBox>
      </>
    ),
  },
  {
    id: 'data-we-collect',
    title: 'Data We Collect',
    content: (
      <>
        <H3>Account data</H3>
        <Ul>
          <Li>Email address (required for authentication and service communications)</Li>
          <Li>Password hash — a derived key, never the raw master password</Li>
          <Li>Account creation date, last login timestamp, subscription tier</Li>
          <Li>Display name (optional)</Li>
        </Ul>
        <H3>Vault data (zero-knowledge encrypted)</H3>
        <Ul>
          <Li>Encrypted vault blob — we cannot decrypt or read any of this content</Li>
          <Li>Encrypted item metadata such as item count and last modified date</Li>
          <Li>Vault salt and verification hash (used to validate your master password client-side)</Li>
        </Ul>
        <H3>Usage and analytics data</H3>
        <Ul>
          <Li>Page views, feature interactions, session duration (anonymised)</Li>
          <Li>Browser type, operating system, screen resolution</Li>
          <Li>Referral source (e.g., utm_source)</Li>
        </Ul>
        <H3>Payment data</H3>
        <P>Payments are processed by Stripe. We receive a non-sensitive token and subscription status. We do not store card numbers, CVVs, or bank account details.</P>
        <H3>Support data</H3>
        <P>If you contact us, we store your email, message content, and any attachments you provide to resolve your request.</P>
      </>
    ),
  },
  {
    id: 'legal-basis',
    title: 'Legal Basis for Processing',
    content: (
      <>
        <P>We process your personal data under the following legal bases (UK GDPR Article 6):</P>
        <Table
          headers={['Purpose', 'Legal Basis']}
          rows={[
            ['Providing the vault service', 'Contract performance (Art. 6(1)(b))'],
            ['Sending transactional emails (account alerts)', 'Contract performance (Art. 6(1)(b))'],
            ['Processing payments', 'Contract performance (Art. 6(1)(b))'],
            ['Security monitoring and fraud prevention', 'Legitimate interests (Art. 6(1)(f))'],
            ['Analytics to improve the product', 'Legitimate interests (Art. 6(1)(f))'],
            ['Marketing emails (opt-in only)', 'Consent (Art. 6(1)(a))'],
            ['Legal compliance (tax, regulation)', 'Legal obligation (Art. 6(1)(c))'],
          ]}
        />
      </>
    ),
  },
  {
    id: 'data-retention',
    title: 'Data Retention',
    content: (
      <>
        <Ul>
          <Li>Account data: retained while your account is active and for 30 days after deletion (to allow recovery)</Li>
          <Li>Vault data: deleted immediately upon account deletion request</Li>
          <Li>Payment records: retained for 7 years (UK tax law requirement)</Li>
          <Li>Support tickets: retained for 2 years then deleted</Li>
          <Li>Analytics: anonymised after 13 months</Li>
        </Ul>
        <InfoBox color="blue">You can request immediate deletion of your account and vault data at any time from Settings → Account → Delete Account. Deletion is irreversible.</InfoBox>
      </>
    ),
  },
  {
    id: 'sharing',
    title: 'Sharing Your Data',
    content: (
      <>
        <P>We do not sell, rent, or trade your personal data. We share data only with the following processors under written data processing agreements:</P>
        <Table
          headers={['Processor', 'Purpose', 'Location']}
          rows={[
            ['Firebase (Google)', 'Authentication', 'EU/UK'],
            ['MongoDB Atlas', 'Encrypted vault storage', 'EU (Ireland)'],
            ['Stripe', 'Payment processing', 'EU/UK/US (SCC)'],
            ['SendGrid', 'Transactional email', 'EU/UK/US (SCC)'],
            ['Vercel', 'Web hosting & CDN', 'EU/UK/US (SCC)'],
          ]}
        />
        <P>We may disclose personal data if required by law, court order, or to protect the rights and safety of SecureVoult and its users.</P>
      </>
    ),
  },
  {
    id: 'international-transfers',
    title: 'International Transfers',
    content: (
      <>
        <P>Some of our processors operate in the United States. All transfers outside the UK/EEA are protected by UK International Data Transfer Agreements (IDTAs) or EU Standard Contractual Clauses (SCCs) in line with UK GDPR Chapter V.</P>
        <P>You may request a copy of the safeguards we have in place by emailing <strong>privacy@securevoult.co.uk</strong>.</P>
      </>
    ),
  },
  {
    id: 'your-rights',
    title: 'Your Rights',
    content: (
      <>
        <P>Under UK GDPR, you have the following rights:</P>
        <Ul>
          <Li><strong>Access:</strong> request a copy of all personal data we hold about you</Li>
          <Li><strong>Rectification:</strong> correct inaccurate or incomplete data</Li>
          <Li><strong>Erasure:</strong> ask us to delete your data (&quot;right to be forgotten&quot;)</Li>
          <Li><strong>Restriction:</strong> pause processing while a dispute is resolved</Li>
          <Li><strong>Portability:</strong> receive your data in a machine-readable format (JSON export available in-app)</Li>
          <Li><strong>Objection:</strong> object to processing based on legitimate interests</Li>
          <Li><strong>Withdraw consent:</strong> for any consent-based processing at any time</Li>
          <Li><strong>Automated decision-making:</strong> we do not use automated decision-making or profiling that significantly affects you</Li>
        </Ul>
        <P>To exercise any right, email <strong>privacy@securevoult.co.uk</strong>. We respond within 30 days. If you are unsatisfied, you may lodge a complaint with the <a href="https://ico.org.uk" className="underline underline-offset-2 hover:opacity-80" target="_blank" rel="noopener noreferrer">UK Information Commissioner&apos;s Office (ICO)</a>.</P>
      </>
    ),
  },
  {
    id: 'security',
    title: 'Security Measures',
    content: (
      <>
        <Ul>
          <Li>AES-256-GCM encryption for all vault data, performed client-side</Li>
          <Li>Argon2id key derivation for master passwords (64 MiB, 3 passes)</Li>
          <Li>TLS 1.3 for all data in transit</Li>
          <Li>MongoDB Atlas encryption at rest (AES-256)</Li>
          <Li>Multi-factor authentication available and recommended</Li>
          <Li>Quarterly penetration testing by an independent third party</Li>
          <Li>Access to production systems is restricted by role and protected by hardware keys</Li>
        </Ul>
        <InfoBox color="green">Even in the event of a data breach of our servers, your vault contents cannot be decrypted without your master password.</InfoBox>
      </>
    ),
  },
  {
    id: 'cookies',
    title: 'Cookies & Tracking',
    content: (
      <>
        <P>We use cookies and similar technologies. See our <a href="/cookies" className="underline underline-offset-2 hover:opacity-80">Cookie Policy</a> for full details. In summary:</P>
        <Ul>
          <Li><strong>Essential cookies:</strong> required for authentication and security — cannot be disabled</Li>
          <Li><strong>Functional cookies:</strong> remember your preferences (theme, language) — optional</Li>
          <Li><strong>Analytics cookies:</strong> anonymised usage statistics — optional, consent required</Li>
        </Ul>
        <P>We do not use advertising, tracking, or fingerprinting technologies.</P>
      </>
    ),
  },
  {
    id: 'children',
    title: "Children's Privacy",
    content: (
      <P>Our Services are not directed to children under the age of 16. We do not knowingly collect personal data from children. If we become aware that a child under 16 has provided us with personal data, we will delete it promptly. Contact us at <strong>privacy@securevoult.co.uk</strong> if you believe this has occurred.</P>
    ),
  },
  {
    id: 'changes',
    title: 'Changes to This Policy',
    content: (
      <>
        <P>We may update this Privacy Policy from time to time. We will notify you of material changes via email at least 30 days before they take effect. The &quot;Last updated&quot; date at the top of this page reflects the most recent revision.</P>
        <P>Continued use of the Services after a change takes effect constitutes your acceptance of the updated policy.</P>
      </>
    ),
  },
  {
    id: 'contact',
    title: 'Contact & Data Protection Officer',
    content: (
      <>
        <P>For any privacy-related queries, data subject requests, or to reach our Data Protection Officer:</P>
        <Ul>
          <Li>Email: privacy@securevoult.co.uk</Li>
          <Li>Post: SecureVoult Ltd, Data Protection Officer, 20 Finsbury Street, London, EC2Y 9AQ</Li>
          <Li>ICO registration number: ZB123456 (illustrative — replace with your actual ICO number)</Li>
        </Ul>
      </>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <LegalLayout
      title="Privacy Policy"
      subtitle="We believe privacy is a fundamental right. Here is exactly what data we collect, why, and how we protect it."
      lastUpdated="1 August 2025"
      effectiveDate="1 August 2025"
      badge="GDPR Compliant"
      badgeColor="bg-green-500/10 text-green-400 border-green-500/20"
      sections={sections}
    />
  );
}
