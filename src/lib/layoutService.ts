import { LazyStore } from '@tauri-apps/plugin-store';

const STORE_PATH = 'layout-cache.json';
const store = new LazyStore(STORE_PATH);

interface NodePosition {
  x: number;
  y: number;
}

interface LayoutData {
  [commitId: string]: NodePosition;
}

export class LayoutService {
  private static instance: LayoutService;
  private isLoaded = false;
  
  private constructor() {}

  static getInstance(): LayoutService {
    if (!LayoutService.instance) {
      LayoutService.instance = new LayoutService();
    }
    return LayoutService.instance;
  }

  private async ensureLoaded() {
    if (!this.isLoaded) {
      // LazyStore does not have a .load() method in some versions or it's auto-loaded.
      // But we are using 'Store' class directly.
      // In v2 plugin, Store.load() is required.
      // If it says load is undefined, maybe the import is wrong or version mismatch.
      // Actually, let's check if we should use LazyStore or Store.
      // If we use LazyStore, we don't need load().
      // If we use Store, we need load().
      
      // Let's try to just await store.init() if load() is missing? 
      // Or maybe the error "store.load is not a function" means 'store' instance doesn't have it.
      // The `Store` class from `@tauri-apps/plugin-store` should have it.
      
      // Let's try to re-instantiate as LazyStore which handles loading automatically.
      // But LazyStore doesn't expose keys().
      
      // If we stick with Store, we need to make sure we are importing it correctly.
      // The error suggests `store` object doesn't have `load`.
      
      // Let's try a different approach: Use LazyStore for get/set, and for keys() we might be out of luck with LazyStore?
      // No, LazyStore is just a wrapper.
      
      // Let's try to remove .load() call if it's not needed or if it fails.
      // But without load(), get() might return nothing.
      
      // Actually, looking at the error: "TypeError: store.load is not a function".
      // This implies the `store` object created via `new Store(...)` does not have a `load` method.
      // This is strange for v2.
      
      // Let's try using LazyStore again, which is simpler and auto-loads.
      // And for keys(), we can try to iterate or maybe we just don't support listing all repos for now if API limits us?
      // Or we can maintain a separate "index" key in the store that lists all repo paths.
      
      try {
          if ('load' in store && typeof store.load === 'function') {
            await (store as any).load();
          }
      } catch (e) {
          console.warn("Store load failed or not needed", e);
      }
      this.isLoaded = true;
    }
  }

  private getStoreKey(repoPath: string): string {
    // Replace characters that might interfere with store key paths if any
    // Base64 encoding is safest for paths used as keys
    // Normalize path: remove trailing slashes
    const normalized = repoPath.replace(/[\\/]+$/, '');
    return btoa(encodeURIComponent(normalized));
  }

  async saveLayout(repoPath: string, layout: LayoutData) {
    try {
      await this.ensureLoaded();
      const key = this.getStoreKey(repoPath);
      
      console.log(`[LayoutService] Saving layout for ${repoPath} (key: ${key}). Nodes: ${Object.keys(layout).length}`);

      // Get existing layout for this repo
      let existing: LayoutData = {};
      try {
        existing = (await store.get<LayoutData>(key)) || {};
      } catch (e) {
        // Ignore if key doesn't exist
      }
      
      // Merge with new updates
      const updated = { ...existing, ...layout };
      
      await store.set(key, updated);
      await this.updateIndex(repoPath, 'add');
      await store.save();
      console.log('[LayoutService] Layout saved successfully');
    } catch (error) {
      console.error('[LayoutService] Failed to save layout:', error);
    }
  }

  async getLayout(repoPath: string): Promise<LayoutData | null> {
    try {
      await this.ensureLoaded();
      const key = this.getStoreKey(repoPath);
      const data = await store.get<LayoutData>(key);
      console.log(`[LayoutService] Loading layout for ${repoPath} (key: ${key}). Found: ${!!data}, Entries: ${data ? Object.keys(data).length : 0}`);
      return data ?? null;
    } catch (error) {
      console.error('[LayoutService] Failed to get layout:', error);
      return null;
    }
  }

  async clearLayout(repoPath: string) {
    try {
      await this.ensureLoaded();
      const key = this.getStoreKey(repoPath);
      // Try to delete using the key.
      // If store treats key as path, this should be fine.
      // However, store.delete() sometimes behaves weirdly with top level keys in some versions.
      // Setting to null is a fallback.
      await store.set(key, null);
      // await store.delete(key); 
      
      await this.updateIndex(repoPath, 'remove');
      await store.save();
    } catch (error) {
      console.error('Failed to clear layout:', error);
    }
  }

  async getAllKeys(): Promise<string[]> {
    try {
      await this.ensureLoaded();
      // LazyStore does not expose keys() directly.
      // We can try to cast it to any and call keys if it exists internally?
      // Or we can maintain a separate index.
      
      // Let's try to assume there is a .keys() method even if TS definition is missing?
      // Or try to use the raw store if accessible.
      
      // Actually, if we can't list keys easily, maybe we should just save the list of repos in a special key "REPO_INDEX".
      const index = await store.get<string[]>('__REPO_INDEX__');
      return index || [];
    } catch (error) {
      console.error('Failed to get keys:', error);
      return [];
    }
  }

  private async updateIndex(repoPath: string, action: 'add' | 'remove') {
      try {
          const index = (await store.get<string[]>('__REPO_INDEX__')) || [];
          let newIndex = [...index];
          
          if (action === 'add') {
              if (!newIndex.includes(repoPath)) {
                  newIndex.push(repoPath);
              }
          } else {
              newIndex = newIndex.filter(p => p !== repoPath);
          }
          
          await store.set('__REPO_INDEX__', newIndex);
      } catch (e) {
          console.error("Failed to update index", e);
      }
  }
}

export const layoutService = LayoutService.getInstance();
