"use strict";Object.defineProperty(exports,"__esModule",{value:!0}),Object.defineProperty(exports,"PostgresSchemaManager",{enumerable:!0,get:function(){return n}});const e=require("pg");function a(e,a,n){return a in e?Object.defineProperty(e,a,{value:n,enumerable:!0,configurable:!0,writable:!0}):e[a]=n,e}class n{async close(){await this.pool.end()}async createTable(e){try{let a=this.groupByTableName(e);for(let[e,n]of Object.entries(a)){let a=this.generateCreateTableSQL(e,n);await this.pool.query(a)}return!0}catch(e){return console.error("PostgreSQL 테이블 생성 중 오류:",e),!1}}async extractSchema(e){try{return(await this.pool.query(`
        SELECT 
          c.column_name,
          c.data_type,
          c.character_maximum_length as length,
          c.numeric_precision as precision,
          c.numeric_scale as scale,
          c.is_nullable = 'YES' as is_nullable,
          (
            SELECT true FROM pg_constraint pc
            JOIN pg_class cl ON cl.oid = pc.conrelid
            JOIN pg_attribute a ON a.attrelid = cl.oid AND a.attnum = ANY(pc.conkey)
            WHERE pc.contype = 'p' AND cl.relname = $1 AND a.attname = c.column_name
          ) as is_primary,
          (
            SELECT true FROM pg_constraint pc
            JOIN pg_class cl ON cl.oid = pc.conrelid
            JOIN pg_attribute a ON a.attrelid = cl.oid AND a.attnum = ANY(pc.conkey)
            WHERE pc.contype = 'u' AND cl.relname = $1 AND a.attname = c.column_name
          ) as is_unique,
          (
            SELECT true FROM pg_constraint pc
            JOIN pg_class cl ON cl.oid = pc.conrelid
            JOIN pg_attribute a ON a.attrelid = cl.oid AND a.attnum = ANY(pc.conkey)
            WHERE pc.contype = 'f' AND cl.relname = $1 AND a.attname = c.column_name
          ) as is_foreign,
          (
            SELECT ccu.table_name FROM information_schema.constraint_column_usage ccu
            JOIN information_schema.referential_constraints rc 
              ON rc.constraint_name = ccu.constraint_name
            JOIN information_schema.key_column_usage kcu 
              ON kcu.constraint_name = rc.constraint_name
            WHERE kcu.table_name = $1 AND kcu.column_name = c.column_name
            LIMIT 1
          ) as foreign_table,
          (
            SELECT ccu.column_name FROM information_schema.constraint_column_usage ccu
            JOIN information_schema.referential_constraints rc 
              ON rc.constraint_name = ccu.constraint_name
            JOIN information_schema.key_column_usage kcu 
              ON kcu.constraint_name = rc.constraint_name
            WHERE kcu.table_name = $1 AND kcu.column_name = c.column_name
            LIMIT 1
          ) as foreign_column,
          c.column_default as default_value,
          (
            SELECT EXISTS(
              SELECT 1 FROM pg_attrdef ad
              JOIN pg_class cl ON cl.oid = ad.adrelid
              WHERE cl.relname = $1 AND ad.adnum = c.ordinal_position AND ad.adsrc LIKE 'nextval%'
            )
          ) as auto_increment,
          (
            SELECT pd.description 
            FROM pg_description pd
            JOIN pg_class pc ON pd.objoid = pc.oid
            JOIN pg_attribute pa ON pa.attrelid = pc.oid AND pd.objsubid = pa.attnum
            WHERE pc.relname = $1 AND pa.attname = c.column_name
          ) as description
        FROM information_schema.columns c
        WHERE c.table_name = $1 AND c.table_schema = 'public'
        ORDER BY c.ordinal_position
      `,[e])).rows.map(this.mapColumnToSchema)}catch(e){return console.error("PostgreSQL 스키마 추출 중 오류:",e),[]}}groupByTableName(e){return e.reduce((e,a)=>{let{table_name:n}=a;return e[n]||(e[n]=[]),e[n].push(a),e},{})}generateCreateTableSQL(e,a){let n=a.map(e=>this.generateColumnSQL(e)),t=a.filter(e=>e.is_primary).map(e=>e.column_name),c=a.filter(e=>e.is_foreign&&e.foreign_table&&e.foreign_column).map(e=>this.generateForeignKeySQL(e));return`
      CREATE TABLE ${e} (
        ${n.join(",\n        ")}
        ${t.length>0?`,
        PRIMARY KEY (${t.join(",")})`:""}
        ${c.length>0?`,
        ${c.join(",\n        ")}`:""}
      )
    `}generateColumnSQL(e){return[e.column_name,this.getDataTypeSQL(e),e.is_nullable?"NULL":"NOT NULL",e.auto_increment?"GENERATED ALWAYS AS IDENTITY":"",e.default_value&&!e.auto_increment?`DEFAULT ${e.default_value}`:"",e.is_unique&&!e.is_primary?"UNIQUE":""].filter(Boolean).join(" ")}generateForeignKeySQL(e){return`FOREIGN KEY (${e.column_name}) REFERENCES ${e.foreign_table} (${e.foreign_column})`}getDataTypeSQL(e){switch(e.data_type.toLowerCase()){case"varchar":case"character varying":return`VARCHAR(${e.length||255})`;case"int":case"integer":return"INTEGER";case"numeric":case"decimal":return`DECIMAL(${e.precision||10},${e.scale||0})`;case"serial":return"SERIAL";case"bigserial":return"BIGSERIAL";default:return e.data_type}}mapColumnToSchema(e){return{table_name:e.table_name||"",column_name:e.column_name||"",data_type:e.data_type||"",length:e.length?parseInt(e.length):void 0,precision:e.precision?parseInt(e.precision):void 0,scale:e.scale?parseInt(e.scale):void 0,is_nullable:!0===e.is_nullable||"t"===e.is_nullable||"YES"===e.is_nullable,is_primary:!0===e.is_primary||"t"===e.is_primary,is_unique:!0===e.is_unique||"t"===e.is_unique,is_foreign:!0===e.is_foreign||"t"===e.is_foreign,foreign_table:e.foreign_table||void 0,foreign_column:e.foreign_column||void 0,default_value:e.default_value||void 0,auto_increment:!0===e.auto_increment||"t"===e.auto_increment,description:e.description||""}}constructor(n){a(this,"pool",void 0),a(this,"config",void 0),this.config=n,this.pool=new e.Pool({host:n.host,port:n.port,user:n.user,password:n.password,database:n.database})}}