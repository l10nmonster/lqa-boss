/**
 * Settings Management
 */

const DEFAULT_SETTINGS = {
  tmEndpointUrl: '',
  sourceLang: 'en',
  targetLang: 'es',
  pwaUrl: 'https://lqaboss.l10n.monster'
};

class SettingsManager {
  constructor() {
    this.settings = { ...DEFAULT_SETTINGS };
    this.init();
  }

  async init() {
    // Load settings from chrome.storage
    await this.load();

    // Populate form fields
    this.populateFields();

    // Setup auto-save event listeners
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Auto-save on input change
    document.getElementById('modal-tm-endpoint').addEventListener('input', (e) => {
      this.settings.tmEndpointUrl = e.target.value.trim();
      this.save();
    });

    document.getElementById('source-lang').addEventListener('input', (e) => {
      this.settings.sourceLang = e.target.value.trim();
      this.save();
    });

    document.getElementById('target-lang').addEventListener('input', (e) => {
      this.settings.targetLang = e.target.value.trim();
      this.save();
    });

    document.getElementById('modal-pwa-url').addEventListener('input', (e) => {
      this.settings.pwaUrl = e.target.value.trim();
      this.save();
    });
  }

  populateFields() {
    document.getElementById('modal-tm-endpoint').value = this.settings.tmEndpointUrl;
    document.getElementById('source-lang').value = this.settings.sourceLang;
    document.getElementById('target-lang').value = this.settings.targetLang;
    document.getElementById('modal-pwa-url').value = this.settings.pwaUrl;
  }

  async load() {
    try {
      const result = await chrome.storage.sync.get('lqaboss_settings');
      if (result.lqaboss_settings) {
        this.settings = { ...DEFAULT_SETTINGS, ...result.lqaboss_settings };
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  }

  async save() {
    try {
      await chrome.storage.sync.set({ lqaboss_settings: this.settings });
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  }

  getSettings() {
    return { ...this.settings };
  }
}

// Global settings instance
const settingsManager = new SettingsManager();
window.settingsManager = settingsManager;
