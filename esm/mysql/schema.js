function e(e,n,t){return n in e?Object.defineProperty(e,n,{value:t,enumerable:!0,configurable:!0,writable:!0}):e[n]=t,e}import n from"mysql2/promise";export class MySqlSchemaManager{async init(){this.connection=await n.createConnection({host:this.config.host,port:this.config.port,user:this.config.user,password:this.config.password,database:this.config.database})}async close(){this.connection&&await this.connection.end()}async findTables(e){try{let n=`
        SELECT TABLE_NAME 
        FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_SCHEMA = ?
      `,t=[this.config.database];e&&(n+=" AND TABLE_NAME REGEXP ?",t.push(e));let[a]=await this.connection.execute(n,t);return Array.isArray(a)?a.map(e=>e.TABLE_NAME):[]}catch(e){return console.error("MySQL 테이블 목록 조회 중 오류:",e),[]}}async removeTables(e){try{let n=await this.findTables(e),t={};for(let e of(await this.connection.execute("SET FOREIGN_KEY_CHECKS = 0"),n))try{await this.connection.execute(`DROP TABLE IF EXISTS ${e}`),t[e]=!0,console.log(`MySQL 테이블 삭제 성공: ${e}`)}catch(n){console.error(`MySQL 테이블 삭제 실패: ${e}`,n),t[e]=!1}return await this.connection.execute("SET FOREIGN_KEY_CHECKS = 1"),t}catch(e){throw console.error("MySQL 테이블 삭제 중 오류:",e),e}}async createTable(e){try{let n=this.groupByTableName(e);for(let[e,t]of Object.entries(n)){let n=this.generateCreateTableSQL(e,t);await this.connection.execute(n)}return!0}catch(e){return console.error("MySQL 테이블 생성 중 오류:",e),!1}}async extractSchema(e){try{let[n]=await this.connection.execute(`
        SELECT 
          COLUMN_NAME as column_name,
          DATA_TYPE as data_type,
          CHARACTER_MAXIMUM_LENGTH as length,
          NUMERIC_PRECISION as \`precision\`,
          NUMERIC_SCALE as \`scale\`,
          CASE WHEN IS_NULLABLE = 'YES' THEN 1 ELSE 0 END as is_nullable,
          CASE WHEN COLUMN_KEY = 'PRI' THEN 1 ELSE 0 END as is_primary,
          CASE WHEN COLUMN_KEY = 'UNI' THEN 1 ELSE 0 END as is_unique,
          CASE WHEN COLUMN_KEY = 'MUL' THEN 1 ELSE 0 END as is_foreign,
          NULL as foreign_table,
          NULL as foreign_column,
          COLUMN_DEFAULT as default_value,
          CASE WHEN EXTRA = 'auto_increment' THEN 1 ELSE 0 END as auto_increment,
          COLUMN_COMMENT as description
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
      `,[this.config.database,e]),[t]=await this.connection.execute(`
        SELECT
          COLUMN_NAME as column_name,
          REFERENCED_TABLE_NAME as foreign_table,
          REFERENCED_COLUMN_NAME as foreign_column
        FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? 
          AND REFERENCED_TABLE_NAME IS NOT NULL
      `,[this.config.database,e]);return(Array.isArray(n)?n.map(n=>{let a=Array.isArray(t)?t.find(e=>e.column_name===n.column_name):null;return{...n,table_name:e,foreign_table:a?a.foreign_table:null,foreign_column:a?a.foreign_column:null,is_foreign:!!a}}):[]).map(this.mapColumnToSchema)}catch(e){return console.error("MySQL 스키마 추출 중 오류:",e),[]}}groupByTableName(e){return e.reduce((e,n)=>{let{table_name:t}=n;return e[t]||(e[t]=[]),e[t].push(n),e},{})}generateCreateTableSQL(e,n){let t=n.map(e=>this.generateColumnSQL(e)),a=n.filter(e=>e.is_primary).map(e=>e.column_name),i=n.filter(e=>e.is_foreign&&e.foreign_table&&e.foreign_column).map(e=>this.generateForeignKeySQL(e));return`
      CREATE TABLE ${e} (
        ${t.join(",\n        ")}
        ${a.length>0?`,
        PRIMARY KEY (${a.join(",")})`:""}
        ${i.length>0?`,
        ${i.join(",\n        ")}`:""}
      )
    `}generateColumnSQL(e){return[e.column_name,this.getDataTypeSQL(e),e.is_nullable?"NULL":"NOT NULL",e.auto_increment?"AUTO_INCREMENT":"",e.default_value?`DEFAULT ${e.default_value}`:"",e.is_unique&&!e.is_primary?"UNIQUE":"",e.description?`COMMENT '${e.description.replace(/'/g,"''")}'`:""].filter(Boolean).join(" ")}generateForeignKeySQL(e){return`FOREIGN KEY (${e.column_name}) REFERENCES ${e.foreign_table} (${e.foreign_column})`}getDataTypeSQL(e){switch(e.data_type.toUpperCase()){case"VARCHAR":return`VARCHAR(${e.length||255})`;case"INT":case"INTEGER":return e.precision?`INT(${e.precision})`:"INT";case"DECIMAL":return`DECIMAL(${e.precision||10},${e.scale||0})`;default:return e.data_type}}mapColumnToSchema(e){return{table_name:e.table_name||"",column_name:e.column_name||"",data_type:e.data_type||"",length:e.length?parseInt(e.length):void 0,precision:e.precision?parseInt(e.precision):void 0,scale:e.scale?parseInt(e.scale):void 0,is_nullable:!0===e.is_nullable||1===e.is_nullable||"YES"===e.is_nullable,is_primary:!0===e.is_primary||1===e.is_primary,is_unique:!0===e.is_unique||1===e.is_unique,is_foreign:!0===e.is_foreign||1===e.is_foreign,foreign_table:e.foreign_table||void 0,foreign_column:e.foreign_column||void 0,default_value:e.default_value||void 0,auto_increment:!0===e.auto_increment||1===e.auto_increment||"auto_increment"===e.auto_increment,description:e.description||""}}constructor(n){e(this,"connection",void 0),e(this,"config",void 0),this.config=n}}