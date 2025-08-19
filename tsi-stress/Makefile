BIN_DIR := bin
TARGET := $(BIN_DIR)/tcp_connect_inf
SRC := cmd/tcp_connect_inf/main.go

.PHONY: all clean

all: $(TARGET)

$(TARGET): $(SRC)
	mkdir -p $(BIN_DIR)
	go build -o $(TARGET) $(SRC)

clean:
	rm -rf $(BIN_DIR)
