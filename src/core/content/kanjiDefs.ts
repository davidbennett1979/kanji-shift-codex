import type { EntityDef } from '../model/Types';

const ink = 0x1f1a17;
const objectTint = 0xdecdae;
const nounTint = 0xd8e7f8;
const propTint = 0xf6d3c5;
const connectorTint = 0xf2e8d5;
const fusedTint = 0xe8d9a0;

export const ENTITY_DEFS: Record<string, EntityDef> = {
  'obj-human': {
    id: 'obj-human', glyph: '人', kind: 'object', category: 'object', nounKey: 'human', tint: objectTint, label: 'Human', defaultPushable: true,
  },
  'obj-tree': {
    id: 'obj-tree', glyph: '木', kind: 'object', category: 'object', nounKey: 'tree', tint: 0xcab88f, label: 'Tree',
  },
  'obj-rock': {
    id: 'obj-rock', glyph: '石', kind: 'object', category: 'object', nounKey: 'rock', tint: 0xb7b5b1, label: 'Rock',
  },
  'obj-mountain': {
    id: 'obj-mountain', glyph: '山', kind: 'object', category: 'object', nounKey: 'mountain', tint: 0xc8bea4, label: 'Mountain',
  },
  'obj-fire': {
    id: 'obj-fire', glyph: '火', kind: 'object', category: 'object', nounKey: 'fire', tint: 0xe39b67, label: 'Fire',
  },
  'obj-water': {
    id: 'obj-water', glyph: '水', kind: 'object', category: 'object', nounKey: 'water', tint: 0x9ec3d3, label: 'Water', defaultProps: ['SINK'],
  },
  'obj-gate': {
    id: 'obj-gate', glyph: '門', kind: 'object', category: 'object', nounKey: 'gate', tint: 0xb49463, label: 'Gate',
  },
  'obj-volcano': {
    id: 'obj-volcano', glyph: '火山', kind: 'object', category: 'object', nounKey: 'volcano', tint: fusedTint, label: 'Volcano', defaultProps: ['HOT'],
  },
  'obj-hotspring': {
    id: 'obj-hotspring', glyph: '湯', kind: 'object', category: 'object', nounKey: 'hotspring', tint: 0xb8d6d0, label: 'Hot Spring',
  },
  'obj-charcoal': {
    id: 'obj-charcoal', glyph: '炭', kind: 'object', category: 'object', nounKey: 'charcoal', tint: 0x8f857b, label: 'Charcoal',
  },

  'txt-human': {
    id: 'txt-human', glyph: '人', kind: 'text', category: 'text-noun', textRole: 'noun', nounKey: 'human', tint: nounTint, label: 'Human text', defaultPushable: true,
  } as EntityDef,
  'txt-tree': {
    id: 'txt-tree', glyph: '木', kind: 'text', category: 'text-noun', textRole: 'noun', nounKey: 'tree', tint: nounTint, label: 'Tree text', defaultPushable: true,
  } as EntityDef,
  'txt-rock': {
    id: 'txt-rock', glyph: '石', kind: 'text', category: 'text-noun', textRole: 'noun', nounKey: 'rock', tint: nounTint, label: 'Rock text', defaultPushable: true,
  } as EntityDef,
  'txt-mountain': {
    id: 'txt-mountain', glyph: '山', kind: 'text', category: 'text-noun', textRole: 'noun', nounKey: 'mountain', tint: nounTint, label: 'Mountain text', defaultPushable: true,
  } as EntityDef,
  'txt-fire': {
    id: 'txt-fire', glyph: '火', kind: 'text', category: 'text-noun', textRole: 'noun', nounKey: 'fire', tint: nounTint, label: 'Fire text', defaultPushable: true,
  } as EntityDef,
  'txt-water': {
    id: 'txt-water', glyph: '水', kind: 'text', category: 'text-noun', textRole: 'noun', nounKey: 'water', tint: nounTint, label: 'Water text', defaultPushable: true,
  } as EntityDef,
  'txt-gate': {
    id: 'txt-gate', glyph: '門', kind: 'text', category: 'text-noun', textRole: 'noun', nounKey: 'gate', tint: nounTint, label: 'Gate text', defaultPushable: true,
  } as EntityDef,
  'txt-volcano': {
    id: 'txt-volcano', glyph: '火山', kind: 'text', category: 'text-noun', textRole: 'noun', nounKey: 'volcano', tint: fusedTint, label: 'Volcano text', defaultPushable: true,
  } as EntityDef,

  'txt-topic': {
    id: 'txt-topic', glyph: 'は', kind: 'text', category: 'text-connector', textRole: 'connector', connectorKey: 'TOPIC', tint: connectorTint, label: 'Topic', defaultPushable: true,
  } as EntityDef,
  'txt-and': {
    id: 'txt-and', glyph: 'と', kind: 'text', category: 'text-operator', textRole: 'operator', operatorKey: 'AND', tint: connectorTint, label: 'And', defaultPushable: true,
  } as EntityDef,

  'txt-you': {
    id: 'txt-you', glyph: '遊', kind: 'text', category: 'text-property', textRole: 'property', propertyKey: 'YOU', tint: propTint, label: 'You', defaultPushable: true,
  } as EntityDef,
  'txt-push': {
    id: 'txt-push', glyph: '押', kind: 'text', category: 'text-property', textRole: 'property', propertyKey: 'PUSH', tint: propTint, label: 'Push', defaultPushable: true,
  } as EntityDef,
  'txt-stop': {
    id: 'txt-stop', glyph: '止', kind: 'text', category: 'text-property', textRole: 'property', propertyKey: 'STOP', tint: propTint, label: 'Stop', defaultPushable: true,
  } as EntityDef,
  'txt-win': {
    id: 'txt-win', glyph: '勝', kind: 'text', category: 'text-property', textRole: 'property', propertyKey: 'WIN', tint: propTint, label: 'Win', defaultPushable: true,
  } as EntityDef,
  'txt-float': {
    id: 'txt-float', glyph: '浮', kind: 'text', category: 'text-property', textRole: 'property', propertyKey: 'FLOAT', tint: propTint, label: 'Float', defaultPushable: true,
  } as EntityDef,
  'txt-sink': {
    id: 'txt-sink', glyph: '沈', kind: 'text', category: 'text-property', textRole: 'property', propertyKey: 'SINK', tint: propTint, label: 'Sink', defaultPushable: true,
  } as EntityDef,
  'txt-hot': {
    id: 'txt-hot', glyph: '熱', kind: 'text', category: 'text-property', textRole: 'property', propertyKey: 'HOT', tint: propTint, label: 'Hot', defaultPushable: true,
  } as EntityDef,
  'txt-hotspring': {
    id: 'txt-hotspring', glyph: '湯', kind: 'text', category: 'text-noun', textRole: 'noun', nounKey: 'hotspring', tint: nounTint, label: 'Hot Spring text', defaultPushable: true,
  } as EntityDef,
  'txt-charcoal': {
    id: 'txt-charcoal', glyph: '炭', kind: 'text', category: 'text-noun', textRole: 'noun', nounKey: 'charcoal', tint: nounTint, label: 'Charcoal text', defaultPushable: true,
  } as EntityDef,
};

export const INK_COLOR = ink;
