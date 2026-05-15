# Step 1: Require a modern enough CMake version.
# CUDA support in CMake has improved over time; 3.24 is a good baseline for
# using CUDA as a first-class language plus CUDAToolkit imported targets.
cmake_minimum_required(VERSION 3.24)

# Step 2: Define the project.
# LANGUAGES CXX CUDA tells CMake this project will use both host C++ and CUDA.
# This makes CMake detect both a C++ compiler and nvcc during configuration.
project(cuda_101_sgemm
  VERSION 0.1.0
  LANGUAGES CXX CUDA
)

# Step 3: Ask CMake to write compile_commands.json.
# VS Code's C/C++ extension can read this file for exact compiler flags,
# include paths, defines, and language mode once real source files are added.
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

# Step 4: Configure the host C++ language standard.
# CMAKE_CXX_STANDARD selects C++17 for normal .cpp/.cc files.
# C++17 is intentionally conservative because CUDA 11.8 with CMake 3.24 does
# not support enabling the CUDA20 dialect through CMake.
# REQUIRED prevents CMake from silently falling back to an older standard.
# EXTENSIONS OFF asks for standard C++ instead of compiler-specific gnu++ mode.
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# Step 5: Configure the CUDA C++ language standard.
# CUDA source files also compile host-side C++ code, so keep this aligned with
# the C++ standard above unless you have a specific reason to differ.
set(CMAKE_CUDA_STANDARD 17)
set(CMAKE_CUDA_STANDARD_REQUIRED ON)
set(CMAKE_CUDA_EXTENSIONS OFF)

# Step 6: Choose the default GPU architecture.
# CMake uses the number form here, so sm_75 is written as 75.
# This value is used only if the preset or command line did not set one.
# Override from the command line or preset when needed, for example:
# cmake -S . -B build -DCMAKE_CUDA_ARCHITECTURES=86
if(NOT DEFINED CMAKE_CUDA_ARCHITECTURES)
  set(CMAKE_CUDA_ARCHITECTURES 75)
endif()

# Step 7: Print the architecture during configure.
# This is useful while learning CMake because it shows which architecture value
# CMake actually received after presets, cache values, and defaults are applied.
message(STATUS "CUDA architectures: ${CMAKE_CUDA_ARCHITECTURES}")

# Step 8: Find the installed CUDA Toolkit.
# CUDAToolkit provides include directories, library locations, and imported
# targets such as CUDA::cudart and CUDA::cublas.
find_package(CUDAToolkit REQUIRED)

# Step 9: Create a settings-only target.
# INTERFACE means this target compiles no source files and produces no binary.
# It exists only to hold common include paths, libraries, and compile options.
# Future executables/libraries can link to it to inherit those settings.
add_library(sgemm_project_options INTERFACE)

# Step 10: Attach include directories to the settings target.
# PROJECT_SOURCE_DIR/include is where your own headers can go.
# CUDAToolkit_INCLUDE_DIRS is where CUDA headers such as cuda_runtime.h live.
# Because this is INTERFACE, consumers inherit these include paths.
target_include_directories(sgemm_project_options
  INTERFACE
    ${PROJECT_SOURCE_DIR}/include
    ${CUDAToolkit_INCLUDE_DIRS}
)

# Step 11: Attach common CUDA libraries to the settings target.
# CUDA::cudart is the CUDA runtime library used by normal CUDA runtime APIs.
# More specialized libraries, such as CUDA::cublas, can be linked by the final
# executable later when that executable actually needs them.
target_link_libraries(sgemm_project_options
  INTERFACE
    CUDA::cudart
)

# Step 12: Add debug-only CUDA compiler flags.
# Generator expressions let CMake apply flags only in specific situations.
# This one applies -G and -src-in-ptx only when:
#   1. the build config is Debug, and
#   2. the file being compiled is CUDA.
# -G enables device debug information but reduces performance.
# -src-in-ptx embeds source information in generated PTX for debugging.
target_compile_options(sgemm_project_options
  INTERFACE
    $<$<AND:$<CONFIG:Debug>,$<COMPILE_LANGUAGE:CUDA>>:-G;-src-in-ptx>
)

# Step 13: Add the CUDA executable target.
# add_executable creates a real build target named simplest_kernel from the
# CUDA source file copied from the reference project.
add_executable(simplest_kernel simplest_kernel.cu)

# Step 14: Link the executable to the shared project settings.
# This makes simplest_kernel inherit the CUDA include directories, CUDA runtime
# library, and debug CUDA compiler flags from sgemm_project_options.
target_link_libraries(simplest_kernel
  PRIVATE
    sgemm_project_options
)
