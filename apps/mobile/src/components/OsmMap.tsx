import { useMemo } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { WebView } from 'react-native-webview';
import { useTheme } from '@/lib/segment';

// OpenStreetMap haritası (sitedeki haritanın aynısı: Leaflet). Google anahtarı gerekmez.
// Kullanım: dükkân işaretleri (dokununca onShop), ya da konum seçme (picker: haritaya dokununca onPick)

type Marker = { id: string; lat: number; lng: number; title: string };
type Props = {
  center: { lat: number; lng: number }; zoom?: number; markers?: Marker[]; me?: { lat: number; lng: number } | null;
  picker?: boolean; onPick?: (p: { lat: number; lng: number }) => void; onShop?: (id: string) => void; style?: StyleProp<ViewStyle>;
};

const esc = (v: unknown) => JSON.stringify(v).replace(/</g, '\\u003c');

export function OsmMap({ center, zoom = 14, markers = [], me, picker, onPick, onShop, style }: Props) {
  const th = useTheme();
  const html = useMemo(() => `<!doctype html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>html,body,#m{height:100%;margin:0;background:${th.surface2}}
.pin{width:18px;height:18px;border-radius:50%;background:${th.accent};border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.5)}
.me{width:16px;height:16px;border-radius:50%;background:#2563eb;border:3px solid #fff;box-shadow:0 0 0 6px rgba(37,99,235,.25)}</style>
</head><body><div id="m"></div><script>
const send = (o) => window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(o));
const map = L.map('m', { zoomControl: false, attributionControl: true }).setView([${center.lat}, ${center.lng}], ${zoom});
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap katkıcıları' }).addTo(map);
const pinIcon = L.divIcon({ className: '', html: '<div class="pin"></div>', iconSize: [18, 18] });
const markers = ${esc(markers)};
markers.forEach((s) => L.marker([s.lat, s.lng], { icon: pinIcon }).addTo(map)
  .bindTooltip(s.title, { direction: 'top', offset: [0, -8] }).on('click', () => send({ type: 'shop', id: s.id })));
const me = ${esc(me ?? null)};
if (me) L.marker([me.lat, me.lng], { icon: L.divIcon({ className: '', html: '<div class="me"></div>', iconSize: [16, 16] }) }).addTo(map);
${picker ? `let chosen = null;
map.on('click', (e) => { if (chosen) chosen.setLatLng(e.latlng); else chosen = L.marker(e.latlng, { icon: pinIcon }).addTo(map);
  send({ type: 'pick', lat: e.latlng.lat, lng: e.latlng.lng }); });` : ''}
</script></body></html>`, [center.lat, center.lng, zoom, markers, me, picker, th.accent, th.surface2]);

  return (
    <View style={[{ overflow: 'hidden', borderRadius: 16, backgroundColor: th.surface2 }, style]}>
      <WebView
        originWhitelist={['*']}
        source={{ html, baseUrl: 'https://bermatik.app/' }}
        onMessage={(e) => {
          try {
            const m = JSON.parse(e.nativeEvent.data);
            if (m.type === 'shop' && typeof m.id === 'string') onShop?.(m.id);
            if (m.type === 'pick' && typeof m.lat === 'number' && typeof m.lng === 'number') onPick?.({ lat: m.lat, lng: m.lng });
          } catch {}
        }}
        // Harita dışındaki bağlantılar uygulama içinde açılmasın
        onShouldStartLoadWithRequest={(r) => r.url.startsWith('https://bermatik.app') || r.url === 'about:blank' || r.url.startsWith('data:')}
        javaScriptEnabled
        style={{ flex: 1, backgroundColor: 'transparent' }}
      />
    </View>
  );
}
