
````
`C:\JnJ\Developments\Utils\nodejs\jnu-db\src` 디렉토리에 database 관련된 utility 함수들을 구현하고 npm 패키지로 등록하여, 다른 프로젝트에서 import 해서 쓰려고 해요. mysql, postgreSQL, sqlite, mongodb, pocketbase 등에 대한 접속, CRUD, backup, restore, ... 등에 대한 utility 및 prisma를 통한 db 사용 등에 대한 utility 들을 'C:\JnJ\Developments\Utils\nodejs\jnu-db\src\mysql.ts' 과 같이 데이터베이스별로 따로 구현하고, index.ts에서 모두 import export하도록 해주세요.

함수는 arrow function 형식으로 구현하고, export는 파일 마지막에  `export { func1, func, ... }` 와 같이 모아서 해주세요.
```

===

```
단위 테스트 함수들을 `C:\JnJ\Developments\Utils\nodejs\jnu-db\tests` 디렉토리에 만들어주세요.
```


===

```
테스트용 db를 만드는 sql?
```


===

```
heidiSQL에서 '.sql' 파일에 있는 sql을 실행시키려면?
```

HeidiSQL에서 SQL 파일을 실행하는 방법을 알려드리겠습니다:

1. **파일 열기**:
   - HeidiSQL 실행
   - 상단 메뉴에서 `파일(File)` > `SQL 파일 열기(Open SQL file)` 선택
   - 또는 단축키 `Ctrl + O` 사용

2. **실행 방법**:
   - 파일이 열리면 상단의 `실행(F9)` 버튼 클릭
   - 또는 단축키 `F9` 사용
   - 또는 `Ctrl + Shift + F9`로 현재 커서 위치부터 실행

3. **주의사항**:
   - 실행 전에 올바른 데이터베이스가 선택되어 있는지 확인
   - `USE test_db;` 문이 있더라도, HeidiSQL에서 먼저 `test_db` 데이터베이스를 선택하는 것이 좋습니다
   - 실행 전에 `Ctrl + A`로 전체 SQL을 선택하는 것이 안전합니다

4. **실행 결과 확인**:
   - 실행 결과는 하단의 `결과(Results)` 탭에서 확인 가능
   - 오류가 있다면 `오류(Errors)` 탭에서 확인 가능

이렇게 하면 `setup-db.sql` 파일의 모든 SQL 문이 순차적으로 실행됩니다.
