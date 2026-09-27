.PHONY: help dev build preview clean new check update \
        mod-tidy mod-update mod-graph \
        git-status git-log deploy

# ============================================================
# Variables
# ============================================================

HUGO       := hugo
HOST       := 0.0.0.0
PORT       := 1313

POST       ?= hello-world

# Git
REMOTE     := origin
BRANCH     := main

# ============================================================
# Default
# ============================================================

.DEFAULT_GOAL := help

# ============================================================
# Help
# ============================================================

help:
	@echo ""
	@echo "real-shenghong - Hugo Blog"
	@echo ""
	@echo "Usage:"
	@echo "  make <target>"
	@echo ""
	@echo "Development:"
	@echo "  make dev                    Start Hugo development server"
	@echo "  make preview                Start server with production build"
	@echo "  make new POST=<name>        Create a new blog post"
	@echo ""
	@echo "Build:"
	@echo "  make build                  Build production site"
	@echo "  make check                  Check Hugo configuration and build"
	@echo "  make clean                  Remove generated files"
	@echo ""
	@echo "Hugo Modules:"
	@echo "  make mod-tidy               Tidy Hugo Modules"
	@echo "  make mod-update             Update Hugo Modules"
	@echo "  make mod-graph              Show Hugo Module dependency graph"
	@echo ""
	@echo "Git:"
	@echo "  make gs                     Show Git status"
	@echo "  make glo                    Show recent Git commits"
	@echo "  make deploy                 Build and push current branch"
	@echo ""
	@echo "Examples:"
	@echo "  make"
	@echo "  make dev"
	@echo "  make new POST=kubernetes-runtime"
	@echo "  make build"
	@echo "  make mod-update"
	@echo "  make deploy"
	@echo ""

# ============================================================
# Development
# ============================================================

dev:
	@echo "==> Starting Hugo development server..."
	@echo "==> http://localhost:$(PORT)/blogio/"
	@echo ""
	$(HUGO) server \
		--bind $(HOST) \
		--port $(PORT) \
		--baseURL http://localhost:$(PORT)/blogio/ \
		--noHTTPCache \
		--noBuildLock

preview:
	@echo "==> Starting Hugo production preview..."
	@echo "==> http://localhost:$(PORT)"
	@echo ""
	$(HUGO) server \
		--bind $(HOST) \
		--port $(PORT) \
		--disableFastRender

# ============================================================
# Content
# ============================================================

new:
	@echo "==> Creating new post: $(POST)"
	$(HUGO) new posts/$(POST).md
	@echo ""
	@echo "==> Created:"
	@echo "    content/posts/$(POST).md"

# ============================================================
# Build
# ============================================================

build:
	@echo "==> Building Hugo site..."
	$(HUGO) --minify
	@echo ""
	@echo "==> Build completed."

check:
	@echo "==> Checking Hugo configuration..."
	$(HUGO) config
	@echo ""
	@echo "==> Checking site build..."
	$(HUGO) --gc --minify --printPathWarnings
	@echo ""
	@echo "==> Check completed."

clean:
	@echo "==> Cleaning generated files..."
	rm -rf public resources .hugo_build.lock
	@echo "==> Clean completed."

# ============================================================
# Hugo Modules
# ============================================================

mod-tidy:
	@echo "==> Tidying Hugo Modules..."
	$(HUGO) mod tidy

mod-update:
	@echo "==> Updating Hugo Modules..."
	$(HUGO) mod get -u
	$(HUGO) mod tidy

mod-graph:
	@echo "==> Hugo Module dependency graph:"
	@echo ""
	$(HUGO) mod graph

# ============================================================
# Git
# ============================================================

gs:
	@echo "==> Git status:"
	@git status

gl:
	@echo "==> Recent commits:"
	@git log --oneline --decorate -10

# ============================================================
# Deploy
# ============================================================

deploy:
	@echo "==> Building site..."
	$(MAKE) build
	@echo ""
	@echo "==> Git status:"
	@git status
	@echo ""
	@echo "==> Pushing $(BRANCH) to $(REMOTE)..."
	git push $(REMOTE) $(BRANCH)