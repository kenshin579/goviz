.DEFAULT_GOAL := help
.PHONY: help deps dev build test check tidy clean release

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-9s\033[0m %s\n", $$1, $$2}'

deps: ## Install Go and frontend dependencies
	go mod download
	cd frontend && npm install

dev: ## Run the app with hot reload (wails dev)
	wails dev

build: ## Build the desktop app (wails build)
	wails build

test: ## Run Go and frontend unit tests
	go test ./...
	cd frontend && npm test

check: ## Vet Go and type-check the frontend
	go vet ./...
	cd frontend && npm run check

tidy: ## Tidy go.mod/go.sum
	go mod tidy

clean: ## Remove build output
	rm -rf build/bin

release: ## Tag and push a release: make release VERSION=vX.Y.Z
	@test -n "$(VERSION)" || { echo "usage: make release VERSION=vX.Y.Z"; exit 1; }
	./scripts/release.sh $(VERSION)
