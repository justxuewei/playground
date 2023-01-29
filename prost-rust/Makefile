.PHONY: run
run:
	@cd example && cargo run

.PHONY: clean
clean:
	@cd example && cargo clean
	@cargo clean
	@echo "cleaning example.rs..."
	@rm -f ./example/src/proto/example.rs

.PHONY: fmt
fmt:
	@cargo fmt
	@cd example && cargo fmt