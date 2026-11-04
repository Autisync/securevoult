import { LegalLayout, P, H3, Ul, Li, InfoBox } from '@/components/LegalLayout';

export const metadata = {
  title: 'Terms of Service — SecureVoult',
  description: 'The terms and conditions governing your use of SecureVoult. Read before using the service.',
};

const sections = [
  {
    id: 'acceptance',
    title: 'Acceptance of Terms',
    content: (
      <>
        <P>By creating an account or accessing SecureVoult (&quot;Service&quot;), you (&quot;User&quot;) agree to be bound by these Terms of Service (&quot;Terms&quot;). If you do not agree, do not use the Service.</P>
        <P>These Terms constitute a legally binding agreement between you and SecureVoult Ltd, a company registered in England and Wales (Company No. 15000001), 20 Finsbury Street, London, EC2Y 9AQ.</P>
        <P>By accepting these Terms, you also accept our <a href="/privacy" className="underline underline-offset-2 hover:opacity-80">Privacy Policy</a> and <a href="/cookies" className="underline underline-offset-2 hover:opacity-80">Cookie Policy</a>.</P>
      </>
    ),
  },
  {
    id: 'service',
    title: 'Description of Service',
    content: (
      <>
        <P>SecureVoult provides a zero-knowledge encrypted password management service, including:</P>
        <Ul>
          <Li>Web application at securevoult.co.uk</Li>
          <Li>Desktop applications for Windows, macOS, and Linux</Li>
          <Li>Mobile applications for iOS and Android</Li>
          <Li>Browser extensions for Chrome, Firefox, Edge, Brave, Opera, and Safari</Li>
          <Li>Administrative tools for team and enterprise accounts</Li>
          <Li>APIs for programmatic access (where available)</Li>
        </Ul>
        <InfoBox color="blue">
          <strong>Zero-knowledge architecture:</strong> Your vault data is encrypted and decrypted exclusively on your device. SecureVoult employees cannot access your passwords, notes, or any vault contents — ever.
        </InfoBox>
      </>
    ),
  },
  {
    id: 'accounts',
    title: 'User Accounts',
    content: (
      <>
        <H3>Registration</H3>
        <P>You must provide a valid email address and create a strong master password. You are responsible for maintaining the confidentiality of your credentials.</P>
        <H3>Age requirement</H3>
        <P>You must be at least 16 years old to use SecureVoult. By registering, you represent that you meet this requirement.</P>
        <H3>Account security</H3>
        <Ul>
          <Li>You are solely responsible for all activity that occurs under your account</Li>
          <Li>Notify us immediately at security@securevoult.co.uk if you suspect unauthorised access</Li>
          <Li>We recommend enabling multi-factor authentication</Li>
          <Li>Do not share your account credentials with others</Li>
        </Ul>
        <H3>Master password</H3>
        <P>Due to our zero-knowledge design, we cannot recover your master password. If you lose it, your vault data cannot be decrypted. We strongly recommend using the emergency access and trusted contact features.</P>
      </>
    ),
  },
  {
    id: 'acceptable-use',
    title: 'Acceptable Use',
    content: (
      <>
        <P>You agree not to use the Service to:</P>
        <Ul>
          <Li>Violate any applicable law or regulation</Li>
          <Li>Infringe the intellectual property rights of any third party</Li>
          <Li>Store, distribute, or transmit malware, exploits, or harmful code</Li>
          <Li>Attempt to gain unauthorised access to our systems or other users&apos; accounts</Li>
          <Li>Perform automated bulk testing, scraping, or load testing without prior written consent</Li>
          <Li>Resell or sublicense access to the Service without an authorised reseller agreement</Li>
          <Li>Use the Service for any purpose other than storing legitimate personal or business credentials</Li>
        </Ul>
        <P>We reserve the right to suspend or terminate accounts that violate these terms, with or without notice, at our sole discretion.</P>
      </>
    ),
  },
  {
    id: 'plans-billing',
    title: 'Plans & Billing',
    content: (
      <>
        <H3>Free tier</H3>
        <P>The Free plan includes unlimited logins and basic vault features at no charge. We may modify or discontinue the Free tier with 90 days&apos; notice.</P>
        <H3>Paid plans</H3>
        <P>Pro and Company plans are billed monthly or annually via Stripe. Prices are in GBP and exclude VAT where applicable. By subscribing, you authorise us to charge your payment method on each billing date.</P>
        <H3>Refunds</H3>
        <P>We offer a 30-day money-back guarantee on all paid plans. After 30 days, payments are non-refundable except where required by law. Contact billing@securevoult.co.uk to request a refund.</P>
        <H3>Plan changes</H3>
        <Ul>
          <Li>Upgrades: take effect immediately; you are billed a pro-rated amount for the remainder of the billing period</Li>
          <Li>Downgrades: take effect at the end of the current billing period</Li>
          <Li>Cancellations: access continues until the end of the paid period</Li>
        </Ul>
      </>
    ),
  },
  {
    id: 'data-and-privacy',
    title: 'Data & Privacy',
    content: (
      <>
        <P>Your use of the Service is also governed by our <a href="/privacy" className="underline underline-offset-2 hover:opacity-80">Privacy Policy</a> and <a href="/dpa" className="underline underline-offset-2 hover:opacity-80">Data Processing Agreement</a>. Key points:</P>
        <Ul>
          <Li>You own your data at all times</Li>
          <Li>You can export your vault in open formats at any time</Li>
          <Li>We process personal data under UK GDPR as data controller</Li>
          <Li>Vault contents are zero-knowledge encrypted — we cannot read them</Li>
        </Ul>
      </>
    ),
  },
  {
    id: 'intellectual-property',
    title: 'Intellectual Property',
    content: (
      <>
        <P>SecureVoult and all associated software, logos, branding, and documentation are the intellectual property of SecureVoult Ltd and are protected by copyright, trademark, and other laws.</P>
        <P>We grant you a limited, non-exclusive, non-transferable, revocable licence to use the Service for its intended purpose. You may not copy, modify, distribute, sell, or create derivative works based on our software.</P>
        <P>You retain full ownership of all data you store in your vault.</P>
      </>
    ),
  },
  {
    id: 'disclaimers',
    title: 'Disclaimers & Limitation of Liability',
    content: (
      <>
        <P>The Service is provided &quot;as is&quot; and &quot;as available&quot; without warranties of any kind, express or implied, except as required by applicable UK consumer law.</P>
        <InfoBox color="amber">
          <strong>Important:</strong> Because your vault data is zero-knowledge encrypted on your device, we cannot recover your data if you lose your master password. Please store your emergency access kit securely.
        </InfoBox>
        <P>To the maximum extent permitted by law, SecureVoult&apos;s total liability for any claim arising from these Terms or your use of the Service shall not exceed the amount you paid in the 12 months preceding the claim, or £100, whichever is greater.</P>
        <P>Nothing in these Terms limits our liability for death or personal injury caused by negligence, fraud, or any liability that cannot be excluded under English law.</P>
      </>
    ),
  },
  {
    id: 'service-availability',
    title: 'Service Availability',
    content: (
      <>
        <P>We target 99.9% monthly uptime and publish our status at <strong>status.securevoult.co.uk</strong>. Planned maintenance windows will be communicated at least 48 hours in advance.</P>
        <P>We are not liable for downtime caused by events outside our reasonable control (force majeure), including but not limited to natural disasters, government actions, third-party infrastructure failures, or cyberattacks.</P>
      </>
    ),
  },
  {
    id: 'termination',
    title: 'Termination',
    content: (
      <>
        <H3>By you</H3>
        <P>You may close your account at any time from Settings → Account → Delete Account. Upon deletion, your vault data is permanently and irrecoverably erased within 30 days.</P>
        <H3>By us</H3>
        <P>We may suspend or terminate your account immediately for material breach of these Terms, or with 30 days&apos; notice for any other reason. Upon termination, we will provide a 30-day window to export your data.</P>
      </>
    ),
  },
  {
    id: 'governing-law',
    title: 'Governing Law',
    content: (
      <>
        <P>These Terms are governed by the laws of England and Wales. Any dispute arising from these Terms shall be subject to the exclusive jurisdiction of the courts of England and Wales.</P>
        <P>If you are a consumer in the European Union, you may also rely on the mandatory protections of your local consumer law and the EU Online Dispute Resolution platform at <a href="https://ec.europa.eu/odr" className="underline underline-offset-2 hover:opacity-80" target="_blank" rel="noopener noreferrer">ec.europa.eu/odr</a>.</P>
      </>
    ),
  },
  {
    id: 'changes-to-terms',
    title: 'Changes to These Terms',
    content: (
      <P>We will notify you of material changes to these Terms via email at least 30 days before they take effect. Continued use of the Service constitutes acceptance of the updated Terms. If you do not agree to the updated Terms, you may close your account before they take effect.</P>
    ),
  },
];

export default function TermsPage() {
  return (
    <LegalLayout
      title="Terms of Service"
      subtitle="Clear, fair terms governing your use of SecureVoult. We have written these to be readable — not just legally watertight."
      lastUpdated="1 August 2025"
      effectiveDate="1 August 2025"
      badge="Terms of Service"
      badgeColor="bg-primary/10 text-primary border-primary/20"
      sections={sections}
    />
  );
}
