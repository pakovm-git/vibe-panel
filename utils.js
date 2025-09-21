import Clutter from 'gi://Clutter';
import St from 'gi://St';
import Cogl from 'gi://Cogl';

export function lookup_for_length(prop, settings) {
    let scale_factor =
        St.ThemeContext.get_for_stage(global.stage).scale_factor;
    let length = settings.get_property(prop.slice(1)).get();

    return length * scale_factor;
};

export function lookup_for_double(prop, settings) {
    return settings.get_property(prop.slice(1)).get();
};

export function lookup_for_color(prop, settings, extension) {
    const interfaceSettings = extension.getInterfaceSettings();
    const colorScheme = interfaceSettings.get_string('color-scheme');

    let color_str;
    if (colorScheme === 'prefer-light') {
        color_str = '#f0f0f0ff'; // Light theme color
    } else {
        // 'default' and 'prefer-dark'
        color_str = '#000000ff'; // Dark theme color
    }

    let color_parsed = Clutter.Color ?
        Clutter.color_from_string(color_str) :
        Cogl.color_from_string(color_str);

    if (color_parsed[0]) {
        return color_parsed[1];
    } else {
        // Fallback to black, though this should not be reached.
        const fallback_color = '#000000ff';
        return Clutter.Color ?
            Clutter.color_from_string(fallback_color)[1] :
            Cogl.color_from_string(fallback_color)[1];
    }
};


