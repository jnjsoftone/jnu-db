function e(e,a,n){return a in e?Object.defineProperty(e,a,{value:n,enumerable:!0,configurable:!0,writable:!0}):e[a]=n,e}import{Pool as a}from"pg";export class PostgresSchemaManager{async close(){await this.pool.end()}async createTable(e){try{let a=this.groupByTableName(e);for(let[e,n]of Object.entries(a)){let a=this.generateCreateTableSQL(e,n);await this.pool.query(a)}return!0}catch(e){return console.error("PostgreSQL 테이블 생성 중 오류:",e),!1}}async extractSchema(e){try{let a=await this.pool.query(`
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
      `,[e]),n=await this.pool.query(`
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
      `,[e]),r=n.rows.map(e=>e.column_name),i=t.rows.map(e=>e.column_name),l=c.rows,s=o.rows.map(e=>e.column_name);return a.rows.map(a=>{let n=l.find(e=>e.column_name===a.column_name);return{table_name:e,column_name:a.column_name,data_type:a.data_type,length:a.length?parseInt(a.length):void 0,precision:a.precision?parseInt(a.precision):void 0,scale:a.scale?parseInt(a.scale):void 0,is_nullable:a.is_nullable,is_primary:r.includes(a.column_name),is_unique:i.includes(a.column_name)||r.includes(a.column_name),is_foreign:!!n,foreign_table:n?n.foreign_table:void 0,foreign_column:n?n.foreign_column:void 0,default_value:a.default_value,auto_increment:s.includes(a.column_name),description:""}})}catch(e){return console.error("PostgreSQL 스키마 추출 중 오류:",e),[]}}groupByTableName(e){return e.reduce((e,a)=>{let{table_name:n}=a;return e[n]||(e[n]=[]),e[n].push(a),e},{})}generateCreateTableSQL(e,a){let n=a.map(e=>this.generateColumnSQL(e)),t=a.filter(e=>e.is_primary).map(e=>e.column_name),c=a.filter(e=>e.is_foreign&&e.foreign_table&&e.foreign_column).map(e=>this.generateForeignKeySQL(e));return`
      CREATE TABLE ${e} (
        ${n.join(",\n        ")}
        ${t.length>0?`,
        PRIMARY KEY (${t.join(",")})`:""}
        ${c.length>0?`,
        ${c.join(",\n        ")}`:""}
      )
    `}generateColumnSQL(e){return[e.column_name,this.getDataTypeSQL(e),e.is_nullable?"NULL":"NOT NULL",e.auto_increment?"GENERATED ALWAYS AS IDENTITY":"",e.default_value&&!e.auto_increment?`DEFAULT ${e.default_value}`:"",e.is_unique&&!e.is_primary?"UNIQUE":""].filter(Boolean).join(" ")}generateForeignKeySQL(e){return`FOREIGN KEY (${e.column_name}) REFERENCES ${e.foreign_table} (${e.foreign_column})`}getDataTypeSQL(e){switch(e.data_type.toLowerCase()){case"varchar":case"character varying":return`VARCHAR(${e.length||255})`;case"int":case"integer":return"INTEGER";case"numeric":case"decimal":return`DECIMAL(${e.precision||10},${e.scale||0})`;case"serial":return"SERIAL";case"bigserial":return"BIGSERIAL";default:return e.data_type}}constructor(n){e(this,"pool",void 0),e(this,"config",void 0),this.config=n,this.pool=new a({host:n.host,port:n.port,user:n.user,password:n.password,database:n.database})}}