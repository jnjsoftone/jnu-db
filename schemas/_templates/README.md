# 테이블 정보 저장 템플릿

이 디렉토리는 데이터베이스 테이블 정보를 저장하기 위한 표준 템플릿을 제공합니다.

## 디렉토리 구조
```
schemas/
├── _templates/          # 템플릿 파일들
│   ├── README.md       # 이 파일
│   ├── table.csv       # CSV 템플릿
│   ├── table.json      # JSON 템플릿
│   └── examples/       # 예제 파일들
│       ├── users.csv
│       └── users.json
├── tables/             # 실제 테이블 정보
│   ├── tables.csv      # 기본 테이블 정보
│   └── tables.json     # 확장 메타데이터
├── relationships/      # 테이블 간 관계 정보
│   └── relationships.json
└── validations/       # 유효성 검사 규칙
    └── rules.json
```

## 파일 형식

### 1. CSV 형식 (tables.csv)
- 기본적인 테이블과 컬럼 정보 저장
- 엑셀에서 쉽게 편집 가능
- 버전 관리 시스템에서 변경 사항 추적 용이

### 2. JSON 형식 (tables.json)
- 복잡한 메타데이터와 관계 정보 저장
- 프로그래밍적 처리에 최적화
- 확장 가능한 구조

## 사용 방법

1. **새 테이블 정보 추가**
   ```bash
   # CSV 파일에 테이블 정보 추가
   cp _templates/table.csv tables/new_table.csv
   
   # JSON 파일에 메타데이터 추가
   cp _templates/table.json tables/new_table.json
   ```

2. **테이블 관계 정의**
   - `relationships/relationships.json` 파일에 관계 정보 추가
   - 참조 무결성 규칙 정의

3. **유효성 검사 규칙 추가**
   - `validations/rules.json` 파일에 규칙 추가
   - 데이터 타입, 길이, 형식 등 정의

## 주의사항

1. **명명 규칙**
   - 테이블명: 소문자, 언더스코어 사용 (예: user_logs)
   - 컬럼명: 소문자, 언더스코어 사용 (예: created_at)
   - 파일명: 테이블명과 동일하게 사용

2. **데이터 타입**
   - 가능한 표준 SQL 데이터 타입 사용
   - 특수한 데이터 타입은 JSON에서 상세 정의

3. **문서화**
   - 모든 테이블과 컬럼에 설명 추가
   - 중요한 제약조건이나 규칙 명시

## 예제

예제 파일들은 `examples/` 디렉토리에서 확인할 수 있습니다:
- `examples/users.csv`: 사용자 테이블 CSV 예제
- `examples/users.json`: 사용자 테이블 JSON 예제

## 관련 도구

- CSV 편집: Microsoft Excel, Google Sheets
- JSON 편집: VS Code (with JSON formatter)
- 데이터베이스 도구: DBeaver, MySQL Workbench

## 참고 자료

- [CSV 파일 형식](https://tools.ietf.org/html/rfc4180)
- [JSON 스키마](https://json-schema.org/)
- [SQL 데이터 타입](https://www.w3schools.com/sql/sql_datatypes.asp) 