/** The SecureVoult mark (padlock shackle over a "V"), drawn like the web app's Logo.tsx. */
import Svg, { Defs, LinearGradient, Mask, Path, Rect, Stop, G } from 'react-native-svg';

export function LogoMark({ size = 56, dark = true }: { size?: number; dark?: boolean }) {
  const [hi, mid, lo] = dark ? ['#F2D797', '#CDA24C', '#8E6722'] : ['#D9B460', '#B2862F', '#6F4F17'];
  return (
    <Svg width={size} height={size} viewBox="8 6 48 52" accessibilityLabel="SecureVoult">
      <Defs>
        <LinearGradient id="g" x1="12" y1="9" x2="50" y2="57" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={hi} />
          <Stop offset="0.5" stopColor={mid} />
          <Stop offset="1" stopColor={lo} />
        </LinearGradient>
        <Mask id="m">
          <Rect width="64" height="64" fill="#fff" />
          <Path d="M25 32.5h14L32 44.2z" fill="#000" />
        </Mask>
      </Defs>
      <Path d="M22 26.5V20a10 10 0 0 1 20 0v6.5" fill="none" stroke="url(#g)" strokeWidth={5.2} strokeLinecap="round" />
      <G mask="url(#m)">
        <Path d="M13.5 26.5h37a1.6 1.6 0 0 1 1.35 2.45L33.4 56.1a1.65 1.65 0 0 1-2.8 0L12.15 28.95a1.6 1.6 0 0 1 1.35-2.45z" fill="url(#g)" />
        <Path d="M13.5 26.5h37a1.6 1.6 0 0 1 1.35 2.45l-1.2 1.75H13.35l-1.2-1.75a1.6 1.6 0 0 1 1.35-2.45z" fill="#FBE7B5" fillOpacity={0.4} />
      </G>
    </Svg>
  );
}
