import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

export class DynamicPanelHandler {
    constructor(settings, extension) {
        this._settings = settings;
        this._extension = extension;
        this._interfaceSettings = extension.getInterfaceSettings();
        this._currentTransparency = -1;
    }

    update() {
        if (!this._settings || !this._extension) return;

        const transparency = this._settings.get_int('transparency');
        const inOverview = Main.panel.has_style_pseudo_class('overview');
        // Get the final truth from the central governor. This call is correct.
        const isTouchingWindow = this._extension.isWindowMaximized();

        let finalTransparency;
        if (inOverview) {
            finalTransparency = 0;
        } else if (isTouchingWindow) {
            finalTransparency = 100;
        } else {
            finalTransparency = transparency;
        }
        
        // --- Robust "Always Update" Logic ---
        // Unconditionally remove all managed classes first to prevent race conditions.
        if (this._currentTransparency !== -1) {
            const oldClass = `dynamic-panel-transparency-${this._currentTransparency}`;
            Main.panel.remove_style_class_name(oldClass);
        }
        Main.panel.remove_style_class_name('dynamic-panel-light');
        Main.panel.remove_style_class_name('dynamic-panel-dark');
        
        // Now, apply the correct new classes from a clean slate.
        Main.panel.add_style_class_name('dynamic-panel-transparent');
        const newClass = `dynamic-panel-transparency-${finalTransparency}`;
        Main.panel.add_style_class_name(newClass);

        const colorScheme = this._interfaceSettings.get_string('color-scheme');
        if (colorScheme === 'prefer-light') {
            Main.panel.add_style_class_name('dynamic-panel-light');
        } else {
            Main.panel.add_style_class_name('dynamic-panel-dark');
        }

        this._currentTransparency = finalTransparency;
    }

    disable() {
        if (this._currentTransparency !== -1) {
            const oldClass = `dynamic-panel-transparency-${this._currentTransparency}`;
            Main.panel.remove_style_class_name(oldClass);
        }
        Main.panel.remove_style_class_name('dynamic-panel-transparent');
        Main.panel.remove_style_class_name('dynamic-panel-light');
        Main.panel.remove_style_class_name('dynamic-panel-dark');

        this._settings = null;
        this._extension = null;
        this._interfaceSettings = null;
    }
}


