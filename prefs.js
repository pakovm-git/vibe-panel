import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';

import { ExtensionPreferences, gettext as _ } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import { Settings, Type } from './conveniences/settings.js';

// This list must contain ALL keys from the schema to prevent errors.
const Keys = ([
    { type: Type.B, name: "panel-corners" },
    { type: Type.B, name: "solid-on-maximize" },
    { type: Type.I, name: "panel-corner-border-width" },
    { type: Type.D, name: "panel-corner-opacity" },
    { type: Type.I, name: "transparency" },
    { type: Type.I, name: "last-used-transparency" },
    { type: Type.B, name: "corners-only-when-opaque" },
    { type: Type.B, name: "enable-light-theme-tweaks" },
    { type: Type.B, name: "disable-corners-on-light-theme" },
]);

const INTERFACE_SCHEMA = 'org.gnome.desktop.interface';

export default class VibePanelPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        this.settings = new Settings(Keys, this.getSettings());
        this._interfaceSettings = new Gio.Settings({ schema: INTERFACE_SCHEMA });

        const PRESET_MAP = [
            { name: _('Crystal'), value: 30 },
            { name: _('Tinted'), value: 50 },
            { name: _('Smoked'), value: 70 },
            { name: _('Shaded'), value: 85 },
        ];
        const PRESET_LABELS = PRESET_MAP.map(item => item.name);
        const PRESET_VALUES = PRESET_MAP.map(item => item.value);

        const page = new Adw.PreferencesPage();
        window.add(page);

        // --- Dynamic Transparency Group ---
        const transparencyGroup = new Adw.PreferencesGroup({ title: _('Dynamic Transparency') });
        page.add(transparencyGroup);

        const transparencySwitch = new Adw.SwitchRow({
            title: _('Enable Dynamic Transparency'),
            subtitle: _('When disabled, the panel will be fully opaque.'),
        });
        transparencyGroup.add(transparencySwitch);

        const transparencyRow = new Adw.ComboRow({
            title: _('Transparency Level'),
            model: Gtk.StringList.new(PRESET_LABELS),
        });
        transparencyGroup.add(transparencyRow);

        const solidOnTouchRow = new Adw.SwitchRow({
            title: _('Opaque When Window is Near'),
            subtitle: _('Makes the panel opaque when a window is touching it.'),
        });
        transparencyGroup.add(solidOnTouchRow);

        // --- Corners Group ---
        const cornersGroup = new Adw.PreferencesGroup({ title: _('Corners') });
        page.add(cornersGroup);

        const cornersSwitch = new Adw.SwitchRow({ title: _('Enable Panel Corners') });
        cornersGroup.add(cornersSwitch);

        const cornersOnlyOpaqueSwitch = new Adw.SwitchRow({
            title: _('Corners only when panel is opaque'),
            subtitle: _('Hides corners when the panel is transparent.'),
        });
        cornersGroup.add(cornersOnlyOpaqueSwitch);
        
        // --- Light Theme Group ---
        const lightGroup = new Adw.PreferencesGroup();
        page.add(lightGroup);

        const lightTweaksExpander = new Adw.ExpanderRow({
            title: _('Light Theme Specifics'),
            subtitle: _('You need <a href="https://extensions.gnome.org/extension/6750/luminus-desktop/">Luminus Shell</a> for these options to take effect.'),
            show_enable_switch: false,
        });
        lightGroup.add(lightTweaksExpander);
        
        const disableCornersLightSwitch = new Adw.SwitchRow({
            title: _('Disable corners'),
        });
        lightTweaksExpander.add_row(disableCornersLightSwitch);


        // --- UI Logic ---
        const updateUI = () => {
            const isTransparencyEnabled = this.settings.TRANSPARENCY.get() < 100;
            transparencySwitch.active = isTransparencyEnabled;
            transparencyRow.visible = isTransparencyEnabled;
            solidOnTouchRow.sensitive = isTransparencyEnabled;

            const areCornersEnabled = this.settings.PANEL_CORNERS.get();
            cornersSwitch.active = areCornersEnabled;
            cornersOnlyOpaqueSwitch.visible = areCornersEnabled;

            transparencyRow.selected = PRESET_VALUES.indexOf(this.settings.LAST_USED_TRANSPARENCY.get());
        };

        transparencySwitch.connect('notify::active', () => {
            const isEnabled = transparencySwitch.active;
            const value = this.settings.LAST_USED_TRANSPARENCY.get();
            this.settings.TRANSPARENCY.set(isEnabled ? value : 100);
        });

        transparencyRow.connect('notify::selected', () => {
            const newValue = PRESET_VALUES[transparencyRow.selected];
            this.settings.LAST_USED_TRANSPARENCY.set(newValue);
            this.settings.TRANSPARENCY.set(newValue);
        });
        
        this.settings.settings.bind('solid-on-maximize', solidOnTouchRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        this.settings.settings.bind('panel-corners', cornersSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);
        this.settings.settings.bind('corners-only-when-opaque', cornersOnlyOpaqueSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);
        this.settings.settings.bind('enable-light-theme-tweaks', lightTweaksExpander, 'enable-expansion', Gio.SettingsBindFlags.DEFAULT);
        this.settings.settings.bind('disable-corners-on-light-theme', disableCornersLightSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);
        
        this.settings.TRANSPARENCY.changed(updateUI);
        this.settings.PANEL_CORNERS.changed(updateUI);
        
        updateUI();
    }
}

