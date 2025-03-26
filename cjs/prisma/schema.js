"use strict";Object.defineProperty(exports,"__esModule",{value:!0}),Object.defineProperty(exports,"PrismaSchemaManager",{enumerable:!0,get:function(){return e}});class e{generatePrismaSchema(e,t="postgresql"){let a=this.groupByTableName(e),r=this.generatePrismaHeader(t);for(let[e,t]of Object.entries(a))r+=this.generateModelDefinition(e,t);return r}extractFromPrismaSchema(e){let t=this.parsePrismaSchema(e),a=[];for(let e of t)for(let t of e.fields)a.push({table_name:e.name,column_name:t.name,data_type:this.mapPrismaTypeToSQL(t.type),is_nullable:!t.required,is_primary:t.isPrimary,is_unique:t.isUnique,is_foreign:t.isRelation,foreign_table:t.relationTable,foreign_column:t.relationField,auto_increment:t.isAutoIncrement,description:t.documentation||"",default_value:t.default});return a}groupByTableName(e){return e.reduce((e,t)=>{let{table_name:a}=t;return e[a]||(e[a]=[]),e[a].push(t),e},{})}generatePrismaHeader(e){return`
datasource db {
  provider = "${e}"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

`}generateModelDefinition(e,t){let a=t.map(e=>this.generateFieldDefinition(e)).join("\n  ");return`model ${this.pascalCase(e)} {
  ${a}
}

`}generateFieldDefinition(e){let t=this.mapSQLTypeToPrisma(e.data_type,e.length),a=[];if(e.is_nullable||a.push(""),e.is_primary&&a.push("@id"),e.auto_increment)a.push("@default(autoincrement())");else if(e.default_value){let t=this.formatPrismaDefaultValue(e.default_value,e.data_type);t&&a.push(`@default(${t})`)}e.is_unique&&!e.is_primary&&a.push("@unique"),e.description&&a.push(`/// ${e.description}`);let r=a.length>0?" "+a.filter(e=>e).join(" "):"";return`${e.column_name} ${t}${e.is_nullable?"?":""}${r}`}mapSQLTypeToPrisma(e,t){switch(e.toLowerCase()){case"int":case"integer":case"serial":return"Int";case"bigint":case"bigserial":return"BigInt";case"varchar":case"character varying":case"text":case"char":case"character":case"uuid":default:return"String";case"boolean":case"bool":return"Boolean";case"real":case"float":case"float4":case"double":case"double precision":case"float8":return"Float";case"decimal":case"numeric":return"Decimal";case"date":return"Date";case"time":case"timetz":case"timestamp":case"timestamptz":return"DateTime";case"json":case"jsonb":return"Json"}}mapPrismaTypeToSQL(e){switch(e){case"Int":return"INTEGER";case"BigInt":return"BIGINT";case"String":default:return"VARCHAR";case"Boolean":return"BOOLEAN";case"Float":return"FLOAT";case"Decimal":return"DECIMAL";case"DateTime":return"TIMESTAMP";case"Date":return"DATE";case"Json":return"JSON";case"Bytes":return"BYTEA"}}formatPrismaDefaultValue(e,t){return e?t.toLowerCase().includes("char")||t.toLowerCase().includes("text")||"varchar"===t.toLowerCase()?`"${e.replace(/"/g,'\\"')}"`:e.includes("(")&&e.includes(")")||!isNaN(Number(e))?e:"true"===e.toLowerCase()||"false"===e.toLowerCase()?e.toLowerCase():"now()"===e.toLowerCase()?"now()":`"${e}"`:null}pascalCase(e){return e.split("_").map(e=>e.charAt(0).toUpperCase()+e.slice(1)).join("")}parsePrismaSchema(e){let t=[],a=e.split("\n"),r=null,i="";for(let e=0;e<a.length;e++){let s=a[e].trim();if(s.startsWith("///")){i=s.substring(3).trim();continue}if(s.startsWith("model ")){r={name:s.substring(6,s.indexOf("{")).trim(),fields:[],documentation:i},i="";continue}if("}"===s&&r){t.push(r),r=null;continue}if(r&&s&&!s.startsWith("}")&&!s.startsWith("model ")){let e=this.parseFieldLine(s);e&&(e.documentation=i,r.fields.push(e),i="")}}return t}parseFieldLine(e){if(e.startsWith("//"))return null;let t=e.split(/\s+/);if(t.length<2)return null;let a=t[0],r=t[1],i=!r.endsWith("?");i||(r=r.slice(0,-1));let s={name:a,type:r,required:i,isPrimary:e.includes("@id"),isUnique:e.includes("@unique"),isRelation:!1,isAutoIncrement:e.includes("@default(autoincrement())")},n=e.match(/@default\((.*?)\)/);return n&&(s.default=n[1]),s}}