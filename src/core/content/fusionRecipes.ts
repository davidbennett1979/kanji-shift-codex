import type { FusionRecipe } from '../model/Types';

export const FUSION_RECIPES: FusionRecipe[] = [
  {
    id: 'fire-mountain-volcano',
    inputs: ['fire', 'mountain'],
    outputDefId: 'obj-volcano',
  },
  {
    id: 'water-fire-hotspring',
    inputs: ['water', 'fire'],
    outputDefId: 'obj-hotspring',
  },
  {
    id: 'tree-fire-charcoal',
    inputs: ['tree', 'fire'],
    outputDefId: 'obj-charcoal',
  },
];
