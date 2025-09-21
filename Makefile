# Makefile for Vibe Panel GNOME Shell Extension

UUID = vibe-panel@pakovm
INSTALL_DIR = $(HOME)/.local/share/gnome-shell/extensions/$(UUID)
ZIP_FILE = $(UUID).shell-extension.zip

# List of all files and directories to be included in the installation and zip archive
# Note: Do not list files that are inside the directories here.
SOURCES = \
	extension.js \
	prefs.js \
	panel_corner.js \
	dynamic_panel.js \
	screen_corner.js \
	stylesheet.css \
	utils.js \
	metadata.json \
	conveniences \
	schemas

.PHONY: all clean install uninstall zip build test-prefs test-shell

all: build

# Install the extension to the user's local directory
install: uninstall
	@echo "Installing extension to $(INSTALL_DIR)..."
	@mkdir -p $(INSTALL_DIR)
	@cp -r $(SOURCES) $(INSTALL_DIR)/
	@glib-compile-schemas $(INSTALL_DIR)/schemas
	@echo "Installation complete. Please enable the extension."

# Create a zip file for distribution
build:
	@echo "Creating zip archive: $(ZIP_FILE)..."
	@rm -f $(ZIP_FILE)
	@zip -qr $(ZIP_FILE) $(SOURCES) -x "*.git*"
	@echo "Zip file created."

# Alias for build
zip: build

# Remove the installed extension
uninstall:
	@echo "Removing installed extension..."
	@rm -rf $(INSTALL_DIR)
	@echo "Cleanup complete."

# Test preferences window
test-prefs: install
	gnome-extensions prefs $(UUID)

# Run a nested GNOME Shell for testing
test-shell: install
	dbus-run-session -- gnome-shell --nested --wayland


