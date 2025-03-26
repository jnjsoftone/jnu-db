"use strict";Object.defineProperty(exports,"__esModule",{value:!0}),Object.defineProperty(exports,"PostgresSchemaManager",{enumerable:!0,get:function(){return a}});const e=require("pg");function n(e,n,a){return n in e?Object.defineProperty(e,n,{value:a,enumerable:!0,configurable:!0,writable:!0}):e[n]=a,e}class a{async close(){await this.pool.end()}async createTable(e){try{let n=this.groupByTableName(e);for(let[e,a]of Object.entries(n)){let n=this.generateCreateTableSQL(e,a);await this.pool.query(n)}return!0}catch(e){return console.error("PostgreSQL 테이블 생성 중 오류:",e),!1}}async extractSchema(e){try{let n=await this.pool.query(`
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
      `,[e]),a=await this.pool.query(`
        SELECT
          kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
        WHERE tc.constraint_type = 'PRIMARY KEY'
          AND tc.table_schema = 'public'
          AND tc.table_name = $1
      `,[e]),t=await this.pool.query(`
        SELECT
          kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
        WHERE tc.constraint_type = 'UNIQUE'
          AND tc.table_schema = 'public'
          AND tc.table_name = $1
      `,[e]),c=await this.pool.query(`
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
      `,[e]),r=a.rows.map(e=>e.column_name),i=t.rows.map(e=>e.column_name),l=c.rows,s=o.rows.map(e=>e.column_name);return n.rows.map(n=>{let a=l.find(e=>e.column_name===n.column_name);return{table_name:e,column_name:n.column_name,data_type:n.data_type,length:n.length?parseInt(n.length):void 0,precision:n.precision?parseInt(n.precision):void 0,scale:n.scale?parseInt(n.scale):void 0,is_nullable:n.is_nullable,is_primary:r.includes(n.column_name),is_unique:i.includes(n.column_name)||r.includes(n.column_name),is_foreign:!!a,foreign_table:a?a.foreign_table:void 0,foreign_column:a?a.foreign_column:void 0,default_value:n.default_value,auto_increment:s.includes(n.column_name),description:""}})}catch(e){return console.error("PostgreSQL 스키마 추출 중 오류:",e),[]}}groupByTableName(e){return e.reduce((e,n)=>{let{table_name:a}=n;return e[a]||(e[a]=[]),e[a].push(n),e},{})}generateCreateTableSQL(e,n){let a=n.map(e=>this.generateColumnSQL(e)),t=n.filter(e=>e.is_primary).map(e=>e.column_name),c=n.filter(e=>e.is_foreign&&e.foreign_table&&e.foreign_column).map(e=>this.generateForeignKeySQL(e));return`
      CREATE TABLE ${e} (
        ${a.join(",\n        ")}
        ${t.length>0?`,
        PRIMARY KEY (${t.join(",")})`:""}
        ${c.length>0?`,
        ${c.join(",\n        ")}`:""}
      )
    `}generateColumnSQL(e){return[e.column_name,this.getDataTypeSQL(e),e.is_nullable?"NULL":"NOT NULL",e.auto_increment?"GENERATED ALWAYS AS IDENTITY":"",e.default_value&&!e.auto_increment?`DEFAULT ${e.default_value}`:"",e.is_unique&&!e.is_primary?"UNIQUE":""].filter(Boolean).join(" ")}generateForeignKeySQL(e){return`FOREIGN KEY (${e.column_name}) REFERENCES ${e.foreign_table} (${e.foreign_column})`}getDataTypeSQL(e){switch(e.data_type.toLowerCase()){case"varchar":case"character varying":return`VARCHAR(${e.length||255})`;case"int":case"integer":return"INTEGER";case"numeric":case"decimal":return`DECIMAL(${e.precision||10},${e.scale||0})`;case"serial":return"SERIAL";case"bigserial":return"BIGSERIAL";default:return e.data_type}}constructor(a){n(this,"pool",void 0),n(this,"config",void 0),this.config=a,this.pool=new e.Pool({host:a.host,port:a.port,user:a.user,password:a.password,database:a.database})}}