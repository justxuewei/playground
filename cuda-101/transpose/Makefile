NVCC ?= nvcc
TARGET := matrixTranspose_sharedMemory
SRC := main.cu
NVCCFLAGS ?= -O2

.PHONY: all clean

all: $(TARGET)

$(TARGET): $(SRC)
	$(NVCC) $(NVCCFLAGS) $(SRC) -o $(TARGET)

clean:
	$(RM) $(TARGET)
