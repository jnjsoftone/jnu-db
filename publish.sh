#!/bin/bash
# [syntax] ./publish.sh patch|minor|major
# default: patch

mode=${1:-patch}

# 1. 빌드
yarn clean:mac && yarn build && \
# 2. git 변경사항 커밋
git add . && \
git commit -m "chore: build for publish" && \
# 3. npm 버전 업데이트 (이때 자동으로 버전 태그가 생성됨)
npm version $mode && \
# 4. git push
git push --follow-tags && \
# 5. npm 배포
npm publish