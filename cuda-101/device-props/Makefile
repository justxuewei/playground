NVCC ?= nvcc
TARGET := device_props
SRC := main.cu

.PHONY: all clean

all: $(TARGET)

$(TARGET): $(SRC)
	$(NVCC) $(SRC) -o $(TARGET)

clean:
	$(RM) $(TARGET)
