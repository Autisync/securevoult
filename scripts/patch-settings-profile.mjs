import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const filePath = join(__dirname, '..', 'src', 'components', 'Settings.tsx');
let src = readFileSync(filePath, 'utf8');

// 1. Add "profile" tab trigger as the first item in TabsList, change defaultValue
src = src.replace(
  `      <Tabs defaultValue="security">`,
  `      <Tabs defaultValue="profile">`
);

src = src.replace(
  `        <TabsList className="bg-secondary/50 flex flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="security"><Shield className="w-3.5 h-3.5 mr-1.5" />Security</TabsTrigger>`,
  `        <TabsList className="bg-secondary/50 flex flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="profile"><User className="w-3.5 h-3.5 mr-1.5" />Profile</TabsTrigger>
          <TabsTrigger value="security"><Shield className="w-3.5 h-3.5 mr-1.5" />Security</TabsTrigger>`
);

// 2. Insert Profile TabsContent before Security TabsContent
const profileTab = `
        {/* Profile */}
        <TabsContent value="profile" className="mt-5 space-y-6">
          <Section title="Account">
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-4">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-violet-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                  {user?.displayName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{user?.displayName || 'User'}</p>
                  <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                </div>
                <span className="text-xs bg-primary/15 text-primary px-2.5 py-1 rounded-lg font-medium flex-shrink-0">Free plan</span>
              </div>
              <div className="border-t border-border/50 px-4 py-3 bg-secondary/20">
                <p className="text-xs text-muted-foreground">
                  Pro plan with shared vaults, breach monitoring, and priority support — coming soon.
                </p>
              </div>
            </div>
          </Section>
          <Section title="Vault overview">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Total entries', value: String(entryCount) },
                { label: 'Encryption', value: 'AES-256-GCM' },
                { label: 'Key derivation', value: 'PBKDF2', sub: '100k rounds' },
                { label: 'Architecture', value: 'Zero-knowledge' },
              ].map(({ label, value, sub }) => (
                <div key={label} className="bg-card border border-border rounded-xl px-4 py-3">
                  <p className="text-lg font-bold text-primary leading-tight">{value}</p>
                  {sub && <p className="text-xs text-muted-foreground/60">{sub}</p>}
                  <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          </Section>
          <Section title="Master password & recovery">
            <div className="space-y-3">
              <div className="bg-amber-500/8 border border-amber-500/20 rounded-xl p-4 space-y-2">
                <p className="text-sm font-semibold text-amber-400 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />Your master password cannot be recovered
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Because of zero-knowledge encryption, your master password is never stored anywhere — not even on our servers. If you forget it, your vault data cannot be decrypted. Keep it in a safe, offline location.
                </p>
              </div>
              <div className="bg-card border border-border rounded-xl p-4 space-y-3">
                <div>
                  <p className="text-sm font-medium">Recovery kit</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    A printable emergency sheet with vault recovery instructions and your encrypted vault hint.
                    Planned for a future release.
                  </p>
                </div>
                <Button variant="outline" size="sm" className="h-8 text-xs opacity-50 cursor-not-allowed" disabled>
                  <Download className="w-3.5 h-3.5 mr-1.5" />Download recovery kit (coming soon)
                </Button>
              </div>
            </div>
          </Section>
        </TabsContent>

`;

src = src.replace(
  `\n        {/* Security */}\n        <TabsContent value="security"`,
  profileTab + `        {/* Security */}\n        <TabsContent value="security"`
);

writeFileSync(filePath, src, 'utf8');
console.log('Settings.tsx updated with Profile tab. Lines:', src.split('\n').length);
