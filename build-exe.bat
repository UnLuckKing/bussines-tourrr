@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
title BusinessTourLive EXE Builder

echo ============================================
echo   BusinessTourLive - EXE Builder
echo ============================================
echo.

set "DOTNET_EXE=dotnet"
where dotnet >nul 2>nul
if errorlevel 1 (
    echo [INFO] .NET 8 SDK bulunamadi. Repo icine otomatik kuruluyor...
    if not exist ".dotnet" mkdir ".dotnet"
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Invoke-WebRequest https://dot.net/v1/dotnet-install.ps1 -OutFile dotnet-install.ps1"
    if errorlevel 1 goto :download_error
    powershell -NoProfile -ExecutionPolicy Bypass -File dotnet-install.ps1 -Channel 8.0 -InstallDir "%CD%\.dotnet"
    if errorlevel 1 goto :install_error
    del /q dotnet-install.ps1 >nul 2>nul
    set "DOTNET_EXE=%CD%\.dotnet\dotnet.exe"
)

echo [1/3] NuGet paketleri yukleniyor...
"%DOTNET_EXE%" restore desktop\BusinessTourLive.csproj
if errorlevel 1 goto :build_error

echo [2/3] Windows x64 tek EXE derleniyor...
if exist "dist" rmdir /s /q "dist"
"%DOTNET_EXE%" publish desktop\BusinessTourLive.csproj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -o dist
if errorlevel 1 goto :build_error

echo [3/3] Tamam.
echo.
echo EXE: %CD%\dist\BusinessTourLive.exe
if exist "dist\BusinessTourLive.exe" (
    explorer /select,"%CD%\dist\BusinessTourLive.exe"
) else (
    echo [HATA] BusinessTourLive.exe bulunamadi.
)
echo.
pause
exit /b 0

:download_error
echo.
echo [HATA] .NET kurulum dosyasi indirilemedi. Internet baglantini kontrol et.
pause
exit /b 1

:install_error
echo.
echo [HATA] .NET 8 SDK otomatik kurulumu basarisiz oldu.
pause
exit /b 1

:build_error
echo.
echo [HATA] Derleme basarisiz oldu. Yukaridaki hata metninin ekran goruntusunu gonder.
pause
exit /b 1
