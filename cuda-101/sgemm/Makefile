BUILD_TYPE ?= debug

.PHONY: all debug release configure configure-release clean

all: debug

debug:
	cmake --preset debug
	cmake --build --preset debug

release:
	cmake --preset release
	cmake --build --preset release

configure:
	cmake --preset $(BUILD_TYPE)

configure-release:
	cmake --preset release

clean:
	$(RM) -r build
