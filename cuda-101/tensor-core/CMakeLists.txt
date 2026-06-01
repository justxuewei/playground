cmake_minimum_required(VERSION 3.24)

project(cuda_101_tensor_core
  VERSION 0.1.0
  LANGUAGES CXX CUDA
)

set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

set(CMAKE_CUDA_STANDARD 17)
set(CMAKE_CUDA_STANDARD_REQUIRED ON)
set(CMAKE_CUDA_EXTENSIONS OFF)

if(NOT DEFINED CMAKE_CUDA_ARCHITECTURES)
  set(CMAKE_CUDA_ARCHITECTURES 75)
endif()

message(STATUS "Default CUDA architecture: ${CMAKE_CUDA_ARCHITECTURES}")

find_package(CUDAToolkit REQUIRED)

add_library(tensor_core_project_options INTERFACE)

target_include_directories(tensor_core_project_options
  INTERFACE
    ${PROJECT_SOURCE_DIR}
    ${PROJECT_SOURCE_DIR}/include
    ${PROJECT_SOURCE_DIR}/src
    ${PROJECT_SOURCE_DIR}/src/Common
    ${CUDAToolkit_INCLUDE_DIRS}
)

target_link_libraries(tensor_core_project_options
  INTERFACE
    CUDA::cudart
)

target_compile_options(tensor_core_project_options
  INTERFACE
    $<$<AND:$<CONFIG:Debug>,$<COMPILE_LANGUAGE:CUDA>>:-G;-src-in-ptx>
    $<$<COMPILE_LANGUAGE:CUDA>:--ptxas-options=-v>
)

function(add_tensor_core_sample target source)
  set(source_path "${PROJECT_SOURCE_DIR}/${source}")

  if(EXISTS "${source_path}")
    add_executable(${target} "${source_path}")
    target_link_libraries(${target}
      PRIVATE
        tensor_core_project_options
        CUDA::cublas
    )
    message(STATUS "Enabled ${target}: ${source} (sm_${CMAKE_CUDA_ARCHITECTURES})")
  else()
    message(STATUS "Skipping ${target}: missing ${source}")
  endif()
endfunction()

add_tensor_core_sample(
  immaTensorCoreGemm
  src/immaTensorCoreGemm/immaTensorCoreGemm.cu
)

add_tensor_core_sample(
  bf16TensorCoreGemm
  src/bf16TensorCoreGemm/bf16TensorCoreGemm.cu
)

add_tensor_core_sample(
  tf32TensorCoreGemm
  src/tf32TensorCoreGemm/tf32TensorCoreGemm.cu
)

add_tensor_core_sample(
  cudaTensorCoreGemm
  src/cudaTensorCoreGemm/cudaTensorCoreGemm.cu
)

add_tensor_core_sample(
  dmmaTensorCoreGemm
  src/dmmaTensorCoreGemm/dmmaTensorCoreGemm.cu
)
