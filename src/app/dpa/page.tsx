import { LegalLayout, P, H3, Ul, Li, InfoBox, Table } from '@/components/LegalLayout';

export const metadata = {
  title: 'Data Processing Agreement — SecureVoult',
  description: 'GDPR Data Processing Agreement (DPA) between SecureVoult and business customers.',
};

const sections = [
  {
    id: 'overview',
    title: 'Overview & Purpose',
    content: (
      <>
        <P>This Data Processing Agreement (&quot;DPA&quot;) forms part of the Terms of Service between SecureVoult Ltd (&quot;Processor&quot;) and the organisation using SecureVoult (&quot;Controller&quot;). It applies where SecureVoult processes personal data on behalf of the Controller in the course of providing the Service.</P>
        <P>This DPA is entered into pursuant to Article 28 of the UK General Data Protection Regulation (&quot;UK GDPR&quot;) and Article 28 of the EU General Data Protection Regulation 2016/679 (&quot;EU GDPR&quot;) where applicable.</P>
        <InfoBox color="blue">
          <strong>Who is this for?</strong> This DPA applies to Teams and Enterprise customers who process their employees&apos; or customers&apos; personal data using SecureVoult. Free and Premium personal accounts are covered by the Privacy Policy.
        </InfoBox>
      </>
    ),
  },
  {
    id: 'definitions',
    title: 'Definitions',
    content: (
      <>
        <Table
          headers={['Term', 'Definition']}
          rows={[
            ['Controller', 'The organisation that determines the purposes and means of processing personal data'],
            ['Processor', 'SecureVoult Ltd, which processes personal data on behalf of the Controller'],
            ['Data Subject', 'The individual whose personal data is being processed'],
            ['Personal Data', 'Any information relating to an identified or identifiable natural person'],
            ['Processing', 'Any operation performed on personal data (collection, storage, retrieval, deletion, etc.)'],
            ['Sub-processor', 'A third party engaged by SecureVoult to assist in processing personal data'],
            ['Security Incident', 'Any accidental or unlawful destruction, loss, alteration, or unauthorised disclosure of personal data'],
          ]}
        />
      </>
    ),
  },
  {
    id: 'nature-of-processing',
    title: 'Nature & Purpose of Processing',
    content: (
      <>
        <H3>Categories of data processed</H3>
        <Table
          headers={['Category', 'Examples', 'Necessity']}
          rows={[
            ['Account identifiers', 'Email address, user ID', 'Required for service operation'],
            ['Authentication data', 'Hashed keys, 2FA metadata', 'Required for security'],
            ['Encrypted vault data', 'Passwords, notes (zero-knowledge)', 'Core service function'],
            ['Usage metadata', 'Login timestamps, feature usage', 'Service improvement, security'],
            ['Billing data', 'Subscription status (via Stripe)', 'Required for paid plans'],
          ]}
        />
        <H3>Subject matter and duration</H3>
        <P>SecureVoult processes personal data for the duration of the agreement between the parties and for any retention periods required by law or agreed in writing.</P>
        <H3>Nature of processing</H3>
        <Ul>
          <Li>Storage of encrypted vault data in MongoDB Atlas (EU region)</Li>
          <Li>Authentication via Firebase (EU region)</Li>
          <Li>Transmission of encrypted data between client devices and servers</Li>
          <Li>Breach monitoring lookups (anonymised, hash-only)</Li>
        </Ul>
      </>
    ),
  },
  {
    id: 'processor-obligations',
    title: "Processor's Obligations",
    content: (
      <>
        <P>SecureVoult (as Processor) shall:</P>
        <Ul>
          <Li>Process personal data only on documented instructions from the Controller</Li>
          <Li>Ensure that all personnel authorised to process personal data are bound by appropriate confidentiality obligations</Li>
          <Li>Implement the technical and organisational security measures described in Section 6 of this DPA</Li>
          <Li>Assist the Controller in fulfilling Data Subject requests (access, deletion, portability) within 5 business days of notification</Li>
          <Li>Assist the Controller in meeting its obligations under Articles 32–36 UK/EU GDPR (security, breach notification, DPIA, prior consultation)</Li>
          <Li>Delete or return all personal data at the end of the service agreement, at the Controller&apos;s choice</Li>
          <Li>Make available all information necessary to demonstrate compliance and allow for audits (with reasonable notice)</Li>
        </Ul>
      </>
    ),
  },
  {
    id: 'controller-obligations',
    title: "Controller's Obligations",
    content: (
      <>
        <P>The Controller shall:</P>
        <Ul>
          <Li>Ensure there is a lawful basis for the processing of personal data</Li>
          <Li>Provide adequate privacy notices to data subjects</Li>
          <Li>Only instruct SecureVoult to process data in compliance with applicable data protection law</Li>
          <Li>Promptly notify SecureVoult of any data subject requests or regulatory enquiries that may affect SecureVoult&apos;s processing</Li>
        </Ul>
      </>
    ),
  },
  {
    id: 'security-measures',
    title: 'Technical & Organisational Security Measures',
    content: (
      <>
        <P>SecureVoult implements the following measures in accordance with Article 32 UK GDPR:</P>
        <H3>Encryption</H3>
        <Ul>
          <Li>AES-256-GCM client-side encryption of all vault data</Li>
          <Li>Argon2id key derivation (64 MiB, 3 passes)</Li>
          <Li>TLS 1.3 for all data in transit</Li>
          <Li>AES-256 encryption at rest (MongoDB Atlas, managed keys)</Li>
        </Ul>
        <H3>Access controls</H3>
        <Ul>
          <Li>Role-based access control (RBAC) with principle of least privilege</Li>
          <Li>Hardware security key (FIDO2) required for all production access</Li>
          <Li>No SecureVoult employee can access vault contents (zero-knowledge design)</Li>
          <Li>All access to production systems is logged and audited</Li>
        </Ul>
        <H3>Resilience &amp; availability</H3>
        <Ul>
          <Li>MongoDB Atlas multi-region replication</Li>
          <Li>Daily encrypted backups retained for 7 days</Li>
          <Li>99.9% monthly uptime SLA</Li>
          <Li>Incident response plan with defined RTO of 4 hours, RPO of 1 hour</Li>
        </Ul>
        <H3>Testing and assessment</H3>
        <Ul>
          <Li>Annual penetration testing by an accredited third party</Li>
          <Li>Continuous dependency vulnerability scanning</Li>
          <Li>Annual internal security review</Li>
        </Ul>
      </>
    ),
  },
  {
    id: 'sub-processors',
    title: 'Sub-processors',
    content: (
      <>
        <P>SecureVoult uses the following sub-processors. We maintain written data processing agreements with each:</P>
        <Table
          headers={['Sub-processor', 'Purpose', 'Location', 'Safeguard']}
          rows={[
            ['Google Firebase', 'Authentication', 'EU/UK', 'IDTA / SCCs'],
            ['MongoDB Atlas', 'Encrypted vault storage', 'EU (Ireland)', 'IDTA / SCCs'],
            ['Stripe', 'Payment processing', 'EU/UK/US', 'IDTA / SCCs'],
            ['Vercel', 'Web hosting & CDN', 'EU/UK/US', 'IDTA / SCCs'],
            ['SendGrid', 'Transactional email', 'EU/UK/US', 'IDTA / SCCs'],
          ]}
        />
        <P>We will notify you at least 30 days before adding or replacing a sub-processor. You may object to a new sub-processor within that period; if we cannot accommodate your objection, you may terminate the agreement.</P>
      </>
    ),
  },
  {
    id: 'international-transfers',
    title: 'International Data Transfers',
    content: (
      <>
        <P>Where personal data is transferred outside the UK or EEA, SecureVoult ensures appropriate safeguards are in place:</P>
        <Ul>
          <Li>UK International Data Transfer Agreements (IDTAs) for transfers from the UK</Li>
          <Li>EU Standard Contractual Clauses (Module 2: Controller to Processor) for EEA transfers</Li>
          <Li>Adequacy decisions where available (e.g., UK-US Data Bridge)</Li>
        </Ul>
        <P>Copies of applicable transfer mechanisms are available upon written request to <strong>dpa@securevoult.co.uk</strong>.</P>
      </>
    ),
  },
  {
    id: 'breach-notification',
    title: 'Security Incident Notification',
    content: (
      <>
        <P>In the event of a Security Incident affecting Controller personal data, SecureVoult will:</P>
        <Ul>
          <Li>Notify the Controller within <strong>72 hours</strong> of becoming aware of the incident</Li>
          <Li>Provide as much detail as possible: nature of the incident, categories of data affected, estimated number of data subjects, likely consequences, and measures taken</Li>
          <Li>Cooperate fully with the Controller&apos;s investigation and regulatory reporting obligations</Li>
          <Li>Maintain a record of all Security Incidents regardless of whether they require notification</Li>
        </Ul>
        <InfoBox color="amber">
          Due to our zero-knowledge architecture, a breach of our servers does not expose vault contents. However, we will still notify you of any incident involving account metadata (email addresses, subscription data, etc.).
        </InfoBox>
      </>
    ),
  },
  {
    id: 'audit-rights',
    title: 'Audit Rights',
    content: (
      <>
        <P>The Controller has the right to audit SecureVoult&apos;s compliance with this DPA. In practice, this is conducted through:</P>
        <Ul>
          <Li>Provision of our annual penetration testing report on request</Li>
          <Li>Completion of Controller security questionnaires within 15 business days</Li>
          <Li>On-site or remote audit with 30 days&apos; written notice (Enterprise plan only)</Li>
          <Li>ISO 27001 / Cyber Essentials certification documents (where available)</Li>
        </Ul>
        <P>Audits are conducted at the Controller&apos;s expense unless findings reveal material non-compliance by SecureVoult.</P>
      </>
    ),
  },
  {
    id: 'term-and-termination',
    title: 'Term & Termination',
    content: (
      <>
        <P>This DPA continues in effect for the duration of the Terms of Service. Upon termination:</P>
        <Ul>
          <Li>SecureVoult will, at the Controller&apos;s choice, delete or return all personal data within 30 days</Li>
          <Li>SecureVoult will provide written confirmation of deletion</Li>
          <Li>Obligations relating to data already processed survive termination</Li>
        </Ul>
      </>
    ),
  },
  {
    id: 'governing-law-dpa',
    title: 'Governing Law',
    content: (
      <P>This DPA is governed by the laws of England and Wales and shall be interpreted in accordance with UK GDPR. For EU-based Controllers, provisions of EU GDPR shall apply to the extent they differ from UK GDPR.</P>
    ),
  },
];

export default function DPAPage() {
  return (
    <LegalLayout
      title="Data Processing Agreement"
      subtitle="Our commitment to processing your organisation's data lawfully, securely, and transparently under UK and EU GDPR."
      lastUpdated="1 August 2025"
      effectiveDate="1 August 2025"
      badge="GDPR Article 28"
      badgeColor="bg-violet-500/10 text-violet-400 border-violet-500/20"
      sections={sections}
    />
  );
}
