function e(e,n,a){return n in e?Object.defineProperty(e,n,{value:a,enumerable:!0,configurable:!0,writable:!0}):e[n]=a,e}import{Pool as n}from"pg";export class PostgresSchemaManager{async close(){await this.pool.end()}async createTable(e){try{let n=this.groupByTableName(e);for(let[e,a]of Object.entries(n)){let n=this.generateCreateTableSQL(e,a);await this.pool.query(n)}return!0}catch(e){return console.error("PostgreSQL 테이블 생성 중 오류:",e),!1}}async extractSchema(e){try{return(await this.pool.query(`
        WITH
        pks AS (
          SELECT a.attname
          FROM pg_index i
          JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
          WHERE i.indrelid = $1::regclass AND i.indisprimary
        ),
        fks AS (
          SELECT
            kcu.column_name,
            ccu.table_name AS foreign_table,
            ccu.column_name AS foreign_column
          FROM information_schema.table_constraints AS tc
          JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name
          JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name
          WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name = $1
        ),
        uks AS (
          SELECT ic.column_name
          FROM information_schema.table_constraints tc
          JOIN information_schema.constraint_column_usage AS ic ON tc.constraint_name = ic.constraint_name
          WHERE tc.constraint_type = 'UNIQUE' AND tc.table_name = $1
        )
        SELECT
          c.column_name,
          c.data_type,
          c.character_maximum_length AS length,
          c.numeric_precision AS "precision",
          c.numeric_scale AS scale,
          CASE WHEN c.is_nullable = 'YES' THEN true ELSE false END AS is_nullable,
          CASE WHEN pk.attname IS NOT NULL THEN true ELSE false END AS is_primary,
          CASE WHEN uk.column_name IS NOT NULL THEN true ELSE false END AS is_unique,
          CASE WHEN fk.column_name IS NOT NULL THEN true ELSE false END AS is_foreign,
          fk.foreign_table,
          fk.foreign_column,
          c.column_default AS default_value,
          CASE 
            WHEN c.column_default LIKE '%nextval%' THEN true 
            WHEN c.column_default LIKE '%identity%' THEN true
            ELSE false 
          END AS auto_increment,
          pgd.description
        FROM information_schema.columns c
        LEFT JOIN pks pk ON pk.attname = c.column_name
        LEFT JOIN fks fk ON fk.column_name = c.column_name
        LEFT JOIN uks uk ON uk.column_name = c.column_name
        LEFT JOIN pg_catalog.pg_statio_all_tables AS st ON st.relname = c.table_name
        LEFT JOIN pg_catalog.pg_description pgd ON pgd.objoid = st.relid
          AND pgd.objsubid = c.ordinal_position
        WHERE c.table_name = $1
      `,[e])).rows.map(n=>({table_name:e,column_name:n.column_name,data_type:n.data_type,length:n.length||void 0,precision:n.precision||void 0,scale:n.scale||void 0,is_nullable:n.is_nullable,is_primary:n.is_primary,is_unique:n.is_unique,is_foreign:n.is_foreign,foreign_table:n.foreign_table||void 0,foreign_column:n.foreign_column||void 0,default_value:n.default_value||void 0,auto_increment:n.auto_increment,description:n.description||""}))}catch(e){return console.error("PostgreSQL 스키마 추출 중 오류:",e),[]}}groupByTableName(e){return e.reduce((e,n)=>{let{table_name:a}=n;return e[a]||(e[a]=[]),e[a].push(n),e},{})}generateCreateTableSQL(e,n){let a=n.map(e=>this.generateColumnSQL(e)),t=n.filter(e=>e.is_primary).map(e=>e.column_name),i=n.filter(e=>e.is_foreign&&e.foreign_table&&e.foreign_column).map(e=>this.generateForeignKeySQL(e));return`
      CREATE TABLE ${e} (
        ${a.join(",\n        ")}
        ${t.length>0?`,
        PRIMARY KEY (${t.join(",")})`:""}
        ${i.length>0?`,
        ${i.join(",\n        ")}`:""}
      )
    `}generateColumnSQL(e){return[e.column_name,this.getDataTypeSQL(e),e.is_nullable?"NULL":"NOT NULL",e.auto_increment?"GENERATED ALWAYS AS IDENTITY":"",e.default_value&&!e.auto_increment?`DEFAULT ${e.default_value}`:"",e.is_unique&&!e.is_primary?"UNIQUE":""].filter(Boolean).join(" ")}generateForeignKeySQL(e){return`FOREIGN KEY (${e.column_name}) REFERENCES ${e.foreign_table} (${e.foreign_column})`}getDataTypeSQL(e){switch(e.data_type.toLowerCase()){case"varchar":case"character varying":return`VARCHAR(${e.length||255})`;case"int":case"integer":return"INTEGER";case"numeric":case"decimal":return`DECIMAL(${e.precision||10},${e.scale||0})`;case"serial":return"SERIAL";case"bigserial":return"BIGSERIAL";default:return e.data_type}}mapColumnToSchema(e){return{table_name:e.table_name||"",column_name:e.column_name||"",data_type:e.data_type||"",length:e.length?parseInt(e.length):void 0,precision:e.precision?parseInt(e.precision):void 0,scale:e.scale?parseInt(e.scale):void 0,is_nullable:!0===e.is_nullable||"t"===e.is_nullable||"YES"===e.is_nullable,is_primary:!0===e.is_primary||"t"===e.is_primary,is_unique:!0===e.is_unique||"t"===e.is_unique,is_foreign:!0===e.is_foreign||"t"===e.is_foreign,foreign_table:e.foreign_table||void 0,foreign_column:e.foreign_column||void 0,default_value:e.default_value||void 0,auto_increment:!0===e.auto_increment||"t"===e.auto_increment,description:e.description||""}}constructor(a){e(this,"pool",void 0),e(this,"config",void 0),this.config=a,this.pool=new n({host:a.host,port:a.port,user:a.user,password:a.password,database:a.database})}}