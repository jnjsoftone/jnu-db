"use strict";Object.defineProperty(exports,"__esModule",{value:!0}),Object.defineProperty(exports,"PostgresSchemaManager",{enumerable:!0,get:function(){return t}});const e=require("pg");function a(e,a,t){return a in e?Object.defineProperty(e,a,{value:t,enumerable:!0,configurable:!0,writable:!0}):e[a]=t,e}class t{async close(){await this.pool.end()}async findTables(e){try{let a=`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
      `,t=[];return e&&(a+=" AND table_name ~ $1",t.push(e)),(await this.pool.query(a,t)).rows.map(e=>e.table_name)}catch(e){return console.error("PostgreSQL 테이블 목록 조회 중 오류:",e),[]}}async removeTables(e){try{let a=await this.findTables(e),t={};for(let e of a)try{await this.pool.query(`DROP TABLE IF EXISTS "${e}" CASCADE`),t[e]=!0,console.log(`PostgreSQL 테이블 삭제 성공: ${e}`)}catch(a){console.error(`PostgreSQL 테이블 삭제 실패: ${e}`,a),t[e]=!1}return t}catch(e){throw console.error("PostgreSQL 테이블 삭제 중 오류:",e),e}}async createTable(e){try{let a=this.groupByTableName(e);for(let[e,t]of Object.entries(a)){let a=this.generateCreateTableSQL(e,t);await this.pool.query(a)}return!0}catch(e){return console.error("PostgreSQL 테이블 생성 중 오류:",e),!1}}async extractSchema(e){try{let a=await this.pool.query(`
        SELECT 
          c.column_name,
          c.data_type,
          c.character_maximum_length AS length,
          c.numeric_precision AS precision,
          c.numeric_scale AS scale,
          (c.is_nullable = 'YES') AS is_nullable,
          c.column_default AS default_value,
          c.ordinal_position
        FROM information_schema.columns c
        WHERE c.table_schema = 'public'
          AND c.table_name = $1
        ORDER BY c.ordinal_position
      `,[e]),t=await this.pool.query(`
        SELECT
          kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
        WHERE tc.constraint_type = 'PRIMARY KEY'
          AND tc.table_schema = 'public'
          AND tc.table_name = $1
      `,[e]),n=await this.pool.query(`
        SELECT
          kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
        WHERE tc.constraint_type = 'UNIQUE'
          AND tc.table_schema = 'public'
          AND tc.table_name = $1
      `,[e]),r=await this.pool.query(`
        SELECT
          kcu.column_name,
          ccu.table_name AS foreign_table,
          ccu.column_name AS foreign_column
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage ccu
          ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema = 'public'
          AND tc.table_name = $1
      `,[e]),o=await this.pool.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = $1
          AND (column_default LIKE 'nextval%' OR column_default LIKE '%identity%')
      `,[e]),c=t.rows.map(e=>e.column_name),i=n.rows.map(e=>e.column_name),l=r.rows,s=o.rows.map(e=>e.column_name);return a.rows.map(a=>{let t=l.find(e=>e.column_name===a.column_name);return{table_name:e,column_name:a.column_name,data_type:a.data_type,length:a.length?parseInt(a.length):void 0,precision:a.precision?parseInt(a.precision):void 0,scale:a.scale?parseInt(a.scale):void 0,is_nullable:a.is_nullable,is_primary:c.includes(a.column_name),is_unique:i.includes(a.column_name)||c.includes(a.column_name),is_foreign:!!t,foreign_table:t?t.foreign_table:void 0,foreign_column:t?t.foreign_column:void 0,default_value:a.default_value,auto_increment:s.includes(a.column_name),description:""}})}catch(e){return console.error("PostgreSQL 스키마 추출 중 오류:",e),[]}}groupByTableName(e){return e.reduce((e,a)=>{let{table_name:t}=a;return e[t]||(e[t]=[]),e[t].push(a),e},{})}generateCreateTableSQL(e,a){let t=a.map(e=>this.generateColumnSQL(e)),n=a.filter(e=>e.is_primary).map(e=>e.column_name),r=a.filter(e=>e.is_foreign&&e.foreign_table&&e.foreign_column).map(e=>this.generateForeignKeySQL(e));return`
      CREATE TABLE ${e} (
        ${t.join(",\n        ")}
        ${n.length>0?`,
        PRIMARY KEY (${n.join(",")})`:""}
        ${r.length>0?`,
        ${r.join(",\n        ")}`:""}
      )
    `}generateColumnSQL(e){return[e.column_name,this.getDataTypeSQL(e),e.is_nullable?"NULL":"NOT NULL",e.auto_increment?"GENERATED ALWAYS AS IDENTITY":"",e.default_value&&!e.auto_increment?`DEFAULT ${e.default_value}`:"",e.is_unique&&!e.is_primary?"UNIQUE":""].filter(Boolean).join(" ")}generateForeignKeySQL(e){return`FOREIGN KEY (${e.column_name}) REFERENCES ${e.foreign_table} (${e.foreign_column})`}getDataTypeSQL(e){switch(e.data_type.toLowerCase()){case"varchar":case"character varying":return`VARCHAR(${e.length||255})`;case"int":case"integer":return"INTEGER";case"numeric":case"decimal":return`DECIMAL(${e.precision||10},${e.scale||0})`;case"serial":return"SERIAL";case"bigserial":return"BIGSERIAL";default:return e.data_type}}constructor(t){a(this,"pool",void 0),a(this,"config",void 0),this.config=t,this.pool=new e.Pool({host:t.host,port:t.port,user:t.user,password:t.password,database:t.database})}}