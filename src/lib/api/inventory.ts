import { inventoryFetch } from './client';

// Generic Inventory API client.
// Add domain-specific functions here as endpoints get defined.
export const inventoryApi = {
  fetch: inventoryFetch,
};
