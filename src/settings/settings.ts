import { invoke } from '@tauri-apps/api/core';
import { render } from 'lit';
import { CloseIcon, ArrowDownSmallIcon } from '@blocksuite/icons/lit';
import { showWelcome } from '../welcome/welcome';

export interface AppSettings {
  theme: string;
  vibrancy: boolean;
  vibrancyOpacity: number;
  vibrancyBlur: number;
  onboarded: boolean;
  notchEnabled: boolean;
  icloudSync: boolean;
  headerBar: boolean;
}

const defaults: AppSettings = {
  theme: 'dark',
  vibrancy: true,
  vibrancyOpacity: 0.15,
  vibrancyBlur: 40,
  onboarded: false,
  notchEnabled: true,
  icloudSync: false,
  headerBar: true,
};

const isMac = navigator.platform.toUpperCase().includes('MAC');

let overlay: HTMLElement | null = null;

export async function loadSettings(): Promise<AppSettings> {
  const saved = await invoke<Partial<AppSettings>>('load_settings');
  return { ...defaults, ...saved };
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

function saveSettingsDebounced(settings: AppSettings) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    invoke('save_settings', { settings: { ...settings } });
  }, 300);
}

export async function saveSettingsImmediate(settings: AppSettings) {
  if (saveTimer) clearTimeout(saveTimer);
  await invoke('save_settings', { settings });
}

export function applySettings(settings: AppSettings) {
  document.documentElement.setAttribute('data-theme', settings.theme);
  document.documentElement.classList.toggle('vibrancy', settings.vibrancy);
  document.documentElement.classList.toggle('peak-header-bar', settings.headerBar);

  const root = document.documentElement.style;
  const rgb = settings.theme === 'light' ? '255, 255, 255' : '0, 0, 0';
  root.setProperty('--peak-vibrancy-bg', `rgba(${rgb}, ${settings.vibrancyOpacity})`);
  root.setProperty('--peak-vibrancy-filter', `blur(${settings.vibrancyBlur}px)`);
}

export function closeSettings() {
  if (overlay) {
    overlay.remove();
    overlay = null;
  }
}

export async function openSettings() {
  if (overlay) return;

  const settings = await loadSettings();

  overlay = document.createElement('div');
  overlay.className = 'peak-settings-overlay';
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeSettings();
  });

  const panel = document.createElement('div');
  panel.className = 'peak-settings-panel';

  // Header
  const header = document.createElement('div');
  header.className = 'peak-settings-header';

  const headerText = document.createElement('span');
  headerText.textContent = 'Settings';
  header.appendChild(headerText);

  const closeBtn = document.createElement('button');
  closeBtn.className = 'peak-settings-close';
  render(CloseIcon({ width: '20', height: '20' }), closeBtn);
  closeBtn.addEventListener('click', closeSettings);
  header.appendChild(closeBtn);

  panel.appendChild(header);

  // Scrollable content
  const content = document.createElement('div');
  content.className = 'peak-settings-content';

  // ===== Appearance section =====
  content.appendChild(createSectionHeader('Appearance'));

  const themeRow = createSettingRow('Theme', 'Choose your theme');
  const themeToggle = createSegmentedControl(
    ['Light', 'Dark'],
    settings.theme === 'dark' ? 1 : 0,
    async (index) => {
      settings.theme = index === 0 ? 'light' : 'dark';
      applySettings(settings);
      await saveSettingsImmediate(settings);
    }
  );
  themeRow.appendChild(themeToggle);
  content.appendChild(themeRow);

  const headerBarRow = createSettingRow('Header Bar', 'Show a header bar with title and controls above the editor');
  const headerBarToggle = createSwitch(settings.headerBar, async (on) => {
    settings.headerBar = on;
    document.documentElement.classList.toggle('peak-header-bar', on);
    await saveSettingsImmediate(settings);
  });
  headerBarRow.appendChild(headerBarToggle);
  content.appendChild(headerBarRow);

  // ===== Vibrancy section =====
  content.appendChild(createSectionHeader('Vibrancy'));

  const vibrancyRow = createSettingRow('Vibrancy', 'Enable translucent background effect');
  const vibrancyToggle = createSwitch(settings.vibrancy, async (on) => {
    settings.vibrancy = on;
    applySettings(settings);
    await saveSettingsImmediate(settings);
  });
  vibrancyRow.appendChild(vibrancyToggle);
  content.appendChild(vibrancyRow);

  const blurRow = createSettingRow('Blur', 'Adjust the vibrancy blur intensity');
  const blurSlider = createSlider(0, 80, settings.vibrancyBlur, (val) => {
    settings.vibrancyBlur = val;
    applySettings(settings);
    saveSettingsDebounced(settings);
  });
  blurRow.appendChild(blurSlider);
  content.appendChild(blurRow);

  const opacityRow = createSettingRow('Opacity', 'Adjust the vibrancy opacity');
  const opacitySlider = createSlider(0, 0.6, settings.vibrancyOpacity, (val) => {
    settings.vibrancyOpacity = Math.round(val * 100) / 100;
    applySettings(settings);
    saveSettingsDebounced(settings);
  }, 0.01);
  opacityRow.appendChild(opacitySlider);
  content.appendChild(opacityRow);

  // ===== Features section =====
  content.appendChild(createSectionHeader('Features'));

  const notchRow = createSettingRow('Notch Widget', 'Show the notch widget for quick access');
  const notchToggle = createSwitch(settings.notchEnabled, async (on) => {
    settings.notchEnabled = on;
    await saveSettingsImmediate(settings);
    invoke('set_notch_visible', { visible: on });
  });
  notchRow.appendChild(notchToggle);
  content.appendChild(notchRow);

  if (isMac) {
    const icloudRow = createSettingRow('iCloud Sync', 'Sync your notes across devices via iCloud');
    const icloudToggle = createSwitch(settings.icloudSync, async (on) => {
      try {
        await invoke('toggle_icloud_sync', { enable: on });
        settings.icloudSync = on;
        await saveSettingsImmediate(settings);
      } catch (err) {
        icloudToggle.classList.toggle('on', !on);
        console.error('iCloud sync toggle failed:', err);
      }
    });
    icloudRow.appendChild(icloudToggle);
    content.appendChild(icloudRow);
  }

  // ===== Developer section =====
  content.appendChild(createSectionHeader('Developer'));

  const resetRow = createSettingRow('Reset Onboarding', 'Show the welcome screen on next launch');
  const resetBtn = document.createElement('button');
  resetBtn.className = 'peak-settings-reset-btn';
  resetBtn.textContent = 'Reset';
  resetBtn.addEventListener('click', async () => {
    settings.onboarded = false;
    await saveSettingsImmediate(settings);
    closeSettings();
    showWelcome(settings);
  });
  resetRow.appendChild(resetBtn);
  content.appendChild(resetRow);

  // Scroll indicator arrow
  const scrollIndicator = document.createElement('div');
  scrollIndicator.className = 'peak-settings-scroll-indicator';
  render(ArrowDownSmallIcon({ width: '20', height: '20' }), scrollIndicator);

  function updateScrollIndicator() {
    const atBottom = content.scrollHeight - content.scrollTop - content.clientHeight < 10;
    scrollIndicator.classList.toggle('hidden', atBottom);
  }

  content.addEventListener('scroll', updateScrollIndicator);

  panel.appendChild(content);
  panel.appendChild(scrollIndicator);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  // Check after render
  requestAnimationFrame(updateScrollIndicator);
}

function createSectionHeader(title: string): HTMLElement {
  const section = document.createElement('div');
  section.className = 'peak-settings-section';
  section.textContent = title;
  return section;
}

function createSettingRow(label: string, description?: string): HTMLElement {
  const row = document.createElement('div');
  row.className = 'peak-settings-row';

  const textWrap = document.createElement('div');
  textWrap.className = 'peak-settings-row-text';

  const labelEl = document.createElement('span');
  labelEl.className = 'peak-settings-label';
  labelEl.textContent = label;
  textWrap.appendChild(labelEl);

  if (description) {
    const descEl = document.createElement('span');
    descEl.className = 'peak-settings-description';
    descEl.textContent = description;
    textWrap.appendChild(descEl);
  }

  row.appendChild(textWrap);
  return row;
}

function createSegmentedControl(
  labels: string[],
  activeIndex: number,
  onChange: (index: number) => void
): HTMLElement {
  const control = document.createElement('div');
  control.className = 'peak-segmented-control';

  const buttons: HTMLButtonElement[] = [];

  labels.forEach((label, i) => {
    const btn = document.createElement('button');
    btn.className = `peak-segmented-btn${i === activeIndex ? ' active' : ''}`;
    btn.textContent = label;
    btn.addEventListener('click', () => {
      buttons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      updateSliderPos();
      onChange(i);
    });
    buttons.push(btn);
    control.appendChild(btn);
  });

  const slider = document.createElement('div');
  slider.className = 'peak-segmented-slider';
  control.appendChild(slider);

  function updateSliderPos() {
    const activeBtn = buttons.find(b => b.classList.contains('active'));
    if (activeBtn) {
      slider.style.width = `${activeBtn.offsetWidth}px`;
      slider.style.left = `${activeBtn.offsetLeft}px`;
    }
  }

  // Position after render
  requestAnimationFrame(() => updateSliderPos());

  return control;
}

function createSwitch(
  on: boolean,
  onChange: (on: boolean) => void
): HTMLElement {
  const sw = document.createElement('button');
  sw.className = `peak-switch${on ? ' on' : ''}`;

  const knob = document.createElement('div');
  knob.className = 'peak-switch-knob';
  sw.appendChild(knob);

  sw.addEventListener('click', () => {
    const isOn = sw.classList.toggle('on');
    onChange(isOn);
  });

  return sw;
}

function createSlider(
  min: number,
  max: number,
  value: number,
  onChange: (val: number) => void,
  step?: number
): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'peak-slider-wrapper';

  const input = document.createElement('input');
  input.type = 'range';
  input.className = 'peak-slider';
  input.min = String(min);
  input.max = String(max);
  input.step = String(step ?? 1);
  input.value = String(value);

  // Set initial fill
  updateSliderFill(input);

  input.addEventListener('input', () => {
    updateSliderFill(input);
    onChange(parseFloat(input.value));
  });

  wrapper.appendChild(input);
  return wrapper;
}

function updateSliderFill(input: HTMLInputElement) {
  const min = parseFloat(input.min);
  const max = parseFloat(input.max);
  const val = parseFloat(input.value);
  const pct = ((val - min) / (max - min)) * 100;
  input.style.setProperty('--fill', `${pct}%`);
}

// Expose globally so Tauri menu can trigger it
(window as any).__openSettings = openSettings;
