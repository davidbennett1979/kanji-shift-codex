import type { LevelData } from '../../core/model/Types';

export const TUTORIAL_LEVELS: LevelData[] = [
  {
    id: 'tutorial-01',
    name: '1. First Rule',
    width: 12,
    height: 8,
    hint: 'Move to the gate. Read the text rules on top.',
    entities: [
      { defId: 'txt-human', x: 1, y: 1 },
      { defId: 'txt-topic', x: 2, y: 1 },
      { defId: 'txt-you', x: 3, y: 1 },
      { defId: 'txt-gate', x: 6, y: 1 },
      { defId: 'txt-topic', x: 7, y: 1 },
      { defId: 'txt-win', x: 8, y: 1 },
      { defId: 'obj-human', x: 2, y: 5 },
      { defId: 'obj-gate', x: 9, y: 5 }
    ]
  },
  {
    id: 'tutorial-02',
    name: '2. Push',
    width: 12,
    height: 8,
    hint: 'Push the tree out of the way.',
    entities: [
      { defId: 'txt-human', x: 1, y: 1 }, { defId: 'txt-topic', x: 2, y: 1 }, { defId: 'txt-you', x: 3, y: 1 },
      { defId: 'txt-gate', x: 6, y: 1 }, { defId: 'txt-topic', x: 7, y: 1 }, { defId: 'txt-win', x: 8, y: 1 },
      { defId: 'txt-tree', x: 1, y: 2 }, { defId: 'txt-topic', x: 2, y: 2 }, { defId: 'txt-push', x: 3, y: 2 },
      { defId: 'obj-human', x: 2, y: 5 },
      { defId: 'obj-tree', x: 5, y: 5 },
      { defId: 'obj-gate', x: 9, y: 5 }
    ]
  },
  {
    id: 'tutorial-03',
    name: '3. Stop',
    width: 14,
    height: 9,
    hint: 'Stones block your path. Use the gap.',
    entities: [
      { defId: 'txt-human', x: 1, y: 1 }, { defId: 'txt-topic', x: 2, y: 1 }, { defId: 'txt-you', x: 3, y: 1 },
      { defId: 'txt-gate', x: 6, y: 1 }, { defId: 'txt-topic', x: 7, y: 1 }, { defId: 'txt-win', x: 8, y: 1 },
      { defId: 'txt-rock', x: 10, y: 1 }, { defId: 'txt-topic', x: 11, y: 1 }, { defId: 'txt-stop', x: 12, y: 1 },
      { defId: 'obj-human', x: 2, y: 6 },
      { defId: 'obj-gate', x: 11, y: 6 },
      { defId: 'obj-rock', x: 6, y: 4 },
      { defId: 'obj-rock', x: 6, y: 5 },
      { defId: 'obj-rock', x: 6, y: 7 },
      { defId: 'obj-rock', x: 7, y: 4 },
      { defId: 'obj-rock', x: 7, y: 7 },
      { defId: 'obj-rock', x: 8, y: 4 },
      { defId: 'obj-rock', x: 8, y: 5 },
      { defId: 'obj-rock', x: 8, y: 7 }
    ]
  },
  {
    id: 'tutorial-04',
    name: '4. Rewrite Push',
    width: 14,
    height: 9,
    hint: 'Make 木 は 押 to move the tree.',
    entities: [
      { defId: 'txt-human', x: 1, y: 1 }, { defId: 'txt-topic', x: 2, y: 1 }, { defId: 'txt-you', x: 3, y: 1 },
      { defId: 'txt-gate', x: 10, y: 1 }, { defId: 'txt-topic', x: 11, y: 1 }, { defId: 'txt-win', x: 12, y: 1 },
      { defId: 'txt-tree', x: 3, y: 3 },
      { defId: 'txt-topic', x: 5, y: 3 },
      { defId: 'txt-push', x: 7, y: 3 },
      { defId: 'obj-human', x: 2, y: 6 },
      { defId: 'obj-tree', x: 6, y: 6 },
      { defId: 'obj-gate', x: 11, y: 6 },
      { defId: 'obj-rock', x: 9, y: 5 },
      { defId: 'obj-rock', x: 9, y: 6 },
      { defId: 'obj-rock', x: 9, y: 7 }
    ]
  },
  {
    id: 'tutorial-05',
    name: '5. First Fusion',
    width: 16,
    height: 10,
    hint: 'Push 火 into 山 to create 火山, then touch it to win.',
    entities: [
      { defId: 'txt-human', x: 1, y: 1 }, { defId: 'txt-topic', x: 2, y: 1 }, { defId: 'txt-you', x: 3, y: 1 },
      { defId: 'txt-volcano', x: 7, y: 1 }, { defId: 'txt-topic', x: 8, y: 1 }, { defId: 'txt-win', x: 9, y: 1 },
      { defId: 'txt-fire', x: 1, y: 2 }, { defId: 'txt-topic', x: 2, y: 2 }, { defId: 'txt-push', x: 3, y: 2 },
      { defId: 'txt-mountain', x: 5, y: 2 }, { defId: 'txt-topic', x: 6, y: 2 }, { defId: 'txt-stop', x: 7, y: 2 },
      { defId: 'obj-human', x: 2, y: 7 },
      { defId: 'obj-fire', x: 5, y: 7 },
      { defId: 'obj-mountain', x: 8, y: 7 },
      { defId: 'obj-rock', x: 11, y: 6 },
      { defId: 'obj-rock', x: 11, y: 7 },
      { defId: 'obj-rock', x: 11, y: 8 }
    ]
  },
  {
    id: 'tutorial-06',
    name: '6. Chain Rules (と)',
    width: 16,
    height: 10,
    hint: 'Gate is both WIN and STOP. Use the gap and touch it.',
    entities: [
      { defId: 'txt-human', x: 1, y: 1 }, { defId: 'txt-topic', x: 2, y: 1 }, { defId: 'txt-you', x: 3, y: 1 },
      { defId: 'txt-gate', x: 6, y: 1 }, { defId: 'txt-topic', x: 7, y: 1 }, { defId: 'txt-win', x: 8, y: 1 },
      { defId: 'txt-and', x: 9, y: 1 }, { defId: 'txt-stop', x: 10, y: 1 },
      { defId: 'txt-tree', x: 1, y: 2 }, { defId: 'txt-topic', x: 2, y: 2 }, { defId: 'txt-push', x: 3, y: 2 },
      { defId: 'obj-human', x: 2, y: 7 },
      { defId: 'obj-tree', x: 7, y: 7 },
      { defId: 'obj-gate', x: 12, y: 7 },
      { defId: 'obj-rock', x: 11, y: 6 },
      { defId: 'obj-rock', x: 11, y: 8 }
    ]
  },
  {
    id: 'tutorial-07',
    name: '7. Transform (NOUN は NOUN)',
    width: 16,
    height: 10,
    hint: 'Build 火 は 山 to turn fire into a mountain. Then 火山 still works in later levels.',
    entities: [
      { defId: 'txt-human', x: 1, y: 1 }, { defId: 'txt-topic', x: 2, y: 1 }, { defId: 'txt-you', x: 3, y: 1 },
      { defId: 'txt-mountain', x: 6, y: 1 }, { defId: 'txt-topic', x: 7, y: 1 }, { defId: 'txt-win', x: 8, y: 1 },
      { defId: 'txt-fire', x: 1, y: 3 },
      { defId: 'txt-topic', x: 4, y: 3 },
      { defId: 'txt-mountain', x: 6, y: 3 },
      { defId: 'obj-human', x: 2, y: 7 },
      { defId: 'obj-fire', x: 5, y: 7 },
      { defId: 'obj-rock', x: 10, y: 6 },
      { defId: 'obj-rock', x: 10, y: 7 },
      { defId: 'obj-rock', x: 10, y: 8 }
    ]
  },
  {
    id: 'tutorial-08',
    name: '8. Pull (引)',
    width: 16,
    height: 10,
    hint: 'Tree is PULL + STOP. Move away from it to drag it and open the gate path.',
    entities: [
      { defId: 'txt-human', x: 1, y: 1 }, { defId: 'txt-topic', x: 2, y: 1 }, { defId: 'txt-you', x: 3, y: 1 },
      { defId: 'txt-gate', x: 6, y: 1 }, { defId: 'txt-topic', x: 7, y: 1 }, { defId: 'txt-win', x: 8, y: 1 },
      { defId: 'txt-tree', x: 10, y: 1 }, { defId: 'txt-topic', x: 11, y: 1 }, { defId: 'txt-pull', x: 12, y: 1 },
      { defId: 'txt-and', x: 13, y: 1 }, { defId: 'txt-stop', x: 14, y: 1 },

      { defId: 'obj-human', x: 9, y: 7 },
      { defId: 'obj-tree', x: 10, y: 7 },
      { defId: 'obj-gate', x: 12, y: 7 },

      { defId: 'obj-rock', x: 11, y: 6 },
      { defId: 'obj-rock', x: 12, y: 6 },
      { defId: 'obj-rock', x: 13, y: 6 },
      { defId: 'obj-rock', x: 13, y: 7 },
      { defId: 'obj-rock', x: 11, y: 8 },
      { defId: 'obj-rock', x: 12, y: 8 },
      { defId: 'obj-rock', x: 13, y: 8 }
    ]
  },
  {
    id: 'tutorial-09',
    name: '9. Melt (溶)',
    width: 18,
    height: 11,
    hint: 'Push the melting tree into hot fire to clear the path.',
    entities: [
      { defId: 'txt-human', x: 1, y: 1 }, { defId: 'txt-topic', x: 2, y: 1 }, { defId: 'txt-you', x: 3, y: 1 },
      { defId: 'txt-gate', x: 6, y: 1 }, { defId: 'txt-topic', x: 7, y: 1 }, { defId: 'txt-win', x: 8, y: 1 },

      { defId: 'txt-fire', x: 1, y: 2 }, { defId: 'txt-topic', x: 2, y: 2 }, { defId: 'txt-hot', x: 3, y: 2 },
      { defId: 'txt-tree', x: 6, y: 2 }, { defId: 'txt-topic', x: 7, y: 2 }, { defId: 'txt-push', x: 8, y: 2 },
      { defId: 'txt-and', x: 9, y: 2 }, { defId: 'txt-melt', x: 10, y: 2 },

      { defId: 'obj-human', x: 2, y: 8 },
      { defId: 'obj-fire', x: 9, y: 8 },
      { defId: 'obj-tree', x: 6, y: 8 },
      { defId: 'obj-gate', x: 14, y: 8 },

      { defId: 'obj-rock', x: 11, y: 7 },
      { defId: 'obj-rock', x: 11, y: 8 },
      { defId: 'obj-rock', x: 11, y: 9 }
    ]
  }
];
