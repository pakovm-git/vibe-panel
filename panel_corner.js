import Clutter from 'gi://Clutter';
import St from 'gi://St';
import GObject from 'gi://GObject';
import Cairo from 'cairo';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Utils from './utils.js';
import { ANIMATION_TIME } from 'resource:///org/gnome/shell/ui/overview.js';

const SYNC_CREATE = GObject.BindingFlags.SYNC_CREATE;

export class PanelCorners {
    #settings;
    #connections;
    #extension;
    _leftCorner;
    _rightCorner;

    constructor(settings, connections, extension) {
        this.#settings = settings;
        this.#connections = connections;
        this.#extension = extension;
    }

    update() {
        this.#log("updating panel corners...");

        this.remove();

        this._leftCorner = new PanelCorner(St.Side.LEFT, this.#settings, this.#extension);
        this._rightCorner = new PanelCorner(St.Side.RIGHT, this.#settings, this.#extension);

        this.update_corner(this._leftCorner);
        this.update_corner(this._rightCorner);

        this.#log("corners updated.");
    }

    update_corner(corner) {
        Main.panel.bind_property('style', corner, 'style', SYNC_CREATE);
        Main.panel.add_child(corner);
        corner.vfunc_style_changed();

        const actor = (this.#settings.settings);

        this.#settings.keys.forEach(key => {
            this.#connections.connect(
                actor,
                'changed::' + key.name,
                corner.vfunc_style_changed.bind(corner)
            );
        });
    }

    updateOpacity() {
        this._leftCorner?.vfunc_style_changed();
        this._rightCorner?.vfunc_style_changed();
    }

    remove() {
        this.#connections.disconnect_all();

        if (this._leftCorner) {
            this.remove_corner(this._leftCorner);
            this._leftCorner = null;
        }

        if (this._rightCorner) {
            this.remove_corner(this._rightCorner);
            this._rightCorner = null;
        }
    }

    remove_corner(corner) {
        corner.remove_connections();
        Main.panel.remove_child(corner);
        corner.destroy();
    }

    #log(str) {
        console.log(`[Vibe Panel] ${str}`);
    }
}


export class PanelCorner extends St.DrawingArea {
    static {
        GObject.registerClass(this);
    }

    #side;
    #settings;
    #extension;

    #position_changed_id;
    #size_changed_id;

    constructor(side, settings, extension) {
        super({ style_class: 'panel-corner' });

        this.#side = side;
        this.#settings = settings;
        this.#extension = extension;

        this.#position_changed_id = Main.panel.connect(
            'notify::position',
            this.#update_allocation.bind(this)
        );
        this.#size_changed_id = Main.panel.connect(
            'notify::size',
            this.#update_allocation.bind(this)
        );

        this.#update_allocation();
    }

    remove_connections() {
        if (this.#position_changed_id) {
            Main.panel.disconnect(this.#position_changed_id);
            this.#position_changed_id = null;
        }
        if (this.#size_changed_id) {
            Main.panel.disconnect(this.#size_changed_id);
            this.#size_changed_id = null;
        }
    }

    #update_allocation() {
        let childBox = new Clutter.ActorBox();

        let cornerWidth, cornerHeight;
        [, cornerWidth] = this.get_preferred_width(-1);
        [, cornerHeight] = this.get_preferred_height(-1);

        let allocWidth = Main.panel.width;
        let allocHeight = Main.panel.height;

        switch (this.#side) {
            case St.Side.LEFT:
                childBox.x1 = 0;
                childBox.x2 = cornerWidth;
                childBox.y1 = allocHeight;
                childBox.y2 = allocHeight + cornerHeight;
                break;

            case St.Side.RIGHT:
                childBox.x1 = allocWidth - cornerWidth;
                childBox.x2 = allocWidth;
                childBox.y1 = allocHeight;
                childBox.y2 = allocHeight + cornerHeight;
                break;
        }

        this.allocate(childBox);
    }

    vfunc_repaint() {
        const cornerRadius = 15; // Hardcoded radius
        let borderWidth = Utils.lookup_for_length('-panel-corner-border-width', this.#settings);
        let backgroundColor = Utils.lookup_for_color('-panel-corner-background-color', this.#settings, this.#extension);

        let cr = this.get_context();
        cr.setOperator(Cairo.Operator.SOURCE);

        cr.moveTo(0, 0);
        if (this.#side == St.Side.LEFT) {
            cr.arc(cornerRadius,
                borderWidth + cornerRadius,
                cornerRadius, Math.PI, 3 * Math.PI / 2);
        } else {
            cr.arc(0,
                borderWidth + cornerRadius,
                cornerRadius, 3 * Math.PI / 2, 2 * Math.PI);
        }
        cr.lineTo(cornerRadius, 0);
        cr.closePath();

        cr.setSourceColor(backgroundColor);
        cr.fill();

        cr.$dispose();
    }

    vfunc_style_changed() {
        super.vfunc_style_changed();

        const cornerRadius = 15; // Hardcoded radius
        let borderWidth = Utils.lookup_for_length('-panel-corner-border-width', this.#settings);
        
        let opacity;

        // In the overview, corners should always be transparent
        if (Main.panel.has_style_pseudo_class('overview')) {
            opacity = 0.0;
        } 
        // If a window is maximized or near the panel, corners should be solid
        else if (this.#extension.isWindowMaximized()) {
            opacity = 1.0;
        } 
        // Otherwise, use the user's transparency preference
        else {
            opacity = Utils.lookup_for_double('-panel-corner-opacity', this.#settings);
        }
        
        this.#log(`Updating corner opacity to: ${opacity}`);

        this.#update_allocation();
        this.set_size(cornerRadius, borderWidth + cornerRadius);
        this.translation_y = -borderWidth;

        this.remove_transition('opacity');
        this.ease({
            opacity: opacity * 255,
            duration: ANIMATION_TIME,
            mode: Clutter.AnimationMode.EASE_IN_OUT_QUAD,
        });
    }

    #log(str) {
        console.log(`[Vibe Panel] ${str}`);
    }
}


