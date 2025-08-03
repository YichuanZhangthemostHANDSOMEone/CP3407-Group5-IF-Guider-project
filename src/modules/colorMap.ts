export type ProtocolMap = Record<string, Record<string, string>>;

export let colorToProtoComp: Record<string, { protocol: string; component: string }> = {};

export async function loadColorMap(): Promise<void> {
  try {
    const resp = await fetch('/colorMap.json');
    if (!resp.ok) {
      console.error('Failed to load colorMap.json:', resp.status);
      return;
    }
    const map: ProtocolMap = await resp.json();
    const table: typeof colorToProtoComp = {};
    for (const protocol in map) {
      const comps = map[protocol];
      for (const component in comps) {
        const color = comps[component];
        table[color] = { protocol, component };
      }
    }
    colorToProtoComp = table;
  } catch (err) {
    console.error('Error loading colorMap.json', err);
  }
}
