export type LegalBlock =
  | { kind: 'paragraph'; text: string }
  | { kind: 'subheading'; text: string }
  | { kind: 'list'; items: readonly string[] }
  | { kind: 'link'; href: string; label: string; testID?: string }
  | { kind: 'mail'; email: string; testID?: string };

export type LegalSection = {
  heading: string;
  blocks: readonly LegalBlock[];
};

export function sectionText(sections: readonly LegalSection[]): string[] {
  const parts: string[] = [];
  for (const section of sections) {
    parts.push(section.heading);
    for (const block of section.blocks) {
      switch (block.kind) {
        case 'paragraph':
        case 'subheading':
          parts.push(block.text);
          break;
        case 'list':
          parts.push(...block.items);
          break;
        case 'link':
          parts.push(block.label);
          break;
        case 'mail':
          parts.push(block.email);
          break;
        default: {
          const _exhaustive: never = block;
          return _exhaustive;
        }
      }
    }
  }
  return parts;
}
