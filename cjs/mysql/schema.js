"use strict";var e;Object.defineProperty(exports,"__esModule",{value:!0}),Object.defineProperty(exports,"MySqlSchemaManager",{enumerable:!0,get:function(){return a}});const n=(e=require("mysql2/promise"))&&e.__esModule?e:{default:e};function t(e,n,t){return n in e?Object.defineProperty(e,n,{value:t,enumerable:!0,configurable:!0,writable:!0}):e[n]=t,e}class a{async init(){this.connection=await n.default.createConnection({host:this.config.host,port:this.config.port,user:this.config.user,password:this.config.password,database:this.config.database})}async close(){this.connection&&await this.connection.end()}async createTable(e){try{let n=this.groupByTableName(e);for(let[e,t]of Object.entries(n)){let n=this.generateCreateTableSQL(e,t);await this.connection.execute(n)}return!0}catch(e){return console.error("MySQL 테이블 생성 중 오류:",e),!1}}async extractSchema(e){try{let[n]=await this.connection.execute(`
        SELECT 
          COLUMN_NAME as column_name,
          DATA_TYPE as data_type,
          CHARACTER_MAXIMUM_LENGTH as length,
          NUMERIC_PRECISION as precision,
          NUMERIC_SCALE as scale,
          IS_NULLABLE = 'YES' as is_nullable,
          COLUMN_KEY = 'PRI' as is_primary,
          COLUMN_KEY = 'UNI' as is_unique,
          COLUMN_KEY = 'MUL' as is_foreign,
          NULL as foreign_table,
          NULL as foreign_column,
          COLUMN_DEFAULT as default_value,
          EXTRA = 'auto_increment' as auto_increment,
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
      `,[this.config.database,e]);return(Array.isArray(n)?n.map(e=>{let n=Array.isArray(t)?t.find(n=>n.column_name===e.column_name):null;return{...e,foreign_table:n?n.foreign_table:null,foreign_column:n?n.foreign_column:null,is_foreign:!!n}}):[]).map(this.mapColumnToSchema)}catch(e){return console.error("MySQL 스키마 추출 중 오류:",e),[]}}groupByTableName(e){return e.reduce((e,n)=>{let{table_name:t}=n;return e[t]||(e[t]=[]),e[t].push(n),e},{})}generateCreateTableSQL(e,n){let t=n.map(e=>this.generateColumnSQL(e)),a=n.filter(e=>e.is_primary).map(e=>e.column_name),i=n.filter(e=>e.is_foreign&&e.foreign_table&&e.foreign_column).map(e=>this.generateForeignKeySQL(e));return`
      CREATE TABLE ${e} (
        ${t.join(",\n        ")}
        ${a.length>0?`,
        PRIMARY KEY (${a.join(",")})`:""}
        ${i.length>0?`,
        ${i.join(",\n        ")}`:""}
      )
    `}generateColumnSQL(e){return[e.column_name,this.getDataTypeSQL(e),e.is_nullable?"NULL":"NOT NULL",e.auto_increment?"AUTO_INCREMENT":"",e.default_value?`DEFAULT ${e.default_value}`:"",e.is_unique&&!e.is_primary?"UNIQUE":"",e.description?`COMMENT '${e.description.replace(/'/g,"''")}'`:""].filter(Boolean).join(" ")}generateForeignKeySQL(e){return`FOREIGN KEY (${e.column_name}) REFERENCES ${e.foreign_table} (${e.foreign_column})`}getDataTypeSQL(e){switch(e.data_type.toUpperCase()){case"VARCHAR":return`VARCHAR(${e.length||255})`;case"INT":case"INTEGER":return e.precision?`INT(${e.precision})`:"INT";case"DECIMAL":return`DECIMAL(${e.precision||10},${e.scale||0})`;default:return e.data_type}}mapColumnToSchema(e){return{table_name:e.table_name||"",column_name:e.column_name||"",data_type:e.data_type||"",length:e.length?parseInt(e.length):void 0,precision:e.precision?parseInt(e.precision):void 0,scale:e.scale?parseInt(e.scale):void 0,is_nullable:!0===e.is_nullable||1===e.is_nullable||"YES"===e.is_nullable,is_primary:!0===e.is_primary||1===e.is_primary,is_unique:!0===e.is_unique||1===e.is_unique,is_foreign:!0===e.is_foreign||1===e.is_foreign,foreign_table:e.foreign_table||void 0,foreign_column:e.foreign_column||void 0,default_value:e.default_value||void 0,auto_increment:!0===e.auto_increment||1===e.auto_increment||"auto_increment"===e.auto_increment,description:e.description||""}}constructor(e){t(this,"connection",void 0),t(this,"config",void 0),this.config=e}}