cmake_minimum_required(VERSION 3.28...3.30)

include("${CMAKE_CURRENT_SOURCE_DIR}/cmake/common/bootstrap.cmake" NO_POLICY_SCOPE)

project(${_name} VERSION ${_version})

option(ENABLE_FRONTEND_API "Use obs-frontend-api for UI functionality" ON)
option(ENABLE_QT "Use Qt functionality" ON)

include(compilerconfig)
include(defaults)
include(helpers)

add_library(${CMAKE_PROJECT_NAME} MODULE)

find_package(libobs REQUIRED)
target_link_libraries(${CMAKE_PROJECT_NAME} PRIVATE OBS::libobs)

if(ENABLE_FRONTEND_API)
  find_package(obs-frontend-api REQUIRED)
  target_link_libraries(${CMAKE_PROJECT_NAME} PRIVATE OBS::obs-frontend-api)
endif()

if(ENABLE_QT)
  find_package(Qt6 COMPONENTS Widgets Core Network REQUIRED)
  target_link_libraries(${CMAKE_PROJECT_NAME} PRIVATE Qt6::Core Qt6::Widgets Qt6::Network)
  # WebSockets is optional in obs-deps prebuilt (not included on Windows). Use QTcpServer fallback if missing.
  find_package(Qt6 COMPONENTS WebSockets QUIET)
  if(Qt6WebSockets_FOUND)
    target_link_libraries(${CMAKE_PROJECT_NAME} PRIVATE Qt6::WebSockets)
    target_compile_definitions(${CMAKE_PROJECT_NAME} PRIVATE HAS_QT_WEBSOCKETS=1)
  else()
    message(WARNING "Qt6WebSockets not found - building with QTcpServer fallback")
  endif()
  target_compile_options(
    ${CMAKE_PROJECT_NAME}
    PRIVATE $<$<C_COMPILER_ID:Clang,AppleClang>:-Wno-quoted-include-in-framework-header -Wno-comma>
  )
  set_target_properties(
    ${CMAKE_PROJECT_NAME}
    PROPERTIES AUTOMOC ON AUTOUIC ON AUTORCC ON
  )
endif()

target_sources(
  ${CMAKE_PROJECT_NAME}
  PRIVATE
    src/plugin-main.cpp
    src/irl-toolkit-dock.cpp
    src/irl-toolkit-dock.hpp
    src/obs/obs-scene-service.cpp
    src/obs/obs-scene-service.hpp
    src/obs/obs-thumbnail.cpp
    src/obs/obs-thumbnail.hpp
    src/protocol/irl-protocol.cpp
    src/protocol/irl-protocol.hpp
    src/net/irl-websocket-server.cpp
    src/net/irl-websocket-server.hpp)

set_target_properties_plugin(${CMAKE_PROJECT_NAME} PROPERTIES OUTPUT_NAME ${_name})
