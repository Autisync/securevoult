import { LegalLayout, P, Ul, Li, InfoBox } from '@/components/LegalLayout';
import { LEGAL } from '@/lib/legal';

export const metadata = {
  title: 'Terms of Service — SecureVoult by Autisync',
  description: 'The agreement between you and Autisync for using SecureVoult.',
};

const who = [LEGAL.company, LEGAL.companyNumber && `company number ${LEGAL.companyNumber}`, LEGAL.address].filter(Boolean).join(', ');

const sections = [
  {
    id: 'agreement',
    title: 'The agreement',
    content: (
      <>
        <P>These terms are an agreement between you and <strong>{who}</strong> (&quot;Autisync&quot;, &quot;we&quot;) for using {LEGAL.product}: the web app at {LEGAL.site}, the browser extension and any SecureVoult apps (the &quot;Service&quot;). By creating an account you accept them.</P>
        <P>If you sign up for a business, you confirm you can accept these terms for it. Company plans are also covered by our <a href="/dpa" className="underline underline-offset-2">Data Processing Agreement</a>.</P>
      </>
    ),
  },
  {
    id: 'your-master-password',
    title: 'Your master password and recovery key',
    content: (
      <>
        <InfoBox color="amber">
          SecureVoult is zero-knowledge. We never receive your master password or your recovery key and cannot reset either. If you lose both, nobody, including Autisync, can open your vault.
        </InfoBox>
        <Ul>
          <Li>Keep your master password private and your Recovery Kit somewhere safe and offline</Li>
          <Li>Turn on two-step sign-in, and only use &quot;Keep me unlocked&quot; on a device only you use</Li>
          <Li>Tell us at {LEGAL.email} straight away if you think someone else has got into your account</Li>
        </Ul>
      </>
    ),
  },
  {
    id: 'using-the-service',
    title: 'Using the Service',
    content: (
      <>
        <P>You must be at least 13, and give an email address you control. Please don&apos;t:</P>
        <Ul>
          <Li>Store content you have no right to hold, or use the Service for anything unlawful</Li>
          <Li>Try to break, overload or get around the Service&apos;s security, limits or other users&apos; accounts</Li>
          <Li>Copy, resell or reverse-engineer the Service except where the law allows it</Li>
        </Ul>
        <P>Security research on your own account is welcome; see our <a href="/security" className="underline underline-offset-2">security page</a> for how to report what you find.</P>
      </>
    ),
  },
  {
    id: 'plans',
    title: 'Plans, payment and cancelling',
    content: (
      <>
        <Ul>
          <Li>The Free plan has the limits shown on the pricing page, such as the number of items and file storage</Li>
          <Li>Paid plans are billed monthly or yearly in advance through Stripe, at the price shown when you subscribe. Prices are in pounds</Li>
          <Li>You can cancel any time; your plan runs to the end of the period you have paid for, then moves to Free. You keep access to your data and can export it</Li>
          <Li>If you are a consumer, you can cancel within 14 days of first subscribing and get a full refund</Li>
          <Li>We&apos;ll give you at least 30 days&apos; notice of a price change, and you can cancel before it applies</Li>
        </Ul>
        <P>If your plan drops below what you are using (for example more items than Free allows), nothing is deleted. You can still open, export and delete items, but not add more until you are back within the limit.</P>
      </>
    ),
  },
  {
    id: 'your-data',
    title: 'Your data',
    content: (
      <P>What you put in your vault belongs to you. We only store it in encrypted form to provide the Service, as described in our <a href="/privacy" className="underline underline-offset-2">Privacy Policy</a>. You can export it at any time.</P>
    ),
  },
  {
    id: 'availability',
    title: 'Availability and changes',
    content: (
      <>
        <P>We work to keep the Service available and your data safe, and each device keeps an encrypted copy so you can still open your vault offline. We can&apos;t promise it will never be interrupted, for example during maintenance or a fault with a provider we rely on.</P>
        <P>We improve the Service over time. If we remove something important from a paid plan, we&apos;ll tell you in advance and you can cancel with a refund for the unused part.</P>
      </>
    ),
  },
  {
    id: 'liability',
    title: 'Liability',
    content: (
      <>
        <P>If you are a consumer, nothing in these terms affects your rights under the Consumer Rights Act 2015. We are responsible for loss you suffer that is a foreseeable result of us breaking these terms or failing to use reasonable care and skill.</P>
        <P>If you use the Service for business, our total liability in any 12 months is limited to the amount you paid us in that period, and we are not liable for loss of profit, business or data that could have been avoided by keeping your own export.</P>
        <P>Nothing limits liability for death or personal injury caused by negligence, for fraud, or for anything else the law does not allow us to limit.</P>
      </>
    ),
  },
  {
    id: 'ending',
    title: 'Closing your account',
    content: (
      <>
        <P>You can stop using the Service at any time. To close your account and delete your data, email {LEGAL.email} from your account&apos;s address; we&apos;ll do it within one month. Export your vault first: once deleted, it can&apos;t be recovered.</P>
        <P>We may suspend or close an account that seriously or repeatedly breaks these terms. Unless the law or a security risk prevents it, we&apos;ll warn you first and give you time to export your data.</P>
      </>
    ),
  },
  {
    id: 'law',
    title: 'Law and disputes',
    content: (
      <P>These terms are governed by the law of England and Wales. If you live elsewhere in the UK, you can bring proceedings in your local courts. Please contact us first; most things can be sorted out by email.</P>
    ),
  },
];

export default function TermsPage() {
  return (
    <LegalLayout
      title="Terms of Service"
      subtitle="The agreement between you and Autisync for using SecureVoult, in plain English."
      lastUpdated={LEGAL.updated}
      effectiveDate={LEGAL.updated}
      badge="Terms"
      sections={sections}
    />
  );
}
