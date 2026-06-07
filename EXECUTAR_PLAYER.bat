@echo off
title FlowPlayer - Reprodutor de Músicas
color 0B
cls
echo ===================================================
echo           FLOWPLAYER - LOCAL MUSIC SYSTEM           
echo ===================================================
echo.

rem Check if Node.js is installed
where node >nul 2>nul
if errorlevel 1 goto NodeMissing

rem Check if node_modules exists
if not exist node_modules goto InstallDeps

:StartServer
echo [*] Iniciando o servidor de streaming...
start "" node server.js

echo [*] Aguardando o servidor carregar (2 segundos)...
timeout /t 2 >nul

echo [*] Abrindo seu navegador em http://localhost:3000...
start http://localhost:3000

echo.
echo [OK] Tudo pronto! Esta janela fechará automaticamente.
echo ===================================================
timeout /t 3 >nul
exit

:NodeMissing
echo [ERRO] Node.js nao foi encontrado no seu computador!
echo.
echo Para rodar o aplicativo, voce precisa instalar o Node.js:
echo 1. Acesse: https://nodejs.org/
echo 2. Instale a versao recomendada (LTS).
echo 3. Depois de instalar, feche esta janela e abra este arquivo novamente.
echo.
pause
exit

:InstallDeps
echo [*] Instalando dependencias do sistema (pode levar alguns segundos)...
call npm install
if errorlevel 1 goto InstallFailed
goto StartServer

:InstallFailed
echo.
echo [ERRO] Falha ao instalar as dependencias via NPM. Verifique sua conexao.
pause
exit
