BIN_DIR := bin

BINS := tcp_client tcp_server
TARGETS := $(addprefix $(BIN_DIR)/, $(BINS))
SRCS := $(addprefix cmd/, $(addsuffix /main.go, $(BINS)))

.PHONY: all clean

# build the SRCS all and save them it TARGETS
all: clean $(TARGETS)

$(BIN_DIR)/%: cmd/%/main.go
	@mkdir -p $(BIN_DIR)
	@go build -o $@ $<

clean:
	@rm -rf $(BIN_DIR)