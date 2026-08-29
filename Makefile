STANDARDS_PROJECT := World-Travel (TREK)
STANDARDS_CUSTOM_HELP := 1
include ../make/standards.mk

.PHONY: setup start test check capture capture-promote capture-open help

setup:
	npm run setup

start:
	npm run dev

test:
	npm test

check:
	npm run check

capture:
	CI=1 npm run capture

capture-promote:
	cd client && node e2e/screenshots/promote.mjs $(ARGS)

capture-open:
	@open client/e2e/.tmp/shots 2>/dev/null || echo "Open client/e2e/.tmp/shots/"

help:
	@echo "$(STANDARDS_PROJECT)"
	@echo ""
	@echo "Standard commands (see $(STANDARDS_ROOT)/AGENTS.md):"
	@echo "  make setup    Install dependencies"
	@echo "  make start    Start local dev server or workflow"
	@echo "  make test     Run automated tests"
	@echo "  make check    Lint, typecheck, and static verification"
	@echo "  make capture  Playwright wiki screenshots"
	@echo ""
	@echo "Capture output (gitignored staging):"
	@echo "  client/e2e/.tmp/shots/     *.png, *.html, *.css.json per screen"
	@echo "  make capture-promote       Resize PNGs into wiki/assets/"
	@echo "  make capture-open          Open staging folder in Finder"
	@echo "  make capture-promote ARGS=--dry   Preview promote sizes only"
