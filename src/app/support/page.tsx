import { LegalLayout, P, H3, Ul, Li, InfoBox } from '@/components/LegalLayout';

export const metadata = {
  title: 'Support — SecureVoult',
  description: 'Get help with SecureVoult. Contact our support team or browse common questions.',
};

const sections = [
  {
    id: 'contact',
    title: 'Contact Support',
    content: (
      <>
        <P>Our support team is available Monday to Friday, 9am–6pm GMT. We typically respond within one business day.</P>
        <InfoBox color="blue">
          <strong>Email:</strong>{' '}
          <a href="mailto:support@securevoult.co.uk" className="underline">
            support@securevoult.co.uk
          </a>
        </InfoBox>
        <P>Please include your account email address and a description of the issue when contacting us.</P>
      </>
    ),
  },
  {
    id: 'account',
    title: 'Account &amp; Billing',
    content: (
      <>
        <H3>Reset your master password</H3>
        <P>For security reasons, SecureVoult cannot recover or reset your master password — it never leaves your device. If you have forgotten your master password, you will need to reset your account. This will permanently delete all vault data.</P>
        <P>To reset your account, go to the login screen and select <strong>Forgot master password?</strong></P>

        <H3>Cancel subscription</H3>
        <P>You can cancel your subscription at any time from <strong>Settings → Billing</strong> inside the app, or by contacting support. You will retain access until the end of your current billing period.</P>

        <H3>Delete your account</H3>
        <P>To permanently delete your account and all associated data, go to <strong>Settings → Account → Delete Account</strong>, or email us at{' '}
          <a href="mailto:support@securevoult.co.uk" className="underline">support@securevoult.co.uk</a>.
        </P>
      </>
    ),
  },
  {
    id: 'vault',
    title: 'Vault &amp; Sync',
    content: (
      <>
        <H3>Vault not syncing</H3>
        <Ul>
          <Li>Ensure you have an active internet connection.</Li>
          <Li>Try signing out and back in on the affected device.</Li>
          <Li>Check that you are using the same account email on all devices.</Li>
        </Ul>

        <H3>Auto-fill not working</H3>
        <Ul>
          <Li><strong>iOS:</strong> Go to Settings → Passwords → AutoFill Passwords and enable SecureVoult.</Li>
          <Li><strong>Android:</strong> Go to Settings → General Management → Passwords and Autofill → select SecureVoult.</Li>
          <Li><strong>Browser:</strong> Ensure the SecureVoult browser extension is installed and you are signed in.</Li>
        </Ul>

        <H3>Biometric unlock not working</H3>
        <P>Go to <strong>Settings → Security → Biometric Unlock</strong> inside the app and re-enable Face ID or fingerprint authentication. If the issue persists, try removing and re-adding your biometric in your device settings.</P>
      </>
    ),
  },
  {
    id: 'security',
    title: 'Security &amp; Privacy',
    content: (
      <>
        <H3>Report a security vulnerability</H3>
        <P>If you have discovered a potential security vulnerability in SecureVoult, please disclose it responsibly by emailing:</P>
        <InfoBox color="red">
          <strong>Security:</strong>{' '}
          <a href="mailto:security@securevoult.co.uk" className="underline">
            security@securevoult.co.uk
          </a>
        </InfoBox>
        <P>Please do not disclose the vulnerability publicly until we have had the opportunity to investigate and release a fix.</P>

        <H3>Is my data safe?</H3>
        <P>Yes. SecureVoult uses end-to-end AES-256 encryption. Your vault is encrypted on your device before it is ever transmitted or stored. We have zero knowledge of your master password or vault contents.</P>
      </>
    ),
  },
  {
    id: 'extension',
    title: 'Browser Extension',
    content: (
      <>
        <H3>Install the extension</H3>
        <Ul>
          <Li><a href="https://chrome.google.com/webstore" className="underline" target="_blank" rel="noopener noreferrer">Chrome Web Store</a></Li>
          <Li><a href="https://addons.mozilla.org" className="underline" target="_blank" rel="noopener noreferrer">Firefox Add-ons</a></Li>
          <Li><a href="https://microsoftedge.microsoft.com/addons" className="underline" target="_blank" rel="noopener noreferrer">Microsoft Edge Add-ons</a></Li>
        </Ul>

        <H3>Extension not detecting passwords</H3>
        <P>Make sure you are signed in to the extension. If the issue persists, try disabling and re-enabling the extension from your browser&apos;s extension manager, then refresh the page.</P>
      </>
    ),
  },
];

export default function SupportPage() {
  return (
    <LegalLayout
      title="Support Centre"
      subtitle="Get help with your SecureVoult account, vault, and apps."
      lastUpdated="21 April 2026"
      effectiveDate="21 April 2026"
      badge="Support"
      badgeColor="blue"
      sections={sections}
    />
  );
}
