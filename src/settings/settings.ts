import { isTauri } from '../platform/platform';
import { render } from 'lit';
import { CloseIcon } from '@blocksuite/icons/lit';
import { getIdentity, setIdentityName, setIdentityColor } from '../collab/identity';

export interface AppSettings {
  theme: string;
  vibrancy: boolean;
  vibrancyOpacity: number;
  vibrancyBlur: number;
  onboarded: boolean;
  notchEnabled: boolean;
}

const defaults: AppSettings = {
  theme: 'dark',
  vibrancy: true,
  vibrancyOpacity: 0.15,
  vibrancyBlur: 40,
  onboarded: false,
  notchEnabled: true,
};

let overlay: HTMLElement | null = null;

const WEB_SETTINGS_KEY = 'peak-settings';

export async function loadSettings(): Promise<AppSettings> {
  if (isTauri) {
    const { invoke } = await import('@tauri-apps/api/core');
    const saved = await invoke<Partial<AppSettings>>('load_settings');
    return { ...defaults, ...saved };
  }
  try {
    const raw = localStorage.getItem(WEB_SETTINGS_KEY);
    if (raw) return { ...defaults, ...JSON.parse(raw) };
  } catch { /* use defaults */ }
  return { ...defaults };
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

function saveSettingsDebounced(settings: AppSettings) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveSettingsImpl(settings);
  }, 300);
}

async function saveSettingsImpl(settings: AppSettings) {
  if (isTauri) {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('save_settings', { settings: { ...settings } });
  } else {
    localStorage.setItem(WEB_SETTINGS_KEY, JSON.stringify(settings));
  }
}

export async function saveSettingsImmediate(settings: AppSettings) {
  if (saveTimer) clearTimeout(saveTimer);
  await saveSettingsImpl(settings);
}

export function applySettings(settings: AppSettings) {
  document.documentElement.setAttribute('data-theme', settings.theme);
  document.documentElement.classList.toggle('vibrancy', settings.vibrancy);

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

  // Theme setting
  const themeRow = createSettingRow('Appearance');
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
  panel.appendChild(themeRow);

  // Vibrancy toggle
  const vibrancyRow = createSettingRow('Vibrancy');
  const vibrancyToggle = createSwitch(settings.vibrancy, async (on) => {
    settings.vibrancy = on;
    applySettings(settings);
    await saveSettingsImmediate(settings);
  });
  vibrancyRow.appendChild(vibrancyToggle);
  panel.appendChild(vibrancyRow);

  // Blur slider
  const blurRow = createSettingRow('Blur');
  const blurSlider = createSlider(0, 80, settings.vibrancyBlur, (val) => {
    settings.vibrancyBlur = val;
    applySettings(settings);
    saveSettingsDebounced(settings);
  });
  blurRow.appendChild(blurSlider);
  panel.appendChild(blurRow);

  // Opacity slider
  const opacityRow = createSettingRow('Opacity');
  const opacitySlider = createSlider(0, 0.6, settings.vibrancyOpacity, (val) => {
    settings.vibrancyOpacity = Math.round(val * 100) / 100;
    applySettings(settings);
    saveSettingsDebounced(settings);
  }, 0.01);
  opacityRow.appendChild(opacitySlider);
  panel.appendChild(opacityRow);

  // Notch widget toggle (Tauri only)
  if (isTauri) {
    const notchRow = createSettingRow('Notch Widget');
    const notchToggle = createSwitch(settings.notchEnabled, async (on) => {
      settings.notchEnabled = on;
      await saveSettingsImmediate(settings);
      const { invoke } = await import('@tauri-apps/api/core');
      invoke('set_notch_visible', { visible: on });
    });
    notchRow.appendChild(notchToggle);
    panel.appendChild(notchRow);
  }

  // Separator
  const separator = document.createElement('div');
  separator.className = 'peak-settings-separator';
  panel.appendChild(separator);

  // Realtime section header
  const realtimeHeader = document.createElement('div');
  realtimeHeader.className = 'peak-settings-section-header';
  realtimeHeader.textContent = 'Realtime';
  panel.appendChild(realtimeHeader);

  // Display Name
  const identity = getIdentity();

  const nameRow = createSettingRow('Display Name');
  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.className = 'peak-settings-input';
  nameInput.value = identity.name;
  nameInput.placeholder = 'Anonymous';
  nameInput.addEventListener('change', () => {
    setIdentityName(nameInput.value);
  });
  nameRow.appendChild(nameInput);
  panel.appendChild(nameRow);

  // Cursor Color
  const colorRow = createSettingRow('Cursor Color');
  const colorInput = document.createElement('input');
  colorInput.type = 'color';
  colorInput.className = 'peak-settings-color-input';
  colorInput.value = identity.color;
  colorInput.addEventListener('change', () => {
    setIdentityColor(colorInput.value);
  });
  colorRow.appendChild(colorInput);
  panel.appendChild(colorRow);

  overlay.appendChild(panel);
  document.body.appendChild(overlay);
}

export function createSettingRow(label: string): HTMLElement {
  const row = document.createElement('div');
  row.className = 'peak-settings-row';

  const labelEl = document.createElement('span');
  labelEl.className = 'peak-settings-label';
  labelEl.textContent = label;
  row.appendChild(labelEl);

  return row;
}

export function createSegmentedControl(
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

export function createSwitch(
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

export function createSlider(
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
