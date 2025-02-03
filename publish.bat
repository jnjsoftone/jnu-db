@echo off
REM [syntax] publish patch|minor|major
REM default: patch

IF "%~1"=="" (
  SET mode=patch
) ELSE (
  SET mode=%1
)

REM 1. 빌드
call yarn clean:win
if errorlevel 1 goto :error
call yarn build
if errorlevel 1 goto :error

REM 2. git 변경사항 커밋
git add .
if errorlevel 1 goto :error
git commit -m "chore: build for publish"
if errorlevel 1 goto :error

REM 3. npm 버전 업데이트 (이때 자동으로 버전 태그가 생성됨)
call npm version %mode%
if errorlevel 1 goto :error

REM 4. git push
git push --follow-tags
if errorlevel 1 goto :error

REM 5. npm 배포
call npm publish
if errorlevel 1 goto :error

goto :success

:error
echo 오류가 발생했습니다.
exit /b 1

:success
echo 배포가 성공적으로 완료되었습니다.
exit /b 0
