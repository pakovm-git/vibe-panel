import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import St from 'gi://St';
import Meta from 'gi://Meta';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import { Connections } from './conveniences/connections.js';
import { Settings, Type } from './conveniences/settings.js';
import { PanelCorners } from './panel_corner.js';
import { DynamicPanelHandler } from './dynamic_panel.js';

// This is the single source of truth for all extension settings keys.
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

export default class VibePanelExtension extends Extension {
    #settings;
    #panel_corners;
    #dynamic_panel;
    #interfaceSettings;

    // --- Unified Governor State ---
    #windowSignals = new Map();
    #isMaximized = false;
    #connections;
    #delayedUpdateId = null;

    isWindowMaximized() {
        return this.#isMaximized;
    }

    getInterfaceSettings() {
        return this.#interfaceSettings;
    }

    enable() {
        this.#settings = new Settings(Keys, this.getSettings());
        this.#connections = new Connections();
        this.#interfaceSettings = new Gio.Settings({ schema: INTERFACE_SCHEMA });

        this._initWindowStateTracking();
        this.loadFeatures();

        // --- Connect Settings Changes ---
        this.#settings.PANEL_CORNERS.changed(() => this.loadFeatures());
        this.#settings.SOLID_ON_MAXIMIZE.changed(() => this._updateWindowState());
        this.#settings.CORNERS_ONLY_WHEN_OPAQUE.changed(() => this._updateWindowState());
        this.#settings.DISABLE_CORNERS_ON_LIGHT_THEME.changed(() => this.loadFeatures());
        this.#settings.TRANSPARENCY.changed(() => this._updateWindowState());
        this.#settings.ENABLE_LIGHT_THEME_TWEAKS.changed(() => this._updateWindowState());
        this.#connections.connect(this.#interfaceSettings, 'changed::color-scheme', () => {
            this.loadFeatures();
            this._updateWindowState();
        });
    }

    disable() {
        this.#panel_corners?.remove();
        this.#panel_corners = null;
        this.#dynamic_panel?.disable();
        this.#dynamic_panel = null;
        
        if (this.#delayedUpdateId) {
            GLib.Source.remove(this.#delayedUpdateId);
            this.#delayedUpdateId = null;
        }
        for (const window of this.#windowSignals.keys()) {
            this._onWindowRemoved(window);
        }
        this.#windowSignals.clear();
        this.#connections.disconnect_all();

        this.#settings = null;
        this.#interfaceSettings = null;
        this.#connections = null;
    }

    loadFeatures() {
        const isLightTheme = this.#interfaceSettings.get_string('color-scheme') === 'prefer-light';
        const areTweaksEnabled = this.#settings.ENABLE_LIGHT_THEME_TWEAKS.get();
        const disableCornersOnLight = this.#settings.DISABLE_CORNERS_ON_LIGHT_THEME.get();

        // Conditionally load corners
        this.#panel_corners?.remove();
        this.#panel_corners = null;
        if (this.#settings.PANEL_CORNERS.get()) {
            if (areTweaksEnabled && isLightTheme && disableCornersOnLight) {
                // Do not load corners
            } else {
                this.#panel_corners = new PanelCorners(this.#settings, new Connections(), this);
                this.#panel_corners.update();
            }
        }

        // Load dynamic panel
        this.#dynamic_panel?.disable();
        this.#dynamic_panel = new DynamicPanelHandler(this.getSettings(), this);

        this._updateWindowState();
    }

    // --- Unified Window State Governor ---

    _initWindowStateTracking() {
        this.#connections.connect(Main.overview, 'showing', () => this._updateWindowState());
        this.#connections.connect(Main.overview, 'hiding', () => this._updateWindowState());
        this.#connections.connect(global.workspace_manager, 'active-workspace-changed', () => this._updateWindowStateDelayed());

        for (const window of global.get_window_actors().map(a => a.meta_window)) {
            this._onWindowAdded(window);
        }

        this.#connections.connect(global.display, 'window-created', (_, window) => {
            this._onWindowAdded(window);
        });
    }

    _onWindowAdded(window) {
        if (!window || this.#windowSignals.has(window)) return;

        const ids = [
            window.connect('notify::maximized-horizontally', () => this._updateWindowState()),
            window.connect('notify::maximized-vertically', () => this._updateWindowState()),
            window.connect('notify::fullscreen', () => this._updateWindowState()),
            window.connect('position-changed', () => this._updateWindowState()),
            window.connect('unmanaged', () => this._onWindowRemoved(window)),
        ];
        this.#windowSignals.set(window, ids);
        this._updateWindowState();
    }

    _onWindowRemoved(window) {
        if (!window || !this.#windowSignals.has(window)) return;
        for (const id of this.#windowSignals.get(window)) {
            window.disconnect(id);
        }
        this.#windowSignals.delete(window);
        this._updateWindowState();
    }

    _shouldBeOpaque() {
        if (Main.panel.has_style_pseudo_class('overview')) {
            return false;
        }

        const activeWorkspace = global.workspace_manager.get_active_workspace();
        const windows = activeWorkspace.list_windows().filter(w => w.is_on_primary_monitor() && w.showing_on_its_workspace());

        const panelBottom = Main.panel.get_transformed_position()[1] + Main.panel.get_height();
        const scale = St.ThemeContext.get_for_stage(global.stage).scale_factor;

        for (const window of windows) {
            if (window.get_maximized() || window.is_fullscreen()) {
                return true;
            }
            
            if (this.#settings.SOLID_ON_MAXIMIZE.get()) {
                const rect = window.get_frame_rect();
                if (rect.y < panelBottom + 5 * scale) {
                    return true;
                }
            }
        }
        return false;
    }
    
    _updateWindowStateDelayed() {
        if (this.#delayedUpdateId) GLib.Source.remove(this.#delayedUpdateId);
        this.#delayedUpdateId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => {
            this._updateWindowState();
            this.#delayedUpdateId = null;
            return GLib.SOURCE_REMOVE;
        });
    }

    _updateWindowState() {
        const isOpaque = this._shouldBeOpaque();
        const stateChanged = this.#isMaximized !== isOpaque;
        this.#isMaximized = isOpaque;

        const cornersOnlyWhenOpaque = this.#settings.CORNERS_ONLY_WHEN_OPAQUE.get();
        
        // Governor takes control of the corner opacity setting
        if (cornersOnlyWhenOpaque && !isOpaque) {
            this.getSettings().set_double('panel-corner-opacity', 0.0);
        } else {
            // Revert to the user's chosen transparency
            const transparencyValue = this.getSettings().get_int('transparency') / 100.0;
            this.getSettings().set_double('panel-corner-opacity', transparencyValue);
        }

        this.#dynamic_panel?.update();
        
        if (stateChanged) {
            this.#panel_corners?.updateOpacity();
        }
    }
}


