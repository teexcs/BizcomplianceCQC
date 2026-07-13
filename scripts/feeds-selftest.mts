/**
 * Proof the RSS/Atom parser extracts items correctly. Runs offline on sample
 * XML in both formats. npx tsx scripts/feeds-selftest.mts
 */
import { parseFeed, type FeedSource } from '@/lib/alerts/feeds';

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d?: string) => (c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.error(`  ✗ ${n}${d ? ` — ${d}` : ''}`)));

const rss: FeedSource = { kind: 'rss_test', label: 'RSS Test', url: 'x' };
const rssXml = `<?xml version="1.0"?><rss><channel>
  <item><title>New medicines management guidance for social care</title>
    <link>https://example.gov.uk/a</link>
    <description><![CDATA[Updated <b>guidance</b> on MAR charts for domiciliary care.]]></description>
    <pubDate>Wed, 15 Jan 2025 09:00:00 GMT</pubDate></item>
  <item><title>Unrelated tax bulletin</title><link>https://example.gov.uk/b</link>
    <description>VAT changes.</description><pubDate>Tue, 14 Jan 2025 09:00:00 GMT</pubDate></item>
</channel></rss>`;

const rItems = parseFeed(rssXml, rss);
ok('RSS: 2 items parsed', rItems.length === 2, `${rItems.length}`);
ok('RSS: title decoded', rItems[0].title === 'New medicines management guidance for social care');
ok('RSS: link extracted', rItems[0].url === 'https://example.gov.uk/a');
ok('RSS: CDATA + tags stripped', rItems[0].summary === 'Updated guidance on MAR charts for domiciliary care.', rItems[0].summary);
ok('RSS: date parsed to ISO 2025', rItems[0].publishedAt?.startsWith('2025-01-15') ?? false, rItems[0].publishedAt ?? 'null');

const atom: FeedSource = { kind: 'atom_test', label: 'Atom Test', url: 'x', legislative: true };
const atomXml = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom">
  <entry><title>Health and Social Care Act update</title>
    <link rel="alternate" href="https://www.gov.uk/x"/>
    <summary>New regulation affecting registered managers.</summary>
    <updated>2025-03-02T10:00:00Z</updated></entry>
</feed>`;

const aItems = parseFeed(atomXml, atom);
ok('Atom: 1 entry parsed', aItems.length === 1, `${aItems.length}`);
ok('Atom: alternate link', aItems[0].url === 'https://www.gov.uk/x', aItems[0].url);
ok('Atom: legislative flag carried', aItems[0].legislative === true);
ok('Atom: date parsed', aItems[0].publishedAt?.startsWith('2025-03-02') ?? false);

console.log(`\n${fail === 0 ? '✅ ALL PASS' : '❌ FAILURES'}: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
